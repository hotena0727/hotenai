'use client';

import { useEffect, useMemo, useState } from 'react';

export default function InstallButton() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
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

  if (!mounted) return null;

  if (isStandalone) {
    return (
      <div className="rounded-2xl bg-green-50 px-4 py-3 text-sm font-medium leading-6 text-green-700">
        이미 홈 화면에 추가되어 앱처럼 사용 중입니다.
      </div>
    );
  }

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

  return (
    <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-600">
      Chrome 또는 Edge에서는 브라우저 메뉴에서 설치 기능을 사용할 수 있어요.
    </div>
  );
}