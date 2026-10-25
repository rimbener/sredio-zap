import type { AppDto } from './dto.js';

/** An `apps` document as seeded (Data-model.md → `apps`). */
export type AppSeed = Omit<AppDto, 'id'>;

/** The app catalog; `npm run seed -w server` upserts it by `key`. */
export const APPS_SEED: readonly AppSeed[] = [
  {
    key: 'github',
    name: 'GitHub',
    icon: 'assets/apps/github.svg',
    status: 'available',
    order: 1,
    triggers: [
      {
        key: 'pull_request.opened',
        name: 'Pull request opened',
        description: 'Triggers when a pull request is opened in a repository.',
      },
    ],
    actions: [
      {
        key: 'pull_request.comment',
        name: 'Comment on the pull request',
        description: 'Posts a comment on the pull request that triggered the Zap.',
      },
    ],
  },
  { key: 'gitlab', name: 'GitLab', icon: 'assets/apps/gitlab.svg', status: 'coming_soon', order: 2, triggers: [], actions: [] },
  { key: 'jira', name: 'Jira', icon: 'assets/apps/jira.svg', status: 'coming_soon', order: 3, triggers: [], actions: [] },
  { key: 'linear', name: 'Linear', icon: 'assets/apps/linear.svg', status: 'coming_soon', order: 4, triggers: [], actions: [] },
  { key: 'slack', name: 'Slack', icon: 'assets/apps/slack.svg', status: 'coming_soon', order: 5, triggers: [], actions: [] },
];
