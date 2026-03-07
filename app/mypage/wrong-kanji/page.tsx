"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchAttemptsByPrefix, type QuizAttemptRow } from "@/lib/attempts";
import { supabase } from "@/lib/supabase";

type KanjiWrongItem = {
  app: "kanji";
  qtype: "reading" | "meaning" | "kr2jp";
  item_key: string;
  jp_word: string;
  reading: string;
  meaning_kr: string;
  pos: string;
  level: string;
  selected: string;
  correct: string;
};

type FlattenedWrongItem = KanjiWrongItem & {
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

export default function WrongKanjiPage() {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [attempts, setAttempts] = useState<QuizAttemptRow[]>([]);

  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [selectedQType, setSelectedQType] = useState("전체");
  const [selectedLevel, setSelectedLevel] = useState("전체");
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

        const rows = await fetchAttemptsByPrefix(user.id, "한자", 50);
        setAttempts(rows);
        setLoading(false);
      } catch (error) {
        console.error(error);
        setErrorMsg("오답노트를 불러오지 못했습니다.");
        setLoading(false);
      }
    };

    void loadWrongNotes();
  }, []);

  const flattened = useMemo<FlattenedWrongItem[]>(() => {
    const rows: FlattenedWrongItem[] = [];

    for (const attempt of attempts) {
      const wrongs = Array.isArray(attempt.wrong_list)
        ? (attempt.wrong_list as KanjiWrongItem[])
        : [];

      for (const item of wrongs) {
        if (item.app !== "kanji") continue;

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

  const levelOptions = useMemo(() => {
    const filteredByQType =
      selectedQType === "전체"
        ? flattened
        : flattened.filter((item) => (item.qtype || "") === selectedQType);

    const values = Array.from(
      new Set(filteredByQType.map((item) => String(item.level || "").trim()).filter(Boolean))
    );
    return ["전체", ...values];
  }, [flattened, selectedQType]);

  const filteredItems = useMemo(() => {
    const q = searchText.trim().toLowerCase();

    return flattened.filter((item) => {
      const qtypeOk = selectedQType === "전체" || (item.qtype || "") === selectedQType;
      const levelOk = selectedLevel === "전체" || (item.level || "") === selectedLevel;

      const haystack = [
        item.jp_word || "",
        item.reading || "",
        item.meaning_kr || "",
        item.selected || "",
        item.correct || "",
        item.level || "",
      ]
        .join(" ")
        .toLowerCase();

      const searchOk = !q || haystack.includes(q);
      return qtypeOk && levelOk && searchOk;
    });
  }, [flattened, selectedQType, selectedLevel, searchText]);

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
    const level = encodeURIComponent(selectedLevel === "전체" ? "" : selectedLevel);

    window.location.href = `/kanji?review=1&qids=${qids}&qtype=${qtype}&level=${level}`;
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-white px-6 py-10 text-gray-900">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold">한자 오답노트</h1>
          <p className="mt-4 text-gray-600">불러오는 중...</p>
        </div>
      </main>
    );
  }

  if (errorMsg) {
    return (
      <main className="min-h-screen bg-white px-6 py-10 text-gray-900">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold">한자 오답노트</h1>
          <p className="mt-4 text-red-500">{errorMsg}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white px-6 py-10 text-gray-900">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">한자 오답노트</h1>
            <p className="mt-2 text-sm text-gray-500">
              최근 한자 훈련에서 틀린 문제들을 다시 복습합니다.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={startReviewSet}
              className="rounded-2xl bg-black px-4 py-2 text-sm text-white"
            >
              선택한 문제 복습하기
            </button>

            <button
              type="button"
              onClick={selectAllVisible}
              className="rounded-2xl border border-gray-300 px-4 py-2 text-sm text-gray-800"
            >
              전체 선택
            </button>

            <button
              type="button"
              onClick={clearAllVisible}
              className="rounded-2xl border border-gray-300 px-4 py-2 text-sm text-gray-800"
            >
              전체 해제
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedQType("전체");
                setSelectedLevel("전체");
                setSearchText("");
                setSelectedKeys([]);
              }}
              className="rounded-2xl border border-gray-300 px-4 py-2 text-sm text-gray-800"
            >
              필터 초기화
            </button>

            <a
              href="/kanji"
              className="rounded-2xl border border-gray-300 px-4 py-2 text-sm text-gray-800"
            >
              한자로 돌아가기
            </a>

            <a
              href="/mypage"
              className="rounded-2xl border border-gray-300 px-4 py-2 text-sm text-gray-800"
            >
              마이페이지
            </a>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              문제 유형 필터
            </label>
            <select
              value={selectedQType}
              onChange={(e) => {
                setSelectedQType(e.target.value);
                setSelectedLevel("전체");
                setSelectedKeys([]);
              }}
              className="mt-2 w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm"
            >
              {qtypeOptions.map((item) => (
                <option key={item} value={item}>
                  {item === "전체" ? item : qtypeLabel(item)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              레벨 필터
            </label>
            <select
              value={selectedLevel}
              onChange={(e) => {
                setSelectedLevel(e.target.value);
                setSelectedKeys([]);
              }}
              className="mt-2 w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm"
            >
              {levelOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3">
          <label className="block text-sm font-medium text-gray-700">검색</label>
          <input
            type="text"
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              setSelectedKeys([]);
            }}
            placeholder="단어, 읽기, 뜻, 내가 고른 답으로 검색"
            className="mt-2 w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm"
          />
        </div>

        {flattened.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-gray-200 p-6">
            <p className="text-sm text-gray-600">저장된 한자 오답이 없습니다.</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-gray-200 p-6">
            <p className="text-sm text-gray-600">
              현재 필터 조건에 맞는 오답이 없습니다.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-8 rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm text-gray-700">
                총 <span className="font-semibold">{filteredItems.length}</span>개의 오답이 있습니다.
              </p>
              <p className="mt-2 text-sm text-gray-600">
                현재 선택된 문제: {selectedKeys.length}개
              </p>
            </div>

            <div className="mt-6 space-y-4">
              {filteredItems.map((item, idx) => {
                const selectionKey = makeSelectionKey(item);

                return (
                  <div
                    key={`${item.attempt_id}-${item.item_key}-${idx}`}
                    className="rounded-2xl border border-gray-200 bg-white p-5"
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
                        href={`/kanji?review=1&qids=${encodeURIComponent(
                          item.item_key
                        )}&qtype=${encodeURIComponent(item.qtype)}&level=${encodeURIComponent(
                          item.level
                        )}`}
                        className="inline-flex rounded-2xl border border-gray-300 px-4 py-2 text-sm text-gray-800"
                      >
                        다시 풀기
                      </a>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <span>{item.pos_mode || "한자"}</span>
                      <span>·</span>
                      <span>{formatDate(item.created_at)}</span>
                      {typeof item.score === "number" &&
                      typeof item.quiz_len === "number" ? (
                        <>
                          <span>·</span>
                          <span>
                            점수 {item.score}/{item.quiz_len}
                          </span>
                        </>
                      ) : null}
                    </div>

                    <div className="mt-4 rounded-2xl border border-gray-200 p-4">
                      <p className="text-sm font-medium text-gray-800">단어</p>
                      <p className="mt-2 text-lg font-semibold text-gray-900">
                        {item.jp_word || "-"}
                      </p>
                      <p className="mt-1 text-sm text-gray-600">
                        읽기: {item.reading || "-"}
                      </p>
                      <p className="mt-1 text-sm text-gray-600">
                        뜻: {item.meaning_kr || "-"}
                      </p>
                    </div>

                    <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4">
                      <p className="text-sm font-medium text-red-700">내가 고른 답</p>
                      <p className="mt-1 text-sm text-gray-800">
                        {item.selected || "-"}
                      </p>
                    </div>

                    <div className="mt-3 rounded-2xl border border-green-200 bg-green-50 p-4">
                      <p className="text-sm font-medium text-green-700">정답</p>
                      <p className="mt-1 text-sm text-gray-800">
                        {item.correct || "-"}
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-500">
                      <span>유형: {qtypeLabel(item.qtype)}</span>
                      {item.level ? <span>레벨: {item.level}</span> : null}
                      {item.pos ? <span>품사: {item.pos}</span> : null}
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