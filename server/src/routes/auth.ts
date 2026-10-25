import { Router } from 'express';

// Mount point for `/auth` (F3). S1 fills this file with the GitHub OAuth routes,
// S2 appends `POST /auth/logout` (with `requireJson`), E1 changes the failure redirect.
export const authRouter = Router();
