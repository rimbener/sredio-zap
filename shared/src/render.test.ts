import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTokenValues,
  neutralizeMentions,
  renderTemplate,
  SAMPLE_TOKEN_VALUES,
  truncateComment,
  type PullRequestPayload,
} from './render.js';
import { COMMENT_BODY_MAX_LENGTH } from './schemas/step-config.js';

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

test('neutralizes mentions in the PR title and body, not in the template', () => {
  const values = buildTokenValues({
    ...payload,
    pull_request: {
      ...payload.pull_request,
      title: '@admin please merge',
      body: 'cc @alice, (@acme/core-team)\nmail me at bob@example.com, not `@code`',
    },
  });
  assert.equal(values['pr.title'], '@​admin please merge');
  assert.equal(
    values['pr.body'],
    'cc @​alice, (@​acme/core-team)\nmail me at bob@example.com, not `@code`',
  );
  assert.equal(values['pr.author'], 'alice');
  assert.equal(
    renderTemplate('Thanks @{{pr.author}}: {{pr.title}}', values),
    'Thanks @alice: @​admin please merge',
  );
});

test('neutralizeMentions leaves text without mentions unchanged', () => {
  assert.equal(neutralizeMentions('Closes #3 — a@b.c, @, @-x, _@y'), 'Closes #3 — a@b.c, @, @-x, _@y');
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

const codePoints = (text: string) => Array.from(text).length;

test('leaves output of exactly 65,536 code points unchanged', () => {
  const ascii = 'a'.repeat(COMMENT_BODY_MAX_LENGTH);
  assert.equal(renderTemplate(ascii, {}), ascii);
  // 65,536 emoji are 131,072 UTF-16 units but still 65,536 code points.
  const emoji = '😀'.repeat(COMMENT_BODY_MAX_LENGTH);
  assert.equal(truncateComment(emoji), emoji);
});

test('cuts 65,537 code points to 65,536 ending in …', () => {
  const result = truncateComment('a'.repeat(COMMENT_BODY_MAX_LENGTH + 1));
  assert.equal(codePoints(result), COMMENT_BODY_MAX_LENGTH);
  assert.equal(result, 'a'.repeat(COMMENT_BODY_MAX_LENGTH - 1) + '…');
});

test('does not split an emoji at the cut', () => {
  // The emoji sits at code point 65,535 (the last one kept before the …), and its
  // surrogate pair straddles UTF-16 unit 65,535, where a `length`-based cut would land.
  const text = 'a'.repeat(COMMENT_BODY_MAX_LENGTH - 2) + '😀' + 'b'.repeat(10);
  const result = truncateComment(text);
  assert.equal(codePoints(result), COMMENT_BODY_MAX_LENGTH);
  assert.ok(result.endsWith('😀…'));
  // With the `u` flag this matches only lone (split) surrogates.
  assert.doesNotMatch(result, /[\uD800-\uDFFF]/u);

  const allEmoji = truncateComment('😀'.repeat(COMMENT_BODY_MAX_LENGTH + 1));
  assert.equal(allEmoji, '😀'.repeat(COMMENT_BODY_MAX_LENGTH - 1) + '…');
});

test('truncates a short template rendered with a long {{pr.body}}', () => {
  const values = buildTokenValues({
    ...payload,
    pull_request: { ...payload.pull_request, body: 'x'.repeat(70_000) },
  });
  const result = renderTemplate('Thanks @{{pr.author}}!\n\n{{pr.body}}', values);
  assert.equal(codePoints(result), COMMENT_BODY_MAX_LENGTH);
  assert.ok(result.startsWith('Thanks @alice!\n\nxxx'));
  assert.ok(result.endsWith('x…'));
});
