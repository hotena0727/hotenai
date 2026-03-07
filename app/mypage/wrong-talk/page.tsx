"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchAttemptsByPrefix, type QuizAttemptRow } from "@/lib/attempts";
import { supabase } from "@/lib/supabase";
import type { TalkAttemptWrongItem } from "@/lib/talk-payload";

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
          setLoading(false);
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
      <main className="min-h-screen bg-white px-6 py-10 text-gray-900">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold">회화 오답노트</h1>
          <p className="mt-4 text-gray-600">불러오는 중...</p>
        </div>
      </main>
    );
  }

  if (errorMsg) {
    return (
      <main className="min-h-screen bg-white px-6 py-10 text-gray-900">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold">회화 오답노트</h1>
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
            <h1 className="text-3xl font-bold">회화 오답노트</h1>
            <p className="mt-2 text-sm text-gray-500">
              최근 회화 세트에서 틀린 문장들을 다시 복습합니다.
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
                setSelectedTag("전체");
                setSelectedSub("전체");
                setSearchText("");
                setSelectedQids([]);
              }}
              className="rounded-2xl border border-gray-300 px-4 py-2 text-sm text-gray-800"
            >
              필터 초기화
            </button>

            <a
              href="/talk"
              className="rounded-2xl border border-gray-300 px-4 py-2 text-sm text-gray-800"
            >
              회화로 돌아가기
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
              유형 필터
            </label>
            <select
              value={selectedTag}
              onChange={(e) => {
                setSelectedTag(e.target.value);
                setSelectedSub("전체");
                setSelectedQids([]);
              }}
              className="mt-2 w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm"
            >
              {tagOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              상황 필터
            </label>
            <select
              value={selectedSub}
              onChange={(e) => {
                setSelectedSub(e.target.value);
                setSelectedQids([]);
              }}
              className="mt-2 w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm"
            >
              {subOptions.map((item) => (
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
              setSelectedQids([]);
            }}
            placeholder="상황, 상대(말), 정답, 내가 고른 답으로 검색"
            className="mt-2 w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm"
          />
        </div>

        {flattened.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-gray-200 p-6">
            <p className="text-sm text-gray-600">저장된 회화 오답이 없습니다.</p>
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
                현재 선택된 문제: {selectedQids.length}개
              </p>
            </div>

            <div className="mt-6 space-y-4">
              {filteredItems.map((item, idx) => (
                <div
                  key={`${item.attempt_id}-${item.qid}-${idx}`}
                  className="rounded-2xl border border-gray-200 bg-white p-5"
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
                      href={`/talk?qid=${encodeURIComponent(item.qid)}&review=1`}
                      className="inline-flex rounded-2xl border border-gray-300 px-4 py-2 text-sm text-gray-800"
                    >
                      다시 풀기
                    </a>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span>{item.pos_mode || "회화"}</span>
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

                  <div className="mt-4">
                    <p className="text-sm font-semibold text-gray-800">상황</p>
                    <p className="mt-2 text-sm text-gray-700">
                      {item.situation_kr || "-"}
                    </p>
                  </div>

                  <div className="mt-4 rounded-2xl border border-gray-200 p-4">
                    <p className="text-sm font-medium text-gray-800">
                      상대(말) {item.partner_jp || "-"}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      {item.partner_kr || "-"}
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
                      {item.answer_jp || item.correct || "-"}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      {item.answer_kr || "-"}
                    </p>
                  </div>

                  <div className="mt-3 rounded-2xl bg-blue-50 p-4">
                    <p className="text-sm font-medium text-blue-900">
                      하테나쌤 원포인트 일본어
                    </p>
                    <p className="mt-2 text-sm text-blue-900">
                      {item.explain_kr || "-"}
                    </p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-500">
                    {item.tag_kr ? <span>유형: {item.tag_kr}</span> : null}
                    {item.sub_kr ? <span>상황: {item.sub_kr}</span> : null}
                    {item.stage ? <span>코스: LV{item.stage}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}