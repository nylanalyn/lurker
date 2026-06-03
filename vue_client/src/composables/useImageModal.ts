// Copyright (c) 2026 Brad Root
// SPDX-License-Identifier: MPL-2.0

import { ref } from 'vue';

const MAX_PRELOADED_IMAGES = 24;

const isOpen = ref(false);
const url = ref<string | null>(null);
const preloadedImages = new Map<string, HTMLImageElement>();

function rememberPreloadedImage(nextUrl: string, image: HTMLImageElement): void {
  if (preloadedImages.size >= MAX_PRELOADED_IMAGES) {
    const oldestUrl = preloadedImages.keys().next().value;
    if (oldestUrl !== undefined) preloadedImages.delete(oldestUrl);
  }
  preloadedImages.set(nextUrl, image);
}

export function useImageModal() {
  function preload(nextUrl: string): void {
    if (preloadedImages.has(nextUrl)) return;

    const image = new Image();
    image.addEventListener('error', () => preloadedImages.delete(nextUrl), { once: true });
    rememberPreloadedImage(nextUrl, image);
    image.src = nextUrl;
  }

  function open(nextUrl: string): void {
    url.value = nextUrl;
    isOpen.value = true;
  }

  function close(): void {
    isOpen.value = false;
    url.value = null;
  }

  return { isOpen, url, preload, open, close };
}
