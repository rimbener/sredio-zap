import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTokenValues,
  renderTemplate,
  SAMPLE_TOKEN_VALUES,
  type PullRequestPayload,
} from './render.js';

const payload: PullRequestPayload = {
  pull_request: {
    number: 7,
    title: 'Add dark mode',
    body: 'Closes #3',
    html_url: 'https://github.com/acme/web/pull/7',
    user: { login: 'alice' },
  },
  repository: { name: 'web', full_name: 'acme/web' },
};

test('substitutes all 7 tokens', () => {
  const template =
    '{{pr.number}}|{{pr.title}}|{{pr.body}}|{{pr.url}}|{{pr.author}}|{{repo.name}}|{{repo.fullName}}';
  assert.equal(
    renderTemplate(template, buildTokenValues(payload)),
    '7|Add dark mode|Closes #3|https://github.com/acme/web/pull/7|alice|web|acme/web',
  );
});

test('substitutes repeated tokens', () => {
  assert.equal(
    renderTemplate('{{pr.author}} {{pr.author}} and {{pr.author}}', { 'pr.author': 'alice' }),
    'alice alice and alice',
  );
});

test('leaves text without tokens unchanged', () => {
  const text = 'Thanks for the PR! {single} braces } and {{ stay.';
  assert.equal(renderTemplate(text, buildTokenValues(payload)), text);
  assert.equal(renderTemplate('', {}), '');
});

test('renders a null PR body as empty', () => {
  const values = buildTokenValues({ ...payload, pull_request: { ...payload.pull_request, body: null } });
  assert.equal(values['pr.body'], '');
  assert.equal(renderTemplate('[{{pr.body}}]', values), '[]');
});

test('does not interpret token values as templates or replacement patterns', () => {
  assert.equal(
    renderTemplate('{{pr.title}} / {{pr.body}}', { 'pr.title': '$& $1 $$', 'pr.body': '{{pr.title}}' }),
    '$& $1 $$ / {{pr.title}}',
  );
});

test('leaves placeholders without a value as they are', () => {
  assert.equal(renderTemplate('{{pr.unknown}} {{constructor}}', {}), '{{pr.unknown}} {{constructor}}');
});

test('renders the builder preview with sample values', () => {
  assert.equal(
    renderTemplate('Thanks @{{pr.author}} for "{{pr.title}}"! #{{pr.number}}', SAMPLE_TOKEN_VALUES),
    'Thanks @octocat for "Fix login redirect"! #42',
  );
});
