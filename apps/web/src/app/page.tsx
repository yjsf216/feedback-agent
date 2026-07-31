import Link from "next/link";
import {
  ArrowUpRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  FileChartColumn,
  MessageSquareText,
  ScanSearch,
  Sparkles,
  Tags,
} from "lucide-react";
import styles from "./page.module.css";

const demoSlug = process.env.NEXT_PUBLIC_DEMO_APP_SLUG || "demo";

const workflow = [
  {
    number: "01",
    title: "对话采集",
    note: "保留用户原话与上下文",
    icon: MessageSquareText,
  },
  {
    number: "02",
    title: "意图识别",
    note: "问题、缺陷、建议与投诉",
    icon: ScanSearch,
  },
  {
    number: "03",
    title: "痛点提炼",
    note: "抽取影响、严重度和证据",
    icon: Tags,
  },
  {
    number: "04",
    title: "形成行动",
    note: "需求草稿、报告与待办队列",
    icon: FileChartColumn,
  },
];

export default function Home() {
  return (
    <main className={styles.page}>
      <nav className={styles.nav} aria-label="主导航">
        <Link href="/" className={styles.brand}>
          <span className={styles.brandMark}>
            <Bot aria-hidden="true" />
          </span>
          <span>Feedback Agent</span>
        </Link>
        <div className={styles.navMeta}>
          <span>
            <span className={styles.liveDot} />
            Agent online
          </span>
          <Link href={`/feedback/${demoSlug}`} className={styles.navLink}>
            打开反馈入口 <ArrowUpRight aria-hidden="true" />
          </Link>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}>
            <Sparkles aria-hidden="true" />
            AI-native feedback infrastructure
          </div>
          <h1>
            别让用户反馈，
            <br />
            <span>停在聊天记录里。</span>
          </h1>
          <p>
            一个可被 Flutter、Web
            和业务后端复用的反馈智能体。它先回答用户，再把真实问题整理成团队可以审阅和行动的产品信号。
          </p>
          <div className={styles.heroActions}>
            <Link
              href={`/feedback/${demoSlug}`}
              className={styles.primaryAction}
            >
              体验对话采集 <ChevronRight aria-hidden="true" />
            </Link>
            <a href="#workflow" className={styles.secondaryAction}>
              看看它如何工作
            </a>
          </div>
          <div className={styles.trustLine}>
            <span>
              <CheckCircle2 aria-hidden="true" />多 App 数据隔离
            </span>
            <span>
              <CheckCircle2 aria-hidden="true" />
              低置信度进入人工队列
            </span>
            <span>
              <CheckCircle2 aria-hidden="true" />
              AI 需求只生成草稿
            </span>
          </div>
        </div>

        <div className={styles.signalStage} aria-label="反馈智能体工作流预览">
          <div className={styles.stageGlow} />
          <div className={styles.userMessage}>
            每次打开订单详情都要重新登录，很影响使用。
          </div>
          <div className={styles.agentCard}>
            <header>
              <span className={styles.agentAvatar}>
                <Bot aria-hidden="true" />
              </span>
              <div>
                <strong>反馈智能体</strong>
                <small>正在理解用户问题</small>
              </div>
              <span className={styles.processing}>Processing</span>
            </header>
            <p>
              收到，我已经记录了“订单详情页登录状态丢失”的问题。为了帮助定位，可以告诉我当前
              App 版本吗？
            </p>
            <div className={styles.classification}>
              <span>BUG</span>
              <span>身份认证</span>
              <span>严重度 P2</span>
            </div>
          </div>
          <div className={styles.requirementCard}>
            <span className={styles.cardKicker}>Requirement draft</span>
            <strong>保持订单流程的登录状态</strong>
            <p>用户进入订单详情时被迫重复认证，打断关键任务并降低完成率。</p>
            <footer>
              <span>3 条相似反馈</span>
              <span>待管理员确认</span>
            </footer>
          </div>
        </div>
      </section>

      <section id="workflow" className={styles.workflowSection}>
        <header>
          <div>
            <span className={styles.sectionIndex}>01 / Workflow</span>
            <h2>从一句抱怨，到一条有证据的需求。</h2>
          </div>
          <p>
            LangGraph 负责可控工作流，知识库约束回答边界，Worker
            在会话结束后提取反馈并聚合相似需求。
          </p>
        </header>
        <div className={styles.workflowGrid}>
          {workflow.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.number} className={styles.workflowItem}>
                <span>{item.number}</span>
                <div className={styles.workflowIcon}>
                  <Icon aria-hidden="true" />
                </div>
                <h3>{item.title}</h3>
                <p>{item.note}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.closingSection}>
        <div>
          <span className={styles.sectionIndex}>Ready to listen</span>
          <h2>让每个产品，都有一条听见用户的通道。</h2>
        </div>
        <Link href={`/feedback/${demoSlug}`} className={styles.roundAction}>
          <span>打开示例反馈页</span>
          <ArrowUpRight aria-hidden="true" />
        </Link>
      </section>

      <footer className={styles.footer}>
        <span>Feedback Agent</span>
        <p>Answer questions. Capture truth. Build what matters.</p>
        <span>Local-first · Multi-app</span>
      </footer>
    </main>
  );
}
