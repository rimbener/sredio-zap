import { ZapRunModel, type ZapRunDocument } from '../models/zapRun.js';

/** The run's `error` text: GitHub's status and message for an Octokit error, else the message. */
export function runErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const status = typeof err === 'object' && err !== null ? (err as { status?: unknown }).status : undefined;
  return typeof status === 'number' ? `GitHub ${status}: ${message}` : message;
}

/** Marks a claimed run `success` with the posted comment's URL. */
export async function markRunSucceeded(run: ZapRunDocument, commentUrl: string): Promise<void> {
  await ZapRunModel.updateOne({ _id: run._id }, { status: 'success', output: { commentUrl }, error: null });
}

/** Marks a claimed run `failed`. The receiver still answers `200` (never `5xx`). */
export async function markRunFailed(run: ZapRunDocument, err: unknown): Promise<void> {
  await ZapRunModel.updateOne({ _id: run._id }, { status: 'failed', error: runErrorMessage(err) });
}
