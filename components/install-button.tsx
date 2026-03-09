'use client';

import { useEffect, useMemo, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      console.log('[PWA] beforeinstallprompt fired');
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      console.log('[PWA] app installed');
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const isIOS = useMemo(() => {
    if (!mounted) return false;
    const ua = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(ua);
  }, [mounted]);

  const isStandalone = useMemo(() => {
    if (!mounted) return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      // iOS Safari
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  }, [mounted]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    console.log('[PWA] userChoice:', choice.outcome);
    setDeferredPrompt(null);
  };

  if (!mounted) return null;

  if (installed || isStandalone) {
    return (
      <div className="text-sm font-medium text-green-600">
        이미 앱처럼 설치되어 있어요.
      </div>
    );
  }

  if (deferredPrompt) {
    return (
      <button
        onClick={handleInstall}
        className="inline-flex items-center justify-center rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
      >
        앱처럼 설치하기
      </button>
    );
  }

  if (isIOS) {
    return (
      <div className="text-sm text-gray-600 leading-6">
        Safari 하단 공유 버튼을 누른 뒤
        <br />
        <span className="font-semibold">‘홈 화면에 추가’</span>를 선택해 주세요.
      </div>
    );
  }

  return (
    <div className="text-sm text-gray-500 leading-6">
      이 브라우저에서는 자동 설치 버튼이 바로 나타나지 않을 수 있어요.
      <br />
      Chrome 메뉴에서 <span className="font-semibold">설치</span> 또는
      <span className="font-semibold"> 홈 화면에 추가</span>를 확인해 주세요.
    </div>
  );
}