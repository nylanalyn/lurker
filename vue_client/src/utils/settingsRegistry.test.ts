// Copyright (c) 2026 Brad Root
// SPDX-License-Identifier: MPL-2.0

import { describe, it, expect } from 'vitest';
import { CATEGORIES, REGISTRY, categoryVisible, optionVisible } from './settingsRegistry.js';

const cat = (id: string) => CATEGORIES.find((c) => c.id === id)!;
const opt = (key: string) => REGISTRY.find((o) => o.key === key)!;

describe('categoryVisible', () => {
  const standalone = { isAdmin: false, isNode: false };
  const node = { isAdmin: false, isNode: true };

  it('hides adminOnly categories from non-admins, shows them to admins', () => {
    expect(categoryVisible(cat('users'), { isAdmin: false, isNode: false })).toBe(false);
    expect(categoryVisible(cat('users'), { isAdmin: true, isNode: false })).toBe(true);
  });

  it('hides selfHostedOnly categories in node edition only', () => {
    expect(categoryVisible(cat('api-tokens'), standalone)).toBe(true);
    expect(categoryVisible(cat('api-tokens'), node)).toBe(false);
    // selfHostedOnly is independent of role — a node-edition admin still can't
    // see it (the route isn't mounted there anyway).
    expect(categoryVisible(cat('api-tokens'), { isAdmin: true, isNode: true })).toBe(false);
  });

  it('shows ordinary categories in both editions', () => {
    expect(categoryVisible(cat('appearance'), standalone)).toBe(true);
    expect(categoryVisible(cat('appearance'), node)).toBe(true);
  });
});

describe('optionVisible', () => {
  it('hides selfHostedOnly settings in node edition, shows them standalone', () => {
    expect(optionVisible(opt('uploads.provider'), { isNode: false })).toBe(true);
    expect(optionVisible(opt('uploads.provider'), { isNode: true })).toBe(false);
    expect(optionVisible(opt('uploads.hoarder.api_key'), { isNode: true })).toBe(false);
  });

  it('keeps the upload pipeline settings visible in node edition', () => {
    // Tenant-relevant prefs (quality, paste behavior), not provider config —
    // these must survive the gating that hides the provider + credentials.
    expect(optionVisible(opt('uploads.image.quality'), { isNode: true })).toBe(true);
    expect(optionVisible(opt('uploads.paste.enabled'), { isNode: true })).toBe(true);
  });
});
