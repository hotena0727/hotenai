import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ScopeType = "mine" | "all";
type ModeType = "preview" | "execute";

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} 환경변수가 필요합니다.`);
  return value;
}

function normalizeBool(value: unknown) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function normalizeDays(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 30;
  return Math.max(0, Math.floor(n));
}

async function requireAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  if (!token) {
    return { ok: false as const, status: 403, message: "인증 토큰이 없습니다." };
  }

  const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) {
    return { ok: false as const, status: 403, message: "로그인 세션을 확인하지 못했습니다." };
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profileRow, error: profileError } = await adminClient
    .from("profiles")
    .select("id, email, is_admin")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError) {
    return { ok: false as const, status: 500, message: "관리자 권한을 확인하지 못했습니다." };
  }

  if (!profileRow?.is_admin) {
    return { ok: false as const, status: 403, message: "관리자만 기록 정리를 실행할 수 있습니다." };
  }

  return {
    ok: true as const,
    adminClient,
    adminUserId: String(authData.user.id),
    adminEmail: String(profileRow.email || authData.user.email || ""),
  };
}

function buildScopeLabel(scope: ScopeType, selectedUserId: string, deleteAll: boolean, days: number) {
  const targetLabel = scope === "all" ? "전체 회원" : selectedUserId ? "선택 회원" : "선택 회원";
  const rangeLabel = deleteAll ? "전체 기록" : `${days}일 이전 기록`;
  return `${targetLabel} · ${rangeLabel}`;
}

async function countTargets(params: {
  adminClient: any;
  scope: ScopeType;
  selectedUserId: string;
  deleteAll: boolean;
  days: number;
}) {
  const { adminClient, scope, selectedUserId, deleteAll, days } = params;

  let query = adminClient
    .from("quiz_attempts")
    .select("id, created_at, user_id", { count: "exact", head: true });

  if (scope === "mine") {
    query = query.eq("user_id", selectedUserId);
  }

  if (!deleteAll) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    query = query.lt("created_at", cutoff.toISOString());
  }

  const { count, error } = await query;
  if (error) {
    throw new Error(`기록 개수 확인 실패: ${error.message}`);
  }

  return Number(count || 0);
}

async function deleteTargets(params: {
  adminClient: any;
  scope: ScopeType;
  selectedUserId: string;
  deleteAll: boolean;
  days: number;
}) {
  const { adminClient, scope, selectedUserId, deleteAll, days } = params;

  let query = adminClient.from("quiz_attempts").delete();

  if (scope === "mine") {
    query = query.eq("user_id", selectedUserId);
  }

  if (!deleteAll) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    query = query.lt("created_at", cutoff.toISOString());
  }

  const { error, count } = await query.select("id", { count: "exact", head: true });
  if (error) {
    throw new Error(`기록 삭제 실패: ${error.message}`);
  }

  return Number(count || 0);
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    if (!admin.ok) {
      return NextResponse.json({ error: admin.message }, { status: admin.status });
    }

    const body = await req.json().catch(() => ({}));
    const mode = (String(body?.mode || "preview").trim() === "execute" ? "execute" : "preview") as ModeType;
    const scope = (String(body?.scope || "mine").trim() === "all" ? "all" : "mine") as ScopeType;
    const selectedUserId = String(body?.selectedUserId || "").trim();
    const deleteAll = normalizeBool(body?.deleteAll);
    const days = normalizeDays(body?.days);

    if (scope === "mine" && !selectedUserId) {
      return NextResponse.json({ error: "회원을 먼저 선택해 주세요." }, { status: 400 });
    }

    const scopeLabel = buildScopeLabel(scope, selectedUserId, deleteAll, days);

    if (mode === "preview") {
      const total = await countTargets({
        adminClient: admin.adminClient,
        scope,
        selectedUserId,
        deleteAll,
        days,
      });

      return NextResponse.json({
        ok: true,
        preview: {
          scopeLabel,
          days,
          total,
        },
      });
    }

    const deleted = await deleteTargets({
      adminClient: admin.adminClient,
      scope,
      selectedUserId,
      deleteAll,
      days,
    });

    return NextResponse.json({
      ok: true,
      deleted,
      summary: {
        scopeLabel,
        days,
        deleteAll,
      },
    });
  } catch (error) {
    console.error("[admin-log-cleanup] failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "기록 정리 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
