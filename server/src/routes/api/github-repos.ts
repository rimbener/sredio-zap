import { Router } from 'express';
import { getTokenEncryptionKey } from '../../env.js';
import { octokitFor } from '../../github/octokit.js';
import { listAdminPublicRepos } from '../../github/repos.js';

/**
 * `GET /api/github/repos`: the session user's admin public repos as `RepoDto[]`
 * (API.md → GitHub helpers). Not cached; the builder loads it once and filters locally.
 * GitHub errors are mapped in `listAdminPublicRepos` (E3); ending the session on `401` is E2.
 */
export const githubReposRouter = Router();

githubReposRouter.get('/repos', async (req, res) => {
  const octokit = octokitFor(req.user!.accessToken, getTokenEncryptionKey());
  res.json(await listAdminPublicRepos(octokit));
});
