"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchAttemptsByPrefix, type QuizAttemptRow } from "@/lib/attempts";
import { supabase } from "@/lib/supabase";

type Bucket = {
  key: "word" | "kanji" | "talk";
  title: string;
  description: string;
  href: string;
  count: number;
  recentWrong: number;
};

function calcWrongCount(rows: QuizAttemptRow[]) {
  return rows.reduce((sum, row) => sum + Number(row.wrong_count || 0), 0);
}

function getRecommendation(buckets: Bucket[]) {
  const sorted = [...buckets].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return b.recentWrong - a.recentWrong;
  });

  const top = sorted[0];
  if (!top || top.count === 0) {
    return "아직 저장된 오답이 없습니다. 오늘은 새 문제를 가볍게 풀고 다시 와보세요.";
  }

  if (top.key === "talk") {
    return "오늘은 회화 오답부터 다시 보며, 막혔던 문장을 자연스럽게 이어가 보세요.";
  }

  if (top.key === "kanji") {
    return "오늘은 한자 오답부터 정리하며, 읽기와 뜻이 흔들린 부분을 차분히 다듬어 보세요.";
  }

  return "오늘은 단어 오답부터 다시 보며, 자주 흔들리는 어휘를 먼저 잡아보세요.";
}

export default function WrongHubPage() {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [wordAttempts, setWordAttempts] = useState<QuizAttemptRow[]>([]);
  const [kanjiAttempts, setKanjiAttempts] = useState<QuizAttemptRow[]>([]);
  const [talkAttempts, setTalkAttempts] = useState<QuizAttemptRow[]>([]);

  useEffect(() => {
    const loadAll = async () => {
      try {
        setLoading(true);
        setErrorMsg("");

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          setErrorMsg("로그인이 필요합니다.");
          return;
        }

        const [wordRows, kanjiRows, talkRows] = await Promise.all([
          fetchAttemptsByPrefix(user.id, "단어", 50),
          fetchAttemptsByPrefix(user.id, "한자", 50),
          fetchAttemptsByPrefix(user.id, "회화", 50),
        ]);

        setWordAttempts(wordRows);
        setKanjiAttempts(kanjiRows);
        setTalkAttempts(talkRows);
      } catch (error) {
        console.error(error);
        setErrorMsg("오답 복습 허브를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };

    void loadAll();
  }, []);

  const buckets = useMemo<Bucket[]>(() => {
    return [
      {
        key: "word",
        title: "단어 오답",
        description: "틀린 단어를 다시 묶어, 오늘 복습 루틴으로 바로 이어가세요.",
        href: "/mypage/wrong-word",
        count: wordAttempts.length,
        recentWrong: calcWrongCount(wordAttempts),
      },
      {
        key: "kanji",
        title: "한자 오답",
        description: "헷갈렸던 한자를 다시 보며 읽기와 뜻을 차분히 정리해보세요.",
        href: "/mypage/wrong-kanji",
        count: kanjiAttempts.length,
        recentWrong: calcWrongCount(kanjiAttempts),
      },
      {
        key: "talk",
        title: "회화 오답",
        description: "막혔던 대화문만 모아 다시 복습하고, 말문을 자연스럽게 이어가세요.",
        href: "/mypage/wrong-talk",
        count: talkAttempts.length,
        recentWrong: calcWrongCount(talkAttempts),
      },
    ];
  }, [wordAttempts, kanjiAttempts, talkAttempts]);

  const totalCount = buckets.reduce((sum, item) => sum + item.count, 0);
  const totalWrong = buckets.reduce((sum, item) => sum + item.recentWrong, 0);
  const recommendation = getRecommendation(buckets);

  if (loading) {
    return (
      <main className="min-h-screen bg-white text-gray-900">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <p className="text-sm text-gray-600">불러오는 중...</p>
        </div>
      </main>
    );
  }

  if (errorMsg) {
    return (
      <main className="min-h-screen bg-white text-gray-900">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <p className="text-sm text-red-500">{errorMsg}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <section className="mt-4">
          <h1 className="text-3xl font-bold">오답 복습 허브</h1>
          <p className="mt-3 text-base text-gray-600">
            오늘 다시 볼 문제를 유형별로 고르고, 가장 부담 없는 복습부터 이어가세요.
          </p>
        </section>

        <div className="mt-6 rounded-3xl border border-gray-200 bg-gradient-to-b from-white to-gray-50/70 p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full border border-gray-200 bg-white px-3 py-1.5 font-semibold text-gray-700">
              저장된 오답 {totalCount}세트
            </span>
            <span className="rounded-full border border-gray-200 bg-white px-3 py-1.5 font-semibold text-gray-700">
              누적 오답 {totalWrong}개
            </span>
            <span className="rounded-full border border-gray-200 bg-white px-3 py-1.5 font-semibold text-gray-700">
              복습 영역 3개
            </span>
          </div>

          <p className="mt-4 text-sm text-gray-600">{recommendation}</p>

          <div className="mt-5">
            <a
              href="/mypage"
              className="inline-flex rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-800"
            >
              마이페이지로 돌아가기
            </a>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4">
          {buckets.map((item) => (
            <div
              key={item.key}
              className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">{item.title}</h2>
                  <p className="mt-2 text-sm text-gray-600">{item.description}</p>
                </div>

                <div className="text-right">
                  <p className="text-2xl font-bold">{item.count}</p>
                  <p className="text-xs text-gray-500">저장된 세트</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 font-semibold text-gray-700">
                  누적 오답 {item.recentWrong}개
                </span>
                <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 font-semibold text-gray-700">
                  {item.count === 0 ? "아직 비어 있음" : "지금 바로 복습 가능"}
                </span>
              </div>

              <div className="mt-5">
                <a
                  href={item.href}
                  className="inline-flex rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white"
                >
                  {item.title} 시작
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
