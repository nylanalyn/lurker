// Copyright (c) 2026 Brad Root
// SPDX-License-Identifier: MPL-2.0

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { LurkerTestAgent } from '../test-utils/testApp.js';
import type { Express } from 'express';
import sharp from 'sharp';
import { setupTestDb, createTestApp, createAuthedAgent } from '../test-utils/testApp.js';
import type { User } from '../db/users.js';

// Resolve to node edition + operator upload creds before the route reads them.
// Edition caches on first getEdition(); vitest gives this file its own process.
process.env.LURKER_EDITION = 'node';
process.env.LURKER_NODE_UPLOAD_URL = 'https://dropper.test';
process.env.LURKER_NODE_UPLOAD_API_KEY = 'operator-key-123';

const ctx = setupTestDb('routes-uploads-node');

// Same stub pattern as uploads.test.ts: capture the secrets the route hands the
// provider so we can prove node edition sources them from the environment
// (nodeUploadSecrets), never from the per-user secretsForProvider below.
const stub = {
  id: 'stub',
  requiresSecrets: false,
  capturedSecrets: null as Record<string, string> | null,
  async upload(
    _buffer: Buffer,
    meta: { filename: string; mime: string },
    secrets?: Record<string, string>,
  ) {
    stub.capturedSecrets = secrets ?? null;
    return { url: `https://stub.example/${meta.filename}` };
  },
};

vi.mock('../services/uploadProviders/index.js', () => ({
  providerIds: ['x0', 'catbox', 'hoarder'],
  getProvider: () => stub,
  // A distinctive sentinel: if node edition ever fell back to per-user secrets,
  // the credential assertion below would fail loudly.
  secretsForProvider: () => ({ from: 'user-settings' }),
}));

let app: Express;
let agent: LurkerTestAgent;
let user: User;
let smallPng: Buffer;

beforeAll(async () => {
  const { createUser } = await import('../db/users.js');
  const { setUserSetting } = await import('../db/settings.js');
  const router = (await import('./uploads.js')).default;

  user = createUser('upload-node-alice');
  // A non-default tenant choice that node edition must IGNORE (default is x0;
  // forcing to hoarder is only meaningful when the user picked something else).
  setUserSetting(user.id, 'uploads.provider', 'catbox');

  app = createTestApp({ '/api/uploads': router });
  agent = await createAuthedAgent(app, user.id);

  smallPng = await sharp({
    create: { width: 16, height: 16, channels: 3, background: { r: 255, g: 0, b: 0 } },
  })
    .png()
    .toBuffer();
});

afterAll(() => {
  ctx.cleanup();
  delete process.env.LURKER_EDITION;
  delete process.env.LURKER_NODE_UPLOAD_URL;
  delete process.env.LURKER_NODE_UPLOAD_API_KEY;
});

describe('POST /api/uploads (node edition)', () => {
  it('forces the in-house provider regardless of the tenant setting', async () => {
    const res = await agent
      .post('/api/uploads')
      .attach('image', smallPng, { filename: 'photo.png', contentType: 'image/png' });
    expect(res.status).toBe(200);

    const list = await agent.get('/api/uploads');
    const row = list.body.items.find((r: { id: number }) => r.id === res.body.id);
    // Recorded as the forced in-house provider, not the tenant's 'catbox' pick.
    expect(row.provider).toBe('hoarder');
  });

  it('hands the provider operator env credentials, not per-user settings', async () => {
    stub.capturedSecrets = null;
    await agent
      .post('/api/uploads')
      .attach('image', smallPng, { filename: 'creds.png', contentType: 'image/png' });
    expect(stub.capturedSecrets).toEqual({
      url: 'https://dropper.test',
      api_key: 'operator-key-123',
    });
  });
});
