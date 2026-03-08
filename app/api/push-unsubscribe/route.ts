import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeEnv(value?: string | null) {
  return (value ?? "").trim().replace(/^["']|["']$/g, "");
}

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = normalizeEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const serviceRoleKey = normalizeEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);

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

    const body = await req.json().catch(() => null);
    const endpoint = body?.endpoint;

    if (!endpoint || typeof endpoint !== "string") {
      return NextResponse.json(
        { ok: false, error: "endpoint 가 필요합니다." },
        { status: 400 }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error } = await admin
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", endpoint);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      action: "deleted",
      endpoint,
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