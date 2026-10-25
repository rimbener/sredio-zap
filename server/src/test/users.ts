import { UserModel, type UserDocument } from '../models/user.js';

let nextGithubId = 1000;

/**
 * Inserts a user for tests. The access token is a placeholder `EncryptedValue`, not a real
 * encryption; tests that decrypt it should store one made with the token crypto helper.
 */
export async function createTestUser(overrides: Partial<{
  githubId: number;
  login: string;
  name: string | null;
  avatarUrl: string;
}> = {}): Promise<UserDocument> {
  const githubId = overrides.githubId ?? nextGithubId++;
  return UserModel.create({
    githubId,
    login: overrides.login ?? `user${githubId}`,
    name: overrides.name === undefined ? `User ${githubId}` : overrides.name,
    avatarUrl: overrides.avatarUrl ?? `https://avatars.githubusercontent.com/u/${githubId}`,
    accessToken: { iv: 'aXY=', authTag: 'dGFn', ciphertext: 'Y2lwaGVy' },
  });
}
