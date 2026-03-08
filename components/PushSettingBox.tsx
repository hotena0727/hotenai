"use client";

import { useEffect, useState } from "react";
import {
  getCurrentPushSubscription,
  isPushSupported,
  subscribePush,
  syncExistingPushSubscription,
  unsubscribePush,
} from "@/lib/push";

export default function PushSettingBox() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const ok = await isPushSupported();
      setSupported(ok);

      if (!ok) return;

      const sub = await getCurrentPushSubscription();
      setEnabled(!!sub);

      if (sub) {
        await syncExistingPushSubscription();
      }
    })();
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    setMsg("");

    const result = await subscribePush();

    if (result.ok) {
      setEnabled(true);
      setMsg(result.mode === "new" ? "푸시 알림이 등록되었습니다." : "기존 푸시 알림이 연결되었습니다.");
    } else {
      setMsg(result.error);
    }

    setLoading(false);
  };

  const handleDisable = async () => {
    setLoading(true);
    setMsg("");

    const result = await unsubscribePush();

    if (result.ok) {
      setEnabled(false);
      setMsg("푸시 알림이 해제되었습니다.");
    } else {
      setMsg(result.error);
    }

    setLoading(false);
  };

  if (supported === null) {
    return <div>확인 중...</div>;
  }

  if (!supported) {
    return <div>이 브라우저에서는 푸시 알림을 지원하지 않습니다.</div>;
  }

  return (
    <div className="rounded-2xl border p-4 space-y-3">
      <div className="font-semibold">푸시 알림</div>
      <div className="text-sm">
        현재 상태: {enabled ? "사용 중" : "사용 안 함"}
      </div>

      <div className="flex gap-2">
        {!enabled ? (
          <button
            onClick={handleEnable}
            disabled={loading}
            className="rounded-xl border px-4 py-2"
          >
            {loading ? "등록 중..." : "알림 켜기"}
          </button>
        ) : (
          <button
            onClick={handleDisable}
            disabled={loading}
            className="rounded-xl border px-4 py-2"
          >
            {loading ? "해제 중..." : "알림 끄기"}
          </button>
        )}
      </div>

      {msg ? <div className="text-sm">{msg}</div> : null}
    </div>
  );
}