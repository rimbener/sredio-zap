import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extractTokens, getTriggerTokens, PULL_REQUEST_OPENED_TOKENS } from './tokens.js';

describe('trigger tokens', () => {
  it('lists the 7 pull_request.opened tokens with labels', () => {
    assert.deepEqual(
      getTriggerTokens('github', 'pull_request.opened').map((t) => t.key),
      ['pr.number', 'pr.title', 'pr.body', 'pr.url', 'pr.author', 'repo.name', 'repo.fullName'],
    );
    for (const token of PULL_REQUEST_OPENED_TOKENS) assert.ok(token.label.length > 0);
  });

  it('returns no tokens for an unknown pair', () => {
    assert.deepEqual(getTriggerTokens('github', 'push'), []);
    assert.deepEqual(getTriggerTokens('gitlab', 'pull_request.opened'), []);
    assert.deepEqual(getTriggerTokens('constructor', 'toString'), []);
  });
});

describe('extractTokens', () => {
  it('returns nothing for text without placeholders', () => {
    assert.deepEqual(extractTokens('Thanks for the PR!'), []);
  });

  it('finds tokens in order, once each', () => {
    assert.deepEqual(extractTokens('Hi {{pr.author}}, see {{pr.url}} ({{pr.author}})'), ['pr.author', 'pr.url']);
  });

  it('handles adjacent tokens', () => {
    assert.deepEqual(extractTokens('{{pr.number}}{{pr.title}}'), ['pr.number', 'pr.title']);
  });

  it('ignores unbalanced braces', () => {
    assert.deepEqual(extractTokens('{{pr.title} and {pr.body}} and {pr.url}'), []);
    assert.deepEqual(extractTokens('{{pr.title'), []);
    assert.deepEqual(extractTokens('pr.title}}'), []);
  });

  it('takes the innermost pair when braces are nested or extra', () => {
    assert.deepEqual(extractTokens('{{{pr.title}}}'), ['pr.title']);
    assert.deepEqual(extractTokens('{{ {{pr.title}}'), ['pr.title']);
  });

  it('keeps names exactly as written, including empty and spaced ones', () => {
    assert.deepEqual(extractTokens('{{}} {{ pr.title }}'), ['', ' pr.title ']);
  });
});
