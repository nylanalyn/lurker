// Copyright (c) 2026 Brad Root
// SPDX-License-Identifier: MPL-2.0

// In the hosted (node) edition the cell never lets a tenant choose an upload
// host: every upload goes through the operator-run in-house dropper — the same
// R2-backed Hoarder service the `hoarder` provider already speaks to — using
// operator-supplied credentials from the environment rather than per-user
// settings. A tenant must never see or set these keys. This module centralizes
// the env var names + secret lookup so the upload route and the boot-time
// config check agree, and keeps it out of the (mockable) provider registry so
// the route reads the real environment in tests.

/** Provider id forced for every upload in node edition. */
export const NODE_UPLOAD_PROVIDER_ID = 'hoarder';

/**
 * Operator-supplied in-house uploader credentials, read fresh from the
 * environment (operator config is fixed for the process lifetime; reading on
 * demand keeps this trivially testable). Shaped to match what the hoarder
 * provider's `upload()` expects.
 */
export function nodeUploadSecrets(): { url: string; api_key: string } {
  return {
    url: (process.env.LURKER_NODE_UPLOAD_URL || '').trim(),
    api_key: (process.env.LURKER_NODE_UPLOAD_API_KEY || '').trim(),
  };
}

/** True only when both required env vars are present (drives the boot warning). */
export function nodeUploadConfigured(): boolean {
  const { url, api_key } = nodeUploadSecrets();
  return Boolean(url && api_key);
}
