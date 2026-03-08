
"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchAttemptsByPrefix, type QuizAttemptRow } from "@/lib/attempts";
import { supabase } from "@/lib/supabase";
import type { TalkAttemptWrongItem } from "@/lib/talk-payload";

const JA_FONT_STYLE = {
  fontFamily: '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif',
} as const;

type FlattenedWrongItem = TalkAttemptWrongItem & {
  attempt_id?: string;
  created_at?: string;
  pos_mode?: string;
  score?: number;
  quiz_len?: number;
};

function formatDate(value?: string): string {
  if (!value) return "-";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}



function WrongPageTabs({
  current,
}: {
  current: "word" | "kanji" | "talk";
}) {
  const tabs = [
    { key: "word", label: "단어 오답", href: "/mypage/wrong-word" },
    { key: "kanji", label: "한자 오답", href: "/mypage/wrong-kanji" },
    { key: "talk", label: "회화 오답", href: "/mypage/wrong-talk" },
  ] as const;

  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const active = current === tab.key;
        return (
          <a
            key={tab.key}
            href={tab.href}
            className={
              active
                ? "rounded-full border border-gray-900 bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
                : "rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700"
            }
          >
            {tab.label}
          </a>
        );
      })}
    </div>
  );
}

export default function WrongTalkPage() {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [attempts, setAttempts] = useState<QuizAttemptRow[]>([]);

  const [selectedQids, setSelectedQids] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState("전체");
  const [selectedSub, setSelectedSub] = useState("전체");
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    const loadWrongNotes = async () => {
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

        const rows = await fetchAttemptsByPrefix(user.id, "회화", 50);
        setAttempts(rows);
      } catch (error) {
        console.error(error);
        setErrorMsg("오답노트를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };

    void loadWrongNotes();
  }, []);

  const flattened = useMemo<FlattenedWrongItem[]>(() => {
    const rows: FlattenedWrongItem[] = [];

    for (const attempt of attempts) {
      const wrongs = Array.isArray(attempt.wrong_list)
        ? (attempt.wrong_list as TalkAttemptWrongItem[])
        : [];

      for (const item of wrongs) {
        if (item.app !== "talk") continue;

        rows.push({
          ...item,
          attempt_id: attempt.id,
          created_at: attempt.created_at,
          pos_mode: attempt.pos_mode,
          score: attempt.score,
          quiz_len: attempt.quiz_len,
        });
      }
    }

    return rows;
  }, [attempts]);

  const tagOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        flattened
          .map((item) => String(item.tag_kr || "").trim())
          .filter(Boolean)
      )
    );
    return ["전체", ...values];
  }, [flattened]);

  const subOptions = useMemo(() => {
    const filteredByTag =
      selectedTag === "전체"
        ? flattened
        : flattened.filter((item) => (item.tag_kr || "") === selectedTag);

    const values = Array.from(
      new Set(
        filteredByTag
          .map((item) => String(item.sub_kr || "").trim())
          .filter(Boolean)
      )
    );
    return ["전체", ...values];
  }, [flattened, selectedTag]);

  const filteredItems = useMemo(() => {
    const q = searchText.trim().toLowerCase();

    return flattened.filter((item) => {
      const tagOk = selectedTag === "전체" || (item.tag_kr || "") === selectedTag;
      const subOk = selectedSub === "전체" || (item.sub_kr || "") === selectedSub;

      const haystack = [
        item.situation_kr || "",
        item.partner_jp || "",
        item.answer_jp || "",
        item.selected || "",
        item.partner_kr || "",
        item.answer_kr || "",
        item.explain_kr || "",
        item.tag_kr || "",
        item.sub_kr || "",
      ]
        .join(" ")
        .toLowerCase();

      const searchOk = !q || haystack.includes(q);
      return tagOk && subOk && searchOk;
    });
  }, [flattened, selectedTag, selectedSub, searchText]);

  const toggleQid = (qid: string) => {
    setSelectedQids((prev) =>
      prev.includes(qid) ? prev.filter((x) => x !== qid) : [...prev, qid]
    );
  };

  const selectAllVisible = () => {
    const qids = Array.from(
      new Set(filteredItems.map((item) => item.qid).filter(Boolean))
    );
    setSelectedQids(qids);
  };

  const clearAllVisible = () => {
    setSelectedQids([]);
  };

  const startReviewSet = () => {
    if (selectedQids.length === 0) {
      alert("복습할 문제를 선택해주세요.");
      return;
    }

    const q = encodeURIComponent(selectedQids.join(","));
    window.location.href = `/talk?review=1&qids=${q}`;
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-white text-gray-900">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <h1 className="text-3xl font-bold">회화 오답노트</h1>
          <p className="mt-4 text-gray-600">불러오는 중...</p>
        </div>
      </main>
    );
  }

  if (errorMsg) {
    return (
      <main className="min-h-screen bg-white text-gray-900">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <h1 className="text-3xl font-bold">회화 오답노트</h1>
          <p className="mt-4 text-red-500">{errorMsg}</p>
        </div>
      </main>
    );
  }

  const summaryCount = filteredItems.length;
  const selectedCount = selectedQids.length;

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <section className="mt-4">
          <h1 className="text-3xl font-bold">회화 오답노트</h1>
          <p className="mt-3 text-base text-gray-600">
            막혔던 대화문만 모아 다시 복습하고, 말문을 자연스럽게 이어가세요.
          </p>
          <WrongPageTabs current="talk" />
        </section>

        <div className="mt-6 rounded-3xl border border-gray-200 bg-gradient-to-b from-white to-gray-50/70 p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full border border-gray-200 bg-white px-3 py-1.5 font-semibold text-gray-700">
              저장된 오답 {flattened.length}개
            </span>
            <span className="rounded-full border border-gray-200 bg-white px-3 py-1.5 font-semibold text-gray-700">
              현재 필터 {summaryCount}개
            </span>
            <span className="rounded-full border border-gray-200 bg-white px-3 py-1.5 font-semibold text-gray-700">
              선택 {selectedCount}개
            </span>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            상황과 표현을 기준으로 묶어, 필요한 회화 오답만 바로 다시 볼 수 있습니다.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={startReviewSet}
              className="rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white"
            >
              선택한 문제 복습하기
            </button>

            <button
              type="button"
              onClick={selectAllVisible}
              className="rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-800"
            >
              전체 선택
            </button>

            <button
              type="button"
              onClick={clearAllVisible}
              className="rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-800"
            >
              전체 해제
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedTag("전체");
                setSelectedSub("전체");
                setSearchText("");
                setSelectedQids([]);
              }}
              className="rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-800"
            >
              필터 초기화
            </button>

            <a
              href="/mypage"
              className="rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-800"
            >
              마이페이지
            </a>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-gray-700">유형</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {tagOptions.map((item) => {
                const active = selectedTag === item;

                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setSelectedTag(item);
                      setSelectedSub("전체");
                      setSelectedQids([]);
                    }}
                    className={
                      active
                        ? "rounded-full border border-blue-500 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700"
                        : "rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700"
                    }
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5 border-t border-gray-100 pt-5">
            <p className="text-sm font-semibold text-gray-700">상황</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {subOptions.map((item) => {
                const active = selectedSub === item;

                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setSelectedSub(item);
                      setSelectedQids([]);
                    }}
                    className={
                      active
                        ? "rounded-full border border-gray-900 bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
                        : "rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700"
                    }
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5 border-t border-gray-100 pt-5">
            <label className="block text-sm font-semibold text-gray-700">검색</label>
            <input
              type="text"
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setSelectedQids([]);
              }}
              placeholder="상황, 상대(말), 정답, 내가 고른 답으로 검색"
              className="mt-2 w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-gray-400"
            />
          </div>
        </div>

        {flattened.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
            <p className="text-lg font-semibold text-gray-900">좋아요. 저장된 회화 오답이 아직 없습니다.</p>
            <p className="mt-2 text-sm text-gray-600">
              회화 세트를 풀고 다시 오면, 막혔던 문장들이 여기에 정리됩니다.
            </p>
            <a
              href="/talk"
              className="mt-5 inline-flex rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-800"
            >
              회화 훈련 하러 가기
            </a>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
            <p className="text-lg font-semibold text-gray-900">현재 필터 조건에 맞는 오답이 없습니다.</p>
            <p className="mt-2 text-sm text-gray-600">
              유형이나 상황을 넓혀 다시 확인해보세요.
            </p>
          </div>
        ) : (
          <>

            <div className="mt-6 space-y-4">
              {filteredItems.map((item, idx) => (
                <div
                  key={`${item.attempt_id}-${item.qid}-${idx}`}
                  className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={selectedQids.includes(item.qid)}
                        onChange={() => toggleQid(item.qid)}
                      />
                      선택
                    </label>

                    <a
                      href={`/talk?review=1&qids=${encodeURIComponent(item.qid)}`}
                      className="inline-flex rounded-2xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800"
                    >
                      이 문제만 복습
                    </a>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                    {item.tag_kr ? (
                      <span className="rounded-full bg-gray-100 px-2 py-1">{item.tag_kr}</span>
                    ) : null}
                    {item.sub_kr ? (
                      <span className="rounded-full bg-gray-100 px-2 py-1">{item.sub_kr}</span>
                    ) : null}
                    <span className="rounded-full bg-gray-100 px-2 py-1">
                      {formatDate(item.created_at)}
                    </span>
                  </div>

                  {item.situation_kr ? (
                    <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                      <p className="text-sm font-medium text-blue-800">상황</p>
                      <p className="mt-1 text-sm text-gray-900">{item.situation_kr}</p>
                    </div>
                  ) : null}

                  <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-sm font-medium text-gray-700">상대(말)</p>
                    <p className="mt-1 text-sm text-gray-800"><span lang="ja" style={JA_FONT_STYLE}>{item.partner_jp || "-"}</span></p>
                    <p className="mt-1 text-sm text-gray-500">{item.partner_kr || "-"}</p>
                  </div>

                  <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4">
                    <p className="text-sm font-medium text-red-700">내가 고른 답</p>
                    <p className="mt-1 text-sm text-gray-800"><span lang="ja" style={JA_FONT_STYLE}>{item.selected || "-"}</span></p>
                  </div>

                  <div className="mt-3 rounded-2xl border border-green-200 bg-green-50 p-4">
                    <p className="text-sm font-medium text-green-700">정답</p>
                    <p className="mt-1 text-sm text-gray-800"><span lang="ja" style={JA_FONT_STYLE}>{item.answer_jp || item.correct || "-"}</span></p>
                    <p className="mt-1 text-sm text-gray-500">{item.answer_kr || "-"}</p>
                  </div>

                  {item.explain_kr ? (
                    <div className="mt-3 rounded-2xl bg-blue-50 p-4">
                      <p className="text-sm font-medium text-blue-900">
                        하테나쌤 원포인트 일본어
                      </p>
                      <p className="mt-2 text-sm text-blue-900">{item.explain_kr}</p>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
