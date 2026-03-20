"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchAttemptsByPrefix, type QuizAttemptRow } from "@/lib/attempts";
import { supabase } from "@/lib/supabase";

const JA_FONT_STYLE = {
  fontFamily:
    '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif',
} as const;

type TalkWrongItem = {
  app: "talk";
  qtype?: "choice";
  item_key: string;
  qid: string;
  selected?: string;
  correct?: string;

  stage?: string;
  tag?: string;
  tag_kr?: string;
  sub?: string;
  sub_kr?: string;

  situation_kr?: string;
  partner_jp?: string;
  partner_kr?: string;
  answer_jp?: string;
  answer_kr?: string;
  explain_kr?: string;
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

        const rows = await fetchAttemptsByPrefix(user.id, "회화", 100);
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

  const tagOptions = useMemo(() => {
    const values = Array.from(
      new Set(flattened.map((item) => String(item.tag_kr || item.tag || "").trim()).filter(Boolean))
    );
    return ["전체", ...values];
  }, [flattened]);

  const subOptions = useMemo(() => {
    const base = flattened.filter((item) => {
      const tagLabel = String(item.tag_kr || item.tag || "").trim();
      return selectedTag === "전체" || tagLabel === selectedTag;
    });

    const values = Array.from(
      new Set(base.map((item) => String(item.sub_kr || item.sub || "").trim()).filter(Boolean))
    );

    return ["전체", ...values];
  }, [flattened, selectedTag]);

  const filteredItems = useMemo(() => {
    const q = searchText.trim().toLowerCase();

    return flattened.filter((item) => {
      const tagLabel = String(item.tag_kr || item.tag || "").trim();
      const subLabel = String(item.sub_kr || item.sub || "").trim();

      const tagOk = selectedTag === "전체" || tagLabel === selectedTag;
      const subOk = selectedSub === "전체" || subLabel === selectedSub;

      const haystack = [
        item.stage || "",
        item.tag || "",
        item.tag_kr || "",
        item.sub || "",
        item.sub_kr || "",
        item.situation_kr || "",
        item.partner_jp || "",
        item.partner_kr || "",
        item.answer_jp || "",
        item.answer_kr || "",
        item.selected || "",
        item.correct || "",
        item.explain_kr || "",
      ]
        .join(" ")
        .toLowerCase();

      const searchOk = !q || haystack.includes(q);
      return tagOk && subOk && searchOk;
    });
  }, [flattened, selectedTag, selectedSub, searchText]);

  const makeSelectionKey = (item: FlattenedWrongItem) =>
    `${item.app}|${item.item_key || ""}|${item.qid || ""}`;

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

    const selectedItems = filteredItems.filter((item) =>
      selectedKeys.includes(makeSelectionKey(item))
    );

    const qids = Array.from(
      new Set(
        selectedItems
          .map((item) => String(item.qid || "").trim())
          .filter(Boolean)
      )
    );

    const itemKeys = Array.from(
      new Set(
        selectedItems
          .map((item) => String(item.item_key || "").trim())
          .filter(Boolean)
      )
    );

    if (qids.length === 0 && itemKeys.length === 0) {
      alert("복습할 문제를 찾지 못했습니다.");
      return;
    }

    const params = new URLSearchParams();
    params.set("review", "1");

    if (qids.length > 0) {
      params.set("qids", qids.join(","));
    }

    if (itemKeys.length > 0) {
      params.set("itemKeys", itemKeys.join(","));
    }

    window.location.href = `/talk?${params.toString()}`;
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
            막혔던 회화 표현만 다시 골라 복습할 수 있습니다.
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
            유형과 상황 기준으로 좁혀서, 필요한 회화만 다시 복습해보세요.
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
                      setSelectedKeys([]);
                    }}
                    className={
                      active
                        ? "rounded-full border border-green-500 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700"
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
              placeholder="상황, 상대말, 정답, 내가 고른 답으로 검색"
              className="mt-2 w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-gray-400"
            />
          </div>
        </div>

        {flattened.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
            <p className="text-lg font-semibold text-gray-900">
              저장된 회화 오답이 아직 없습니다.
            </p>
            <p className="mt-2 text-sm text-gray-600">
              회화 훈련을 하고 다시 오면, 막혔던 문제들이 여기에 정리됩니다.
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
            <p className="text-lg font-semibold text-gray-900">
              현재 조건에 맞는 오답이 없습니다.
            </p>
            <p className="mt-2 text-sm text-gray-600">
              유형/상황을 넓히거나 검색어를 비워 다시 확인해보세요.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {filteredItems.map((item, idx) => {
              const selectionKey = makeSelectionKey(item);

              return (
                <div
                  key={`${item.attempt_id}-${item.qid}-${idx}`}
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
                      href={`/talk?review=1&qids=${encodeURIComponent(
                        String(item.qid || "")
                      )}&itemKeys=${encodeURIComponent(String(item.item_key || ""))}`}
                      className="inline-flex rounded-2xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800"
                    >
                      이 문제만 복습
                    </a>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                    <span className="rounded-full bg-gray-100 px-2 py-1">
                      {item.tag_kr || item.tag || "회화"}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-1">
                      {item.sub_kr || item.sub || "상황"}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-1">
                      {formatDate(item.created_at)}
                    </span>
                  </div>

                  <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-sm font-medium text-gray-700">상황</p>
                    <p className="mt-1 text-sm text-gray-800">
                      {item.situation_kr || "-"}
                    </p>
                  </div>

                  <div className="mt-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                    <p className="text-sm font-medium text-blue-800">상대(말)</p>
                    <p className="mt-1 text-base font-bold text-gray-900">
                      <span lang="ja" style={JA_FONT_STYLE}>
                        {item.partner_jp || "-"}
                      </span>
                    </p>
                    <p className="mt-2 text-sm text-gray-600">
                      {item.partner_kr || "-"}
                    </p>
                  </div>

                  <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4">
                    <p className="text-sm font-medium text-red-700">내가 고른 답</p>
                    <p className="mt-1 text-sm text-gray-800">
                      <span lang="ja" style={JA_FONT_STYLE}>
                        {item.selected || "-"}
                      </span>
                    </p>
                  </div>

                  <div className="mt-3 rounded-2xl border border-green-200 bg-green-50 p-4">
                    <p className="text-sm font-medium text-green-700">정답</p>
                    <p className="mt-1 text-sm text-gray-800">
                      <span lang="ja" style={JA_FONT_STYLE}>
                        {item.correct || item.answer_jp || "-"}
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      {item.answer_kr || "-"}
                    </p>
                  </div>

                  {item.explain_kr ? (
                    <div className="mt-3 rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
                      <p className="text-sm font-medium text-yellow-800">
                        원포인트 설명
                      </p>
                      <p className="mt-1 text-sm text-gray-800">
                        {item.explain_kr}
                      </p>
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