import { z } from 'zod';

/** A MongoDB ObjectId as a 24-char hex string (path ids, `?appId=`). */
export const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

/** Query string of `GET /api/zaps`. */
export const listZapsQuerySchema = z.object({
  appId: objectIdSchema.optional(),
});

export type ListZapsQuery = z.infer<typeof listZapsQuerySchema>;
