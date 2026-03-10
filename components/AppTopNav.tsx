"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ActiveKey =
  | "home"
  | "word"
  | "kanji"
  | "katsuyou"
  | "talk"
  | "mypage"
  | "none";

type PlanType = "FREE" | "PRO";

type ProfileLite = {
  plan: PlanType;
  is_admin: boolean;
};

type MenuSettings = {
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

function normalizePlan(value?: string | null): PlanType {
  return String(value || "FREE").toUpperCase() === "PRO" ? "PRO" : "FREE";
}

function getActiveKey(pathname: string): ActiveKey {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/word")) return "word";
  if (pathname.startsWith("/kanji")) return "kanji";
  if (pathname.startsWith("/katsuyou")) return "katsuyou";
  if (pathname.startsWith("/talk")) return "talk";
  if (pathname.startsWith("/mypage")) return "mypage";
  return "none";
}

function shouldHideNav(pathname: string): boolean {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/auth")
  );
}

function hasMenuAccess(userPlan: PlanType, minPlan: PlanType): boolean {
  if (minPlan === "FREE") return true;
  return userPlan === "PRO";
}

export default function AppTopNav() {
  const pathname = usePathname();

  const [profile, setProfile] = useState<ProfileLite>({
    plan: "FREE",
    is_admin: false,
  });

  const [menuSettings, setMenuSettings] = useState<MenuSettings>({
    show_home: true,
    show_word: true,
    show_kanji: true,
    show_katsuyou: true,
    show_talk: true,
    show_mypage: true,
    show_admin: true,

    home_min_plan: "FREE",
    word_min_plan: "FREE",
    kanji_min_plan: "FREE",
    katsuyou_min_plan: "FREE",
    talk_min_plan: "FREE",
    mypage_min_plan: "FREE",
    admin_min_plan: "PRO",
  });

  useEffect(() => {
    const loadProfileAndMenu = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setProfile({
            plan: "FREE",
            is_admin: false,
          });
        } else {
          const { data: profileRow, error: profileError } = await supabase
            .from("profiles")
            .select("plan, is_admin")
            .eq("id", user.id)
            .maybeSingle();

          if (profileError) {
            console.error(profileError);
          }

          setProfile({
            plan: normalizePlan(profileRow?.plan),
            is_admin: Boolean(profileRow?.is_admin),
          });
        }

        const { data: menuRow, error: menuError } = await supabase
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

        if (menuError) {
          console.error(menuError);
          return;
        }

        if (menuRow) {
          setMenuSettings({
            show_home: Boolean(menuRow.show_home),
            show_word: Boolean(menuRow.show_word),
            show_kanji: Boolean(menuRow.show_kanji),
            show_katsuyou: Boolean(menuRow.show_katsuyou),
            show_talk: Boolean(menuRow.show_talk),
            show_mypage: Boolean(menuRow.show_mypage),
            show_admin: Boolean(menuRow.show_admin),

            home_min_plan: normalizePlan(menuRow.home_min_plan),
            word_min_plan: normalizePlan(menuRow.word_min_plan),
            kanji_min_plan: normalizePlan(menuRow.kanji_min_plan),
            katsuyou_min_plan: normalizePlan(menuRow.katsuyou_min_plan),
            talk_min_plan: normalizePlan(menuRow.talk_min_plan),
            mypage_min_plan: normalizePlan(menuRow.mypage_min_plan),
            admin_min_plan: normalizePlan(menuRow.admin_min_plan || "PRO"),
          });
        }
      } catch (error) {
        console.error(error);
        setProfile({
          plan: "FREE",
          is_admin: false,
        });
      }
    };

    void loadProfileAndMenu();
  }, []);

  const active = useMemo(() => getActiveKey(pathname), [pathname]);

  if (shouldHideNav(pathname)) {
    return null;
  }

  const linkClass = (key: ActiveKey) =>
    active === key
      ? "border-b-2 border-blue-500 px-2 py-5 text-sm font-semibold text-gray-900 sm:text-base"
      : "px-2 py-5 text-sm font-semibold text-gray-500 sm:text-base";

  return (
    <div
      className={
        profile.plan === "PRO"
          ? "border-b border-blue-100 bg-blue-50/60"
          : "border-b border-gray-200 bg-white"
      }
    >
      <div className="mx-auto max-w-3xl px-4">
        <nav className="flex items-center justify-between gap-2">
          {menuSettings.show_home &&
          hasMenuAccess(profile.plan, menuSettings.home_min_plan) ? (
            <a href="/" className={linkClass("home")}>
              홈
            </a>
          ) : null}

          {menuSettings.show_word &&
          hasMenuAccess(profile.plan, menuSettings.word_min_plan) ? (
            <a href="/word" className={linkClass("word")}>
              단어
            </a>
          ) : null}

          {menuSettings.show_kanji &&
          hasMenuAccess(profile.plan, menuSettings.kanji_min_plan) ? (
            <a href="/kanji" className={linkClass("kanji")}>
              한자
            </a>
          ) : null}

          {menuSettings.show_katsuyou &&
          hasMenuAccess(profile.plan, menuSettings.katsuyou_min_plan) ? (
            <a href="/katsuyou" className={linkClass("katsuyou")}>
              활용
            </a>
          ) : null}

          {menuSettings.show_talk &&
          hasMenuAccess(profile.plan, menuSettings.talk_min_plan) ? (
            <a href="/talk" className={linkClass("talk")}>
              회화
            </a>
          ) : null}

          {menuSettings.show_mypage &&
          hasMenuAccess(profile.plan, menuSettings.mypage_min_plan) ? (
            <a href="/mypage" className={linkClass("mypage")}>
              MY
            </a>
          ) : null}

          {profile.is_admin &&
          menuSettings.show_admin &&
          hasMenuAccess(profile.plan, menuSettings.admin_min_plan) ? (
            <a
              href="/admin"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/80 text-sm text-gray-600 transition hover:bg-white"
              aria-label="관리자"
              title="관리자"
            >
              ⚙️
            </a>
          ) : null}
        </nav>
      </div>
    </div>
  );
}