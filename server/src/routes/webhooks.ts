import express, { Router } from 'express';
import { decrypt } from '../crypto/token.js';
import { getTokenEncryptionKey } from '../env.js';
import { UnauthenticatedError } from '../errors/app-error.js';
import { ZapModel } from '../models/zap.js';
import { handlePullRequestOpened, parseOpenedPullRequest } from '../webhooks/handle-pull-request.js';
import { verifySignature } from '../webhooks/verify-signature.js';

// Mounted at `/webhooks` before `express.json()` (F3), so the HMAC is checked on the raw bytes.
export const webhooksRouter = Router();

const HOOK_ID = /^\d+$/;

/** `POST /webhooks/github` (API.md → Webhook receiver; Data-model.md → zapRuns). */
webhooksRouter.post('/github', express.raw({ type: 'application/json' }), async (req, res) => {
  // 1. Route by X-GitHub-Hook-ID; unknown hook or disabled Zap → 204, not recorded.
  const hookId = req.get('X-GitHub-Hook-ID');
  const zap = hookId && HOOK_ID.test(hookId)
    ? await ZapModel.findOne({ 'webhook.hookId': Number(hookId) })
    : null;
  if (!zap || !zap.enabled || !zap.webhook) {
    res.status(204).end();
    return;
  }

  // 2. Verify the signature on the raw body with the decrypted secret. A non-JSON
  //    Content-Type leaves the body unparsed, so it's checked as empty and fails.
  const key = getTokenEncryptionKey();
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  const secret = decrypt(zap.webhook.secret, key);
  if (!verifySignature(req.get('X-Hub-Signature-256'), secret, rawBody)) {
    throw new UnauthenticatedError('Invalid webhook signature');
  }

  // 3. Only pull_request.opened is processed (ping and other actions → 204, not recorded).
  let body: unknown = null;
  try {
    body = JSON.parse(rawBody.toString('utf8'));
  } catch {
    // A signed but unparseable body is ignored like any other non-matching event.
  }
  const payload = parseOpenedPullRequest(req.get('X-GitHub-Event'), body);
  const deliveryId = req.get('X-GitHub-Delivery');
  if (!payload || !deliveryId) {
    res.status(204).end();
    return;
  }

  // 4. Record the run and post the comment.
  await handlePullRequestOpened(zap, deliveryId, payload, key);
  res.status(200).end();
});
