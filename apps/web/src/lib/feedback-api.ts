import type {
  AccessTokenResponse,
  AppLocale,
  PublicAppConfig,
  StreamEvent,
} from "@feedback-agent/contracts";

export type IdentityKind = "guest" | "email";

export type AuthSession = AccessTokenResponse & {
  identityKind: IdentityKind;
};

export type Conversation = {
  id: string;
  status: "OPEN" | "RESOLVED" | "UNRESOLVED" | "CLOSED";
  locale: AppLocale;
};

const apiBase = (
  process.env.NEXT_PUBLIC_FEEDBACK_API_URL || "http://localhost:4100"
).replace(/\/$/, "");

export class FeedbackApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "FeedbackApiError";
  }
}

async function readError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(payload.message)) return payload.message.join("；");
    if (payload.message) return payload.message;
  } catch {
    // Some proxies return text or an empty body for transport errors.
  }
  return response.status >= 500
    ? "服务暂时不可用，请稍后再试"
    : "请求未成功，请检查后重试";
}

async function expectJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new FeedbackApiError(await readError(response), response.status);
  }
  return response.json() as Promise<T>;
}

export async function fetchPublicConfig(
  appSlug: string,
): Promise<PublicAppConfig> {
  const response = await fetch(
    `${apiBase}/v1/public/apps/${encodeURIComponent(appSlug)}/config`,
    { cache: "no-store" },
  );
  return expectJson<PublicAppConfig>(response);
}

function sessionKey(appSlug: string): string {
  return `feedback-agent:session:${appSlug}`;
}

function guestKey(appSlug: string): string {
  return `feedback-agent:guest:${appSlug}`;
}

export function loadSession(appSlug: string): AuthSession | null {
  try {
    const value = window.localStorage.getItem(sessionKey(appSlug));
    return value ? (JSON.parse(value) as AuthSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(appSlug: string, session: AuthSession): void {
  window.localStorage.setItem(sessionKey(appSlug), JSON.stringify(session));
}

export function clearSession(appSlug: string): void {
  window.localStorage.removeItem(sessionKey(appSlug));
}

export function getOrCreateGuestId(appSlug: string): string {
  const existing = window.localStorage.getItem(guestKey(appSlug));
  if (existing) return existing;
  const id = `guest_${crypto.randomUUID()}`;
  window.localStorage.setItem(guestKey(appSlug), id);
  return id;
}

export async function createGuestSession(
  appSlug: string,
  appId: string,
): Promise<AuthSession> {
  const response = await fetch(`${apiBase}/v1/auth/guest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appId, guestId: getOrCreateGuestId(appSlug) }),
  });
  const tokens = await expectJson<AccessTokenResponse>(response);
  const session: AuthSession = { ...tokens, identityKind: "guest" };
  saveSession(appSlug, session);
  return session;
}

export async function createEmailSession(input: {
  appSlug: string;
  appId: string;
  email: string;
  password: string;
  displayName?: string;
  mode: "login" | "register";
}): Promise<AuthSession> {
  const path =
    input.mode === "login" ? "/v1/auth/email/login" : "/v1/auth/email/register";
  const response = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      appId: input.appId,
      email: input.email,
      password: input.password,
      displayName: input.mode === "register" ? input.displayName : undefined,
    }),
  });
  const tokens = await expectJson<AccessTokenResponse>(response);
  const session: AuthSession = { ...tokens, identityKind: "email" };
  saveSession(input.appSlug, session);
  return session;
}

async function refreshSession(
  appSlug: string,
  session: AuthSession,
): Promise<AuthSession> {
  const response = await fetch(`${apiBase}/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });
  const tokens = await expectJson<AccessTokenResponse>(response);
  const refreshed = { ...tokens, identityKind: session.identityKind };
  saveSession(appSlug, refreshed);
  return refreshed;
}

export async function requestWithSession(
  appSlug: string,
  session: AuthSession,
  path: string,
  init: RequestInit,
): Promise<{ response: Response; session: AuthSession }> {
  const send = (accessToken: string) =>
    fetch(`${apiBase}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
        Authorization: `Bearer ${accessToken}`,
      },
    });

  let activeSession = session;
  let response = await send(activeSession.accessToken);
  if (response.status === 401) {
    try {
      activeSession = await refreshSession(appSlug, activeSession);
      response = await send(activeSession.accessToken);
    } catch (error) {
      clearSession(appSlug);
      throw error;
    }
  }
  if (!response.ok) {
    throw new FeedbackApiError(await readError(response), response.status);
  }
  return { response, session: activeSession };
}

export async function createConversation(
  appSlug: string,
  session: AuthSession,
  appId: string,
  locale: AppLocale,
): Promise<{ conversation: Conversation; session: AuthSession }> {
  const result = await requestWithSession(
    appSlug,
    session,
    "/v1/conversations",
    {
      method: "POST",
      body: JSON.stringify({
        appId,
        locale,
        channel: "WEB",
        metadata: { surface: "public-web" },
      }),
    },
  );
  return {
    conversation: (await result.response.json()) as Conversation,
    session: result.session,
  };
}

export async function setResolution(
  appSlug: string,
  session: AuthSession,
  conversationId: string,
  resolved: boolean,
): Promise<AuthSession> {
  const result = await requestWithSession(
    appSlug,
    session,
    `/v1/conversations/${conversationId}/resolution`,
    {
      method: "POST",
      body: JSON.stringify({ resolved }),
    },
  );
  return result.session;
}

export async function closeConversation(
  appSlug: string,
  session: AuthSession,
  conversationId: string,
): Promise<AuthSession> {
  const result = await requestWithSession(
    appSlug,
    session,
    `/v1/conversations/${conversationId}/close`,
    { method: "POST" },
  );
  return result.session;
}

export async function streamMessage(input: {
  appSlug: string;
  session: AuthSession;
  conversationId: string;
  content: string;
  onEvent: (event: StreamEvent) => void;
}): Promise<AuthSession> {
  const result = await requestWithSession(
    input.appSlug,
    input.session,
    `/v1/conversations/${input.conversationId}/messages:stream`,
    {
      method: "POST",
      headers: { Accept: "text/event-stream" },
      body: JSON.stringify({
        content: input.content,
        clientMessageId: crypto.randomUUID(),
      }),
    },
  );
  if (!result.response.body) {
    throw new FeedbackApiError("浏览器不支持流式响应", 500);
  }

  const reader = result.response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const consumeBlock = (block: string) => {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data) return;
    input.onEvent(JSON.parse(data) as StreamEvent);
  };

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() ?? "";
    blocks.forEach(consumeBlock);
    if (done) break;
  }
  if (buffer.trim()) consumeBlock(buffer);
  return result.session;
}
