<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import {
  api,
  type DashboardMetrics,
  type Requirement,
  type UnresolvedCase
} from "@/api/feedback";
import { useAppScopeStore } from "@/store/modules/appScope";
import { errorMessage, formatDate, statusLabel } from "@/utils/feedback";
import StatusPill from "@/components/StatusPill/index.vue";
import MessagesSquare from "~icons/lucide/messages-square";
import CircleAlert from "~icons/lucide/circle-alert";
import Tags from "~icons/lucide/tags";
import ListTodo from "~icons/lucide/list-todo";
import ArrowUpRight from "~icons/lucide/arrow-up-right";
import RefreshCw from "~icons/lucide/refresh-cw";

defineOptions({ name: "Dashboard" });

const router = useRouter();
const scope = useAppScopeStore();
const { selectedAppId, selectedApp } = storeToRefs(scope);
const loading = ref(true);
const loadError = ref("");
const metrics = ref<DashboardMetrics>({
  conversations: 0,
  unresolved: 0,
  feedback: 0,
  requirements: 0,
  resolutionRate: 0
});
const unresolved = ref<UnresolvedCase[]>([]);
const requirements = ref<Requirement[]>([]);

const scopeName = computed(() => selectedApp.value?.name ?? "全部应用");
const metricCards = computed(() => [
  {
    label: "对话总量",
    value: metrics.value.conversations,
    note: "已进入反馈智能体的会话",
    icon: MessagesSquare,
    tone: "teal"
  },
  {
    label: "未解决",
    value: metrics.value.unresolved,
    note: "需要管理员继续跟进",
    icon: CircleAlert,
    tone: "amber"
  },
  {
    label: "反馈信号",
    value: metrics.value.feedback,
    note: "从对话中结构化提取",
    icon: Tags,
    tone: "blue"
  },
  {
    label: "需求草稿",
    value: metrics.value.requirements,
    note: "等待确认、合并或拒绝",
    icon: ListTodo,
    tone: "slate"
  }
]);

async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    const [dashboard, unresolvedItems, requirementItems] = await Promise.all([
      api.dashboard(),
      api.unresolved.list(),
      api.requirements.list()
    ]);
    metrics.value = dashboard;
    unresolved.value = unresolvedItems.slice(0, 5);
    requirements.value = requirementItems.slice(0, 5);
  } catch (error) {
    loadError.value = errorMessage(error);
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await scope.loadApps();
  await load();
});
watch(selectedAppId, load);
</script>

<template>
  <div class="fa-page dashboard-page">
    <header class="fa-page-header">
      <div>
        <p class="fa-eyebrow">Signal overview · {{ scopeName }}</p>
        <h1 class="fa-page-title">今天，用户在告诉你什么？</h1>
        <p class="fa-page-description">
          先处理没有解决的问题，再审阅 AI
          提炼的需求草稿。数据会跟随顶部应用范围自动切换。
        </p>
      </div>
      <el-button :loading="loading" :icon="RefreshCw" @click="load"
        >刷新数据</el-button
      >
    </header>

    <el-alert
      v-if="loadError"
      class="dashboard-error"
      type="error"
      :title="loadError"
      show-icon
    />

    <section class="metric-grid" aria-label="核心指标">
      <div
        v-for="card in metricCards"
        :key="card.label"
        class="fa-card metric-card"
      >
        <div :class="['metric-icon', `metric-icon--${card.tone}`]">
          <IconifyIconOffline :icon="card.icon" />
        </div>
        <div>
          <span>{{ card.label }}</span>
          <strong v-if="!loading">{{ card.value.toLocaleString() }}</strong>
          <el-skeleton v-else animated
            ><template #template><el-skeleton-item variant="h1" /></template
          ></el-skeleton>
          <small>{{ card.note }}</small>
        </div>
      </div>

      <div class="resolution-card">
        <div>
          <span>自动解决率</span>
          <strong>{{ metrics.resolutionRate }}<small>%</small></strong>
        </div>
        <div
          class="resolution-ring"
          :style="{ '--progress': `${metrics.resolutionRate * 3.6}deg` }"
        >
          <span>{{ metrics.resolutionRate }}%</span>
        </div>
      </div>
    </section>

    <section class="dashboard-columns">
      <div class="fa-card queue-panel">
        <div class="panel-heading">
          <div>
            <p class="fa-eyebrow">Needs attention</p>
            <h2>未解决队列</h2>
          </div>
          <el-button text type="primary" @click="router.push('/unresolved')">
            查看全部 <IconifyIconOffline :icon="ArrowUpRight" />
          </el-button>
        </div>
        <div v-if="loading" class="loading-list">
          <el-skeleton :rows="4" animated />
        </div>
        <div v-else-if="unresolved.length === 0" class="fa-empty compact-empty">
          <div>
            <strong>暂时没有待跟进问题</strong
            ><span>新的低置信度对话会自动出现在这里。</span>
          </div>
        </div>
        <template v-else>
          <button
            v-for="item in unresolved"
            :key="item.id"
            class="queue-item"
            @click="router.push('/unresolved')"
          >
            <span :class="['priority-mark', `priority-mark--${item.priority}`]"
              >P{{ item.priority }}</span
            >
            <span class="queue-copy">
              <strong>{{ item.conversation.subject || item.reason }}</strong>
              <small
                >{{ item.conversation.app.name }} ·
                {{ item.conversation.endUser.displayName || "匿名用户" }}</small
              >
            </span>
            <span class="queue-time">{{ formatDate(item.createdAt) }}</span>
          </button>
        </template>
      </div>

      <div class="fa-card requirement-panel">
        <div class="panel-heading">
          <div>
            <p class="fa-eyebrow">AI drafts</p>
            <h2>需求草稿</h2>
          </div>
          <el-button text type="primary" @click="router.push('/requirements')">
            进入需求池 <IconifyIconOffline :icon="ArrowUpRight" />
          </el-button>
        </div>
        <div v-if="loading" class="loading-list">
          <el-skeleton :rows="4" animated />
        </div>
        <div
          v-else-if="requirements.length === 0"
          class="fa-empty compact-empty"
        >
          <div>
            <strong>还没有需求草稿</strong
            ><span>缺陷、建议和投诉会由 Worker 自动提炼。</span>
          </div>
        </div>
        <template v-else>
          <article
            v-for="item in requirements"
            :key="item.id"
            class="requirement-item"
          >
            <div class="requirement-topline">
              <span
                >P{{ item.priority }} · {{ item.category || "未分类" }}</span
              >
              <StatusPill :value="item.status" />
            </div>
            <h3>{{ item.title }}</h3>
            <p>{{ item.painPoint }}</p>
            <footer>
              <span>{{ item.frequency }} 条反馈</span>
              <span>{{
                statusLabel(item.source === "AI" ? "DRAFT" : item.source)
              }}</span>
            </footer>
          </article>
        </template>
      </div>
    </section>
  </div>
</template>

<style scoped>
.dashboard-error {
  margin-bottom: 18px;
}

.metric-grid {
  display: grid;
  margin-bottom: 20px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.metric-card {
  display: flex;
  min-height: 142px;
  padding: 20px;
  gap: 15px;
  transition:
    transform 180ms ease,
    box-shadow 180ms ease;
}

.metric-card:hover {
  box-shadow: var(--fa-shadow);
  transform: translateY(-2px);
}

.metric-card > div:last-child {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.metric-card span {
  color: var(--fa-muted-foreground);
  font-size: 12px;
  font-weight: 650;
}

.metric-card strong {
  margin: 5px 0 3px;
  font-size: 31px;
  font-weight: 760;
  letter-spacing: -0.05em;
}

.metric-card small {
  color: var(--fa-muted-foreground);
  font-size: 11px;
  line-height: 1.5;
}

.metric-icon {
  display: grid;
  width: 40px;
  height: 40px;
  flex: none;
  border-radius: 13px;
  place-items: center;
}

.metric-icon--teal {
  color: var(--fa-primary);
  background: oklch(0.93 0.04 177);
}
.metric-icon--amber {
  color: oklch(0.58 0.14 70);
  background: oklch(0.95 0.05 80);
}
.metric-icon--blue {
  color: oklch(0.5 0.13 240);
  background: oklch(0.94 0.035 240);
}
.metric-icon--slate {
  color: oklch(0.45 0.05 260);
  background: oklch(0.94 0.018 260);
}

.resolution-card {
  display: flex;
  min-height: 142px;
  padding: 22px 24px;
  color: oklch(0.96 0.01 180);
  background: oklch(0.3 0.055 187);
  border-radius: 18px;
  box-shadow: var(--fa-shadow);
  grid-column: span 2;
  align-items: center;
  justify-content: space-between;
}

.resolution-card > div:first-child {
  display: flex;
  flex-direction: column;
}
.resolution-card > div:first-child > span {
  color: oklch(0.8 0.035 180);
  font-size: 12px;
}
.resolution-card strong {
  margin-top: 3px;
  font-size: 42px;
  letter-spacing: -0.06em;
}
.resolution-card strong small {
  font-size: 19px;
}

.resolution-ring {
  display: grid;
  width: 82px;
  height: 82px;
  background: conic-gradient(
    var(--fa-accent) var(--progress),
    oklch(0.43 0.045 187) 0
  );
  border-radius: 50%;
  place-items: center;
}

.resolution-ring::before {
  width: 62px;
  height: 62px;
  background: oklch(0.3 0.055 187);
  border-radius: 50%;
  content: "";
  grid-area: 1 / 1;
}

.resolution-ring span {
  z-index: 1;
  font-size: 12px;
  font-weight: 750;
  grid-area: 1 / 1;
}

.dashboard-columns {
  display: grid;
  grid-template-columns: minmax(0, 1.16fr) minmax(340px, 0.84fr);
  gap: 20px;
}

.queue-panel,
.requirement-panel {
  padding: 21px;
}

.panel-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 14px;
}

.panel-heading h2 {
  margin: 0;
  font-size: 20px;
  letter-spacing: -0.03em;
}

.queue-item {
  display: grid;
  width: 100%;
  padding: 15px 4px;
  color: inherit;
  text-align: left;
  background: transparent;
  border: 0;
  border-top: 1px solid var(--fa-border);
  cursor: pointer;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 13px;
  align-items: center;
}

.queue-item:hover .queue-copy strong {
  color: var(--fa-primary);
}

.priority-mark {
  display: grid;
  width: 34px;
  height: 34px;
  color: var(--fa-primary);
  font-size: 11px;
  font-weight: 760;
  background: oklch(0.94 0.03 177);
  border-radius: 10px;
  place-items: center;
}

.priority-mark--3,
.priority-mark--4 {
  color: var(--fa-danger);
  background: oklch(0.95 0.035 28);
}

.queue-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
}
.queue-copy strong {
  overflow: hidden;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 160ms ease;
}
.queue-copy small,
.queue-time {
  color: var(--fa-muted-foreground);
  font-size: 11px;
}
.queue-time {
  white-space: nowrap;
}

.requirement-item {
  padding: 15px 0;
  border-top: 1px solid var(--fa-border);
}
.requirement-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.requirement-topline > span:first-child {
  color: var(--fa-primary);
  font-size: 11px;
  font-weight: 720;
}
.requirement-item h3 {
  margin: 10px 0 5px;
  font-size: 14px;
}
.requirement-item p {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--fa-muted-foreground);
  font-size: 12px;
  line-height: 1.6;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.requirement-item footer {
  display: flex;
  margin-top: 9px;
  color: var(--fa-muted-foreground);
  font-size: 11px;
  justify-content: space-between;
}

.compact-empty {
  min-height: 220px;
}
.compact-empty span {
  display: block;
  margin-top: 4px;
  font-size: 12px;
}
.loading-list {
  padding: 14px 0;
}

@media (width >= 1400px) {
  .metric-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}

@media (width <= 1100px) {
  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .dashboard-columns {
    grid-template-columns: 1fr;
  }
}

@media (width <= 600px) {
  .metric-grid {
    grid-template-columns: 1fr;
  }
  .resolution-card {
    grid-column: span 1;
  }
  .queue-time {
    display: none;
  }
}
</style>
