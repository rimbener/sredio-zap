import { Octokit } from '@octokit/rest';
import { decrypt, type EncryptedValue } from '../crypto/token.js';

/** Builds an Octokit for a plain user token. Tests swap it for a fake. */
export type OctokitFactory = (token: string) => Octokit;

const defaultFactory: OctokitFactory = (token) => new Octokit({ auth: token });

let factory: OctokitFactory = defaultFactory;

/** The single entry point for every GitHub API call (Tech-Stack.md → Testing approach). */
export function getOctokit(token: string): Octokit {
  return factory(token);
}

/** Decrypts the stored token in memory and returns an Octokit for it. The plain token is not kept. */
export function octokitFor(encryptedToken: EncryptedValue, key: Buffer): Octokit {
  return getOctokit(decrypt(encryptedToken, key));
}

/** Test seam: replace the factory with a fake. */
export function setOctokitFactory(fn: OctokitFactory): void {
  factory = fn;
}

/** Test seam: restore the real Octokit factory. */
export function resetOctokitFactory(): void {
  factory = defaultFactory;
}
