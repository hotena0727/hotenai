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

type ProfileLite = {
  plan: string;
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
            plan: String(profileRow?.plan || "FREE").toUpperCase(),
            is_admin: Boolean(profileRow?.is_admin),
          });
        }

        const { data: menuRow, error: menuError } = await supabase
          .from("app_menu_settings")
          .select(
            "show_home, show_word, show_kanji, show_katsuyou, show_talk, show_mypage, show_admin"
          )
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
          {menuSettings.show_home ? (
            <a href="/" className={linkClass("home")}>
              홈
            </a>
          ) : null}

          {menuSettings.show_word ? (
            <a href="/word" className={linkClass("word")}>
              단어
            </a>
          ) : null}

          {menuSettings.show_kanji ? (
            <a href="/kanji" className={linkClass("kanji")}>
              한자
            </a>
          ) : null}

          {menuSettings.show_katsuyou ? (
            <a href="/katsuyou" className={linkClass("katsuyou")}>
              활용
            </a>
          ) : null}

          {menuSettings.show_talk ? (
            <a href="/talk" className={linkClass("talk")}>
              회화
            </a>
          ) : null}

          {menuSettings.show_mypage ? (
            <a href="/mypage" className={linkClass("mypage")}>
              MY
            </a>
          ) : null}

          {profile.is_admin && menuSettings.show_admin ? (
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