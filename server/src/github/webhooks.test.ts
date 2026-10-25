import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { Octokit } from '@octokit/rest';
import { getOctokit, resetOctokitFactory, setOctokitFactory } from './octokit.js';
import { buildHookBody, createWebhook, removeWebhook } from './webhooks.js';

const WEBHOOK_URL = 'https://smee.io/abc123';
const ZAP_ID = '65f0c0ffee0000000000abcd';

interface Call {
  method: string;
  params: Record<string, unknown>;
}

/** A fake Octokit that records calls and returns canned responses. */
function fakeOctokit(hookId = 4242): { octokit: Octokit; calls: Call[] } {
  const calls: Call[] = [];
  const repos = {
    createWebhook: async (params: Record<string, unknown>) => {
      calls.push({ method: 'repos.createWebhook', params });
      return { status: 201, data: { id: hookId } };
    },
    deleteWebhook: async (params: Record<string, unknown>) => {
      calls.push({ method: 'repos.deleteWebhook', params });
      return { status: 204, data: undefined };
    },
  };
  return { octokit: { rest: { repos } } as unknown as Octokit, calls };
}

describe('buildHookBody', () => {
  it('matches the API.md hook body', () => {
    assert.deepEqual(buildHookBody(ZAP_ID, 's3cret', WEBHOOK_URL), {
      active: true,
      events: ['pull_request'],
      config: {
        url: `${WEBHOOK_URL}?zap=${ZAP_ID}`,
        content_type: 'json',
        secret: 's3cret',
        insecure_ssl: '0',
      },
    });
  });
});

describe('createWebhook', () => {
  afterEach(() => resetOctokitFactory());

  it('calls repos.createWebhook with the hook body and returns its id and secret', async () => {
    const { octokit, calls } = fakeOctokit(4242);
    setOctokitFactory(() => octokit);

    const result = await createWebhook(getOctokit('gho_token'), {
      owner: 'acme',
      repo: 'api',
      zapId: ZAP_ID,
      webhookPublicUrl: WEBHOOK_URL,
    });

    assert.equal(result.hookId, 4242);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, 'repos.createWebhook');
    assert.deepEqual(calls[0].params, {
      owner: 'acme',
      repo: 'api',
      ...buildHookBody(ZAP_ID, result.secret, WEBHOOK_URL),
    });
  });

  it('uses a fresh 32-byte random secret on every create', async () => {
    const { octokit } = fakeOctokit();
    const params = { owner: 'acme', repo: 'api', zapId: ZAP_ID, webhookPublicUrl: WEBHOOK_URL };
    const a = await createWebhook(octokit, params);
    const b = await createWebhook(octokit, params);

    for (const { secret } of [a, b]) {
      assert.match(secret, /^[0-9a-f]{64}$/);
      assert.equal(Buffer.from(secret, 'hex').length, 32);
    }
    assert.notEqual(a.secret, b.secret);
  });
});

describe('removeWebhook', () => {
  it('calls repos.deleteWebhook with the hook id', async () => {
    const { octokit, calls } = fakeOctokit();
    await removeWebhook(octokit, { owner: 'acme', repo: 'api', hookId: 4242 });
    assert.deepEqual(calls, [
      { method: 'repos.deleteWebhook', params: { owner: 'acme', repo: 'api', hook_id: 4242 } },
    ]);
  });

  for (const status of [404, 401, 403, 500]) {
    it(`swallows a GitHub ${status} (best-effort, never throws)`, async () => {
      const octokit = {
        rest: {
          repos: {
            deleteWebhook: async () => {
              throw Object.assign(new Error(`GitHub ${status}`), { status });
            },
          },
        },
      } as unknown as Octokit;
      await removeWebhook(octokit, { owner: 'acme', repo: 'api', hookId: 4242 });
    });
  }

  it('swallows a network failure with no status', async () => {
    const octokit = {
      rest: { repos: { deleteWebhook: async () => Promise.reject(new TypeError('fetch failed')) } },
    } as unknown as Octokit;
    await removeWebhook(octokit, { owner: 'acme', repo: 'api', hookId: 4242 });
  });
});
