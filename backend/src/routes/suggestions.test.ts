import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { prisma } from '../db.js';

// The public "Təklif ver" feedback widget (POST /api/suggestions) was removed from the product —
// these tests confirm the submission route is gone while the admin-only read path (which
// AdminGate.tsx's key validation and the Admin.tsx panel both still depend on) keeps working.

describe('POST /api/suggestions — removed feature', () => {
  it('no longer exists (the public feedback-submission route was removed)', async () => {
    const res = await request(app).post('/api/suggestions').send({ category: 'Digər', text: 'test feedback text', email: 'a@b.com' });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/suggestions — admin-only read, preserved', () => {
  const ORIGINAL_ADMIN_KEY = process.env.ADMIN_KEY;

  beforeAll(() => {
    process.env.ADMIN_KEY = 'test-admin-key';
  });
  afterAll(() => {
    process.env.ADMIN_KEY = ORIGINAL_ADMIN_KEY;
  });

  it('rejects a request with no admin key', async () => {
    const res = await request(app).get('/api/suggestions');
    expect(res.status).toBe(401);
  });

  it('rejects a request with the wrong admin key', async () => {
    const res = await request(app).get('/api/suggestions').set('x-admin-key', 'wrong-key');
    expect(res.status).toBe(401);
  });

  it('succeeds with the correct admin key — this is what AdminGate.tsx relies on to validate the key', async () => {
    const res = await request(app).get('/api/suggestions').set('x-admin-key', 'test-admin-key');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('Suggestion table — preserved for admin viewing, not written to anymore', () => {
  it('the Suggestion model still exists and is queryable (schema/migration untouched)', async () => {
    await expect(prisma.suggestion.findMany({ take: 1 })).resolves.toBeInstanceOf(Array);
  });
});
