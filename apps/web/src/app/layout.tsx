import type { Metadata } from "next";
import "@fontsource-variable/syne";
import "@fontsource-variable/noto-sans-sc";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Feedback Agent · 把用户声音变成行动",
    template: "%s · Feedback Agent",
  },
  description:
    "可接入多应用的用户反馈智能体：回答问题、识别意图、提炼痛点并生成可审阅的需求草稿。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
