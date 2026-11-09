import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "数据处理协议审核 · Legal Agent",
  description:
    "一位资深数据合规律师的 AI 分身，为你逐条审阅《数据处理协议 / DPA》，出具合规评级、风险清单与整改建议。",
  keywords: [
    "数据处理协议",
    "DPA 审核",
    "个人信息保护法",
    "PIPL",
    "GDPR",
    "CCPA",
    "合规审查",
    "Legal Agent",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
