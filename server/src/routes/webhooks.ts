import { Router } from 'express';

// Mount point for `/webhooks` (F3), mounted before `express.json()`.
// S10 fills this file with `POST /github` using `express.raw({ type: 'application/json' })`,
// so the `X-Hub-Signature-256` HMAC is checked on the raw bytes.
export const webhooksRouter = Router();
