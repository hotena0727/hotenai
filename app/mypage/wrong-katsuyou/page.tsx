"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchAttemptsByPrefix, type QuizAttemptRow } from "@/lib/attempts";
import { supabase } from "@/lib/supabase";

const JA_FONT_STYLE = {
  fontFamily:
    '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif',
} as const;

type KatsuyouWrongItem = {
  app: "katsuyou";
  item_key: string;
  jp_word: string;
  kr_word: string;
  pos: "i_adj" | "na_adj" | "verb" | string;
  qtype: "kr2jp" | "jp2kr" | string;
  form_key?: string;
  reading?: string;
  selected: string;
  correct: string;
  prompt?: string;
};

type FlattenedWrongItem = KatsuyouWrongItem & {
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
    case "kr2jp":
      return "한→일";
    case "jp2kr":
      return "일→한";
    default:
      return qtype || "-";
  }
}

function posLabel(pos?: string): string {
  const raw = String(pos || "").trim().toLowerCase();

  switch (raw) {
    case "i_adj":
      return "い형용사";
    case "na_adj":
      return "な형용사";
    case "verb":
      return "동사";
    default:
      return raw || "-";
  }
}

function formKeyLabel(formKey?: string): string {
  const raw = String(formKey || "").trim();

  switch (raw) {
    case "plain_present":
      return "기본형 현재";
    case "polite_present":
      return "정중형 현재";
    case "plain_negative":
      return "기본형 부정";
    case "polite_negative":
      return "정중형 부정";
    case "plain_past":
      return "기본형 과거";
    case "polite_past":
      return "정중형 과거";
    case "plain_negative_past":
      return "기본형 부정과거";
    case "polite_negative_past":
      return "정중형 부정과거";
    case "adverbial":
      return "부사형";
    case "te_form":
      return "て형";
    case "connective_a":
      return "연결형(~고)";
    case "connective_b":
      return "연결형(~아서/어서/해서)";
    case "potential":
      return "가능형";
    case "imperative":
      return "명령형";
    case "volitional":
      return "의지형";
    case "passive":
      return "수동형";
    case "causative":
      return "사역형";
    case "causative_passive":
      return "사역수동형";
    default:
      return raw || "-";
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

function makeSelectionKey(item: FlattenedWrongItem): string {
  return [
    "katsuyou",
    item.item_key || "",
    item.qtype || "",
    item.form_key || "",
  ].join("|");
}

export default function WrongKatsuyouPage() {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [attempts, setAttempts] = useState<QuizAttemptRow[]>([]);

  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [selectedPos, setSelectedPos] = useState("전체");
  const [selectedQType, setSelectedQType] = useState("전체");
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

        const rows = await fetchAttemptsByPrefix(user.id, "활용", 300);
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
    const normalAttempts = attempts.filter((attempt) =>
      String(attempt.pos_mode || "").startsWith("활용 ·")
    );

    const reviewAttempts = attempts.filter((attempt) =>
      String(attempt.pos_mode || "").startsWith("활용오답복습 ·")
    );

    const wrongCandidateMap = new Map<string, FlattenedWrongItem>();

    for (const attempt of normalAttempts) {
      const wrongs = Array.isArray(attempt.wrong_list)
        ? (attempt.wrong_list as KatsuyouWrongItem[])
        : [];

      for (const item of wrongs) {
        if (item.app !== "katsuyou") continue;

        const key = [
          "katsuyou",
          item.item_key || "",
          item.qtype || "",
          item.form_key || "",
        ].join("|");

        const prev = wrongCandidateMap.get(key);

        const nextItem: FlattenedWrongItem = {
          ...item,
          attempt_id: attempt.id,
          created_at: attempt.created_at,
          pos_mode: attempt.pos_mode,
          score: attempt.score,
          quiz_len: attempt.quiz_len,
        };

        if (!prev) {
          wrongCandidateMap.set(key, nextItem);
          continue;
        }

        const prevTime = prev.created_at ? new Date(prev.created_at).getTime() : 0;
        const nextTime = attempt.created_at ? new Date(attempt.created_at).getTime() : 0;

        if (nextTime >= prevTime) {
          wrongCandidateMap.set(key, nextItem);
        }
      }
    }

    const reviewCorrectCountMap = new Map<string, number>();

    for (const attempt of reviewAttempts) {
      const questionKeys = Array.isArray(attempt.question_keys)
        ? attempt.question_keys.map((v) => String(v || "").trim()).filter(Boolean)
        : [];

      const wrongs = Array.isArray(attempt.wrong_list)
        ? (attempt.wrong_list as KatsuyouWrongItem[])
        : [];

      const wrongKeySet = new Set(
        wrongs
          .filter((item) => item.app === "katsuyou")
          .map((item) =>
            [
              "katsuyou",
              String(item.item_key || "").trim(),
              String(item.qtype || "").trim(),
              String(item.form_key || "").trim(),
            ].join("|")
          )
      );

      for (const questionKey of questionKeys) {
        const [itemKey, formKey, qtype] = questionKey.split("|||").map((v) => String(v || "").trim());

        if (!itemKey || !formKey || !qtype) continue;

        const fullKey = ["katsuyou", itemKey, qtype, formKey].join("|");

        if (!wrongCandidateMap.has(fullKey)) continue;
        if (wrongKeySet.has(fullKey)) continue;

        reviewCorrectCountMap.set(
          fullKey,
          (reviewCorrectCountMap.get(fullKey) || 0) + 1
        );
      }
    }

    return Array.from(wrongCandidateMap.entries())
      .filter(([key]) => (reviewCorrectCountMap.get(key) || 0) < 2)
      .map(([, item]) => item)
      .sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      });
  }, [attempts]);

  const posOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        flattened.map((item) => String(item.pos || "").trim()).filter(Boolean)
      )
    );
    return ["전체", ...values];
  }, [flattened]);

  const qtypeOptions = useMemo(() => {
    const filteredByPos =
      selectedPos === "전체"
        ? flattened
        : flattened.filter((item) => (item.pos || "") === selectedPos);

    const values = Array.from(
      new Set(
        filteredByPos
          .map((item) => String(item.qtype || "").trim())
          .filter(Boolean)
      )
    );
    return ["전체", ...values];
  }, [flattened, selectedPos]);

  const filteredItems = useMemo(() => {
    const q = searchText.trim().toLowerCase();

    return flattened.filter((item) => {
      const posOk = selectedPos === "전체" || (item.pos || "") === selectedPos;
      const qtypeOk =
        selectedQType === "전체" || (item.qtype || "") === selectedQType;

      const haystack = [
        item.jp_word || "",
        item.kr_word || "",
        item.reading || "",
        item.prompt || "",
        item.selected || "",
        item.correct || "",
        item.pos || "",
        item.qtype || "",
        item.form_key || "",
      ]
        .join(" ")
        .toLowerCase();

      const searchOk = !q || haystack.includes(q);
      return posOk && qtypeOk && searchOk;
    });
  }, [flattened, selectedPos, selectedQType, searchText]);

  const visibleSelectionKeys = useMemo(() => {
    return Array.from(
      new Set(filteredItems.map((item) => makeSelectionKey(item)).filter(Boolean))
    );
  }, [filteredItems]);

  const selectedVisibleCount = useMemo(() => {
    const visibleSet = new Set(visibleSelectionKeys);
    return selectedKeys.filter((key) => visibleSet.has(key)).length;
  }, [selectedKeys, visibleSelectionKeys]);

  const toggleKey = (key: string) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]
    );
  };

  const selectAllVisible = () => {
    setSelectedKeys(visibleSelectionKeys);
  };

  const clearAllVisible = () => {
    setSelectedKeys([]);
  };

  const startReviewSet = () => {
    if (selectedKeys.length === 0) {
      alert("복습할 문제를 선택해주세요.");
      return;
    }

    const selectedReviewTargets = Array.from(
      new Set(
        filteredItems
          .filter((item) => selectedKeys.includes(makeSelectionKey(item)))
          .map((item) =>
            [
              String(item.item_key || "").trim(),
              String(item.form_key || "").trim(),
              String(item.qtype || "").trim(),
            ].join("|||")
          )
          .filter(Boolean)
      )
    );

    if (selectedReviewTargets.length === 0) {
      alert("복습할 문제를 찾지 못했습니다.");
      return;
    }

    const targetPos =
      selectedPos === "전체" ? "" : String(selectedPos || "").trim();
    const targetQType =
      selectedQType === "전체" ? "" : String(selectedQType || "").trim();

    const targets = encodeURIComponent(selectedReviewTargets.join(","));
    const pos = encodeURIComponent(targetPos);
    const qtype = encodeURIComponent(targetQType);

    window.location.href = `/katsuyou?review=1&targets=${targets}&pos=${pos}&qtype=${qtype}`;
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-white text-gray-900">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <h1 className="text-3xl font-bold">활용 오답노트</h1>
          <p className="mt-4 text-gray-600">불러오는 중...</p>
        </div>
      </main>
    );
  }

  if (errorMsg) {
    return (
      <main className="min-h-screen bg-white text-gray-900">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <h1 className="text-3xl font-bold">활용 오답노트</h1>
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
          <h1 className="text-3xl font-bold">활용 오답노트</h1>
          <p className="mt-3 text-base text-gray-600">
            헷갈렸던 활용 형태만 다시 골라, 오늘 복습 루틴으로 차분히 정리해보세요.
          </p>
          <WrongPageTabs current="katsuyou" />
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
            <span className="rounded-full border border-gray-200 bg-white px-3 py-1.5 font-semibold text-gray-700">
              현재 화면 선택 {selectedVisibleCount}개
            </span>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            형용사와 동사의 흔들렸던 형태만 다시 골라 복습할 수 있습니다.
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
                setSelectedPos("전체");
                setSelectedQType("전체");
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
                      setSelectedQType("전체");
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
            <p className="text-sm font-semibold text-gray-700">유형</p>
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
            <label className="block text-sm font-semibold text-gray-700">
              검색
            </label>
            <input
              type="text"
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setSelectedKeys([]);
              }}
              placeholder="단어, 뜻, 형태, 내가 고른 답으로 검색"
              className="mt-2 w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-gray-400"
            />
          </div>
        </div>

        {flattened.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
            <p className="text-lg font-semibold text-gray-900">
              좋아요. 저장된 활용 오답이 아직 없습니다.
            </p>
            <p className="mt-2 text-sm text-gray-600">
              활용 문제를 풀고 다시 오면, 헷갈린 문제들이 여기에 정리됩니다.
            </p>
            <a
              href="/katsuyou"
              className="mt-5 inline-flex rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-800"
            >
              활용 훈련 하러 가기
            </a>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
            <p className="text-lg font-semibold text-gray-900">
              현재 필터 조건에 맞는 오답이 없습니다.
            </p>
            <p className="mt-2 text-sm text-gray-600">
              품사나 유형을 넓혀 다시 확인해보세요.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {filteredItems.map((item, idx) => {
              const selectionKey = makeSelectionKey(item);

              return (
                <div
                  key={`${item.item_key}-${item.qtype}-${item.form_key}-${idx}`}
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
                      href={`/katsuyou?review=1&targets=${encodeURIComponent(
                        [
                          String(item.item_key || "").trim(),
                          String(item.form_key || "").trim(),
                          String(item.qtype || "").trim(),
                        ].join("|||")
                      )}&pos=${encodeURIComponent(item.pos || "")}&qtype=${encodeURIComponent(
                        item.qtype || ""
                      )}`}
                      className="inline-flex rounded-2xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800"
                    >
                      이 문제만 복습
                    </a>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                    <span className="rounded-full bg-gray-100 px-2 py-1">
                      {posLabel(item.pos)}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-1">
                      {qtypeLabel(item.qtype)}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-1">
                      {formKeyLabel(item.form_key)}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-1">
                      {formatDate(item.created_at)}
                    </span>
                  </div>

                  <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                    <p className="text-sm font-medium text-blue-800">문제</p>
                    <p className="mt-1 text-xl font-bold text-gray-900">
                      <span lang="ja" style={JA_FONT_STYLE}>
                        {item.prompt || item.jp_word || "-"}
                      </span>
                    </p>
                    <p className="mt-2 text-sm text-gray-600">
                      기본형:{" "}
                      <span lang="ja" style={JA_FONT_STYLE}>
                        {item.jp_word || "-"}
                      </span>
                      {" / "}뜻: {item.kr_word || "-"}
                    </p>
                    {item.reading ? (
                      <p className="mt-1 text-sm text-gray-600">
                        읽기:{" "}
                        <span lang="ja" style={JA_FONT_STYLE}>
                          {item.reading}
                        </span>
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4">
                    <p className="text-sm font-medium text-red-700">
                      내가 고른 답
                    </p>
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
                        {item.correct || "-"}
                      </span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}