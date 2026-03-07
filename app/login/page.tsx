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
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-bold">로그인</h1>
        <p className="mt-3 text-gray-600">
          Google 계정으로 로그인해보세요.
        </p>

        <div className="mt-8 rounded-2xl border border-gray-200 p-6">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full rounded-2xl bg-black py-3 text-white font-medium disabled:opacity-50"
          >
            {loading ? "로그인 중..." : "Google로 로그인"}
          </button>

          {message && (
            <p className="mt-4 text-sm text-red-500">{message}</p>
          )}
        </div>
      </div>
    </main>
  );
}