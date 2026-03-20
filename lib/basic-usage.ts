import { supabase } from "@/lib/supabase";
import { fetchTodayBasicQuizSetCount } from "@/lib/attempts";
import { isPaidPlan, normalizePlan, type PlanCode } from "@/lib/plans";

export function makeTodayUsageCacheKey(appKey: string, userId: string, todayKey: string) {
  return `${appKey}-today-usage:${userId}:${todayKey}`;
}

export function readTodayUsageCache(
  appKey: string,
  userId: string,
  todayKey: string
): number | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(
      makeTodayUsageCacheKey(appKey, userId, todayKey)
    );
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeTodayUsageCache(
  appKey: string,
  userId: string,
  todayKey: string,
  value: number
) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      makeTodayUsageCacheKey(appKey, userId, todayKey),
      String(value)
    );
  } catch {
    // noop
  }
}

type LoadBasicUsageResult = {
  plan: PlanCode;
  isAdminUser: boolean;
  used: number;
  limitMessage: string;
};

export async function loadBasicPlanAndUsage(params: {
  appKey: string;
  todayKey: string;
  dailyFreeSetLimit: number;
  limitReachedMessageWithUpgrade: string;
}): Promise<LoadBasicUsageResult> {
  const {
    appKey,
    todayKey,
    dailyFreeSetLimit,
    limitReachedMessageWithUpgrade,
  } = params;

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const user = session?.user;
    if (!user) {
      return {
        plan: "free",
        isAdminUser: false,
        used: 0,
        limitMessage: "",
      };
    }

    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("plan, is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error(profileError);
    }

    const plan = normalizePlan(profileRow?.plan);
    const isAdminUser = Boolean(profileRow?.is_admin);

    const cachedUsed = readTodayUsageCache(appKey, user.id, todayKey);

    if (cachedUsed !== null) {
      return {
        plan,
        isAdminUser,
        used: cachedUsed,
        limitMessage:
          !isPaidPlan(plan) && cachedUsed >= dailyFreeSetLimit
            ? limitReachedMessageWithUpgrade
            : "",
      };
    }

    const used = await fetchTodayBasicQuizSetCount(user.id);
    writeTodayUsageCache(appKey, user.id, todayKey, used);

    return {
      plan,
      isAdminUser,
      used,
      limitMessage:
        !isPaidPlan(plan) && used >= dailyFreeSetLimit
          ? limitReachedMessageWithUpgrade
          : "",
    };
  } catch (error) {
    console.error(error);
    return {
      plan: "free",
      isAdminUser: false,
      used: 0,
      limitMessage: "",
    };
  }
}