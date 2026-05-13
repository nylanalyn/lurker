import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lurker-test-'));
process.env.DATABASE_PATH = path.join(tmpDir, 'test.db');

let createUser;
let createNetwork;
let insertMessage;
let listMessages;

beforeAll(async () => {
  ({ createUser } = await import('./users.js'));
  ({ createNetwork } = await import('./networks.js'));
  ({ insertMessage, listMessages } = await import('./messages.js'));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function chat(networkId, target, nick, text, type = 'message') {
  return insertMessage({
    networkId,
    target,
    time: new Date().toISOString(),
    type,
    nick,
    text,
    self: false,
  });
}

function event(networkId, target, type, nick = null) {
  return insertMessage({
    networkId,
    target,
    time: new Date().toISOString(),
    type,
    nick,
    self: false,
  });
}

function altsFor(networkId, target) {
  return listMessages(networkId, target, { limit: 1000 }).map((m) => m.alt);
}

describe('messages.alt parity', () => {
  it('alternates alt for chat-shaped types within a buffer', () => {
    const user = createUser('parity-basic');
    const net = createNetwork(user.id, {
      name: 'n', host: 'h', port: 6697, tls: true, nick: 'parity-basic',
    });
    chat(net.id, '#a', 'alice', 'one');
    chat(net.id, '#a', 'bob', 'two');
    chat(net.id, '#a', 'alice', 'three');
    chat(net.id, '#a', 'bob', 'four');
    expect(altsFor(net.id, '#a')).toEqual([false, true, false, true]);
  });

  it('does not flip parity on system events', () => {
    const user = createUser('parity-events');
    const net = createNetwork(user.id, {
      name: 'n', host: 'h', port: 6697, tls: true, nick: 'parity-events',
    });
    chat(net.id, '#a', 'alice', 'one');
    event(net.id, '#a', 'join', 'carol');
    event(net.id, '#a', 'part', 'carol');
    chat(net.id, '#a', 'bob', 'two');
    event(net.id, '#a', 'mode');
    chat(net.id, '#a', 'alice', 'three');

    const events = listMessages(net.id, '#a', { limit: 1000 });
    const chatAlts = events.filter((m) => ['message', 'action', 'notice'].includes(m.type)).map((m) => m.alt);
    expect(chatAlts).toEqual([false, true, false]);
    const sysAlts = events.filter((m) => !['message', 'action', 'notice'].includes(m.type)).map((m) => m.alt);
    expect(sysAlts.every((a) => a === false)).toBe(true);
  });

  it('tracks parity independently per buffer', () => {
    const user = createUser('parity-isolation');
    const net = createNetwork(user.id, {
      name: 'n', host: 'h', port: 6697, tls: true, nick: 'parity-isolation',
    });
    chat(net.id, '#a', 'alice', 'a1');
    chat(net.id, '#b', 'alice', 'b1');
    chat(net.id, '#a', 'alice', 'a2');
    chat(net.id, '#b', 'alice', 'b2');
    chat(net.id, '#a', 'alice', 'a3');
    expect(altsFor(net.id, '#a')).toEqual([false, true, false]);
    expect(altsFor(net.id, '#b')).toEqual([false, true]);
  });

  it('treats action and notice as striped types', () => {
    const user = createUser('parity-actions');
    const net = createNetwork(user.id, {
      name: 'n', host: 'h', port: 6697, tls: true, nick: 'parity-actions',
    });
    chat(net.id, '#a', 'alice', 'one', 'message');
    chat(net.id, '#a', 'alice', 'two', 'action');
    chat(net.id, '#a', 'alice', 'three', 'notice');
    chat(net.id, '#a', 'alice', 'four', 'message');
    expect(altsFor(net.id, '#a')).toEqual([false, true, false, true]);
  });

  it('returns alt on the insert result', () => {
    const user = createUser('parity-return');
    const net = createNetwork(user.id, {
      name: 'n', host: 'h', port: 6697, tls: true, nick: 'parity-return',
    });
    const first = insertMessage({
      networkId: net.id, target: '#a', time: new Date().toISOString(),
      type: 'message', nick: 'alice', text: 'hi', self: false,
    });
    const second = insertMessage({
      networkId: net.id, target: '#a', time: new Date().toISOString(),
      type: 'message', nick: 'bob', text: 'hi', self: false,
    });
    const sysEvt = insertMessage({
      networkId: net.id, target: '#a', time: new Date().toISOString(),
      type: 'join', nick: 'carol', self: false,
    });
    expect(first.alt).toBe(false);
    expect(second.alt).toBe(true);
    expect(sysEvt.alt).toBe(false);
  });
});
