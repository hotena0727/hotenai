import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} 환경변수가 필요합니다.`);
  return value;
}

async function requireAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  if (!token) {
    return { ok: false as const, message: "인증 토큰이 없습니다." };
  }

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

  if (profileError) {
    return { ok: false as const, message: "관리자 권한을 확인하지 못했습니다." };
  }

  if (!profileRow?.is_admin) {
    return { ok: false as const, message: "관리자만 플랜을 변경할 수 있습니다." };
  }

  return { ok: true as const, adminClient };
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    if (!admin.ok) {
      return NextResponse.json({ error: admin.message }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const userId = String(body?.userId || "").trim();
    const plan = String(body?.plan || "").trim().toLowerCase();

    if (!userId) {
      return NextResponse.json({ error: "회원 ID가 필요합니다." }, { status: 400 });
    }

    if (plan !== "free" && plan !== "pro") {
      return NextResponse.json(
        { error: "플랜은 free 또는 pro만 가능합니다." },
        { status: 400 }
      );
    }

    const { error } = await admin.adminClient
      .from("profiles")
      .update({
        plan,
      })
      .eq("id", userId);

    if (error) {
      return NextResponse.json(
        { error: `플랜 저장 실패: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      userId,
      plan,
    });
  } catch (error) {
    console.error("[admin-member-plan] failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "플랜 저장 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}