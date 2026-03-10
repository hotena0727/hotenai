import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { getPlanBadge, parsePlanOrNull, type PlanCode } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubscriptionRow = {
  id?: string | number;
  user_id?: string | null;
  subscription?: any;
  sub_json?: any;
  sub?: any;
};

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} 환경변수가 필요합니다.`);
  return value;
}

function pickEnv(...names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  throw new Error(`${names.join(" / ")} 환경변수가 필요합니다.`);
}

async function requireAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  if (!token) return { ok: false as const, message: "인증 토큰이 없습니다." };

  const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) {
    return { ok: false as const, message: "로그인 세션을 확인하지 못했습니다." };
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profileRow, error: profileError } = await adminClient
    .from("profiles")
    .select("is_admin, email")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError) return { ok: false as const, message: "관리자 권한을 확인하지 못했습니다." };
  if (!profileRow?.is_admin) return { ok: false as const, message: "관리자만 푸시를 보낼 수 있습니다." };

  return {
    ok: true as const,
    userId: authData.user.id,
    email: String(profileRow.email || authData.user.email || ""),
    adminClient,
  };
}

function normalizeSubscription(value: any) {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (typeof value === "object") return value;
  return null;
}

async function loadSubscriptionRows(
  adminClient: any,
  mode: "test" | "all" | "selected" | "plan",
  userId: string,
  targetUserId?: string,
  plan?: PlanCode
) {
  const columns = [
    "id,user_id,subscription",
    "id,user_id,sub_json",
    "id,user_id,sub",
    "user_id,subscription",
    "user_id,sub_json",
    "user_id,sub",
  ];

  let planUserIds: string[] = [];

  if (mode === "plan") {
    if (!plan) {
      throw new Error("플랜 기준 발송에는 유효한 플랜 값이 필요합니다.");
    }

    const { data: planRows, error: planError } = await adminClient
      .from("profiles")
      .select("id")
      .eq("plan", plan);

    if (planError) {
      throw new Error(`플랜 회원 조회 실패: ${planError.message}`);
    }

    planUserIds = (planRows || [])
      .map((row: any) => String(row.id || ""))
      .filter(Boolean);

    if (planUserIds.length === 0) {
      return {
        rows: [] as SubscriptionRow[],
        usedColumns: [] as string[],
        matchedUsers: 0,
      };
    }
  }

  for (const cols of columns) {
    let query = adminClient.from("push_subscriptions").select(cols);

    if (mode === "test") query = query.eq("user_id", userId);
    if (mode === "selected" && targetUserId) query = query.eq("user_id", targetUserId);
    if (mode === "plan") query = query.in("user_id", planUserIds);

    const { data, error } = await query.limit(mode === "all" ? 5000 : 2000);
    if (!error && Array.isArray(data)) {
      return {
        rows: data as SubscriptionRow[],
        usedColumns: cols.split(","),
        matchedUsers: mode === "plan" ? planUserIds.length : undefined,
      };
    }
  }

  throw new Error("push_subscriptions 테이블을 읽지 못했습니다.");
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    if (!admin.ok) return NextResponse.json({ error: admin.message }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const rawMode = String(body?.mode || "test").trim();

    const mode =
      rawMode === "all"
        ? "all"
        : rawMode === "selected"
          ? "selected"
          : rawMode === "plan"
            ? "plan"
            : "test";

    const targetUserId = String(body?.userId || "").trim();
    const plan = parsePlanOrNull(body?.plan);
    const probeOnly = Boolean(body?.probeOnly);
    const title = String(body?.title || "").trim();
    const message = String(body?.body || "").trim();
    const url = String(body?.url || "").trim();

    if (mode === "plan" && !plan) {
      return NextResponse.json(
        { error: "플랜 발송에는 free, light, standard, pro, vip 중 하나가 필요합니다." },
        { status: 400 }
      );
    }

    if (!probeOnly) {
      if (!title) return NextResponse.json({ error: "제목을 입력해 주세요." }, { status: 400 });
      if (!message) return NextResponse.json({ error: "내용을 입력해 주세요." }, { status: 400 });
    }

    if (mode === "selected" && !targetUserId) {
      return NextResponse.json({ error: "발송할 회원을 먼저 선택해 주세요." }, { status: 400 });
    }

    const loaded = await loadSubscriptionRows(
      admin.adminClient,
      mode,
      admin.userId,
      targetUserId,
      plan || undefined
    );

    const rows = loaded.rows;
    const subscriptions = rows
      .map((row) => normalizeSubscription(row.subscription ?? row.sub_json ?? row.sub))
      .filter(Boolean);

    const debug = {
      mode,
      targetUserId: targetUserId || "",
      plan: mode === "plan" && plan ? plan : "",
      total: subscriptions.length,
      matchedRows: rows.length,
      matchedUsers: loaded.matchedUsers ?? undefined,
      availableColumns: loaded.usedColumns,
      detail:
        subscriptions.length > 0
          ? "발송 가능한 구독이 확인되었습니다."
          : "구독 행은 있지만 실제 subscription 데이터가 비어 있거나 대상 구독이 없습니다.",
      note:
        mode === "test"
          ? "테스트 발송은 현재 관리자 계정 user_id 기준으로만 조회합니다."
          : mode === "selected"
            ? "선택 회원 발송은 지정한 회원 user_id 기준으로만 조회합니다."
            : mode === "plan" && plan
              ? `${getPlanBadge(plan)} 플랜 회원 전체를 기준으로 조회합니다.`
              : "전체 발송은 저장된 전체 구독을 조회합니다.",
    };

    if (probeOnly) {
      return NextResponse.json({
        ok: true,
        total: subscriptions.length,
        debug,
      });
    }

    if (subscriptions.length === 0) {
      return NextResponse.json(
        {
          error:
            mode === "test"
              ? "테스트 대상 구독이 없습니다. 현재 관리자 계정으로 푸시 구독이 저장되어 있는지 확인해 주세요."
              : mode === "selected"
                ? "선택 회원 구독이 없습니다."
                : mode === "plan" && plan
                  ? `${getPlanBadge(plan)} 플랜 회원 중 발송 가능한 구독이 없습니다.`
                  : "발송 대상 구독이 없습니다.",
          debug,
        },
        { status: 400 }
      );
    }

    const vapidPublicKey = pickEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PUBLIC_KEY");
    const vapidPrivateKey = pickEnv("VAPID_PRIVATE_KEY");
    const vapidSubject = pickEnv("VAPID_SUBJECT", "NEXT_PUBLIC_VAPID_SUBJECT");

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const payload = JSON.stringify({
      title,
      body: message,
      url,
    });

    const results = await Promise.allSettled(
      subscriptions.map((sub) => webpush.sendNotification(sub, payload))
    );

    const sent = results.filter((item) => item.status === "fulfilled").length;
    const failed = results.length - sent;

    return NextResponse.json({
      ok: true,
      total: subscriptions.length,
      sent,
      failed,
      debug: {
        ...debug,
        detail: "푸시 발송 요청이 완료되었습니다.",
      },
    });
  } catch (error) {
    console.error("[admin-push] failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "푸시 발송 중 오류가 발생했습니다.",
        debug: {
          detail: error instanceof Error ? error.message : "unknown_error",
        },
      },
      { status: 500 }
    );
  }
}