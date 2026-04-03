"use client";

import { getPlanBadge, type PlanCode } from "@/lib/plans";

type PushProfileOption = {
  id: string;
  email: string;
  plan: PlanCode;
};

type PushDebugInfo = {
  mode?: string;
  targetUserId?: string;
  total?: number;
  matchedRows?: number;
  availableColumns?: string[];
  detail?: string;
  note?: string;
};

type Props = {
  pushMode: "test" | "all" | "selected";
  pushTitle: string;
  pushBody: string;
  pushUrl: string;
  pushBusy: boolean;
  pushMessage: string;
  pushMemberQuery: string;
  selectedPushUserId: string;
  filteredPushProfiles: PushProfileOption[];
  selectedPushProfile: PushProfileOption | null;
  pushDebugInfo: PushDebugInfo | null;
  pushProbeBusy: boolean;
  onPushModeChange: (mode: "test" | "all" | "selected") => void;
  onPushTitleChange: (value: string) => void;
  onPushBodyChange: (value: string) => void;
  onPushUrlChange: (value: string) => void;
  onPushMemberQueryChange: (value: string) => void;
  onSelectedPushUserIdChange: (value: string) => void;
  onProbePushTarget: () => void;
  onSendPush: () => void;
};

export default function AdminPushSection({
  pushMode,
  pushTitle,
  pushBody,
  pushUrl,
  pushBusy,
  pushMessage,
  pushMemberQuery,
  selectedPushUserId,
  filteredPushProfiles,
  selectedPushProfile,
  pushDebugInfo,
  pushProbeBusy,
  onPushModeChange,
  onPushTitleChange,
  onPushBodyChange,
  onPushUrlChange,
  onPushMemberQueryChange,
  onSelectedPushUserIdChange,
  onProbePushTarget,
  onSendPush,
}: Props) {
  return (
    <section className="mt-8 space-y-8">
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold">🔔 푸시 알림 보내기</h2>
        <p className="mt-2 text-sm text-gray-600">
          테스트, 선택 회원, 전체 발송으로 나누어 알림을 보낼 수 있습니다.
        </p>
      </div>
      <div className="space-y-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <label className="text-sm font-semibold text-gray-800">발송 방식</label>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onPushModeChange("test")}
              className={
                pushMode === "test"
                  ? "rounded-2xl bg-black px-4 py-3 text-xs font-semibold text-white"
                  : "rounded-2xl border border-gray-300 bg-white px-4 py-3 text-xs font-semibold text-gray-800"
              }
            >
              테스트 발송
            </button>
            <button
              type="button"
              onClick={() => onPushModeChange("selected")}
              className={
                pushMode === "selected"
                  ? "rounded-2xl bg-black px-4 py-3 text-xs font-semibold text-white"
                  : "rounded-2xl border border-gray-300 bg-white px-4 py-3 text-xs font-semibold text-gray-800"
              }
            >
              선택 회원 발송
            </button>
            <button
              type="button"
              onClick={() => onPushModeChange("all")}
              className={
                pushMode === "all"
                  ? "rounded-2xl bg-black px-4 py-3 text-xs font-semibold text-white"
                  : "rounded-2xl border border-gray-300 bg-white px-4 py-3 text-xs font-semibold text-gray-800"
              }
            >
              전체 발송
            </button>
          </div>
        </div>

        {pushMode === "selected" ? (
          <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <div>
              <label className="text-sm font-semibold text-gray-800">회원 검색</label>
              <input
                value={pushMemberQuery}
                onChange={(e) => onPushMemberQueryChange(e.target.value)}
                placeholder="이름/이메일/ID/플랜으로 검색"
                className="mt-3 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-800">
                발송할 회원
              </label>
              <select
                value={selectedPushUserId}
                onChange={(e) => onSelectedPushUserIdChange(e.target.value)}
                className="mt-3 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
              >
                <option value="">회원 선택</option>
                {filteredPushProfiles.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.email} · {getPlanBadge(item.plan)}
                  </option>
                ))}
              </select>
            </div>
            {selectedPushUserId ? (
              <p className="text-sm text-gray-600">
                선택됨: {selectedPushProfile?.email || "-"}
              </p>
            ) : null}
          </div>
        ) : null}

        <div>
          <label className="text-sm font-semibold text-gray-800">제목</label>
          <input
            value={pushTitle}
            onChange={(e) => onPushTitleChange(e.target.value)}
            className="mt-3 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
          />
        </div>
        <div>
          <label className="text-sm font-semibold text-gray-800">내용</label>
          <textarea
            value={pushBody}
            onChange={(e) => onPushBodyChange(e.target.value)}
            rows={4}
            className="mt-3 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
          />
        </div>
        <div>
          <label className="text-sm font-semibold text-gray-800">
            클릭 이동 URL (선택)
          </label>
          <input
            value={pushUrl}
            onChange={(e) => onPushUrlChange(e.target.value)}
            className="mt-3 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onProbePushTarget}
            disabled={pushProbeBusy || (pushMode === "selected" && !selectedPushUserId)}
            className={
              pushProbeBusy || (pushMode === "selected" && !selectedPushUserId)
                ? "inline-flex rounded-2xl border border-gray-200 bg-gray-100 px-5 py-3 text-sm font-semibold text-gray-400"
                : "inline-flex rounded-2xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-800"
            }
          >
            {pushProbeBusy ? "대상 확인 중..." : "대상 확인"}
          </button>
          <button
            type="button"
            onClick={onSendPush}
            disabled={
              pushBusy ||
              !pushTitle.trim() ||
              !pushBody.trim() ||
              (pushMode === "selected" && !selectedPushUserId)
            }
            className={
              pushBusy ||
              !pushTitle.trim() ||
              !pushBody.trim() ||
              (pushMode === "selected" && !selectedPushUserId)
                ? "inline-flex rounded-2xl border border-gray-200 bg-gray-100 px-6 py-3 text-sm font-semibold text-gray-400"
                : "inline-flex rounded-2xl bg-black px-6 py-3 text-sm font-semibold text-white"
            }
          >
            {pushBusy
              ? "푸시 발송 중..."
              : pushMode === "test"
                ? "🚀 테스트 발송"
                : pushMode === "selected"
                  ? "🚀 선택 회원 발송"
                  : "🚀 전체 발송"}
          </button>
        </div>

        {pushMessage ? (
          <p className="text-sm text-gray-600">{pushMessage}</p>
        ) : (
          <p className="text-sm text-gray-500">
            테스트 발송은 현재 관리자 계정의 구독만, 선택 회원 발송은 지정 회원의 구독만, 전체 발송은 저장된 전체 구독을 대상으로 합니다.
          </p>
        )}

        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-semibold text-gray-800">푸시 디버그</p>
          <div className="mt-3 space-y-2 text-sm text-gray-600">
            <p>발송 방식: {pushMode}</p>
            <p>선택 회원: {selectedPushProfile?.email || "-"}</p>
            <p>대상 구독 수: {pushDebugInfo?.total ?? "-"}</p>
            <p>매칭 행 수: {pushDebugInfo?.matchedRows ?? "-"}</p>
            <p>사용 컬럼: {pushDebugInfo?.availableColumns?.join(", ") || "-"}</p>
            <p>상세: {pushDebugInfo?.detail || pushDebugInfo?.note || "-"}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
