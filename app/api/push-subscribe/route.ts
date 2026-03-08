import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PushSubscriptionLike = {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

function normalizeEnv(value?: string | null) {
  return (value ?? "").trim().replace(/^["']|["']$/g, "");
}

function isValidSubscription(value: unknown): value is PushSubscriptionLike {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, any>;
  return (
    typeof v.endpoint === "string" &&
    v.endpoint.length > 0 &&
    v.keys &&
    typeof v.keys === "object" &&
    typeof v.keys.p256dh === "string" &&
    typeof v.keys.auth === "string"
  );
}

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = normalizeEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const anonKey = normalizeEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const serviceRoleKey = normalizeEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);

    if (!supabaseUrl) {
      return NextResponse.json(
        { ok: false, error: "NEXT_PUBLIC_SUPABASE_URL 가 비어 있습니다." },
        { status: 500 }
      );
    }

    if (!anonKey) {
      return NextResponse.json(
        { ok: false, error: "NEXT_PUBLIC_SUPABASE_ANON_KEY 가 비어 있습니다." },
        { status: 500 }
      );
    }

    if (!serviceRoleKey) {
      return NextResponse.json(
        { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY 가 비어 있습니다." },
        { status: 500 }
      );
    }

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : "";

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "인증 토큰이 없습니다." },
        { status: 401 }
      );
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authData, error: authError } = await authClient.auth.getUser(token);

    if (authError || !authData.user) {
      return NextResponse.json(
        { ok: false, error: "로그인 사용자를 확인하지 못했습니다." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);
    const subscription = body?.subscription;

    if (!isValidSubscription(subscription)) {
      return NextResponse.json(
        { ok: false, error: "유효한 PushSubscription 이 아닙니다." },
        { status: 400 }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const payload = {
      user_id: authData.user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      sub_json: subscription,
      updated_at: new Date().toISOString(),
    };

    const { data: existing, error: selectErr } = await admin
      .from("push_subscriptions")
      .select("id")
      .eq("endpoint", subscription.endpoint)
      .maybeSingle();

    if (selectErr) {
      return NextResponse.json(
        { ok: false, error: `select 실패: ${selectErr.message}` },
        { status: 500 }
      );
    }

    if (existing?.id) {
      const { error: updateErr } = await admin
        .from("push_subscriptions")
        .update(payload)
        .eq("id", existing.id);

      if (updateErr) {
        return NextResponse.json(
          { ok: false, error: `update 실패: ${updateErr.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        action: "updated",
        endpoint: subscription.endpoint,
        user_id: authData.user.id,
      });
    }

    const { error: insertErr } = await admin
      .from("push_subscriptions")
      .insert(payload);

    if (insertErr) {
      return NextResponse.json(
        { ok: false, error: `insert 실패: ${insertErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      action: "inserted",
      endpoint: subscription.endpoint,
      user_id: authData.user.id,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}