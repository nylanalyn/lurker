<!--
  Copyright (c) 2026 Brad Root
  SPDX-License-Identifier: MPL-2.0
-->

<!--
  Persistent top-of-app banner shown while the account is paused (read-only).
  Mounted by App.vue inside the .app-shell wrapper, which reflows the route view
  beneath it. The copy is mode-aware: a self-hosted (standalone) user is told to
  contact their admin, while a hosted (node) tenant gets a link to their account
  page to reactivate.
-->

<template>
  <div class="paused-banner" role="status">
    <span class="paused-banner__text"><strong>Account paused.</strong> {{ detail }}</span>
    <a v-if="config.isNode" class="paused-banner__link" :href="ACCOUNT_URL">Reactivate</a>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useConfigStore } from '../stores/config.js';

const config = useConfigStore();

// The hosted account/billing page. It doesn't exist yet (B4/B5), but the URL is
// stable, so the link is correct ahead of the page landing.
const ACCOUNT_URL = 'https://app.lurker.chat/account';

const detail = computed(() =>
  config.isNode
    ? 'You can read your history, but sending is disabled until you reactivate.'
    : 'You can read your history, but sending is disabled. Contact the administrator to restore access.',
);
</script>

<style scoped>
.paused-banner {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: var(--space-6);
  padding: var(--space-3) var(--space-6);
  background: var(--warn);
  color: var(--bg);
  text-align: center;
}
.paused-banner__link {
  color: var(--bg);
  font-weight: 600;
  text-decoration: underline;
  white-space: nowrap;
}
</style>
