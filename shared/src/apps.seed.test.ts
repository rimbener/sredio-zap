import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { APPS_SEED } from './apps.seed.js';
import { getStepConfigSchema } from './schemas/step-config.js';
import { getTriggerTokens } from './tokens.js';

describe('APPS_SEED', () => {
  it('lists the 5 apps in order, only github available', () => {
    assert.deepEqual(
      APPS_SEED.map((a) => [a.key, a.order, a.status]),
      [
        ['github', 1, 'available'],
        ['gitlab', 2, 'coming_soon'],
        ['jira', 3, 'coming_soon'],
        ['linear', 4, 'coming_soon'],
        ['slack', 5, 'coming_soon'],
      ],
    );
  });

  it('uses assets/apps/<key>.svg icons', () => {
    for (const app of APPS_SEED) assert.equal(app.icon, `assets/apps/${app.key}.svg`);
  });

  it('gives coming-soon apps no triggers or actions', () => {
    for (const app of APPS_SEED.filter((a) => a.status === 'coming_soon')) {
      assert.deepEqual([app.triggers, app.actions], [[], []]);
    }
  });

  it('only lists events the config registry and token list know', () => {
    for (const app of APPS_SEED) {
      for (const t of app.triggers) {
        assert.ok(getStepConfigSchema('trigger', app.key, t.key), `${app.key}/${t.key}`);
        assert.ok(getTriggerTokens(app.key, t.key).length > 0, `${app.key}/${t.key} tokens`);
      }
      for (const a of app.actions) assert.ok(getStepConfigSchema('action', app.key, a.key), `${app.key}/${a.key}`);
    }
  });
});
