import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ZodError, type ZodIssue } from 'zod';
import { listZapsQuerySchema, objectIdSchema } from './object-id.js';
import { getStepConfigSchema } from './step-config.js';
import { createZapSchema, patchZapSchema, validateZap } from './zap.js';

const APP_ID = '0123456789abcdef01234567';

function validZap() {
  return {
    appId: APP_ID,
    name: 'Comment on new PRs',
    trigger: { app: 'github', event: 'pull_request.opened', config: { owner: 'octocat', repo: 'hello-world' } },
    action: { app: 'github', event: 'pull_request.comment', config: { body: 'Thanks @{{pr.author}}!' } },
  };
}

function issues(input: unknown): ZodIssue[] {
  const result = createZapSchema.safeParse(input);
  assert.equal(result.success, false, 'expected validation to fail');
  return result.success ? [] : result.error.issues;
}

function paths(input: unknown): string[] {
  return issues(input).map((i) => i.path.join('.'));
}

describe('objectIdSchema', () => {
  it('accepts 24 hex chars', () => {
    assert.equal(objectIdSchema.safeParse(APP_ID).success, true);
    assert.equal(objectIdSchema.safeParse(APP_ID.toUpperCase()).success, true);
  });

  it('rejects other strings', () => {
    for (const id of ['abc', '', `${APP_ID}0`, 'zzzzzzzzzzzzzzzzzzzzzzzz', 12]) {
      assert.equal(objectIdSchema.safeParse(id).success, false, String(id));
    }
  });

  it('validates the ?appId= query', () => {
    assert.equal(listZapsQuerySchema.safeParse({}).success, true);
    assert.equal(listZapsQuerySchema.safeParse({ appId: APP_ID }).success, true);
    assert.equal(listZapsQuerySchema.safeParse({ appId: 'abc' }).success, false);
  });
});

describe('step config registry', () => {
  it('knows the trigger and action pairs, by kind', () => {
    assert.ok(getStepConfigSchema('trigger', 'github', 'pull_request.opened'));
    assert.ok(getStepConfigSchema('action', 'github', 'pull_request.comment'));
    assert.equal(getStepConfigSchema('trigger', 'github', 'pull_request.comment'), undefined);
    assert.equal(getStepConfigSchema('action', 'github', 'pull_request.opened'), undefined);
    assert.equal(getStepConfigSchema('trigger', 'toString', 'constructor'), undefined);
  });
});

describe('createZapSchema', () => {
  it('accepts a valid Zap', () => {
    assert.deepEqual(createZapSchema.parse(validZap()), validZap());
  });

  describe('github / pull_request.opened config', () => {
    it('rejects a missing or empty owner / repo', () => {
      const zap = validZap();
      zap.trigger.config = { owner: '', repo: 'x' };
      assert.deepEqual(paths(zap), ['trigger.config.owner']);
      (zap.trigger.config as Record<string, unknown>) = { owner: 'octocat' };
      assert.deepEqual(paths(zap), ['trigger.config.repo']);
    });

    it('rejects a non-string repo', () => {
      const zap = validZap();
      (zap.trigger.config as Record<string, unknown>) = { owner: 'octocat', repo: 42 };
      assert.deepEqual(paths(zap), ['trigger.config.repo']);
    });

    it('strips unknown config keys', () => {
      const zap = validZap();
      (zap.trigger.config as Record<string, unknown>) = { owner: 'octocat', repo: 'hello-world', extra: 1 };
      assert.deepEqual(createZapSchema.parse(zap).trigger.config, { owner: 'octocat', repo: 'hello-world' });
    });
  });

  describe('github / pull_request.comment config', () => {
    it('rejects a missing or empty body', () => {
      const zap = validZap();
      zap.action.config = { body: '' };
      assert.deepEqual(paths(zap), ['action.config.body']);
      (zap.action.config as Record<string, unknown>) = {};
      assert.deepEqual(paths(zap), ['action.config.body']);
    });

    it('accepts a 65,536-char body and rejects 65,537', () => {
      const zap = validZap();
      zap.action.config = { body: 'a'.repeat(65536) };
      assert.equal(createZapSchema.safeParse(zap).success, true);
      zap.action.config = { body: 'a'.repeat(65537) };
      assert.deepEqual(paths(zap), ['action.config.body']);
    });

    it('counts UTF-16 units, so an emoji counts as 2', () => {
      const zap = validZap();
      zap.action.config = { body: '😀'.repeat(32768) }; // 65,536 units
      assert.equal(createZapSchema.safeParse(zap).success, true);
      zap.action.config = { body: `${'😀'.repeat(32768)}a` }; // 65,537 units, 32,769 code points
      assert.deepEqual(paths(zap), ['action.config.body']);
    });
  });

  describe('unknown app + event pairs', () => {
    it('rejects an unknown trigger pair', () => {
      const zap = validZap();
      zap.trigger.event = 'push';
      assert.deepEqual(paths(zap), ['trigger.event']);
    });

    it('rejects an unknown action pair', () => {
      const zap = validZap();
      zap.action.app = 'slack';
      assert.deepEqual(paths(zap), ['action.event']);
    });

    it('rejects an action pair used as the trigger', () => {
      const zap = validZap();
      zap.trigger = { app: 'github', event: 'pull_request.comment', config: { body: 'x' } } as never;
      assert.deepEqual(paths(zap), ['trigger.event']);
    });

    it('rejects prototype keys as app or event', () => {
      const zap = validZap();
      zap.trigger.app = '__proto__';
      assert.deepEqual(paths(zap), ['trigger.event']);
    });
  });

  describe('name', () => {
    it('accepts 1 and 100 chars', () => {
      for (const name of ['a', 'a'.repeat(100)]) {
        assert.equal(createZapSchema.safeParse({ ...validZap(), name }).success, true);
      }
    });

    it('rejects empty and 101 chars', () => {
      for (const name of ['', 'a'.repeat(101)]) {
        assert.deepEqual(paths({ ...validZap(), name }), ['name']);
      }
    });
  });

  describe('tokens', () => {
    it('accepts every known token', () => {
      const zap = validZap();
      zap.action.config = {
        body: '{{pr.number}} {{pr.title}} {{pr.body}} {{pr.url}} {{pr.author}} {{repo.name}} {{repo.fullName}}',
      };
      assert.equal(createZapSchema.safeParse(zap).success, true);
    });

    it('rejects an unknown token with an "Unknown field" message', () => {
      const zap = validZap();
      zap.action.config = { body: 'Hi {{pr.author}} {{pr.nope}}' };
      const [issue, ...rest] = issues(zap);
      assert.equal(rest.length, 0);
      assert.deepEqual(issue.path, ['action', 'config', 'body']);
      assert.equal(issue.message, 'Unknown field {{pr.nope}}');
    });

    it('reports each unknown token once', () => {
      const zap = validZap();
      zap.action.config = { body: '{{a}} {{b}} {{a}}' };
      assert.deepEqual(
        issues(zap).map((i) => i.message),
        ['Unknown field {{a}}', 'Unknown field {{b}}'],
      );
    });

    it('rejects tokens with spaces inside the braces', () => {
      const zap = validZap();
      zap.action.config = { body: '{{ pr.author }}' };
      assert.deepEqual(paths(zap), ['action.config.body']);
    });

    it('does not treat unbalanced braces as tokens', () => {
      const zap = validZap();
      zap.action.config = { body: 'Hi {{pr.nope} and {x}}' };
      assert.equal(createZapSchema.safeParse(zap).success, true);
    });
  });

  it('rejects a missing field', () => {
    const { action: _action, ...rest } = validZap();
    assert.deepEqual(paths(rest), ['action']);
  });

  it('rejects an invalid appId', () => {
    assert.deepEqual(paths({ ...validZap(), appId: 'abc' }), ['appId']);
  });
});

describe('patchZapSchema', () => {
  it('accepts any subset of the fields', () => {
    assert.equal(patchZapSchema.safeParse({}).success, true);
    assert.equal(patchZapSchema.safeParse({ name: 'Renamed' }).success, true);
    assert.equal(patchZapSchema.safeParse({ action: validZap().action }).success, true);
  });

  it('still checks the shape of sent fields', () => {
    assert.equal(patchZapSchema.safeParse({ name: '' }).success, false);
    assert.equal(patchZapSchema.safeParse({ appId: 'abc' }).success, false);
    assert.equal(patchZapSchema.safeParse({ trigger: { app: 'github' } }).success, false);
  });
});

describe('validateZap', () => {
  it('returns the parsed merged Zap', () => {
    const stored = validZap();
    const patch = patchZapSchema.parse({ name: 'Renamed' });
    assert.equal(validateZap({ ...stored, ...patch }).name, 'Renamed');
  });

  it('ignores stored fields outside the input shape', () => {
    const merged = { ...validZap(), enabled: true, id: APP_ID };
    assert.deepEqual(validateZap(merged), validZap());
  });

  it('checks tokens against the merged trigger', () => {
    const stored = validZap();
    const patch = { action: { app: 'github', event: 'pull_request.comment', config: { body: '{{issue.title}}' } } };
    assert.throws(() => validateZap({ ...stored, ...patch }), ZodError);
  });

  it('throws a ZodError for an unknown pair', () => {
    const merged = { ...validZap(), trigger: { app: 'github', event: 'push', config: {} } };
    assert.throws(() => validateZap(merged), (err: unknown) => {
      assert.ok(err instanceof ZodError);
      assert.deepEqual(err.issues.map((i) => i.path.join('.')), ['trigger.event']);
      return true;
    });
  });
});
