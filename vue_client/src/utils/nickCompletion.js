// Copyright (c) 2026 Brad Root
// SPDX-License-Identifier: Elastic-2.0

// Shared candidate builder for nick completion — used by both Tab-completion in
// MessageInput and the @-triggered NickPicker. Returns nicks matching `prefix`
// (case-insensitive), with `recent: true` marking entries that come from the
// speakers map (reverse-chronological) and `recent: false` marking remaining
// channel members (alphabetical). The caller's own nick is excluded.
//
// Membership filter: when the buffer has a members list, speakers that are no
// longer in the channel (parted/quit) are dropped, so completion only surfaces
// people who can still see the message. DM buffers don't carry a members list,
// so the filter is skipped there and the peer remains completable.
export function buildNickCandidates(buf, selfNick, prefix) {
  if (!buf) return [];
  const lower = (prefix || '').toLowerCase();
  const seen = new Set();
  if (selfNick) seen.add(selfNick.toLowerCase());

  const memberNames = (buf.members || [])
    .map((m) => (typeof m === 'string' ? m : m.nick))
    .filter(Boolean);
  const memberLcSet = new Set(memberNames.map((n) => n.toLowerCase()));
  const filterSpeakersByMembership = memberLcSet.size > 0;

  const out = [];

  const speakers = Object.values(buf.speakers || {})
    .sort((a, b) => b.lastTime - a.lastTime);
  for (const s of speakers) {
    const lc = s.nick.toLowerCase();
    if (seen.has(lc)) continue;
    if (!lc.startsWith(lower)) continue;
    if (filterSpeakersByMembership && !memberLcSet.has(lc)) continue;
    seen.add(lc);
    out.push({ nick: s.nick, recent: true });
  }

  const sortedMembers = memberNames.slice().sort((a, b) => a.localeCompare(b));
  for (const n of sortedMembers) {
    const lc = n.toLowerCase();
    if (seen.has(lc)) continue;
    if (!lc.startsWith(lower)) continue;
    seen.add(lc);
    out.push({ nick: n, recent: false });
  }

  return out;
}
