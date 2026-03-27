"use client";

import { useState } from "react";

type FeedbackFloatingButtonProps = {
  contactHref?: string;
};

export default function FeedbackFloatingButton({
  contactHref = `mailto:hotena@naver.com?subject=${encodeURIComponent(
    "[하테나 문의]"
  )}&body=${encodeURIComponent(
    [
      "안녕하세요.",
      "",
      "오타 / 오류 / 불편한 점 / 개선 희망 사항이 있으면 아래에 적어 주세요.",
      "",
      "- 문의 유형:",
      "- 사용 페이지:",
      "- 내용:",
      "- 기기/브라우저:",
      "",
      "가능하면 화면 캡처도 함께 보내주시면 확인에 도움이 됩니다.",
    ].join("\n")
  )}`,
}: FeedbackFloatingButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-[90] inline-flex items-center justify-center rounded-full bg-[#006241] px-5 py-3 text-base font-semibold text-white shadow-[0_12px_30px_rgba(0,98,65,0.28)] transition hover:translate-y-[-1px]"
        aria-label="문의하기"
      >
        문의
      </button>

      {open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-sm overflow-hidden rounded-[28px] bg-white shadow-2xl">
            <div className="bg-[#006241] px-6 pb-6 pt-6 text-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-[0.22em] text-white/70">
                    HOTENA FEEDBACK
                  </p>
                  <p className="mt-3 text-3xl font-bold leading-tight">
                    의견 보내기
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-2xl text-white"
                  aria-label="닫기"
                >
                  ×
                </button>
              </div>

              <p className="mt-5 whitespace-pre-line text-base leading-7 text-white/90">
                오타, 오류, 불편한 점,
                {"\n"}
                개선 희망 사항이 있으면
                {"\n"}
                메일로 편하게 알려 주세요.
              </p>
            </div>

            <div className="px-6 pb-6 pt-6">
              <div className="rounded-[24px] border border-[#cfe2da] bg-[#f4f8f6] px-5 py-5">
                <p className="text-lg font-bold text-slate-900">
                  이런 내용을 보내주시면 좋아요
                </p>

                <div className="mt-4 space-y-3 text-base leading-7 text-slate-600">
                  <p>• 오타나 어색한 표현</p>
                  <p>• 버튼/화면 오류</p>
                  <p>• 사용하면서 불편했던 점</p>
                  <p>• 있었으면 하는 기능</p>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <a
                  href={contactHref}
                  className="block w-full rounded-2xl bg-[#006241] px-5 py-4 text-center text-lg font-semibold text-white"
                >
                  메일 보내기
                </a>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-full rounded-2xl border border-gray-300 px-5 py-4 text-base font-semibold text-gray-700"
                >
                  닫기
                </button>
              </div>

              <p className="mt-5 text-center text-sm leading-6 text-[#8da1bd]">
                hotena@naver.com 으로 연결됩니다.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}