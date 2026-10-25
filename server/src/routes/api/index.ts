import { Router } from 'express';
import { requireAuth } from '../../middleware/require-auth.js';
import { requireJsonOnWrites } from '../../middleware/require-json.js';

// ---- Slice router imports: one line per slice ----------------------------------------
import { appsRouter } from './apps.js';                   // F4
import { zapsRouter } from './zaps/index.js';             // F4 (zap slices register there)
import { meRouter } from './me.js';                       // S1
import { githubReposRouter } from './github-repos.js';    // S5
// ---- end slice router imports ---------------------------------------------------------

/**
 * The `/api` router: session required, `requireJson` on POST/PATCH, then the slice routes.
 * Slices don't edit `app.ts`; they add one import and one registration line here.
 */
export function createApiRouter(): Router {
  const router = Router();

  router.use(requireAuth);
  router.use(requireJsonOnWrites);

  // ---- Slice registrations: one line per slice --------------------------------------
  router.use('/apps', appsRouter);             // F4
  router.use('/zaps', zapsRouter);             // F4
  router.use('/me', meRouter);                 // S1
  router.use('/github', githubReposRouter);    // S5
  // ---- end slice registrations ------------------------------------------------------

  return router;
}
