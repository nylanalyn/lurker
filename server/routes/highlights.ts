// Copyright (c) 2026 Brad Root
// SPDX-License-Identifier: MPL-2.0

import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { searchMessages } from '../db/messages.js';

const router = Router();
router.use(requireAuth);

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined;
}

router.get('/', (req: Request, res: Response) => {
  const rawLimit = Number(req.query.limit);
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_LIMIT) : DEFAULT_LIMIT;
  const rawBefore = Number(req.query.before);
  const before = Number.isFinite(rawBefore) && rawBefore > 0 ? rawBefore : undefined;
  const rawNetworkId = Number(req.query.networkId);
  const networkId = Number.isFinite(rawNetworkId) && rawNetworkId > 0 ? rawNetworkId : undefined;

  // Highlights are matched messages; the optional q / nick / target / networkId
  // params are the same from:/in:/on: + free-text filters search uses, so this
  // shares searchMessages() (FTS index included) rather than a parallel query.
  const items = searchMessages(req.user!.id, {
    matched: true,
    query: str(req.query.q),
    nick: str(req.query.nick),
    target: str(req.query.target),
    networkId,
    before,
    limit,
  });
  // Cursor for the next page is the id of the oldest row in this page; null
  // when the page didn't fill the limit (there's nothing older).
  const nextBefore = items.length === limit ? items[items.length - 1].id : null;
  res.json({ items, nextBefore });
});

export default router;
