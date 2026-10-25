import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { useTestDb } from '../test/db.js';
import { createTestUser } from '../test/users.js';
import { UserModel } from './user.js';

useTestDb();

describe('User model', () => {
  it('stores the profile, an encrypted token subdocument and timestamps', async () => {
    const user = await createTestUser({ githubId: 42, login: 'octocat', name: null });
    const found = await UserModel.findById(user._id).lean();
    assert.ok(found);
    assert.equal(found.githubId, 42);
    assert.equal(found.login, 'octocat');
    assert.equal(found.name, null);
    assert.deepEqual(Object.keys(found.accessToken).sort(), ['authTag', 'ciphertext', 'iv']);
    assert.ok(found.createdAt instanceof Date);
    assert.ok(found.updatedAt instanceof Date);
  });

  it('enforces a unique githubId', async () => {
    await createTestUser({ githubId: 7 });
    await assert.rejects(createTestUser({ githubId: 7 }), /duplicate key/);
  });

  it('requires accessToken fields', async () => {
    await assert.rejects(
      UserModel.create({ githubId: 1, login: 'a', avatarUrl: 'https://x', accessToken: { iv: 'a' } }),
      /authTag|ciphertext/,
    );
  });
});
