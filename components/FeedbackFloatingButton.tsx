"use client";

import { useState } from "react";

type FeedbackFloatingButtonProps = {
  contactHref?: string;
};

export default function FeedbackFloatingButton({
  contactHref = "https://hotena.com/",
}: FeedbackFloatingButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-[90] inline-flex items-center justify-center rounded-full bg-black px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(0,0,0,0.22)] transition hover:translate-y-[-1px]"
        aria-label="문의하기"
      >
        문의
      </button>

      {open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-sm rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                불편한 점이 있으신가요?
              </p>

              <p className="mt-3 whitespace-pre-line text-base leading-7 text-gray-600">
                오타, 오류, 불편한 점, 개선 희망 사항이 있으면
                {"\n"}
                교육센터로 편하게 알려 주세요.
                {"\n"}
                확인 후 반영하겠습니다.
              </p>
            </div>

            <div className="mt-6 space-y-3">
              <a
                href={contactHref}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full rounded-2xl bg-black px-5 py-4 text-center text-base font-semibold text-white"
              >
                문의하러 가기
              </a>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full rounded-2xl border border-gray-300 px-5 py-4 text-base font-semibold text-gray-700"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}