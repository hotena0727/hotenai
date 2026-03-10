"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { hasPlan, normalizePlan, type PlanCode } from "@/lib/plans";

type ActiveKey =
  | "home"
  | "word"
  | "kanji"
  | "katsuyou"
  | "talk"
  | "mypage"
  | "none";

type ProfileLite = {
  plan: PlanCode;
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

  home_min_plan: PlanCode;
  word_min_plan: PlanCode;
  kanji_min_plan: PlanCode;
  katsuyou_min_plan: PlanCode;
  talk_min_plan: PlanCode;
  mypage_min_plan: PlanCode;
  admin_min_plan: PlanCode;
};

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

function hasMenuAccess(userPlan: PlanCode, minPlan: PlanCode): boolean {
  return hasPlan(userPlan, minPlan);
}

function getPlanNavTheme(plan: PlanCode) {
  switch (plan) {
    case "free":
      return {
        wrap: "border-b border-gray-200 bg-white",
        active: "border-b-2 border-gray-900 text-gray-900",
        inactive: "text-gray-500 hover:text-gray-700",
        adminBtn:
          "border border-gray-200 bg-white/90 text-gray-600 hover:bg-gray-50",
      };

    case "light":
      return {
        wrap: "border-b border-sky-100 bg-sky-50/80",
        active: "border-b-2 border-sky-500 text-sky-900",
        inactive: "text-sky-700/80 hover:text-sky-900",
        adminBtn:
          "border border-sky-200 bg-white/90 text-sky-700 hover:bg-sky-50",
      };

    case "standard":
      return {
        wrap: "border-b border-violet-100 bg-violet-50/80",
        active: "border-b-2 border-violet-500 text-violet-900",
        inactive: "text-violet-700/80 hover:text-violet-900",
        adminBtn:
          "border border-violet-200 bg-white/90 text-violet-700 hover:bg-violet-50",
      };

    case "pro":
      return {
        wrap: "border-b border-blue-100 bg-blue-50/80",
        active: "border-b-2 border-blue-500 text-blue-900",
        inactive: "text-blue-700/80 hover:text-blue-900",
        adminBtn:
          "border border-blue-200 bg-white/90 text-blue-700 hover:bg-blue-50",
      };

    case "vip":
      return {
        wrap: "border-b border-amber-200 bg-amber-50/90",
        active: "border-b-2 border-amber-500 text-amber-900",
        inactive: "text-amber-700/90 hover:text-amber-900",
        adminBtn:
          "border border-amber-200 bg-white/90 text-amber-700 hover:bg-amber-50",
      };

    default:
      return {
        wrap: "border-b border-gray-200 bg-white",
        active: "border-b-2 border-gray-900 text-gray-900",
        inactive: "text-gray-500 hover:text-gray-700",
        adminBtn:
          "border border-gray-200 bg-white/90 text-gray-600 hover:bg-gray-50",
      };
  }
}

const DEFAULT_MENU_SETTINGS: MenuSettings = {
  show_home: true,
  show_word: true,
  show_kanji: true,
  show_katsuyou: true,
  show_talk: true,
  show_mypage: true,
  show_admin: true,

  home_min_plan: "free",
  word_min_plan: "free",
  kanji_min_plan: "free",
  katsuyou_min_plan: "free",
  talk_min_plan: "free",
  mypage_min_plan: "free",
  admin_min_plan: "pro",
};

export default function AppTopNav() {
  const pathname = usePathname();

  const [profile, setProfile] = useState<ProfileLite>({
    plan: "free",
    is_admin: false,
  });

  const [menuSettings, setMenuSettings] =
    useState<MenuSettings>(DEFAULT_MENU_SETTINGS);

  useEffect(() => {
    const loadProfileAndMenu = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setProfile({
            plan: "free",
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
            admin_min_plan: normalizePlan(menuRow.admin_min_plan || "pro"),
          });
        }
      } catch (error) {
        console.error(error);
        setProfile({
          plan: "free",
          is_admin: false,
        });
        setMenuSettings(DEFAULT_MENU_SETTINGS);
      }
    };

    void loadProfileAndMenu();
  }, []);

  const active = useMemo(() => getActiveKey(pathname), [pathname]);
  const theme = useMemo(() => getPlanNavTheme(profile.plan), [profile.plan]);

  const visibleMenus = useMemo(
    () => [
      menuSettings.show_home &&
      hasMenuAccess(profile.plan, menuSettings.home_min_plan) && {
        key: "home" as ActiveKey,
        href: "/",
        label: "홈",
      },

      menuSettings.show_word &&
      hasMenuAccess(profile.plan, menuSettings.word_min_plan) && {
        key: "word" as ActiveKey,
        href: "/word",
        label: "단어",
      },

      menuSettings.show_kanji &&
      hasMenuAccess(profile.plan, menuSettings.kanji_min_plan) && {
        key: "kanji" as ActiveKey,
        href: "/kanji",
        label: "한자",
      },

      menuSettings.show_katsuyou &&
      hasMenuAccess(profile.plan, menuSettings.katsuyou_min_plan) && {
        key: "katsuyou" as ActiveKey,
        href: "/katsuyou",
        label: "활용",
      },

      menuSettings.show_talk &&
      hasMenuAccess(profile.plan, menuSettings.talk_min_plan) && {
        key: "talk" as ActiveKey,
        href: "/talk",
        label: "회화",
      },

      menuSettings.show_mypage &&
      hasMenuAccess(profile.plan, menuSettings.mypage_min_plan) && {
        key: "mypage" as ActiveKey,
        href: "/mypage",
        label: "MY",
      },
    ].filter(Boolean) as Array<{
      key: ActiveKey;
      href: string;
      label: string;
    }>,
    [menuSettings, profile.plan]
  );

  if (shouldHideNav(pathname)) {
    return null;
  }

  const linkClass = (key: ActiveKey) =>
    active === key
      ? `shrink-0 px-2 py-5 text-sm font-semibold sm:text-base ${theme.active}`
      : `shrink-0 px-2 py-5 text-sm font-semibold sm:text-base transition ${theme.inactive}`;

  return (
    <div className={theme.wrap}>
      <div className="mx-auto max-w-3xl px-4">
        <nav className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto whitespace-nowrap scrollbar-hide">
            {visibleMenus.map((menu) => (
              <a key={menu.key} href={menu.href} className={linkClass(menu.key)}>
                {menu.label}
              </a>
            ))}
          </div>

          {profile.is_admin &&
          menuSettings.show_admin &&
          hasMenuAccess(profile.plan, menuSettings.admin_min_plan) ? (
            <a
              href="/admin"
              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm transition ${theme.adminBtn}`}
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