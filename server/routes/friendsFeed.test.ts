// Copyright (c) 2026 Brad Root
// SPDX-License-Identifier: MPL-2.0

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { LurkerTestAgent } from '../test-utils/testApp.js';
import type { Express } from 'express';
import {
  setupTestDb,
  createTestApp,
  createAuthedAgent,
  createAnonAgent,
} from '../test-utils/testApp.js';
import type { User } from '../db/users.js';
import type { Network } from '../db/networks.js';

const ctx = setupTestDb('routes-friends-feed');

let app: Express;
let agent: LurkerTestAgent;
let user: User;
let net: Network;
let net2: Network;
let contactId: number;
let insertMessage: typeof import('../db/messages.js').insertMessage;
let createNetwork: typeof import('../db/networks.js').createNetwork;

beforeAll(async () => {
  const { createUser } = await import('../db/users.js');
  ({ createNetwork } = await import('../db/networks.js'));
  ({ insertMessage } = await import('../db/messages.js'));
  const { createContact } = await import('../db/contacts.js');
  const router = (await import('./friendsFeed.js')).default;

  user = createUser('ff-alice');
  net = createNetwork(user.id, {
    name: 'libera',
    host: 'h',
    port: 6697,
    tls: true,
    nick: 'alice',
  })!;
  net2 = createNetwork(user.id, { name: 'oftc', host: 'h', port: 6697, tls: true, nick: 'alice' })!;
  contactId = createContact({ userId: user.id, displayName: 'Darc', notifyOnline: false });

  app = createTestApp({ '/api/friends-feed': router });
  agent = await createAuthedAgent(app, user.id);
});

afterAll(() => ctx.cleanup());

function msg(
  networkId: number,
  target: string,
  nick: string,
  text: string,
  friendContactId: number | null,
  type = 'message',
) {
  return insertMessage({
    networkId,
    target,
    time: new Date().toISOString(),
    type,
    nick,
    text,
    self: false,
    friendContactId,
  });
}

describe('GET /api/friends-feed', () => {
  it('requires authentication', async () => {
    const res = await createAnonAgent(app).get('/api/friends-feed');
    expect(res.status).toBe(401);
  });

  it('returns only friend-marked chat messages, newest-first', async () => {
    const stranger = msg(net.id, '#dev', 'bob', 'hello there', null).id;
    const friend1 = msg(net.id, '#dev', 'darc', 'sup people', contactId).id;
    const friend2 = msg(net.id, '#dev', 'darc', 'shipped it', contactId).id;

    const res = await agent.get('/api/friends-feed');
    expect(res.status).toBe(200);
    const ids = res.body.items.map((r: { id: number }) => r.id);
    expect(ids).toEqual([friend2, friend1]);
    expect(ids).not.toContain(stranger);
    // rowToEvent exposes the friend flag + the joined network name for the prefix.
    expect(res.body.items[0].friend).toBe(true);
    expect(res.body.items[0].networkName).toBe('libera');
  });

  it('aggregates across networks', async () => {
    const here = msg(net.id, '#a', 'darc', 'on libera', contactId).id;
    const there = msg(net2.id, '#b', 'darc', 'on oftc', contactId).id;
    const res = await agent.get('/api/friends-feed?limit=50');
    const ids = res.body.items.map((r: { id: number }) => r.id);
    expect(ids).toContain(here);
    expect(ids).toContain(there);
    // Both networks represented, each row carrying its own networkName.
    const names = new Set(res.body.items.map((r: { networkName: string }) => r.networkName));
    expect(names.has('libera')).toBe(true);
    expect(names.has('oftc')).toBe(true);
  });

  it('excludes non-chat types even when friend-marked', async () => {
    const join = msg(net.id, '#dev', 'darc', '', contactId, 'join').id;
    const res = await agent.get('/api/friends-feed?limit=200');
    const ids = res.body.items.map((r: { id: number }) => r.id);
    expect(ids).not.toContain(join);
  });

  it('paginates with limit + before cursor', async () => {
    const ids: Array<number | bigint> = [];
    for (let i = 0; i < 4; i += 1) ids.push(msg(net.id, '#pg', 'darc', `m${i}`, contactId).id);
    const page1 = await agent.get(
      '/api/friends-feed?limit=2&before=' + (Number(ids[ids.length - 1]) + 1),
    );
    expect(page1.body.items).toHaveLength(2);
    expect(page1.body.items[0].id).toBe(ids[3]);
    expect(page1.body.nextBefore).toBe(ids[2]);
    const page2 = await agent.get(`/api/friends-feed?limit=2&before=${page1.body.nextBefore}`);
    expect(page2.body.items.map((r: { id: number }) => r.id)).toEqual([ids[1], ids[0]]);
  });

  it('caps limit to MAX_LIMIT silently', async () => {
    const res = await agent.get('/api/friends-feed?limit=99999');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });
});

describe('tenant isolation', () => {
  it('never surfaces another user’s friend messages', async () => {
    const { createUser } = await import('../db/users.js');
    const bob = createUser('ff-bob');
    const bobNet = createNetwork(bob.id, {
      name: 'bobnet',
      host: 'h',
      port: 6697,
      tls: true,
      nick: 'bob',
    })!;
    const { createContact } = await import('../db/contacts.js');
    const bobContact = createContact({ userId: bob.id, displayName: 'Eve', notifyOnline: false });
    const secret = msg(bobNet.id, '#bob', 'eve', 'private', bobContact).id;

    // Alice's feed must not include Bob's row.
    const res = await agent.get('/api/friends-feed?limit=200');
    const ids = res.body.items.map((r: { id: number }) => r.id);
    expect(ids).not.toContain(secret);
  });
});
