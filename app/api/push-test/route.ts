// app/api/push-test/route.ts
import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PushRow = {
  id?: number | string;
  endpoint?: string | null;
  p256dh?: string | null;
  auth?: string | null;
};

function normalizeEnv(value?: string | null) {
  return (value ?? "").trim().replace(/^["']|["']$/g, "");
}

function isVapidPrivateKeyLikelyValid(key: string) {
  try {
    const normalized = key.replace(/-/g, "+").replace(/_/g, "/");
    const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
    const decoded = Buffer.from(normalized + pad, "base64");
    return decoded.length === 32;
  } catch {
    return false;
  }
}

function rowToSubscription(row: PushRow) {
  if (!row.endpoint || !row.p256dh || !row.auth) return null;

  return {
    endpoint: row.endpoint,
    keys: {
      p256dh: row.p256dh,
      auth: row.auth,
    },
  };
}

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = normalizeEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const serviceRoleKey = normalizeEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);

    const vapidSubject =
      normalizeEnv(process.env.VAPID_SUBJECT) ||
      normalizeEnv(process.env.NEXT_PUBLIC_VAPID_SUBJECT);

    const vapidPublicKey = normalizeEnv(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
    const vapidPrivateKey = normalizeEnv(process.env.VAPID_PRIVATE_KEY);

    if (!supabaseUrl) {
      return NextResponse.json(
        { ok: false, error: "NEXT_PUBLIC_SUPABASE_URL 가 비어 있습니다." },
        { status: 500 }
      );
    }

    if (!serviceRoleKey) {
      return NextResponse.json(
        { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY 가 비어 있습니다." },
        { status: 500 }
      );
    }

    if (!vapidSubject || !vapidPublicKey || !vapidPrivateKey) {
      return NextResponse.json(
        {
          ok: false,
          error: "VAPID 환경변수가 비어 있습니다. VAPID_SUBJECT / NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY 를 확인하세요.",
        },
        { status: 500 }
      );
    }

    if (!isVapidPrivateKeyLikelyValid(vapidPrivateKey)) {
      return NextResponse.json(
        {
          ok: false,
          error: "VAPID_PRIVATE_KEY 형식이 올바르지 않습니다. base64url 디코드 결과가 32바이트여야 합니다.",
        },
        { status: 500 }
      );
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .limit(5000);

    if (error) {
      return NextResponse.json(
        { ok: false, error: `push_subscriptions 조회 실패: ${error.message}` },
        { status: 500 }
      );
    }

    const rows = (data || []) as PushRow[];
    const subscriptions = rows
      .map((row) => ({ row, sub: rowToSubscription(row) }))
      .filter((item) => item.sub !== null) as Array<{
      row: PushRow;
      sub: { endpoint: string; keys: { p256dh: string; auth: string } };
    }>;

    if (subscriptions.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "전송할 구독이 없습니다.",
        totalRows: rows.length,
        validSubscriptions: 0,
      });
    }

    const body = await req.json().catch(() => null);

    const payload = JSON.stringify({
      title: body?.title || "하테나 테스트 알림",
      body: body?.body || "푸시 테스트가 정상 동작했습니다.",
      url: "/mypage",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      timestamp: Date.now(),
    });

    const settled = await Promise.allSettled(
      subscriptions.map(async ({ row, sub }) => {
        try {
          await webpush.sendNotification(sub, payload);
          return {
            ok: true,
            id: row.id ?? null,
            endpoint: row.endpoint ?? null,
          };
        } catch (err: any) {
          const statusCode = err?.statusCode ?? null;
          const message = err?.message ?? "unknown error";
          const bodyText = err?.body ?? null;

          if ((statusCode === 404 || statusCode === 410) && row.id != null) {
            await admin.from("push_subscriptions").delete().eq("id", row.id);
          }

          return {
            ok: false,
            id: row.id ?? null,
            endpoint: row.endpoint ?? null,
            statusCode,
            message,
            body: bodyText,
          };
        }
      })
    );

    const success = settled
      .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
      .map((r) => r.value)
      .filter((v) => v.ok);

    const failed = settled
      .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
      .map((r) => r.value)
      .filter((v) => !v.ok);

    const crashed = settled
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r) => ({
        ok: false,
        message: r.reason?.message ?? String(r.reason),
      }));

    return NextResponse.json({
      ok: true,
      totalRows: rows.length,
      validSubscriptions: subscriptions.length,
      successCount: success.length,
      failedCount: failed.length + crashed.length,
      success,
      failed: [...failed, ...crashed],
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message ?? "push test failed",
      },
      { status: 500 }
    );
  }
}