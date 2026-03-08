"use client";

import dynamic from "next/dynamic";

const TalkPageClient = dynamic(() => import("./TalkPageClient"), {
  ssr: false,
});

export default function TalkPageShell() {
  return <TalkPageClient />;
}