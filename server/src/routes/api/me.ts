import type { UserDto } from '@zaps/shared';
import { Router } from 'express';
import type { UserDocument } from '../../models/user.js';

/** Maps a user document to `UserDto`; never exposes `githubId` or `accessToken`. */
export function toUserDto(user: UserDocument): UserDto {
  return {
    id: user._id.toString(),
    login: user.login,
    name: user.name ?? null,
    avatarUrl: user.avatarUrl,
  };
}

/** `GET /api/me`: the signed-in user (API.md → Current user). `requireAuth` sends the 401. */
export const meRouter = Router();

meRouter.get('/', (req, res) => {
  res.json(toUserDto(req.user as UserDocument));
});
