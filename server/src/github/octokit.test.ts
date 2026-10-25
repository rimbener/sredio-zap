import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { afterEach, describe, it } from 'node:test';
import { Octokit } from '@octokit/rest';
import { encrypt } from '../crypto/token.js';
import { getOctokit, octokitFor, resetOctokitFactory, setOctokitFactory } from './octokit.js';

describe('Octokit factory', () => {
  afterEach(() => resetOctokitFactory());

  it('returns a real Octokit by default', () => {
    assert.ok(getOctokit('gho_token') instanceof Octokit);
  });

  it('can be swapped for a fake and reset', () => {
    const fake = {} as Octokit;
    const tokens: string[] = [];
    setOctokitFactory((token) => {
      tokens.push(token);
      return fake;
    });
    assert.equal(getOctokit('gho_a'), fake);
    assert.deepEqual(tokens, ['gho_a']);

    resetOctokitFactory();
    assert.ok(getOctokit('gho_b') instanceof Octokit);
  });

  it('octokitFor decrypts the stored token before calling the factory', () => {
    const key = randomBytes(32);
    const tokens: string[] = [];
    setOctokitFactory((token) => {
      tokens.push(token);
      return {} as Octokit;
    });
    octokitFor(encrypt('gho_secret', key), key);
    assert.deepEqual(tokens, ['gho_secret']);
  });
});
