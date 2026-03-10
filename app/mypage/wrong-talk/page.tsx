"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchAttemptsByPrefix, type QuizAttemptRow } from "@/lib/attempts";
import { supabase } from "@/lib/supabase";

const JA_FONT_STYLE = {
  fontFamily: '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif',
} as const;

type TalkWrongItem = {
  app: "talk";
  item_key: string;
  selected?: string;
  correct?: string;

  // 회화에서 자주 쓰일 수 있는 필드들
  theme?: string;
  topic?: string;
  situation?: string;
  prompt?: string;
  question_jp?: string;
  question_kr?: string;
  jp_word?: string;
  answer_jp?: string;
  answer_kr?: string;
  reading?: string;
};

type FlattenedWrongItem = TalkWrongItem & {
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

function displayTitle(item: FlattenedWrongItem): string {
  return (
    item.question_jp ||
    item.prompt ||
    item.jp_word ||
    item.answer_jp ||
    item.theme ||
    item.topic ||
    "회화 오답"
  );
}

function displaySubTitle(item: FlattenedWrongItem): string {
  return (
    item.question_kr ||
    item.answer_kr ||
    item.situation ||
    item.topic ||
    "-"
  );
}

function WrongPageTabs({
  current,
}: {
  current: "word" | "kanji" | "katsuyou" | "talk";
}) {
  const tabs = [
    { key: "word", label: "단어 오답", href: "/mypage/wrong-word" },
    { key: "kanji", label: "한자 오답", href: "/mypage/wrong-kanji" },
    { key: "katsuyou", label: "활용 오답", href: "/mypage/wrong-katsuyou" },
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

  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [selectedTheme, setSelectedTheme] = useState("전체");
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
        ? (attempt.wrong_list as TalkWrongItem[])
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

  const themeOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        flattened
          .map((item) => String(item.theme || item.topic || "").trim())
          .filter(Boolean)
      )
    );
    return ["전체", ...values];
  }, [flattened]);

  const filteredItems = useMemo(() => {
    const q = searchText.trim().toLowerCase();

    return flattened.filter((item) => {
      const themeValue = String(item.theme || item.topic || "").trim();
      const themeOk = selectedTheme === "전체" || themeValue === selectedTheme;

      const haystack = [
        item.theme || "",
        item.topic || "",
        item.situation || "",
        item.prompt || "",
        item.question_jp || "",
        item.question_kr || "",
        item.jp_word || "",
        item.answer_jp || "",
        item.answer_kr || "",
        item.selected || "",
        item.correct || "",
      ]
        .join(" ")
        .toLowerCase();

      const searchOk = !q || haystack.includes(q);
      return themeOk && searchOk;
    });
  }, [flattened, selectedTheme, searchText]);

  const makeSelectionKey = (item: FlattenedWrongItem) =>
    `${item.app}|${item.item_key}`;

  const toggleKey = (key: string) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]
    );
  };

  const selectAllVisible = () => {
    const keys = Array.from(
      new Set(filteredItems.map((item) => makeSelectionKey(item)).filter(Boolean))
    );
    setSelectedKeys(keys);
  };

  const clearAllVisible = () => {
    setSelectedKeys([]);
  };

  const startReviewSet = () => {
    if (selectedKeys.length === 0) {
      alert("복습할 문제를 선택해주세요.");
      return;
    }

    const itemKeys = filteredItems
      .filter((item) => selectedKeys.includes(makeSelectionKey(item)))
      .map((item) => item.item_key);

    if (itemKeys.length === 0) {
      alert("복습할 문제를 찾지 못했습니다.");
      return;
    }

    const qids = encodeURIComponent(itemKeys.join(","));
    const theme = encodeURIComponent(selectedTheme === "전체" ? "" : selectedTheme);

    window.location.href = `/talk?review=1&qids=${qids}&theme=${theme}`;
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
  const selectedCount = selectedKeys.length;

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <section className="mt-4">
          <h1 className="text-3xl font-bold">회화 오답노트</h1>
          <p className="mt-3 text-base text-gray-600">
            막혔던 회화 표현만 다시 골라, 오늘 복습 루틴으로 차분히 정리해보세요.
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
            대답이 막혔던 회화 문제만 다시 골라 복습할 수 있습니다.
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
                setSelectedTheme("전체");
                setSearchText("");
                setSelectedKeys([]);
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
            <p className="text-sm font-semibold text-gray-700">테마</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {themeOptions.map((item) => {
                const active = selectedTheme === item;

                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setSelectedTheme(item);
                      setSelectedKeys([]);
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
            <label className="block text-sm font-semibold text-gray-700">검색</label>
            <input
              type="text"
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setSelectedKeys([]);
              }}
              placeholder="테마, 질문, 정답, 내가 말한 답으로 검색"
              className="mt-2 w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-gray-400"
            />
          </div>
        </div>

        {flattened.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
            <p className="text-lg font-semibold text-gray-900">좋아요. 저장된 회화 오답이 아직 없습니다.</p>
            <p className="mt-2 text-sm text-gray-600">
              회화 문제를 풀고 다시 오면, 막혔던 문제들이 여기에 정리됩니다.
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
              테마를 넓히거나 검색어를 비워 다시 확인해보세요.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {filteredItems.map((item, idx) => {
              const selectionKey = makeSelectionKey(item);

              return (
                <div
                  key={`${item.attempt_id}-${item.item_key}-${idx}`}
                  className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={selectedKeys.includes(selectionKey)}
                        onChange={() => toggleKey(selectionKey)}
                      />
                      선택
                    </label>

                    <a
                      href={`/talk?review=1&qids=${encodeURIComponent(item.item_key)}&theme=${encodeURIComponent(
                        item.theme || item.topic || ""
                      )}`}
                      className="inline-flex rounded-2xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800"
                    >
                      이 문제만 복습
                    </a>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                    <span className="rounded-full bg-gray-100 px-2 py-1">
                      {item.theme || item.topic || "회화"}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-1">
                      {formatDate(item.created_at)}
                    </span>
                  </div>

                  <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                    <p className="text-sm font-medium text-blue-800">문제</p>
                    <p className="mt-1 text-base font-bold text-gray-900">
                      <span lang="ja" style={JA_FONT_STYLE}>
                        {displayTitle(item)}
                      </span>
                    </p>
                    <p className="mt-2 text-sm text-gray-600">{displaySubTitle(item)}</p>
                    {item.reading ? (
                      <p className="mt-1 text-sm text-gray-600">
                        읽기: <span lang="ja" style={JA_FONT_STYLE}>{item.reading}</span>
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4">
                    <p className="text-sm font-medium text-red-700">내가 고른 답</p>
                    <p className="mt-1 text-sm text-gray-800">
                      <span lang="ja" style={JA_FONT_STYLE}>{item.selected || "-"}</span>
                    </p>
                  </div>

                  <div className="mt-3 rounded-2xl border border-green-200 bg-green-50 p-4">
                    <p className="text-sm font-medium text-green-700">정답</p>
                    <p className="mt-1 text-sm text-gray-800">
                      <span lang="ja" style={JA_FONT_STYLE}>
                        {item.correct || item.answer_jp || "-"}
                      </span>
                    </p>
                    {item.answer_kr ? (
                      <p className="mt-1 text-sm text-gray-600">{item.answer_kr}</p>
                    ) : null}
                  </div>

                  {item.situation ? (
                    <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <p className="text-sm font-medium text-gray-700">상황</p>
                      <p className="mt-1 text-sm text-gray-700">{item.situation}</p>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}