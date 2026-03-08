
"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchAttemptsByPrefix, type QuizAttemptRow } from "@/lib/attempts";
import { supabase } from "@/lib/supabase";

const JA_FONT_STYLE = {
  fontFamily: '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif',
} as const;

type WordWrongItem = {
  app: "word";
  qtype: "reading" | "meaning" | "kr2jp";
  item_key: string;
  jp_word: string;
  reading: string;
  meaning_kr: string;
  pos: string;
  level: string;
  selected: string;
  correct: string;
  example_jp?: string;
  example_kr?: string;
};

type FlattenedWrongItem = WordWrongItem & {
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

function qtypeLabel(qtype?: string): string {
  switch (qtype) {
    case "reading":
      return "발음";
    case "meaning":
      return "뜻";
    case "kr2jp":
      return "한→일";
    default:
      return qtype || "-";
  }
}

function posLabel(pos?: string): string {
  const raw = String(pos || "").trim().toLowerCase();
  switch (raw) {
    case "noun":
      return "명사";
    case "verb":
      return "동사";
    case "adj_i":
      return "い형용사";
    case "adj_na":
      return "な형용사";
    case "adverb":
      return "부사";
    case "particle":
      return "조사";
    case "conjunction":
      return "접속사";
    case "interjection":
      return "감탄사";
    default:
      return pos || "-";
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

export default function WrongWordPage() {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [attempts, setAttempts] = useState<QuizAttemptRow[]>([]);

  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [selectedQType, setSelectedQType] = useState("전체");
  const [selectedPos, setSelectedPos] = useState("전체");
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
          setLoading(false);
          return;
        }

        const rows = await fetchAttemptsByPrefix(user.id, "단어", 50);
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
        ? (attempt.wrong_list as WordWrongItem[])
        : [];

      for (const item of wrongs) {
        if (item.app !== "word") continue;

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

  const qtypeOptions = useMemo(() => {
    const values = Array.from(
      new Set(flattened.map((item) => String(item.qtype || "").trim()).filter(Boolean))
    );
    return ["전체", ...values];
  }, [flattened]);

  const posOptions = useMemo(() => {
    const filteredByQType =
      selectedQType === "전체"
        ? flattened
        : flattened.filter((item) => (item.qtype || "") === selectedQType);

    const values = Array.from(
      new Set(filteredByQType.map((item) => String(item.pos || "").trim()).filter(Boolean))
    );
    return ["전체", ...values];
  }, [flattened, selectedQType]);

  const filteredItems = useMemo(() => {
    const q = searchText.trim().toLowerCase();

    return flattened.filter((item) => {
      const qtypeOk = selectedQType === "전체" || item.qtype === selectedQType;
      const posOk = selectedPos === "전체" || item.pos === selectedPos;

      const haystack = [
        item.jp_word || "",
        item.reading || "",
        item.meaning_kr || "",
        item.selected || "",
        item.correct || "",
        item.level || "",
        item.example_jp || "",
        item.example_kr || "",
      ]
        .join(" ")
        .toLowerCase();

      const searchOk = !q || haystack.includes(q);
      return qtypeOk && posOk && searchOk;
    });
  }, [flattened, selectedQType, selectedPos, searchText]);

  const makeSelectionKey = (item: FlattenedWrongItem) =>
    `${item.app}|${item.qtype}|${item.item_key}`;

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
    const qtype = encodeURIComponent(selectedQType === "전체" ? "" : selectedQType);
    const pos = encodeURIComponent(selectedPos === "전체" ? "" : selectedPos);

    window.location.href = `/word?review=1&qids=${qids}&qtype=${qtype}&pos=${pos}`;
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-white text-gray-900">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <h1 className="text-3xl font-bold">단어 오답노트</h1>
          <p className="mt-4 text-gray-600">불러오는 중...</p>
        </div>
      </main>
    );
  }

  if (errorMsg) {
    return (
      <main className="min-h-screen bg-white text-gray-900">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <h1 className="text-3xl font-bold">단어 오답노트</h1>
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
          <h1 className="text-3xl font-bold">단어 오답노트</h1>
          <p className="mt-3 text-base text-gray-600">
            틀린 단어를 다시 묶어, 오늘 복습 루틴으로 바로 이어가세요.
          </p>
          <WrongPageTabs current="word" />
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
            원하는 문제만 골라 복습하거나, 지금 필터 상태 그대로 다시 시험볼 수 있습니다.
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
                setSelectedQType("전체");
                setSelectedPos("전체");
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
            <p className="text-sm font-semibold text-gray-700">문제 유형</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {qtypeOptions.map((item) => {
                const active = selectedQType === item;
                const label = item === "전체" ? "전체" : qtypeLabel(item);

                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setSelectedQType(item);
                      setSelectedPos("전체");
                      setSelectedKeys([]);
                    }}
                    className={
                      active
                        ? "rounded-full border border-blue-500 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700"
                        : "rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700"
                    }
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5 border-t border-gray-100 pt-5">
            <p className="text-sm font-semibold text-gray-700">품사</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {posOptions.map((item) => {
                const active = selectedPos === item;
                const label = item === "전체" ? "전체" : posLabel(item);

                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setSelectedPos(item);
                      setSelectedKeys([]);
                    }}
                    className={
                      active
                        ? "rounded-full border border-gray-900 bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
                        : "rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700"
                    }
                  >
                    {label}
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
              placeholder="단어, 읽기, 뜻, 내가 고른 답으로 검색"
              className="mt-2 w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-gray-400"
            />
          </div>
        </div>

        {flattened.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
            <p className="text-lg font-semibold text-gray-900">좋아요. 저장된 단어 오답이 아직 없습니다.</p>
            <p className="mt-2 text-sm text-gray-600">
              새 문제를 풀고 다시 오면, 틀린 단어가 이곳에 차곡차곡 쌓입니다.
            </p>
            <a
              href="/word"
              className="mt-5 inline-flex rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-800"
            >
              단어 훈련 하러 가기
            </a>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
            <p className="text-lg font-semibold text-gray-900">현재 필터 조건에 맞는 오답이 없습니다.</p>
            <p className="mt-2 text-sm text-gray-600">
              필터를 조금 완화하거나, 전체로 바꿔서 다시 확인해보세요.
            </p>
          </div>
        ) : (
          <>

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
                        href={`/word?review=1&qids=${encodeURIComponent(
                          item.item_key
                        )}&qtype=${encodeURIComponent(item.qtype)}&pos=${encodeURIComponent(
                          item.pos || ""
                        )}`}
                        className="inline-flex rounded-2xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800"
                      >
                        이 문제만 복습
                      </a>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                      <span className="rounded-full bg-gray-100 px-2 py-1">
                        {qtypeLabel(item.qtype)}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2 py-1">
                        {posLabel(item.pos)}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2 py-1">
                        {item.level || "-"}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2 py-1">
                        {formatDate(item.created_at)}
                      </span>
                    </div>

                    <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                      <p className="text-sm font-medium text-blue-800">문제 단어</p>
                      <p className="mt-1 text-xl font-bold text-gray-900">
                        {item.jp_word || "-"}
                      </p>
                      <p className="mt-2 text-sm text-gray-600">
                        {item.reading || "-"} · {item.meaning_kr || "-"}
                      </p>
                    </div>

                    {item.example_jp || item.example_kr ? (
                      <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                        <p className="text-sm font-medium text-gray-700">예문</p>
                        <p className="mt-1 text-sm text-gray-900">{item.example_jp || "-"}</p>
                        <p className="mt-1 text-sm text-gray-500">{item.example_kr || "-"}</p>
                      </div>
                    ) : null}

                    <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4">
                      <p className="text-sm font-medium text-red-700">내가 고른 답</p>
                      <p className="mt-1 text-sm text-gray-800">{item.selected || "-"}</p>
                    </div>

                    <div className="mt-3 rounded-2xl border border-green-200 bg-green-50 p-4">
                      <p className="text-sm font-medium text-green-700">정답</p>
                      <p className="mt-1 text-sm text-gray-800">{item.correct || "-"}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
