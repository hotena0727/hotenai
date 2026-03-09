'use client';

import { useEffect, useMemo, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export default function InstallButton() {
  const [mounted, setMounted] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setMounted(true);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      console.log('[PWA] beforeinstallprompt fired');
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      console.log('[PWA] appinstalled fired');
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
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  }, [mounted]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    console.log('[PWA] userChoice:', choice.outcome);

    // accepted / dismissed 이후 다시 숨김
    setDeferredPrompt(null);
  };

  if (!mounted) return null;

  // 이미 앱처럼 실행 중인 경우
  if (installed || isStandalone) {
    return (
      <div className="rounded-2xl bg-green-50 px-4 py-3 text-sm font-medium leading-6 text-green-700">
        이미 앱처럼 설치되어 사용 중입니다.
      </div>
    );
  }

  // iPhone / iPad Safari 계열
  if (isIOS) {
    return (
      <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-700">
        <div className="font-semibold text-gray-900">Safari에서 설치하는 방법</div>
        <div className="mt-2">
          1. 아래쪽 <span className="font-semibold">공유 버튼</span>을 누르세요.
          <br />
          2. <span className="font-semibold">홈 화면에 추가</span>를 선택하세요.
        </div>
      </div>
    );
  }

  // 크롬에서 설치 가능 상태일 때만 버튼 표시
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

  // 아직 설치 가능 이벤트가 오지 않은 크롬/기타 브라우저
  return (
    <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-600">
      크롬에서는 설치 가능 상태가 되면 이곳에 설치 버튼이 나타납니다.
      <br />
      잠시 사용한 뒤 다시 확인하거나, 브라우저 메뉴의 설치 기능도 확인해 주세요.
    </div>
  );
}