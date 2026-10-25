import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import type { ApiErrorEnvelope, ValidationIssue } from '@zaps/shared';
import type { Types } from 'mongoose';
import request from 'supertest';
import { createApp } from '../../../app.js';
import { AppModel } from '../../../models/app.js';
import type { UserDocument } from '../../../models/user.js';
import { ZapModel, type ZapDocument } from '../../../models/zap.js';
import { seedApps } from '../../../scripts/seed-apps.js';
import { useTestDb } from '../../../test/db.js';
import { createTestUser } from '../../../test/users.js';
import { createTestZap } from '../../../test/zaps.js';

useTestDb();

/**
 * End-to-end validation of the Zap write routes (E8): every rule from API.md → Zaps →
 * Validation returns `400 VALIDATION_ERROR` with zod-issue `details[].path`, which the
 * builder maps to its fields; writes without `application/json` return `415`.
 */

const SAVED_BODY = 'Thanks @{{pr.author}} for opening this pull request!';

type Zap = {
  appId: string;
  name: string;
  trigger: { app: string; event: string; config: Record<string, unknown> };
  action: { app: string; event: string; config: Record<string, unknown> };
};

/** One invalid change and the `details[].path` it must produce. */
type Rule = { name: string; change: (zap: Zap, ids: { gitlab: string }) => Partial<Zap>; path: string[] };

const RULES: Rule[] = [
  { name: 'name of 101 chars', change: () => ({ name: 'a'.repeat(101) }), path: ['name'] },
  { name: 'empty name', change: () => ({ name: '' }), path: ['name'] },
  {
    name: 'empty repo',
    change: (zap) => ({ trigger: { ...zap.trigger, config: { owner: 'octocat', repo: '' } } }),
    path: ['trigger', 'config', 'repo'],
  },
  {
    name: 'empty body',
    change: (zap) => ({ action: { ...zap.action, config: { body: '' } } }),
    path: ['action', 'config', 'body'],
  },
  {
    name: 'body of 65,537 chars',
    change: (zap) => ({ action: { ...zap.action, config: { body: 'a'.repeat(65537) } } }),
    path: ['action', 'config', 'body'],
  },
  {
    name: 'unknown token',
    change: (zap) => ({ action: { ...zap.action, config: { body: 'Hi {{pr.nope}}' } } }),
    path: ['action', 'config', 'body'],
  },
  {
    name: 'unknown trigger app + event',
    change: (zap) => ({ trigger: { ...zap.trigger, event: 'push' } }),
    path: ['trigger', 'event'],
  },
  {
    name: 'unknown action app + event',
    change: (zap) => ({ action: { ...zap.action, event: 'issue.comment' } }),
    path: ['action', 'event'],
  },
  {
    name: 'appId of another app (mismatch with trigger.app)',
    change: (_zap, ids) => ({ appId: ids.gitlab }),
    path: ['appId'],
  },
  {
    name: 'appId of no app',
    change: () => ({ appId: '0123456789abcdef01234567' }),
    path: ['appId'],
  },
];

function issuesOf(res: request.Response): ValidationIssue[] {
  const body = res.body as ApiErrorEnvelope;
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.equal(body.error.code, 'VALIDATION_ERROR');
  assert.equal(typeof body.error.message, 'string');
  assert.ok(Array.isArray(body.error.details), 'details is an array of zod issues');
  const issues = body.error.details as ValidationIssue[];
  for (const issue of issues) {
    assert.ok(Array.isArray(issue.path));
    assert.equal(typeof issue.message, 'string');
  }
  return issues;
}

describe('Zap validation end to end (POST/PATCH /api/zaps)', () => {
  let user: UserDocument;
  let app: ReturnType<typeof createApp>;
  let githubId: Types.ObjectId;
  let ids: { gitlab: string };
  let zap: ZapDocument;

  function validZap(): Zap {
    return {
      appId: githubId.toString(),
      name: 'Comment on new PRs',
      trigger: { app: 'github', event: 'pull_request.opened', config: { owner: 'octocat', repo: 'hello-world' } },
      action: { app: 'github', event: 'pull_request.comment', config: { body: SAVED_BODY } },
    };
  }

  beforeEach(async () => {
    await seedApps();
    githubId = (await AppModel.findOne({ key: 'github' }).orFail())._id;
    ids = { gitlab: (await AppModel.findOne({ key: 'gitlab' }).orFail())._id.toString() };
    user = await createTestUser();
    app = createApp({ authenticateAs: () => user });
    zap = await createTestZap(user._id, { appId: githubId });
  });

  for (const rule of RULES) {
    it(`POST with ${rule.name} → 400 at ${rule.path.join('.')}, nothing saved`, async () => {
      const before = await ZapModel.countDocuments();
      const base = validZap();
      const res = await request(app)
        .post('/api/zaps')
        .send({ ...base, ...rule.change(base, ids) });
      assert.deepEqual(
        issuesOf(res).map((issue) => issue.path),
        [rule.path],
      );
      assert.equal(await ZapModel.countDocuments(), before);
    });

    it(`PATCH with ${rule.name} → 400 at ${rule.path.join('.')}, Zap unchanged`, async () => {
      const res = await request(app)
        .patch(`/api/zaps/${zap._id.toString()}`)
        .send(rule.change(validZap(), ids));
      assert.deepEqual(
        issuesOf(res).map((issue) => issue.path),
        [rule.path],
      );
      const stored = await ZapModel.findById(zap._id).orFail();
      assert.equal(stored.name, 'Comment on new PRs');
      assert.equal(stored.appId.toString(), githubId.toString());
      assert.deepEqual(stored.action.config, { body: SAVED_BODY });
    });
  }

  it('reports every failing field at once', async () => {
    const base = validZap();
    const res = await request(app)
      .post('/api/zaps')
      .send({ ...base, name: '', action: { ...base.action, config: { body: '' } } });
    const paths = issuesOf(res).map((issue) => issue.path.join('.'));
    assert.deepEqual(paths.sort(), ['action.config.body', 'name']);
  });

  it('an unknown token names the token in the message', async () => {
    const base = validZap();
    const res = await request(app)
      .post('/api/zaps')
      .send({ ...base, action: { ...base.action, config: { body: 'Hi {{pr.nope}}' } } });
    const [issue] = issuesOf(res);
    assert.match(issue!.message, /pr\.nope/);
  });

  describe('415 without application/json', () => {
    const writes: { name: string; send: (path: string) => request.Test }[] = [
      { name: 'POST /api/zaps', send: () => request(app).post('/api/zaps') },
      { name: 'PATCH /api/zaps/:id', send: (path) => request(app).patch(path) },
      { name: 'POST /api/zaps/:id/enable', send: (path) => request(app).post(`${path}/enable`) },
      { name: 'POST /api/zaps/:id/disable', send: (path) => request(app).post(`${path}/disable`) },
    ];

    for (const write of writes) {
      it(`${write.name} with text/plain → 415 UNSUPPORTED_MEDIA_TYPE`, async () => {
        const res = await write
          .send(`/api/zaps/${zap._id.toString()}`)
          .set('Content-Type', 'text/plain')
          .send(JSON.stringify(validZap()));
        assert.equal(res.status, 415);
        assert.equal((res.body as ApiErrorEnvelope).error.code, 'UNSUPPORTED_MEDIA_TYPE');
        const stored = await ZapModel.findById(zap._id).orFail();
        assert.equal(stored.enabled, false);
        assert.equal(stored.name, 'Comment on new PRs');
      });
    }

    it('a form-encoded POST /api/zaps → 415 and nothing saved', async () => {
      const before = await ZapModel.countDocuments();
      const res = await request(app).post('/api/zaps').type('form').send({ name: 'x' });
      assert.equal(res.status, 415);
      assert.equal(await ZapModel.countDocuments(), before);
    });
  });
});
