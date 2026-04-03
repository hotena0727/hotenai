"use client";

import {
  getPlanBadge,
  getPlanLabel,
  getPlanTheme,
  type PlanCode,
} from "@/lib/plans";

type AdminProfile = {
  id: string;
  email: string;
  full_name?: string;
  plan: PlanCode;
  is_admin: boolean;
  created_at?: string | null;
  plan_expires_at?: string | null;
};

type PushDebugInfo = {
  total?: number;
  matchedRows?: number;
  detail?: string;
  note?: string;
};

type CleanupPreview = {
  scopeLabel: string;
  days: number;
  total: number;
};

function PillButton({
  active,
  onClick,
  label,
  tone = "default",
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  tone?: "default" | "danger";
}) {
  const activeCls =
    tone === "danger"
      ? "border-red-300 bg-red-50 text-red-600"
      : "border-black bg-black text-white";
  const inactiveCls =
    tone === "danger"
      ? "border-gray-200 bg-white text-gray-700"
      : "border-gray-300 bg-white text-gray-800";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-xs font-semibold ${active ? activeCls : inactiveCls}`}
    >
      {label}
    </button>
  );
}

type Props = {
  memberSearch: string;
  onMemberSearchChange: (value: string) => void;
  memberMessage: string;
  filteredProfiles: AdminProfile[];
  profiles: AdminProfile[];
  selectedMemberId: string;
  onSelectedMemberIdChange: (value: string) => void;
  planDrafts: Record<string, PlanCode>;
  durationDrafts: Record<string, number>;
  savingUserId: string;
  memberRecentMap: Map<string, string>;
  formatDateTime: (value: string | null | undefined) => string;
  getAdminDisplayName: (item: AdminProfile) => string;
  addDays: (base: Date, days: number) => Date;
  onPlanDraftChange: (userId: string, value: PlanCode) => void;
  onDurationDraftChange: (userId: string, value: number) => void;
  onSavePlan: (userId: string) => void;
  cleanupPreset: 7 | 30 | 90;
  cleanupDays: number;
  cleanupScope: "mine" | "all";
  cleanupDeleteAll: boolean;
  cleanupPreview: CleanupPreview | null;
  cleanupBusy: boolean;
  cleanupMessage: string;
  cleanupReadyToRun: boolean;
  onCleanupPresetChange: (days: 7 | 30 | 90) => void;
  onCleanupDaysChange: (value: number) => void;
  onCleanupScopeChange: (value: "mine" | "all") => void;
  onCleanupDeleteAllChange: (value: boolean) => void;
  onCleanupPreview: () => void;
  onCleanupRun: () => void;
  memberMsgPreset: "시험 독려" | "루틴 독려" | "합격 축하" | "";
  memberMsgTitle: string;
  memberMsgBody: string;
  memberMsgTarget: "selected" | "plan";
  memberMsgPlan: PlanCode;
  memberMsgConfirm: boolean;
  memberMsgBusy: boolean;
  memberMsgStatus: string;
  memberMsgProbeBusy: boolean;
  memberMsgProbeResult: PushDebugInfo | null;
  onApplyMemberMsgPreset: (preset: "시험 독려" | "루틴 독려" | "합격 축하") => void;
  onMemberMsgTitleChange: (value: string) => void;
  onMemberMsgBodyChange: (value: string) => void;
  onMemberMsgTargetChange: (value: "selected" | "plan") => void;
  onMemberMsgPlanChange: (value: PlanCode) => void;
  onMemberMsgConfirmChange: (value: boolean) => void;
  onProbeMemberMessageTarget: () => void;
  onSendMemberMessage: () => void;
  planOptions: ReadonlyArray<{ value: PlanCode; badge: string }>;
  planDurationOptions: ReadonlyArray<{ value: number; label: string }>;
};

export default function AdminMembersSection({
  memberSearch,
  onMemberSearchChange,
  memberMessage,
  filteredProfiles,
  profiles,
  selectedMemberId,
  onSelectedMemberIdChange,
  planDrafts,
  durationDrafts,
  savingUserId,
  memberRecentMap,
  formatDateTime,
  getAdminDisplayName,
  addDays,
  onPlanDraftChange,
  onDurationDraftChange,
  onSavePlan,
  cleanupPreset,
  cleanupDays,
  cleanupScope,
  cleanupDeleteAll,
  cleanupPreview,
  cleanupBusy,
  cleanupMessage,
  cleanupReadyToRun,
  onCleanupPresetChange,
  onCleanupDaysChange,
  onCleanupScopeChange,
  onCleanupDeleteAllChange,
  onCleanupPreview,
  onCleanupRun,
  memberMsgPreset,
  memberMsgTitle,
  memberMsgBody,
  memberMsgTarget,
  memberMsgPlan,
  memberMsgConfirm,
  memberMsgBusy,
  memberMsgStatus,
  memberMsgProbeBusy,
  memberMsgProbeResult,
  onApplyMemberMsgPreset,
  onMemberMsgTitleChange,
  onMemberMsgBodyChange,
  onMemberMsgTargetChange,
  onMemberMsgPlanChange,
  onMemberMsgConfirmChange,
  onProbeMemberMessageTarget,
  onSendMemberMessage,
  planOptions,
  planDurationOptions,
}: Props) {
  const selectedMember =
    profiles.find((item) => item.id === selectedMemberId) || null;

  return (
    <section className="mt-8">
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold">회원 관리</h2>
        <p className="mt-2 text-sm text-gray-600">
          5단계 플랜 변경, 기록 정리, 학생 메시지 발송을 한 곳에서 관리합니다.
        </p>
      </div>

      <div className="mt-8">
        <label className="text-sm font-semibold text-gray-800">회원 검색</label>
        <input
          value={memberSearch}
          onChange={(e) => onMemberSearchChange(e.target.value)}
          placeholder="이름/이메일/ID/플랜으로 검색"
          className="mt-3 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
        />
      </div>

      {memberMessage ? (
        <p className="mt-6 text-sm text-gray-600">{memberMessage}</p>
      ) : (
        <p className="mt-6 text-sm text-gray-600">
          검색 결과: {filteredProfiles.length}명 / 전체: {profiles.length}명
        </p>
      )}

      <div className="mt-6 space-y-4">
        {filteredProfiles.map((item) => {
          const draft = planDrafts[item.id] || item.plan;
          const durationDraft = durationDrafts[item.id] || 30;
          const changed = draft !== item.plan || draft !== "free";
          const saving = savingUserId === item.id;
          const theme = getPlanTheme(item.plan);

          return (
            <div
              key={item.id}
              className={`rounded-3xl border bg-white p-5 shadow-sm ${selectedMemberId === item.id ? "border-red-300" : "border-gray-200"}`}
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <button
                  type="button"
                  onClick={() => onSelectedMemberIdChange(item.id)}
                  className="text-left"
                >
                  <p className="text-lg font-bold">{item.email || "-"}</p>
                  <p className="mt-2 text-sm text-gray-600">
                    이름: {item.full_name?.trim() || "-"}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    가입: {formatDateTime(item.created_at)}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    최근 학습: {memberRecentMap.get(item.id) || "-"}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    만료:{" "}
                    {item.plan !== "free"
                      ? formatDateTime(item.plan_expires_at)
                      : "-"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span
                      className={`rounded-full border px-4 py-2 text-xs font-semibold ${theme.badge}`}
                    >
                      {getPlanBadge(item.plan)}
                    </span>
                    <span
                      className={`rounded-full border px-4 py-2 text-xs font-semibold ${theme.soft}`}
                    >
                      {getPlanLabel(item.plan)}
                    </span>
                    {item.is_admin ? (
                      <span className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-700">
                        관리자
                      </span>
                    ) : null}
                  </div>
                </button>

                <div className="w-full max-w-xs space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-semibold text-gray-800">
                        플랜 변경
                      </label>
                      <select
                        value={draft}
                        onChange={(e) =>
                          onPlanDraftChange(item.id, e.target.value as PlanCode)
                        }
                        className="mt-2 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
                      >
                        {planOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.badge}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-800">
                        기간
                      </label>
                      <select
                        value={durationDraft}
                        onChange={(e) =>
                          onDurationDraftChange(item.id, Number(e.target.value))
                        }
                        disabled={draft === "free"}
                        className={
                          draft === "free"
                            ? "mt-2 w-full rounded-2xl border border-gray-200 bg-gray-100 px-4 py-3 text-sm text-gray-400 outline-none"
                            : "mt-2 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
                        }
                      >
                        {planDurationOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {draft !== "free" ? (
                    <p className="text-xs text-gray-500">
                      만료 예정일:{" "}
                      {formatDateTime(addDays(new Date(), durationDraft).toISOString())}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500">
                      FREE로 변경하면 기간 정보는 비워집니다.
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => onSavePlan(item.id)}
                    disabled={saving || !changed}
                    className={
                      saving || !changed
                        ? "inline-flex w-full items-center justify-center rounded-2xl border border-gray-200 bg-gray-100 px-5 py-3 text-sm font-semibold text-gray-400"
                        : "inline-flex w-full items-center justify-center rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white"
                    }
                  >
                    {saving ? "저장 중..." : "플랜 저장"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-10 space-y-5 rounded-3xl border border-red-100 bg-red-50/50 p-6 shadow-sm">
        <div>
          <h3 className="text-xl font-bold">기록 정리</h3>
          <p className="mt-2 text-sm text-gray-600">
            선택한 회원의 오래된 학습 기록을 정리합니다. 먼저 미리보기를 확인한 뒤 실행해 주세요.
          </p>
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-800">선택 회원</label>
          <div className="mt-3 flex flex-wrap gap-2">
            {profiles.slice(0, 8).map((item) => (
              <PillButton
                key={item.id}
                active={selectedMemberId === item.id}
                onClick={() => onSelectedMemberIdChange(item.id)}
                label={getAdminDisplayName(item)}
              />
            ))}
          </div>
          <div className="mt-3">
            <select
              value={selectedMemberId}
              onChange={(e) => onSelectedMemberIdChange(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
            >
              <option value="">회원 선택</option>
              {profiles.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.email}
                </option>
              ))}
            </select>
          </div>
          {selectedMember ? (
            <p className="mt-3 text-sm text-gray-600">
              선택됨: {getAdminDisplayName(selectedMember)} · 최근 학습:{" "}
              {memberRecentMap.get(selectedMember.id) || "-"}
            </p>
          ) : null}
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-800">정리 기간</label>
          <div className="mt-3 flex flex-wrap gap-2">
            {[7, 30, 90].map((days) => (
              <PillButton
                key={days}
                active={!cleanupDeleteAll && cleanupPreset === days}
                onClick={() => onCleanupPresetChange(days as 7 | 30 | 90)}
                label={`${days}일`}
              />
            ))}
            <PillButton
              active={cleanupDeleteAll}
              onClick={() => onCleanupDeleteAllChange(true)}
              label="전체 기록"
              tone="danger"
            />
          </div>

          <div className="mt-4">
            <label className="text-xs font-semibold text-gray-700">직접 입력</label>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="number"
                min={1}
                value={cleanupDays}
                onChange={(e) => onCleanupDaysChange(Number(e.target.value || 1))}
                className="w-32 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
              />
              <span className="text-sm text-gray-600">일 이전 기록 정리</span>
            </div>
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-800">정리 대상</label>
          <div className="mt-3 flex flex-wrap gap-2">
            <PillButton
              active={cleanupScope === "mine"}
              onClick={() => onCleanupScopeChange("mine")}
              label="이 회원만"
            />
            <PillButton
              active={cleanupScope === "all"}
              onClick={() => onCleanupScopeChange("all")}
              label="전체 회원"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onCleanupPreview}
            disabled={cleanupBusy}
            className="inline-flex rounded-2xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-800"
          >
            {cleanupBusy ? "확인 중..." : "정리 미리보기"}
          </button>

          <button
            type="button"
            onClick={onCleanupRun}
            disabled={cleanupBusy || !cleanupReadyToRun}
            className={
              cleanupBusy || !cleanupReadyToRun
                ? "inline-flex rounded-2xl border border-gray-200 bg-gray-100 px-6 py-3 text-sm font-semibold text-gray-400"
                : "inline-flex rounded-2xl bg-black px-6 py-3 text-sm font-semibold text-white"
            }
          >
            정리 실행
          </button>
        </div>

        {cleanupPreview ? (
          <div className="rounded-2xl border border-white bg-white p-4 text-sm text-gray-700 shadow-sm">
            <p>대상: {cleanupPreview.scopeLabel}</p>
            <p>
              기준: {cleanupDeleteAll ? "전체 기록" : `${cleanupPreview.days}일 이전`}
            </p>
            <p>정리 예정: {cleanupPreview.total}건</p>
          </div>
        ) : null}

        {cleanupMessage ? (
          <p className="text-sm text-gray-600">{cleanupMessage}</p>
        ) : null}
      </div>

      <div className="mt-10 space-y-5 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <h3 className="text-xl font-bold">학생에게 메시지 보내기</h3>
          <p className="mt-2 text-sm text-gray-600">
            선택 회원 또는 특정 플랜 전체에게 메시지를 보낼 수 있습니다.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <PillButton
            active={memberMsgPreset === "시험 독려"}
            onClick={() => onApplyMemberMsgPreset("시험 독려")}
            label="시험 독려"
          />
          <PillButton
            active={memberMsgPreset === "루틴 독려"}
            onClick={() => onApplyMemberMsgPreset("루틴 독려")}
            label="루틴 독려"
          />
          <PillButton
            active={memberMsgPreset === "합격 축하"}
            onClick={() => onApplyMemberMsgPreset("합격 축하")}
            label="합격 축하"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-800">제목</label>
          <input
            value={memberMsgTitle}
            onChange={(e) => onMemberMsgTitleChange(e.target.value)}
            className="mt-3 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-800">내용</label>
          <textarea
            value={memberMsgBody}
            onChange={(e) => onMemberMsgBodyChange(e.target.value)}
            rows={4}
            placeholder="학생에게 보낼 메시지를 입력하세요."
            className="mt-3 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <label className="text-sm font-semibold text-gray-800">전송 대상</label>
            <div className="mt-3 flex flex-wrap gap-2">
              <PillButton
                active={memberMsgTarget === "selected"}
                onClick={() => onMemberMsgTargetChange("selected")}
                label="선택 회원에게"
              />
              <PillButton
                active={memberMsgTarget === "plan"}
                onClick={() => onMemberMsgTargetChange("plan")}
                label="특정 플랜 전체"
              />
            </div>
            {memberMsgTarget === "selected" && selectedMember ? (
              <p className="mt-3 text-sm text-gray-600">
                현재 선택: {getAdminDisplayName(selectedMember)}
              </p>
            ) : null}
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-800">플랜 선택</label>
            <div className="mt-3 flex flex-wrap gap-2">
              {planOptions.map((option) => {
                const theme = getPlanTheme(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onMemberMsgPlanChange(option.value)}
                    className={
                      memberMsgPlan === option.value
                        ? `rounded-full border px-4 py-2 text-xs font-semibold ${theme.badge}`
                        : "rounded-full border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700"
                    }
                  >
                    {option.badge}
                  </button>
                );
              })}
            </div>
            {memberMsgTarget === "plan" ? (
              <p className="mt-3 text-sm text-gray-600">
                현재 선택: {getPlanBadge(memberMsgPlan)} 전체
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onProbeMemberMessageTarget}
            disabled={
              memberMsgProbeBusy ||
              (memberMsgTarget === "selected" && !selectedMemberId)
            }
            className={
              memberMsgProbeBusy ||
              (memberMsgTarget === "selected" && !selectedMemberId)
                ? "inline-flex rounded-2xl border border-gray-200 bg-gray-100 px-5 py-3 text-sm font-semibold text-gray-400"
                : "inline-flex rounded-2xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-800"
            }
          >
            {memberMsgProbeBusy ? "대상 확인 중..." : "대상 수 미리보기"}
          </button>
        </div>

        {memberMsgProbeResult ? (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
            <p>
              발송 방식:{" "}
              {memberMsgTarget === "plan"
                ? `${getPlanBadge(memberMsgPlan)} 전체`
                : "선택 회원"}
            </p>
            <p>대상 구독 수: {memberMsgProbeResult.total ?? "-"}</p>
            <p>매칭 행 수: {memberMsgProbeResult.matchedRows ?? "-"}</p>
            <p>
              상세: {memberMsgProbeResult.detail || memberMsgProbeResult.note || "-"}
            </p>
          </div>
        ) : null}

        <label className="inline-flex items-center gap-3 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={memberMsgConfirm}
            onChange={(e) => onMemberMsgConfirmChange(e.target.checked)}
            className="h-4 w-4"
          />
          전송 확인
        </label>

        <button
          type="button"
          onClick={onSendMemberMessage}
          disabled={
            memberMsgBusy ||
            !memberMsgTitle.trim() ||
            !memberMsgBody.trim() ||
            (memberMsgTarget === "selected" && !selectedMemberId)
          }
          className={
            memberMsgBusy ||
            !memberMsgTitle.trim() ||
            !memberMsgBody.trim() ||
            (memberMsgTarget === "selected" && !selectedMemberId)
              ? "inline-flex w-full items-center justify-center rounded-2xl border border-gray-200 bg-gray-100 px-6 py-3 text-sm font-semibold text-gray-400"
              : "inline-flex w-full items-center justify-center rounded-2xl bg-black px-6 py-3 text-sm font-semibold text-white"
          }
        >
          {memberMsgBusy ? "메시지 전송 중..." : "메시지 전송"}
        </button>

        {memberMsgStatus ? (
          <p className="text-sm text-gray-600">{memberMsgStatus}</p>
        ) : (
          <p className="text-sm text-gray-500">
            전송 전에 대상 수 미리보기를 눌러 확인하면 더 안전합니다.
          </p>
        )}
      </div>
    </section>
  );
}
