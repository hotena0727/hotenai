import { supabase } from "@/lib/supabase";

export type PlanType = "FREE" | "PRO";

export type MenuSettings = {
  show_home: boolean;
  show_word: boolean;
  show_kanji: boolean;
  show_katsuyou: boolean;
  show_talk: boolean;
  show_mypage: boolean;
  show_admin: boolean;

  home_min_plan: PlanType;
  word_min_plan: PlanType;
  kanji_min_plan: PlanType;
  katsuyou_min_plan: PlanType;
  talk_min_plan: PlanType;
  mypage_min_plan: PlanType;
  admin_min_plan: PlanType;
};

export type MenuKey =
  | "home"
  | "word"
  | "kanji"
  | "katsuyou"
  | "talk"
  | "mypage"
  | "admin";

function normalizePlan(value?: string | null): PlanType {
  return String(value || "FREE").toUpperCase() === "PRO" ? "PRO" : "FREE";
}

export function hasMenuAccess(
  userPlan: PlanType,
  minPlan: PlanType,
  show: boolean
): boolean {
  if (!show) return false;
  if (minPlan === "FREE") return true;
  return userPlan === "PRO";
}

export async function fetchMyPlan(): Promise<PlanType> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return "FREE";

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .maybeSingle();

  return normalizePlan(profileRow?.plan);
}

export async function fetchMenuSettings(): Promise<MenuSettings> {
  const { data: menuRow } = await supabase
    .from("app_menu_settings")
    .select(`
      show_home,
      show_word,
      show_kanji,
      show_katsuyou,
      show_talk,
      show_mypage,
      show_admin,
      home_min_plan,
      word_min_plan,
      kanji_min_plan,
      katsuyou_min_plan,
      talk_min_plan,
      mypage_min_plan,
      admin_min_plan
    `)
    .eq("id", 1)
    .maybeSingle();

  return {
    show_home: Boolean(menuRow?.show_home ?? true),
    show_word: Boolean(menuRow?.show_word ?? true),
    show_kanji: Boolean(menuRow?.show_kanji ?? true),
    show_katsuyou: Boolean(menuRow?.show_katsuyou ?? true),
    show_talk: Boolean(menuRow?.show_talk ?? true),
    show_mypage: Boolean(menuRow?.show_mypage ?? true),
    show_admin: Boolean(menuRow?.show_admin ?? true),

    home_min_plan: normalizePlan(menuRow?.home_min_plan),
    word_min_plan: normalizePlan(menuRow?.word_min_plan),
    kanji_min_plan: normalizePlan(menuRow?.kanji_min_plan),
    katsuyou_min_plan: normalizePlan(menuRow?.katsuyou_min_plan),
    talk_min_plan: normalizePlan(menuRow?.talk_min_plan),
    mypage_min_plan: normalizePlan(menuRow?.mypage_min_plan),
    admin_min_plan: normalizePlan(menuRow?.admin_min_plan || "PRO"),
  };
}

export function canOpenMenu(
  menuKey: MenuKey,
  plan: PlanType,
  settings: MenuSettings,
  isAdmin = false
): boolean {
  if (menuKey === "home") {
    return hasMenuAccess(plan, settings.home_min_plan, settings.show_home);
  }
  if (menuKey === "word") {
    return hasMenuAccess(plan, settings.word_min_plan, settings.show_word);
  }
  if (menuKey === "kanji") {
    return hasMenuAccess(plan, settings.kanji_min_plan, settings.show_kanji);
  }
  if (menuKey === "katsuyou") {
    return hasMenuAccess(plan, settings.katsuyou_min_plan, settings.show_katsuyou);
  }
  if (menuKey === "talk") {
    return hasMenuAccess(plan, settings.talk_min_plan, settings.show_talk);
  }
  if (menuKey === "mypage") {
    return hasMenuAccess(plan, settings.mypage_min_plan, settings.show_mypage);
  }
  if (menuKey === "admin") {
    return (
      isAdmin &&
      hasMenuAccess(plan, settings.admin_min_plan, settings.show_admin)
    );
  }
  return false;
}