import { Router } from 'express';

// ---- Zap slice router imports: one line per slice -------------------------------------
import { listZapsRouter } from './list.js';              // S3
// import { createZapRouter } from './create.js';        // S5
// import { getUpdateZapRouter } from './get-update.js'; // S7
// import { toggleZapRouter } from './toggle.js';        // S8
// import { deleteZapRouter } from './delete.js';        // S9
import { zapRunsRouter } from './runs.js';               // E12
// ---- end zap slice router imports -----------------------------------------------------

/**
 * `/api/zaps`. Each Zap slice exports its own `Router` (paths relative to `/api/zaps`) and
 * registers it here with one line. Shared helpers live in `src/zaps/`.
 */
export const zapsRouter = Router();

// ---- Zap slice registrations: one line per slice ----------------------------------------
zapsRouter.use(listZapsRouter);        // S3
// zapsRouter.use(createZapRouter);    // S5
// zapsRouter.use(getUpdateZapRouter); // S7
// zapsRouter.use(toggleZapRouter);    // S8
// zapsRouter.use(deleteZapRouter);    // S9
zapsRouter.use(zapRunsRouter);         // E12
// ---- end zap slice registrations --------------------------------------------------------
