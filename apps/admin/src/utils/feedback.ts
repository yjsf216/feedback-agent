import Axios from "axios";

const statusLabels: Record<string, string> = {
  OPEN: "处理中",
  RESOLVED: "已解决",
  UNRESOLVED: "未解决",
  CLOSED: "已关闭",
  NEW: "新反馈",
  REVIEWED: "已复核",
  LINKED: "已关联",
  ARCHIVED: "已归档",
  DRAFT: "待确认",
  APPROVED: "已确认",
  PLANNED: "已规划",
  IN_PROGRESS: "进行中",
  DONE: "已完成",
  REJECTED: "已拒绝",
  PROCESSING: "处理中",
  DISMISSED: "已忽略",
  PENDING: "等待处理",
  READY: "可用",
  FAILED: "失败",
  ACTIVE: "运行中",
  DISABLED: "已停用",
  BUG: "缺陷",
  FEATURE_REQUEST: "功能建议",
  COMPLAINT: "投诉",
  PRAISE: "表扬",
  QUESTION: "咨询",
  OTHER: "其他"
};

export function statusLabel(value: string): string {
  return statusLabels[value] ?? value;
}

export function statusTone(value: string): string {
  if (["RESOLVED", "DONE", "READY", "ACTIVE", "APPROVED"].includes(value))
    return "success";
  if (["UNRESOLVED", "FAILED", "REJECTED", "BUG"].includes(value))
    return "danger";
  if (["OPEN", "PROCESSING", "PENDING", "IN_PROGRESS"].includes(value))
    return "warning";
  if (["DRAFT", "NEW", "PLANNED", "FEATURE_REQUEST"].includes(value))
    return "primary";
  return "muted";
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function formatPercent(value: number | null | undefined): string {
  return `${Math.round((value ?? 0) * 100)}%`;
}

export function errorMessage(error: unknown): string {
  if (Axios.isAxiosError<{ message?: string }>(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join("；");
    if (message) return message;
  }
  return error instanceof Error ? error.message : "请求失败，请稍后重试";
}
