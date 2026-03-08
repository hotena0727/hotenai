import { supabase } from "@/lib/supabase";

export type TalkFeatureKey = "talk_listen" | "talk_record";

export type DailyFeatureUsageResult = {
  ok: boolean;
  error?: string;
  used: number;
  limit: number;
  remaining: number;
  day_kst?: string;
};

export async function fetchTalkFeatureUsage(
  feature: TalkFeatureKey,
  limit = 3
): Promise<DailyFeatureUsageResult> {
  try {
    const { data, error } = await supabase.rpc("get_daily_feature_usage", {
      p_feature: feature,
      p_limit: limit,
    });

    if (error) {
      console.error(error);
      return {
        ok: false,
        error: error.message || "usage 조회 실패",
        used: 0,
        limit,
        remaining: limit,
      };
    }

    return {
      ok: Boolean(data?.ok),
      error: data?.error ? String(data.error) : undefined,
      used: Number(data?.used ?? 0),
      limit: Number(data?.limit ?? limit),
      remaining: Number(data?.remaining ?? limit),
      day_kst: data?.day_kst ? String(data.day_kst) : undefined,
    };
  } catch (error) {
    console.error(error);
    return {
      ok: false,
      error: "usage 조회 중 예외 발생",
      used: 0,
      limit,
      remaining: limit,
    };
  }
}

export async function consumeTalkFeatureUsage(
  feature: TalkFeatureKey,
  limit = 3
): Promise<DailyFeatureUsageResult> {
  try {
    const { data, error } = await supabase.rpc("use_daily_feature", {
      p_feature: feature,
      p_limit: limit,
    });

    if (error) {
      console.error(error);
      return {
        ok: false,
        error: error.message || "usage 차감 실패",
        used: 0,
        limit,
        remaining: limit,
      };
    }

    return {
      ok: Boolean(data?.ok),
      error: data?.error ? String(data.error) : undefined,
      used: Number(data?.used ?? 0),
      limit: Number(data?.limit ?? limit),
      remaining: Number(data?.remaining ?? limit),
      day_kst: data?.day_kst ? String(data.day_kst) : undefined,
    };
  } catch (error) {
    console.error(error);
    return {
      ok: false,
      error: "usage 차감 중 예외 발생",
      used: 0,
      limit,
      remaining: limit,
    };
  }
}
