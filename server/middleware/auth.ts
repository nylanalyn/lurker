// Copyright (c) 2026 Brad Root
// SPDX-License-Identifier: MPL-2.0

import type { CookieOptions, NextFunction, Request, Response } from 'express';
import { findSession } from '../db/sessions.js';
import type { Session } from '../db/sessions.js';
import { findUserById, touchUserLastSeen } from '../db/users.js';
import type { User } from '../db/users.js';

export const SESSION_COOKIE = 'lurker_session';

export function getCookieOptions(): CookieOptions {
  // Secure is opt-in via COOKIE_SECURE=true. Tying it to NODE_ENV silently
  // breaks the common self-hosted shapes: LAN hostnames over plain HTTP, and
  // proxies (Cloudflare Tunnel, reverse proxies) that terminate TLS upstream
  // and connect to the container in cleartext — in both cases the browser
  // drops Secure cookies and the user appears logged in but the session
  // cookie never lands. Operators serving Lurker over true end-to-end HTTPS
  // can flip this on to harden against cleartext-network eavesdropping.
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    signed: true,
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  };
}

export function loadSession(req: Request): { session: Session; user: User } | null {
  const token = req.signedCookies?.[SESSION_COOKIE];
  if (!token) return null;
  const session = findSession(token);
  if (!session) return null;
  const user = findUserById(session.user_id);
  if (!user) return null;
  return { session, user };
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const ctx = loadSession(req);
  if (!ctx) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  req.user = ctx.user;
  req.session = ctx.session;
  touchUserLastSeen(ctx.user.id);
  next();
}

// Stack on top of requireAuth. Returns 403 (not 401) so the client knows the
// session is fine but the user just lacks the role — different from a missing
// or expired cookie, which the auth-store redirect handler reacts to.
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'forbidden' });
    return;
  }
  next();
}

// Read-only gate for paused accounts. Stack on top of requireAuth. GET/HEAD
// reads fall through so a paused user can still browse their history; any
// mutating method gets a clean 403. The authoritative block on IRC traffic is
// the startNetwork gate in ircManager — this just turns what would be a silent
// no-op into a clear error and stops a paused user from mutating network config.
export function blockWritesWhenPaused(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.is_paused && req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(403).json({ error: 'account paused' });
    return;
  }
  next();
}
