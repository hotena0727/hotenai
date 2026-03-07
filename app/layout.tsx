import type { Metadata } from "next";
import "./globals.css";
import AppTopNav from "@/components/AppTopNav";

export const metadata: Metadata = {
  title: "Hotena",
  description: "일본어 학습 앱",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <AppTopNav />
        {children}
      </body>
    </html>
  );
}