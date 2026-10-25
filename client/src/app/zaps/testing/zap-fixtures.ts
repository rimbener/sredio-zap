import type { AppDto, ZapDto } from '@zaps/shared';

/** Test fixtures for Zap specs (only imported by `*.spec.ts`, so not part of the app bundle). */
export const GITHUB_APP: AppDto = {
  id: '0123456789abcdef01234567',
  key: 'github',
  name: 'GitHub',
  icon: 'assets/apps/github.svg',
  status: 'available',
  order: 1,
  triggers: [{ key: 'pull_request.opened', name: 'Pull request opened', description: '' }],
  actions: [{ key: 'pull_request.comment', name: 'Comment on the pull request', description: '' }],
};

export function makeZap(overrides: Partial<ZapDto> = {}): ZapDto {
  return {
    id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    appId: GITHUB_APP.id,
    name: 'Thank PRs',
    enabled: false,
    trigger: { app: 'github', event: 'pull_request.opened', config: { owner: 'acme', repo: 'api' } },
    action: { app: 'github', event: 'pull_request.comment', config: { body: 'Thanks!' } },
    createdAt: '2026-10-20T10:00:00.000Z',
    updatedAt: '2026-10-25T10:00:00.000Z',
    ...overrides,
  };
}
