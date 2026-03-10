"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getPlanTheme, hasPlan, normalizePlan, type PlanCode } from "@/lib/plans";

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
  const theme = useMemo(() => getPlanTheme(profile.plan), [profile.plan]);

  const visibleMenus = useMemo(
    () =>
      [
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
      ? `flex min-w-0 items-center justify-center whitespace-nowrap px-2 py-5 text-center text-sm font-semibold sm:text-base ${theme.navActive}`
      : `flex min-w-0 items-center justify-center whitespace-nowrap px-2 py-5 text-center text-sm font-semibold sm:text-base transition ${theme.navInactive}`;

  const showAdmin =
    profile.is_admin &&
    menuSettings.show_admin &&
    hasMenuAccess(profile.plan, menuSettings.admin_min_plan);

  return (
    <div className={theme.nav}>
      <div className="mx-auto max-w-3xl px-4">
        <nav className="flex items-center gap-3">
          <div
            className="grid min-w-0 flex-1 items-stretch"
            style={{
              gridTemplateColumns: `repeat(${Math.max(visibleMenus.length, 1)}, minmax(0, 1fr))`,
            }}
          >
            {visibleMenus.map((menu) => (
              <a key={menu.key} href={menu.href} className={linkClass(menu.key)}>
                {menu.label}
              </a>
            ))}
          </div>

          {showAdmin ? (
            <a
              href="/admin"
              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm transition hover:opacity-90 ${theme.badge}`}
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