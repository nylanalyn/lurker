<!--
  Copyright (c) 2026 Brad Root
  SPDX-License-Identifier: MPL-2.0
-->

<template>
  <div class="app-shell" :class="{ 'is-paused': auth.isPaused }">
    <PausedBanner v-if="auth.isPaused" />
    <RouterView />
  </div>
  <ToastContainer />
  <ContextMenu />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useAuthStore } from './stores/auth.js';
import { useSettingsStore } from './stores/settings.js';
import { useConfigStore } from './stores/config.js';
import { useTheme } from './composables/useTheme.js';
import ToastContainer from './components/ToastContainer.vue';
import ContextMenu from './components/ContextMenu.vue';
import PausedBanner from './components/PausedBanner.vue';

const auth = useAuthStore();
const settings = useSettingsStore();
const config = useConfigStore();

useTheme();

onMounted(() => {
  auth.fetchMe();
  if (!config.checked) config.fetch().catch(() => {});
  if (!settings.loaded) settings.fetchAll().catch(() => {});
});
</script>
