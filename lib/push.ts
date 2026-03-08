// lib/push.ts

import { supabase } from "@/lib/supabase";

type PushSubscribeResult =
  | { ok: true; subscription: PushSubscription; mode: "existing" | "new" }
  | { ok: false; error: string };

function normalizeEnv(value?: string | null) {
  return (value ?? "").trim().replace(/^["']|["']$/g, "");
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const normalized = base64String.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  const base64 = normalized + padding;
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

async function getAccessToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token || "";
}

export async function isPushSupported(): Promise<boolean> {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!(await isPushSupported())) {
    throw new Error("이 브라우저는 웹푸시를 지원하지 않습니다.");
  }

  const reg = await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none",
  });

  return reg;
}

export async function getNotificationPermission(): Promise<NotificationPermission> {
  if (!(await isPushSupported())) {
    throw new Error("이 브라우저는 알림 기능을 지원하지 않습니다.");
  }

  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";

  return await Notification.requestPermission();
}

export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  const reg = await registerPushServiceWorker();
  return await reg.pushManager.getSubscription();
}

export async function subscribePush(): Promise<PushSubscribeResult> {
  try {
    if (!(await isPushSupported())) {
      return { ok: false, error: "이 브라우저는 웹푸시를 지원하지 않습니다." };
    }

    const vapidPublicKey = normalizeEnv(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
    if (!vapidPublicKey) {
      return { ok: false, error: "NEXT_PUBLIC_VAPID_PUBLIC_KEY 가 비어 있습니다." };
    }

    const permission = await getNotificationPermission();
    if (permission !== "granted") {
      return { ok: false, error: "알림 권한이 허용되지 않았습니다." };
    }

    const reg = await registerPushServiceWorker();

    let subscription = await reg.pushManager.getSubscription();
    let mode: "existing" | "new" = "existing";

    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });
      mode = "new";
    }

    const accessToken = await getAccessToken();
    if (!accessToken) {
      return { ok: false, error: "로그인 세션을 찾지 못했습니다." };
    }

    const res = await fetch("/api/push-subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ subscription }),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.ok) {
      return {
        ok: false,
        error: json?.error || `push-subscribe 실패 (${res.status})`,
      };
    }

    return { ok: true, subscription, mode };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function unsubscribePush(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!(await isPushSupported())) {
      return { ok: false, error: "이 브라우저는 웹푸시를 지원하지 않습니다." };
    }

    const reg = await registerPushServiceWorker();
    const subscription = await reg.pushManager.getSubscription();

    if (!subscription) {
      return { ok: true };
    }

    const accessToken = await getAccessToken();
    if (!accessToken) {
      return { ok: false, error: "로그인 세션을 찾지 못했습니다." };
    }

    const endpoint = subscription.endpoint;

    const apiRes = await fetch("/api/push-unsubscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ endpoint }),
    });

    const apiJson = await apiRes.json().catch(() => null);

    if (!apiRes.ok || !apiJson?.ok) {
      return {
        ok: false,
        error: apiJson?.error || `push-unsubscribe 실패 (${apiRes.status})`,
      };
    }

    await subscription.unsubscribe();

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function syncExistingPushSubscription(): Promise<
  { ok: true; hasSubscription: boolean } | { ok: false; error: string }
> {
  try {
    if (!(await isPushSupported())) {
      return { ok: true, hasSubscription: false };
    }

    const reg = await registerPushServiceWorker();
    const subscription = await reg.pushManager.getSubscription();

    if (!subscription) {
      return { ok: true, hasSubscription: false };
    }

    const accessToken = await getAccessToken();
    if (!accessToken) {
      return { ok: false, error: "로그인 세션을 찾지 못했습니다." };
    }

    const res = await fetch("/api/push-subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ subscription }),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.ok) {
      return {
        ok: false,
        error: json?.error || `기존 구독 동기화 실패 (${res.status})`,
      };
    }

    return { ok: true, hasSubscription: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}