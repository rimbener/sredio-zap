import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import type { Types } from 'mongoose';
import request from 'supertest';
import { createApp } from '../../../app.js';
import { decrypt, encrypt, type EncryptedValue } from '../../../crypto/token.js';
import { getTokenEncryptionKey } from '../../../env.js';
import { resetOctokitFactory, setOctokitFactory } from '../../../github/octokit.js';
import { AppModel } from '../../../models/app.js';
import type { UserDocument } from '../../../models/user.js';
import { ZapModel, type ZapDocument } from '../../../models/zap.js';
import { seedApps } from '../../../scripts/seed-apps.js';
import { useTestDb } from '../../../test/db.js';
import { TEST_ENV } from '../../../test/env.js';
import { fakeHooksOctokit, type FakeHooks, type FakeHooksOptions } from '../../../test/fake-github-hooks.js';
import { createTestUser } from '../../../test/users.js';
import { createTestZap, testWebhook } from '../../../test/zaps.js';

useTestDb();

const OLD_HOOK_ID = 111;
const NEW_HOOK_ID = 222;
const trigger = (owner: string, repo: string) => ({
  app: 'github',
  event: 'pull_request.opened',
  config: { owner, repo },
});

/** E6: PATCH on an enabled Zap that changes the trigger repo (API.md → Side effects). */
describe('PATCH /api/zaps/:id: repo move on an enabled Zap', () => {
  let user: UserDocument;
  let app: ReturnType<typeof createApp>;
  let githubId: Types.ObjectId;
  let zap: ZapDocument;
  let gh: FakeHooks;

  beforeEach(async () => {
    await seedApps();
    githubId = (await AppModel.findOne({ key: 'github' }).orFail())._id;
    user = await createTestUser();
    user.accessToken = encrypt('gho_owner_token', getTokenEncryptionKey()) as never;
    await user.save();
    app = createApp({ authenticateAs: () => user });
    zap = await createTestZap(user._id, {
      appId: githubId,
      enabled: true,
      owner: 'acme',
      repo: 'api',
      webhook: testWebhook(OLD_HOOK_ID),
    });
  });

  afterEach(() => {
    resetOctokitFactory();
    mock.restoreAll();
  });

  function useGithub(options: FakeHooksOptions = {}) {
    gh = fakeHooksOctokit({ createdId: NEW_HOOK_ID, ...options });
    setOctokitFactory(() => gh.octokit);
  }

  const patch = (body: object) => request(app).patch(`/api/zaps/${zap._id.toString()}`).send(body);
  const stored = () => ZapModel.findById(zap._id).orFail();
  const calls = () => gh.requests.map((r) => r.split('?')[0]);

  async function assertUnchanged() {
    const s = await stored();
    assert.equal(s.enabled, true);
    assert.deepEqual(s.trigger.config, { owner: 'acme', repo: 'api' });
    assert.equal(s.webhook?.hookId, OLD_HOOK_ID);
  }

  it('creates the new hook, saves the Zap, then removes the old hook, in that order', async () => {
    useGithub();
    const originalSave = ZapModel.prototype.save;
    mock.method(ZapModel.prototype, 'save', function (this: ZapDocument, ...args: unknown[]) {
      gh.requests.push('save');
      return originalSave.apply(this, args as never);
    });

    const res = await patch({ name: 'Moved', trigger: trigger('acme', 'web') });

    assert.equal(res.status, 200);
    assert.equal(res.body.enabled, true);
    assert.deepEqual(res.body.trigger.config, { owner: 'acme', repo: 'web' });
    assert.equal(res.body.name, 'Moved');
    assert.equal('webhook' in res.body, false);
    assert.deepEqual(calls(), ['POST /repos/acme/web/hooks', 'save', `DELETE /repos/acme/api/hooks/${OLD_HOOK_ID}`]);

    const s = await stored();
    assert.equal(s.enabled, true);
    assert.deepEqual(s.trigger.config, { owner: 'acme', repo: 'web' });
    assert.equal(s.webhook?.hookId, NEW_HOOK_ID);
    assert.match(decrypt(s.webhook!.secret as EncryptedValue, getTokenEncryptionKey()), /^[0-9a-f]{64}$/);
  });

  it("409 WEBHOOK_EXISTS when the new repo has this Zap's leftover hook: nothing saved, old hook kept", async () => {
    useGithub({
      createStatus: 422,
      hookPages: [[{ id: 987, url: `${TEST_ENV.WEBHOOK_PUBLIC_URL}?zap=${zap._id.toString()}` }]],
    });
    const res = await patch({ trigger: trigger('acme', 'web') });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'WEBHOOK_EXISTS');
    assert.deepEqual(res.body.error.details, { hookSettingsUrl: 'https://github.com/acme/web/settings/hooks/987' });
    assert.ok(!calls().some((c) => c.startsWith('DELETE')));
    await assertUnchanged();
  });

  it('422 REPO_NOT_ACCESSIBLE when GitHub refuses the new repo: nothing saved, old hook kept', async () => {
    useGithub({ createStatus: 404 });
    const res = await patch({ name: 'Not saved', trigger: trigger('acme', 'private') });
    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, 'REPO_NOT_ACCESSIBLE');
    assert.deepEqual(calls(), ['POST /repos/acme/private/hooks']);
    await assertUnchanged();
    assert.equal((await stored()).name, 'Comment on new PRs');
  });

  it('502 GITHUB_ERROR when GitHub fails the create: nothing saved, old hook kept', async () => {
    useGithub({ createStatus: 500 });
    const res = await patch({ trigger: trigger('acme', 'web') });
    assert.equal(res.status, 502);
    assert.equal(res.body.error.code, 'GITHUB_ERROR');
    assert.ok(!calls().some((c) => c.startsWith('DELETE')));
    await assertUnchanged();
  });

  it('save failure → removes the new hook (not the old one) and returns 500', async () => {
    useGithub();
    mock.method(ZapModel.prototype, 'save', async () => {
      throw new Error('write failed');
    });
    const res = await patch({ trigger: trigger('acme', 'web') });
    mock.restoreAll();

    assert.equal(res.status, 500);
    assert.equal(res.body.error.code, 'INTERNAL_ERROR');
    assert.deepEqual(calls(), ['POST /repos/acme/web/hooks', `DELETE /repos/acme/web/hooks/${NEW_HOOK_ID}`]);
    await assertUnchanged();
  });

  it('old-hook removal failure still returns 200 with the new hook stored', async () => {
    useGithub({ deleteStatus: 500 });
    const res = await patch({ trigger: trigger('acme', 'web') });
    assert.equal(res.status, 200);
    assert.deepEqual(calls(), ['POST /repos/acme/web/hooks', `DELETE /repos/acme/api/hooks/${OLD_HOOK_ID}`]);
    const s = await stored();
    assert.deepEqual(s.trigger.config, { owner: 'acme', repo: 'web' });
    assert.equal(s.webhook?.hookId, NEW_HOOK_ID);
  });

  it('changing only the comment makes no GitHub calls', async () => {
    useGithub();
    const res = await patch({ action: { app: 'github', event: 'pull_request.comment', config: { body: 'Hi' } } });
    assert.equal(res.status, 200);
    assert.equal(res.body.action.config.body, 'Hi');
    assert.deepEqual(gh.requests, []);
    assert.equal((await stored()).webhook?.hookId, OLD_HOOK_ID);
  });

  it('a case-only repo change is not a move: no GitHub calls', async () => {
    useGithub();
    const res = await patch({ trigger: trigger('ACME', 'Api') });
    assert.equal(res.status, 200);
    assert.deepEqual(gh.requests, []);
    assert.equal((await stored()).webhook?.hookId, OLD_HOOK_ID);
  });

  it('a repo change on a disabled Zap makes no GitHub calls', async () => {
    await ZapModel.updateOne({ _id: zap._id }, { enabled: false, webhook: null });
    useGithub();
    const res = await patch({ trigger: trigger('acme', 'web') });
    assert.equal(res.status, 200);
    assert.deepEqual(gh.requests, []);
    const s = await stored();
    assert.deepEqual(s.trigger.config, { owner: 'acme', repo: 'web' });
    assert.equal(s.webhook, null);
  });
});
