import type { Metadata } from "next";
import { FeedbackChat } from "@/components/feedback-chat";

export const metadata: Metadata = {
  title: "用户反馈",
  description: "与 AI 助手对话，获取产品帮助并提交真实反馈。",
};

export default async function FeedbackPage({
  params,
}: {
  params: Promise<{ appSlug: string }>;
}) {
  const { appSlug } = await params;
  return <FeedbackChat appSlug={appSlug} />;
}
