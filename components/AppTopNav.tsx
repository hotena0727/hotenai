"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ActiveKey = "home" | "word" | "kanji" | "talk" | "mypage" | "none";

type ProfileLite = {
  plan: string;
  is_admin: boolean;
};

function getActiveKey(pathname: string): ActiveKey {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/word")) return "word";
  if (pathname.startsWith("/kanji")) return "kanji";
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

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setProfile({
            plan: "FREE",
            is_admin: false,
          });
          return;
        }

        const { data: profileRow } = await supabase
          .from("profiles")
          .select("plan, is_admin")
          .eq("id", user.id)
          .maybeSingle();

        setProfile({
          plan: String(profileRow?.plan || "FREE").toUpperCase(),
          is_admin: Boolean(profileRow?.is_admin),
        });
      } catch (error) {
        console.error(error);
        setProfile({
          plan: "FREE",
          is_admin: false,
        });
      }
    };

    void loadProfile();
  }, []);

  const active = useMemo(() => getActiveKey(pathname), [pathname]);

  if (shouldHideNav(pathname)) {
    return null;
  }

  const linkClass = (key: ActiveKey) =>
    active === key
      ? "border-b-2 border-blue-500 py-5 text-center text-base font-semibold text-gray-900"
      : "py-5 text-center text-base font-semibold text-gray-500";

  return (
    <>
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-3xl px-4">
          <nav className="grid grid-cols-5">
            <a href="/" className={linkClass("home")}>
              홈
            </a>
            <a href="/word" className={linkClass("word")}>
              단어
            </a>
            <a href="/kanji" className={linkClass("kanji")}>
              한자
            </a>
            <a href="/talk" className={linkClass("talk")}>
              회화
            </a>
            <a href="/mypage" className={linkClass("mypage")}>
              MY
            </a>
          </nav>
        </div>
      </div>

      <div className="mx-auto mt-3 max-w-3xl px-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-base font-medium">
          <span>
            {profile.plan === "PRO" ? "✨ PRO 이용 중입니다" : "FREE 이용 중입니다"}
          </span>

          {profile.is_admin ? (
            <a
              href="/admin"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-sm text-gray-700"
              aria-label="관리자"
              title="관리자"
            >
              ⚙️
            </a>
          ) : null}
        </div>
      </div>
    </>
  );
}