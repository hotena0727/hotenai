"use client";

import { supabase } from "@/lib/supabase";
import { useState } from "react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleGoogleLogin = async () => {
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: "http://localhost:3000/mypage",
      },
    });

    if (error) {
      setMessage("로그인 중 오류가 발생했습니다.");
      console.error(error);
    }

    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-white px-6 pt-34 pb-10 text-gray-900">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mx-auto max-w-3xl rounded-[30px] border border-gray-200 bg-gradient-to-r from-blue-50/80 via-white to-gray-50 p-4 shadow-sm sm:p-5">
          <div className="rounded-[26px] border border-gray-200 bg-white/95 p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[26px] border border-gray-200 bg-gray-50 shadow-sm">
                  <img
                    src="/images/hotena_talk/icons_title/icon_check_title.png"
                    alt="하테나 이미지"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>

                <div className="pt-1.5">
                  <p className="text-base font-medium text-gray-500">
                    한글만 알면 누구나 할 수 있는
                  </p>
                  <h1 className="mt-1 text-4xl font-bold tracking-[-0.02em] text-gray-900">
                    하테나일본어
                  </h1>
                </div>
              </div>

              <div className="self-start mt-3 rounded-full border border-blue-200 bg-blue-50 px-5 py-3 text-lg font-semibold text-gray-800">
                오늘도 1세트부터
              </div>
            </div>

            <p className="mt-6 text-center text-[24px] leading-snug text-gray-500">
              이제, 일본어로 "말할 수 있는 사람"이 되어보세요.
            </p>
          </div>
        </div>

        <div className="mx-auto mt-5 max-w-3xl">
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-gray-700">
              Google 계정으로 간편하게 시작할 수 있어요.
            </p>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="mt-4 w-full rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? "로그인 중..." : "Google로 로그인"}
            </button>

            {message ? (
              <p className="mt-4 text-sm text-red-500">{message}</p>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
