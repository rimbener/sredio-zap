import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { AppError } from './app-error.js';
import { errorHandler, notFoundHandler } from './handler.js';

process.env.NODE_ENV = 'test';

function appWith(route: express.RequestHandler) {
  const app = express();
  app.use(express.json());
  app.post('/t', route);
  app.get('/t', route);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe('errorHandler', () => {
  it('maps a thrown Error to 500 INTERNAL_ERROR without a stack', async () => {
    const res = await request(
      appWith(() => {
        throw new Error('secret internal detail');
      }),
    ).get('/t');
    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
    assert.doesNotMatch(res.text, /secret internal detail|at .*\.ts/);
  });

  it('maps a rejected async handler to 500 (Express 5)', async () => {
    const res = await request(
      appWith(async () => {
        throw new Error('boom');
      }),
    ).get('/t');
    assert.equal(res.status, 500);
    assert.equal(res.body.error.code, 'INTERNAL_ERROR');
  });

  it('maps an AppError to its envelope, with details', async () => {
    const res = await request(
      appWith(() => {
        throw new AppError(409, 'WEBHOOK_EXISTS', 'Webhook exists', { hookSettingsUrl: 'https://x' });
      }),
    ).get('/t');
    assert.equal(res.status, 409);
    assert.deepEqual(res.body, {
      error: { code: 'WEBHOOK_EXISTS', message: 'Webhook exists', details: { hookSettingsUrl: 'https://x' } },
    });
  });

  it('omits details when an AppError has none', async () => {
    const res = await request(
      appWith(() => {
        throw new AppError(404, 'NOT_FOUND', 'Zap not found');
      }),
    ).get('/t');
    assert.deepEqual(res.body, { error: { code: 'NOT_FOUND', message: 'Zap not found' } });
  });

  it('maps a ZodError to 400 VALIDATION_ERROR with the issues', async () => {
    const schema = z.object({ name: z.string().min(1) });
    const res = await request(
      appWith((req, res) => {
        res.json(schema.parse(req.body));
      }),
    )
      .post('/t')
      .send({ name: '' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    assert.equal(res.body.error.details.length, 1);
    assert.deepEqual(res.body.error.details[0].path, ['name']);
    assert.equal(typeof res.body.error.details[0].message, 'string');
  });

  it('maps malformed JSON to 400 VALIDATION_ERROR', async () => {
    const res = await request(appWith((_req, res) => res.end()))
      .post('/t')
      .set('Content-Type', 'application/json')
      .send('{"name":');
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  it('unknown route → 404 NOT_FOUND envelope', async () => {
    const res = await request(appWith((_req, res) => res.end())).get('/nope');
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'NOT_FOUND');
  });
});
