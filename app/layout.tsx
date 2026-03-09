import type { Metadata } from "next";
import "./globals.css";
import AppTopNav from "@/components/AppTopNav";

export const metadata: Metadata = {
  title: "Hotena",
  description: "일본어 학습 앱",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.jpeg", type: "image/jpeg" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: ["/favicon.jpeg"],
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