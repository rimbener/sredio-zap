import type { Octokit } from '@octokit/rest';
import type { RepoDto } from '@zaps/shared';
import { mapGithubError } from './errors.js';

const PER_PAGE = 100;

/** True when a GitHub `Link` header points at another page. */
function hasNextPage(link: string | undefined): boolean {
  return link?.split(',').some((part) => /rel="next"/.test(part)) ?? false;
}

/**
 * The user's public repos where they're an admin (needed to add a webhook), in GitHub's
 * order (most recently pushed first). Follows every page (API.md → GitHub helpers).
 * GitHub `401` → `GITHUB_AUTH_REQUIRED`; any other failure → `GITHUB_ERROR`.
 */
export async function listAdminPublicRepos(octokit: Octokit): Promise<RepoDto[]> {
  const repos: RepoDto[] = [];
  for (let page = 1; ; page++) {
    const { data, headers } = await octokit.rest.repos
      .listForAuthenticatedUser({
        visibility: 'public',
        affiliation: 'owner,collaborator,organization_member',
        sort: 'pushed',
        per_page: PER_PAGE,
        page,
      })
      // `REPO_NOT_ACCESSIBLE` doesn't apply to a list (API.md → GitHub helpers).
      .catch((err: unknown) => {
        throw mapGithubError(err, { repoAccess: false });
      });
    for (const repo of data) {
      if (repo.permissions?.admin !== true) continue;
      repos.push({
        owner: repo.owner.login,
        repo: repo.name,
        fullName: repo.full_name,
        htmlUrl: repo.html_url,
      });
    }
    if (!hasNextPage(headers.link)) return repos;
  }
}
