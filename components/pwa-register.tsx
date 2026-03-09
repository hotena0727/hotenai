'use client';

import { useEffect } from 'react';

export default function PWARegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    const registerSW = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });
        console.log('[PWA] service worker registered:', reg.scope);
      } catch (error) {
        console.error('[PWA] service worker registration failed:', error);
      }
    };

    registerSW();
  }, []);

  return null;
}