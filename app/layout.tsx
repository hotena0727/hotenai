import type { Metadata } from "next";
import "./globals.css";
import AppTopNav from "@/components/AppTopNav";

export const metadata: Metadata = {
  title: "하테나일본어",
  description: "일본어 학습 앱",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "하테나일본어",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: ["/favicon.ico"],
  },
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