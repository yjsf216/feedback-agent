"use client";

import type { CSSProperties, FormEvent, KeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  Languages,
  LockKeyhole,
  Mail,
  MessageCircleQuestion,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import type {
  AppLocale,
  PublicAppConfig,
  StreamEvent,
} from "@feedback-agent/contracts";
import {
  clearSession,
  closeConversation,
  createConversation,
  createEmailSession,
  createGuestSession,
  fetchPublicConfig,
  loadSession,
  saveSession,
  setResolution,
  streamMessage,
  type AuthSession,
  type Conversation,
} from "@/lib/feedback-api";
import styles from "./feedback-chat.module.css";

type MessageState = "complete" | "streaming" | "error";

type UiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  state: MessageState;
  confidence?: number;
  sources?: Array<{ id: string; title: string; url?: string }>;
};

const dictionaries = {
  "zh-CN": {
    online: "在线",
    back: "返回首页",
    newChat: "新对话",
    anonymous: "匿名访客",
    account: "邮箱身份",
    contextTitle: "在这里，你可以",
    contextItems: [
      "询问产品使用问题",
      "提交缺陷或功能建议",
      "补充影响范围与使用场景",
    ],
    privacy:
      "对话会被用于回答问题和整理产品反馈。AI 提炼的需求必须由管理员确认。",
    workflow: ["理解问题", "检索已验证知识", "记录反馈信号"],
    placeholder: "描述你的问题、建议或遇到的困难…",
    send: "发送",
    sendHint: "Enter 发送 · Shift + Enter 换行",
    source: "回答依据",
    confidence: "AI 置信度",
    solvedQuestion: "这个回答解决了你的问题吗？",
    solved: "已解决",
    unresolved: "仍需帮助",
    solvedThanks: "谢谢确认，这会帮助我们评估回答质量。",
    unresolvedThanks: "已记录为未解决问题，负责人可以在管理台继续跟进。",
    streamError: "这次连接没有完成。你可以重新发送，原始问题已经保留。",
    retry: "重新发送",
    loading: "正在连接反馈入口",
    loadErrorTitle: "暂时无法打开反馈入口",
    retryLoad: "重新加载",
    unavailable: "该应用未开放可用的用户身份入口，请联系产品团队。",
    signInTitle: "用邮箱继续",
    signInNote: "登录后，同一邮箱可以在后续会话中保持身份连续性。",
    email: "邮箱",
    password: "密码",
    displayName: "怎么称呼你",
    login: "登录",
    register: "创建账号",
    switchRegister: "第一次使用？创建账号",
    switchLogin: "已有账号？直接登录",
    continueGuest: "继续匿名反馈",
    signedIn: "当前已使用邮箱身份",
    logout: "退出邮箱身份",
    close: "关闭",
    footer: "由 Feedback Agent 提供支持",
  },
  en: {
    online: "Online",
    back: "Back home",
    newChat: "New chat",
    anonymous: "Guest",
    account: "Email identity",
    contextTitle: "You can use this space to",
    contextItems: [
      "Ask product questions",
      "Report a bug or suggest a feature",
      "Explain impact and context",
    ],
    privacy:
      "Conversations help answer questions and structure product feedback. AI requirement drafts always require human approval.",
    workflow: ["Understand", "Search verified knowledge", "Capture feedback"],
    placeholder: "Describe your question, idea, or what went wrong…",
    send: "Send",
    sendHint: "Enter to send · Shift + Enter for a new line",
    source: "Sources",
    confidence: "AI confidence",
    solvedQuestion: "Did this answer solve your problem?",
    solved: "Solved",
    unresolved: "Still need help",
    solvedThanks:
      "Thanks — your confirmation helps us evaluate answer quality.",
    unresolvedThanks:
      "Marked as unresolved. The product team can follow up from the admin queue.",
    streamError:
      "The connection ended before the answer completed. You can retry; your original message is preserved.",
    retry: "Try again",
    loading: "Connecting to feedback",
    loadErrorTitle: "This feedback entry is unavailable",
    retryLoad: "Reload",
    unavailable:
      "This app has no available identity method. Please contact the product team.",
    signInTitle: "Continue with email",
    signInNote:
      "Signing in keeps your identity consistent across future conversations.",
    email: "Email",
    password: "Password",
    displayName: "Display name",
    login: "Sign in",
    register: "Create account",
    switchRegister: "New here? Create an account",
    switchLogin: "Already registered? Sign in",
    continueGuest: "Continue as guest",
    signedIn: "You are using an email identity",
    logout: "Sign out",
    close: "Close",
    footer: "Powered by Feedback Agent",
  },
} as const;

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Request failed";
}

function initialLocale(): AppLocale {
  if (typeof navigator === "undefined") return "zh-CN";
  return navigator.language.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}

function welcomeMessage(config: PublicAppConfig, locale: AppLocale): UiMessage {
  return {
    id: `welcome-${locale}`,
    role: "assistant",
    content: config.welcomeMessages[locale],
    state: "complete",
  };
}

export function FeedbackChat({ appSlug }: { appSlug: string }) {
  const [config, setConfig] = useState<PublicAppConfig | null>(null);
  const [configError, setConfigError] = useState("");
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [locale, setLocale] = useState<AppLocale>("zh-CN");
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [composer, setComposer] = useState("");
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [resolution, setResolutionState] = useState<boolean | null>(null);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [identityMode, setIdentityMode] = useState<"login" | "register">(
    "login",
  );
  const [identityError, setIdentityError] = useState("");
  const [identityBusy, setIdentityBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const messageEndRef = useRef<HTMLDivElement>(null);

  const dictionary = dictionaries[locale];
  const suggestions = config?.suggestedQuestions[locale] ?? [];
  const hasUserMessage = messages.some((message) => message.role === "user");
  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user")?.content;

  const appStyle = useMemo(
    () =>
      ({
        "--app-primary": config?.primaryColor || "#0F766E",
      }) as CSSProperties,
    [config?.primaryColor],
  );

  async function loadConfig() {
    setLoadingConfig(true);
    setConfigError("");
    try {
      const nextConfig = await fetchPublicConfig(appSlug);
      const nextLocale = initialLocale();
      setLocale(nextLocale);
      setConfig(nextConfig);
      setSession(loadSession(appSlug));
      setMessages([welcomeMessage(nextConfig, nextLocale)]);
      document.documentElement.lang = nextLocale;
    } catch (error) {
      setConfigError(errorText(error));
    } finally {
      setLoadingConfig(false);
    }
  }

  useEffect(() => {
    let active = true;
    void fetchPublicConfig(appSlug)
      .then((nextConfig) => {
        if (!active) return;
        const nextLocale = initialLocale();
        setLocale(nextLocale);
        setConfig(nextConfig);
        setSession(loadSession(appSlug));
        setMessages([welcomeMessage(nextConfig, nextLocale)]);
        document.documentElement.lang = nextLocale;
      })
      .catch((error: unknown) => {
        if (active) setConfigError(errorText(error));
      })
      .finally(() => {
        if (active) setLoadingConfig(false);
      });
    return () => {
      active = false;
    };
  }, [appSlug]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy, resolution]);

  function updateSession(nextSession: AuthSession) {
    setSession(nextSession);
    saveSession(appSlug, nextSession);
  }

  async function ensureSession(
    forcedSession?: AuthSession,
  ): Promise<AuthSession | null> {
    if (forcedSession) return forcedSession;
    if (session) return session;
    if (!config) return null;
    if (config.auth.guest) {
      const guest = await createGuestSession(appSlug, config.id);
      updateSession(guest);
      return guest;
    }
    if (config.auth.email) {
      setIdentityOpen(true);
      return null;
    }
    return null;
  }

  function updateAssistant(id: string, update: Partial<UiMessage>) {
    setMessages((current) =>
      current.map((message) =>
        message.id === id ? { ...message, ...update } : message,
      ),
    );
  }

  async function sendMessage(value = composer, forcedSession?: AuthSession) {
    const content = value.trim();
    if (!content || busy || !config) return;
    setBusy(true);
    setResolutionState(null);
    try {
      let activeSession = await ensureSession(forcedSession);
      if (!activeSession) {
        if (!config.auth.email && !config.auth.guest) {
          setConfigError(dictionary.unavailable);
        }
        return;
      }

      let activeConversation = conversation;
      if (!activeConversation) {
        const created = await createConversation(
          appSlug,
          activeSession,
          config.id,
          locale,
        );
        activeConversation = created.conversation;
        activeSession = created.session;
        setConversation(created.conversation);
        updateSession(created.session);
      }

      const userId = `user-${crypto.randomUUID()}`;
      const assistantId = `assistant-${crypto.randomUUID()}`;
      setMessages((current) => [
        ...current,
        { id: userId, role: "user", content, state: "complete" },
        {
          id: assistantId,
          role: "assistant",
          content: "",
          state: "streaming",
          sources: [],
        },
      ]);
      setComposer("");

      const refreshedSession = await streamMessage({
        appSlug,
        session: activeSession,
        conversationId: activeConversation.id,
        content,
        onEvent: (event: StreamEvent) => {
          if (event.type === "message.delta") {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? { ...message, content: message.content + event.delta }
                  : message,
              ),
            );
          }
          if (event.type === "knowledge.source") {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? {
                      ...message,
                      sources: [
                        ...(message.sources ?? []).filter(
                          (source) => source.id !== event.source.id,
                        ),
                        event.source,
                      ],
                    }
                  : message,
              ),
            );
          }
          if (event.type === "conversation.state") {
            setConversation((current) =>
              current ? { ...current, status: event.status } : current,
            );
          }
          if (event.type === "message.completed") {
            updateAssistant(assistantId, {
              content: event.content,
              confidence: event.confidence,
              state: "complete",
            });
          }
          if (event.type === "error") throw new Error(event.message);
        },
      });
      updateSession(refreshedSession);
    } catch (error) {
      const message = errorText(error);
      setMessages((current) => {
        const active = [...current]
          .reverse()
          .find(
            (item) => item.role === "assistant" && item.state === "streaming",
          );
        if (!active) {
          return [
            ...current,
            {
              id: `error-${crypto.randomUUID()}`,
              role: "assistant",
              content: `${dictionary.streamError} (${message})`,
              state: "error",
            },
          ];
        }
        return current.map((item) =>
          item.id === active.id
            ? {
                ...item,
                content: `${dictionary.streamError} (${message})`,
                state: "error",
              }
            : item,
        );
      });
    } finally {
      setBusy(false);
    }
  }

  async function submitIdentity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!config) return;
    setIdentityBusy(true);
    setIdentityError("");
    try {
      const nextSession = await createEmailSession({
        appSlug,
        appId: config.id,
        email,
        password,
        displayName: displayName || undefined,
        mode: identityMode,
      });
      updateSession(nextSession);
      setIdentityOpen(false);
      if (composer.trim()) await sendMessage(composer, nextSession);
    } catch (error) {
      setIdentityError(errorText(error));
    } finally {
      setIdentityBusy(false);
    }
  }

  async function markResolution(resolved: boolean) {
    if (!session || !conversation) return;
    try {
      const activeSession = await setResolution(
        appSlug,
        session,
        conversation.id,
        resolved,
      );
      updateSession(activeSession);
      setResolutionState(resolved);
      setConversation({
        ...conversation,
        status: resolved ? "RESOLVED" : "UNRESOLVED",
      });
    } catch (error) {
      setConfigError(errorText(error));
    }
  }

  async function startNewConversation(nextLocale = locale) {
    if (busy || !config) return;
    if (session && conversation) {
      try {
        updateSession(
          await closeConversation(appSlug, session, conversation.id),
        );
      } catch {
        // A local reset should remain available if the old session already expired.
      }
    }
    setConversation(null);
    setResolutionState(null);
    setMessages([welcomeMessage(config, nextLocale)]);
    setComposer("");
  }

  async function changeLocale(nextLocale: AppLocale) {
    if (nextLocale === locale || !config) return;
    setLocale(nextLocale);
    document.documentElement.lang = nextLocale;
    await startNewConversation(nextLocale);
  }

  async function logoutEmail() {
    await startNewConversation();
    clearSession(appSlug);
    setSession(null);
    setIdentityOpen(false);
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  if (loadingConfig) {
    return (
      <main className={styles.statePage}>
        <div className={styles.loadingOrb}>
          <Bot aria-hidden="true" />
        </div>
        <strong>{dictionaries[locale].loading}</strong>
        <div className={styles.loadingLine}>
          <span />
        </div>
      </main>
    );
  }

  if (!config || configError) {
    return (
      <main className={styles.statePage}>
        <div className={`${styles.loadingOrb} ${styles.errorOrb}`}>
          <CircleAlert aria-hidden="true" />
        </div>
        <h1>{dictionaries[locale].loadErrorTitle}</h1>
        <p>{configError}</p>
        <div className={styles.stateActions}>
          <button type="button" onClick={() => void loadConfig()}>
            <RefreshCw aria-hidden="true" />
            {dictionaries[locale].retryLoad}
          </button>
          <Link href="/">
            <ArrowLeft aria-hidden="true" />
            {dictionaries[locale].back}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.feedbackPage} style={appStyle}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.appBrand} aria-label={dictionary.back}>
          <span className={styles.appLogo}>
            <Bot aria-hidden="true" />
          </span>
          <span>
            <strong>{config.name}</strong>
            <small>
              <i />
              {dictionary.online}
            </small>
          </span>
        </Link>
        <div className={styles.topbarActions}>
          <div className={styles.localeSwitch} aria-label="Language">
            <Languages aria-hidden="true" />
            <button
              type="button"
              className={locale === "zh-CN" ? styles.activeLocale : ""}
              onClick={() => void changeLocale("zh-CN")}
            >
              中
            </button>
            <button
              type="button"
              className={locale === "en" ? styles.activeLocale : ""}
              onClick={() => void changeLocale("en")}
            >
              EN
            </button>
          </div>
          <button
            type="button"
            className={styles.identityButton}
            onClick={() => setIdentityOpen(true)}
          >
            <UserRound aria-hidden="true" />
            <span>
              {session?.identityKind === "email"
                ? session.user.displayName || session.user.id.slice(0, 8)
                : dictionary.anonymous}
            </span>
          </button>
          <button
            type="button"
            className={styles.newChatButton}
            disabled={busy}
            onClick={() => void startNewConversation()}
          >
            <Plus aria-hidden="true" />
            <span>{dictionary.newChat}</span>
          </button>
        </div>
      </header>

      <div className={styles.workspace}>
        <aside className={styles.contextPanel}>
          <Link href="/" className={styles.backLink}>
            <ArrowLeft aria-hidden="true" />
            {dictionary.back}
          </Link>
          <div className={styles.contextIntro}>
            <span>Feedback channel</span>
            <h1>{config.name}</h1>
            <p>{dictionary.contextTitle}</p>
          </div>
          <ul className={styles.contextList}>
            {dictionary.contextItems.map((item) => (
              <li key={item}>
                <Check aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
          <div className={styles.workflowMini}>
            {dictionary.workflow.map((item, index) => (
              <div key={item}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{item}</p>
                {index < 2 && <ChevronRight aria-hidden="true" />}
              </div>
            ))}
          </div>
          <div className={styles.privacyNote}>
            <ShieldCheck aria-hidden="true" />
            <p>{dictionary.privacy}</p>
          </div>
        </aside>

        <section className={styles.chatPanel} aria-label="AI feedback chat">
          <div className={styles.mobileContext}>
            <span>
              <LockKeyhole aria-hidden="true" />
              {config.name}
            </span>
            <small>{dictionary.privacy}</small>
          </div>
          <div className={styles.messageList} aria-live="polite">
            {messages.map((message) => (
              <article
                key={message.id}
                className={`${styles.messageRow} ${message.role === "user" ? styles.userRow : styles.assistantRow}`}
              >
                {message.role === "assistant" && (
                  <span className={styles.messageAvatar}>
                    <Bot aria-hidden="true" />
                  </span>
                )}
                <div
                  className={`${styles.messageBubble} ${message.state === "error" ? styles.errorBubble : ""}`}
                >
                  {message.state === "streaming" && !message.content ? (
                    <span className={styles.typingDots}>
                      <i />
                      <i />
                      <i />
                    </span>
                  ) : (
                    <p>{message.content}</p>
                  )}
                  {message.sources && message.sources.length > 0 && (
                    <div className={styles.sources}>
                      <span>{dictionary.source}</span>
                      {message.sources.map((source) =>
                        source.url ? (
                          <a
                            key={source.id}
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {source.title}
                            <ExternalLink aria-hidden="true" />
                          </a>
                        ) : (
                          <em key={source.id}>{source.title}</em>
                        ),
                      )}
                    </div>
                  )}
                  {message.confidence !== undefined && (
                    <div className={styles.confidence}>
                      <span>{dictionary.confidence}</span>
                      <div>
                        <i
                          style={{
                            width: `${Math.round(message.confidence * 100)}%`,
                          }}
                        />
                      </div>
                      <strong>{Math.round(message.confidence * 100)}%</strong>
                    </div>
                  )}
                  {message.state === "error" && lastUserMessage && (
                    <button
                      type="button"
                      className={styles.retryMessage}
                      disabled={busy}
                      onClick={() => void sendMessage(lastUserMessage)}
                    >
                      <RotateCcw aria-hidden="true" />
                      {dictionary.retry}
                    </button>
                  )}
                </div>
              </article>
            ))}

            {!hasUserMessage && suggestions.length > 0 && (
              <div className={styles.suggestions}>
                <span>
                  <Sparkles aria-hidden="true" />
                  Suggestions
                </span>
                {suggestions.map((question) => (
                  <button
                    key={question}
                    type="button"
                    disabled={busy}
                    onClick={() => void sendMessage(question)}
                  >
                    {question}
                    <ChevronRight aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}

            {conversation &&
              !busy &&
              messages.at(-1)?.role === "assistant" &&
              messages.at(-1)?.state === "complete" && (
                <div className={styles.resolutionCard}>
                  {resolution === null ? (
                    <>
                      <span>{dictionary.solvedQuestion}</span>
                      <div>
                        <button
                          type="button"
                          onClick={() => void markResolution(true)}
                        >
                          <CheckCircle2 aria-hidden="true" />
                          {dictionary.solved}
                        </button>
                        <button
                          type="button"
                          onClick={() => void markResolution(false)}
                        >
                          <MessageCircleQuestion aria-hidden="true" />
                          {dictionary.unresolved}
                        </button>
                      </div>
                    </>
                  ) : (
                    <p>
                      <CheckCircle2 aria-hidden="true" />
                      {resolution
                        ? dictionary.solvedThanks
                        : dictionary.unresolvedThanks}
                    </p>
                  )}
                </div>
              )}
            <div ref={messageEndRef} />
          </div>

          <footer className={styles.composerArea}>
            <div
              className={`${styles.composer} ${busy ? styles.composerBusy : ""}`}
            >
              <textarea
                value={composer}
                rows={2}
                maxLength={8000}
                placeholder={dictionary.placeholder}
                disabled={busy}
                onChange={(event) => setComposer(event.target.value)}
                onKeyDown={onComposerKeyDown}
                aria-label={dictionary.placeholder}
              />
              <button
                type="button"
                disabled={busy || !composer.trim()}
                aria-label={dictionary.send}
                onClick={() => void sendMessage()}
              >
                {busy ? (
                  <RefreshCw className={styles.spin} aria-hidden="true" />
                ) : (
                  <Send aria-hidden="true" />
                )}
              </button>
            </div>
            <div className={styles.composerMeta}>
              <span>{dictionary.sendHint}</span>
              <span>
                <LockKeyhole aria-hidden="true" />
                {dictionary.footer}
              </span>
            </div>
          </footer>
        </section>
      </div>

      {identityOpen && (
        <div
          className={styles.identityOverlay}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIdentityOpen(false);
          }}
        >
          <section
            className={styles.identityDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="identity-title"
          >
            <button
              type="button"
              className={styles.dialogClose}
              aria-label={dictionary.close}
              onClick={() => setIdentityOpen(false)}
            >
              <X aria-hidden="true" />
            </button>
            <span className={styles.identityIcon}>
              {session?.identityKind === "email" ? (
                <UserRound aria-hidden="true" />
              ) : (
                <Mail aria-hidden="true" />
              )}
            </span>
            {session?.identityKind === "email" ? (
              <div className={styles.signedIdentity}>
                <h2 id="identity-title">{dictionary.signedIn}</h2>
                <p>{session.user.displayName || email}</p>
                <button type="button" onClick={() => void logoutEmail()}>
                  {dictionary.logout}
                </button>
              </div>
            ) : (
              <>
                <h2 id="identity-title">{dictionary.signInTitle}</h2>
                <p>{dictionary.signInNote}</p>
                {config.auth.email && (
                  <form onSubmit={submitIdentity}>
                    {identityMode === "register" && (
                      <label>
                        {dictionary.displayName}
                        <input
                          value={displayName}
                          required
                          maxLength={120}
                          autoComplete="name"
                          onChange={(event) =>
                            setDisplayName(event.target.value)
                          }
                        />
                      </label>
                    )}
                    <label>
                      {dictionary.email}
                      <input
                        type="email"
                        value={email}
                        required
                        autoComplete="email"
                        onChange={(event) => setEmail(event.target.value)}
                      />
                    </label>
                    <label>
                      {dictionary.password}
                      <input
                        type="password"
                        value={password}
                        required
                        minLength={8}
                        maxLength={128}
                        autoComplete={
                          identityMode === "login"
                            ? "current-password"
                            : "new-password"
                        }
                        onChange={(event) => setPassword(event.target.value)}
                      />
                    </label>
                    {identityError && (
                      <span className={styles.identityError}>
                        {identityError}
                      </span>
                    )}
                    <button
                      type="submit"
                      className={styles.submitIdentity}
                      disabled={identityBusy}
                    >
                      {identityBusy && (
                        <RefreshCw className={styles.spin} aria-hidden="true" />
                      )}
                      {identityMode === "login"
                        ? dictionary.login
                        : dictionary.register}
                    </button>
                    <button
                      type="button"
                      className={styles.switchIdentity}
                      onClick={() => {
                        setIdentityError("");
                        setIdentityMode(
                          identityMode === "login" ? "register" : "login",
                        );
                      }}
                    >
                      {identityMode === "login"
                        ? dictionary.switchRegister
                        : dictionary.switchLogin}
                    </button>
                  </form>
                )}
                {config.auth.guest && (
                  <button
                    type="button"
                    className={styles.guestIdentity}
                    onClick={() => setIdentityOpen(false)}
                  >
                    <UserRound aria-hidden="true" />
                    {dictionary.continueGuest}
                  </button>
                )}
                {!config.auth.email && !config.auth.guest && (
                  <p className={styles.identityError}>
                    {dictionary.unavailable}
                  </p>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
