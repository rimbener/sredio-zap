import { Octokit } from '@octokit/rest';

export interface FakeHooksOptions {
  /** Status for `POST /repos/{owner}/{repo}/hooks`; 201 returns hook `createdId`. */
  createStatus?: number;
  createdId?: number;
  /** Pages of `GET /repos/{owner}/{repo}/hooks` (hook id + `config.url`), or `'fail'` for an error. */
  hookPages?: Array<Array<{ id: number; url: string }>> | 'fail';
  /** Status of the list error when `hookPages` is `'fail'` (default 500). */
  listFailStatus?: number;
}

export interface FakeHooks {
  octokit: Octokit;
  /** `METHOD path?query` of every request, in order. */
  requests: string[];
}

/**
 * A real Octokit whose `fetch` serves canned hook responses, so `RequestError`s and
 * `Link`-header pagination behave like GitHub's (no HTTP mocking library needed).
 */
export function fakeHooksOctokit({ createStatus = 201, createdId = 1, hookPages = [[]], listFailStatus = 500 }: FakeHooksOptions = {}): FakeHooks {
  const requests: string[] = [];
  const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

  const fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    const method = (init?.method ?? 'GET').toUpperCase();
    requests.push(`${method} ${url.pathname}${url.search}`);
    if (!/^\/repos\/[^/]+\/[^/]+\/hooks$/.test(url.pathname)) return json(404, { message: 'Not Found' });

    if (method === 'POST') {
      return createStatus === 201
        ? json(201, { id: createdId })
        : json(createStatus, { message: 'Validation Failed', errors: [{ message: 'Hook already exists on this repository' }] });
    }
    if (hookPages === 'fail') return json(listFailStatus, { message: 'List failed' });
    const page = Number(url.searchParams.get('page') ?? '1');
    const hooks = (hookPages[page - 1] ?? []).map(({ id, url: hookUrl }) => ({ id, config: { url: hookUrl } }));
    const headers: Record<string, string> = {};
    if (page < hookPages.length) {
      const next = new URL(url);
      next.searchParams.set('page', String(page + 1));
      headers['link'] = `<${next.toString()}>; rel="next"`;
    }
    return json(200, hooks, headers);
  };

  const quiet = () => undefined;
  const log = { debug: quiet, info: quiet, warn: quiet, error: quiet };
  return { octokit: new Octokit({ auth: 'gho_fake', request: { fetch }, log }), requests };
}
