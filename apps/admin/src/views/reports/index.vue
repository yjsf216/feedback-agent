<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { api, type Report } from "@/api/feedback";
import { ALL_APPS_SCOPE } from "@/config/app-scope";
import { useAppScopeStore } from "@/store/modules/appScope";
import { errorMessage, formatDate, formatPercent } from "@/utils/feedback";
import { message } from "@/utils/message";
import StatusPill from "@/components/StatusPill/index.vue";
import RefreshCw from "~icons/lucide/refresh-cw";
import Plus from "~icons/lucide/plus";
import FileChartColumn from "~icons/lucide/file-chart-column";
import ArrowUpRight from "~icons/lucide/arrow-up-right";
import CalendarRange from "~icons/lucide/calendar-range";

defineOptions({ name: "Reports" });

type FeedbackMetric = { kind: string; count: number };
type RequirementMetric = {
  id: string;
  title: string;
  frequency: number;
  priority: number;
  status: string;
};

const scope = useAppScopeStore();
const { selectedAppId, selectedApp, isAllApps } = storeToRefs(scope);
const loading = ref(true);
const saving = ref(false);
const loadError = ref("");
const items = ref<Report[]>([]);
const createOpen = ref(false);
const drawerOpen = ref(false);
const selected = ref<Report | null>(null);
const form = reactive({
  name: "用户反馈月报",
  range: defaultRange()
});
let pollingTimer: ReturnType<typeof setInterval> | undefined;

const scopeName = computed(() => selectedApp.value?.name ?? "全部应用");
const selectedMetrics = computed(() => selected.value?.metrics ?? {});
const feedbackKinds = computed(() =>
  Array.isArray(selectedMetrics.value.feedbackByKind)
    ? (selectedMetrics.value.feedbackByKind as FeedbackMetric[])
    : []
);
const topRequirements = computed(() =>
  Array.isArray(selectedMetrics.value.topRequirements)
    ? (selectedMetrics.value.topRequirements as RequirementMetric[])
    : []
);

function defaultRange(): [Date, Date] {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 30);
  return [start, end];
}

function metricNumber(key: string): number {
  const value = selectedMetrics.value[key];
  return typeof value === "number" ? value : 0;
}

async function load(showLoading = true) {
  if (showLoading) loading.value = true;
  loadError.value = "";
  try {
    items.value = await api.reports.list();
    if (selected.value) {
      const latest = items.value.find(item => item.id === selected.value?.id);
      if (latest) selected.value = latest;
    }
  } catch (error) {
    loadError.value = errorMessage(error);
  } finally {
    loading.value = false;
  }
}

async function createReport() {
  if (!form.range?.[0] || !form.range?.[1]) return;
  saving.value = true;
  try {
    const report = await api.reports.create({
      name: form.name,
      rangeStart: form.range[0].toISOString(),
      rangeEnd: form.range[1].toISOString(),
      appId:
        selectedAppId.value === ALL_APPS_SCOPE ? undefined : selectedAppId.value
    });
    message("报告已进入生成队列", { type: "success" });
    createOpen.value = false;
    selected.value = report;
    drawerOpen.value = true;
    await load(false);
  } catch (error) {
    message(errorMessage(error), { type: "error" });
  } finally {
    saving.value = false;
  }
}

async function inspect(item: Report) {
  selected.value = item;
  drawerOpen.value = true;
  try {
    selected.value = await api.reports.detail(item.id);
  } catch (error) {
    message(errorMessage(error), { type: "error" });
  }
}

onMounted(() => {
  void load();
  pollingTimer = setInterval(() => {
    if (
      items.value.some(item => ["PENDING", "GENERATING"].includes(item.status))
    )
      void load(false);
  }, 4000);
});
onUnmounted(() => pollingTimer && clearInterval(pollingTimer));
watch(selectedAppId, () => load());
</script>

<template>
  <div class="fa-page reports-page">
    <header class="fa-page-header">
      <div>
        <p class="fa-eyebrow">Decision-ready summaries</p>
        <h1 class="fa-page-title">反馈报告</h1>
        <p class="fa-page-description">
          把
          {{ scopeName }} 的对话、未解决问题和高频需求汇总成可审阅的管理报告。
        </p>
      </div>
      <div class="header-actions">
        <el-button :icon="RefreshCw" :loading="loading" @click="load()"
          >刷新</el-button
        >
        <el-button type="primary" :icon="Plus" @click="createOpen = true"
          >生成报告</el-button
        >
      </div>
    </header>

    <el-alert
      v-if="loadError"
      type="error"
      :title="loadError"
      show-icon
      class="page-alert"
    />
    <div v-if="loading" class="fa-card loading-panel">
      <el-skeleton :rows="9" animated />
    </div>
    <div v-else-if="items.length === 0" class="fa-card fa-empty">
      <div>
        <IconifyIconOffline :icon="FileChartColumn" class="empty-icon" /><strong
          >还没有反馈报告</strong
        ><span>选择统计周期，生成第一份可追踪的用户声音快照。</span
        ><el-button type="primary" :icon="Plus" @click="createOpen = true"
          >生成第一份报告</el-button
        >
      </div>
    </div>
    <section v-else class="report-grid">
      <button
        v-for="item in items"
        :key="item.id"
        class="fa-card report-card"
        @click="inspect(item)"
      >
        <div class="report-mark">
          <IconifyIconOffline :icon="FileChartColumn" />
        </div>
        <div class="report-copy">
          <div>
            <StatusPill :value="item.status" /><span>{{
              formatDate(item.createdAt)
            }}</span>
          </div>
          <h2>{{ item.name }}</h2>
          <p>
            <IconifyIconOffline :icon="CalendarRange" />{{
              new Date(item.rangeStart).toLocaleDateString("zh-CN")
            }}
            — {{ new Date(item.rangeEnd).toLocaleDateString("zh-CN") }}
          </p>
          <small v-if="item.error">{{ item.error }}</small>
        </div>
        <IconifyIconOffline :icon="ArrowUpRight" class="open-icon" />
      </button>
    </section>

    <el-dialog
      v-model="createOpen"
      title="生成反馈报告"
      width="min(580px, 92vw)"
    >
      <el-alert
        type="info"
        :closable="false"
        :title="`当前范围：${scopeName}`"
        class="dialog-alert"
      />
      <el-form label-position="top">
        <el-form-item label="报告名称"
          ><el-input
            v-model="form.name"
            maxlength="240"
            placeholder="例如：七月用户反馈周报"
        /></el-form-item>
        <el-form-item label="统计周期"
          ><el-date-picker
            v-model="form.range"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            style="width: 100%"
        /></el-form-item>
      </el-form>
      <template #footer
        ><el-button @click="createOpen = false">取消</el-button
        ><el-button
          type="primary"
          :disabled="form.name.trim().length < 2 || !form.range"
          :loading="saving"
          @click="createReport"
          >开始生成</el-button
        ></template
      >
    </el-dialog>

    <el-drawer
      v-model="drawerOpen"
      size="min(760px, 96vw)"
      :title="selected?.name || '报告详情'"
    >
      <template v-if="selected">
        <div class="drawer-status">
          <StatusPill :value="selected.status" /><span
            >{{ new Date(selected.rangeStart).toLocaleString("zh-CN") }} —
            {{ new Date(selected.rangeEnd).toLocaleString("zh-CN") }}</span
          >
        </div>
        <el-alert
          v-if="selected.status === 'FAILED'"
          type="error"
          :title="selected.error || '报告生成失败'"
          show-icon
        />
        <div v-else-if="selected.status !== 'READY'" class="generating-state">
          <el-icon class="is-loading"><RefreshCw /></el-icon
          ><strong>正在汇总用户反馈</strong
          ><span>Worker 完成后，本页会自动更新。</span>
        </div>
        <template v-else>
          <section class="metric-strip">
            <div>
              <span>对话</span
              ><strong>{{ metricNumber("conversations") }}</strong>
            </div>
            <div>
              <span>已解决</span><strong>{{ metricNumber("resolved") }}</strong>
            </div>
            <div>
              <span>未解决</span
              ><strong>{{ metricNumber("unresolved") }}</strong>
            </div>
            <div>
              <span>解决率</span
              ><strong>{{ metricNumber("resolutionRate") }}%</strong>
            </div>
            <div>
              <span>平均置信度</span
              ><strong>{{
                formatPercent(metricNumber("averageConfidence"))
              }}</strong>
            </div>
          </section>
          <section class="report-section">
            <h3>反馈分布</h3>
            <div v-if="feedbackKinds.length" class="kind-list">
              <span v-for="kind in feedbackKinds" :key="kind.kind"
                ><b>{{ kind.kind }}</b
                >{{ kind.count }}</span
              >
            </div>
            <p v-else>当前周期没有结构化反馈。</p>
          </section>
          <section class="report-section">
            <h3>高频需求</h3>
            <ol v-if="topRequirements.length">
              <li v-for="item in topRequirements" :key="item.id">
                <strong>{{ item.title }}</strong
                ><span>P{{ item.priority }} · {{ item.frequency }} 条反馈</span>
              </li>
            </ol>
            <p v-else>当前周期没有需求草稿。</p>
          </section>
          <section class="report-section markdown-section">
            <h3>报告原文</h3>
            <pre>{{ selected.markdown }}</pre>
          </section>
        </template>
      </template>
    </el-drawer>
  </div>
</template>

<style scoped>
.header-actions {
  display: flex;
  gap: 9px;
}
.page-alert {
  margin-bottom: 16px;
}
.loading-panel {
  padding: 28px;
}
.empty-icon {
  width: 36px;
  height: 36px;
  margin-bottom: 12px;
  color: var(--fa-primary);
}
.fa-empty span {
  display: block;
  margin: 5px 0 18px;
  font-size: 12px;
}
.report-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.report-card {
  display: grid;
  width: 100%;
  padding: 20px;
  color: inherit;
  text-align: left;
  cursor: pointer;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 15px;
  align-items: start;
  transition:
    transform 180ms ease,
    box-shadow 180ms ease;
}
.report-card:hover {
  box-shadow: var(--fa-shadow);
  transform: translateY(-2px);
}
.report-mark {
  display: grid;
  width: 46px;
  height: 46px;
  color: var(--fa-primary);
  background: oklch(0.94 0.035 177);
  border-radius: 14px;
  place-items: center;
}
.report-copy > div {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--fa-muted-foreground);
  font-size: 11px;
}
.report-copy h2 {
  margin: 12px 0 7px;
  font-size: 16px;
}
.report-copy p {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: var(--fa-muted-foreground);
  font-size: 11px;
}
.report-copy small {
  display: block;
  margin-top: 8px;
  color: var(--fa-danger);
}
.open-icon {
  color: var(--fa-muted-foreground);
}
.dialog-alert {
  margin-bottom: 18px;
}
.drawer-status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  color: var(--fa-muted-foreground);
  font-size: 12px;
}
.generating-state {
  display: grid;
  min-height: 360px;
  color: var(--fa-muted-foreground);
  text-align: center;
  place-items: center;
  align-content: center;
  gap: 10px;
}
.generating-state .el-icon {
  color: var(--fa-primary);
  font-size: 30px;
}
.generating-state strong {
  color: var(--fa-foreground);
  font-size: 17px;
}
.metric-strip {
  display: grid;
  margin-bottom: 20px;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}
.metric-strip > div {
  padding: 14px 12px;
  background: var(--fa-muted);
  border-radius: 12px;
}
.metric-strip span {
  display: block;
  color: var(--fa-muted-foreground);
  font-size: 10px;
}
.metric-strip strong {
  display: block;
  margin-top: 6px;
  font-size: 20px;
}
.report-section {
  margin-top: 16px;
  padding: 20px;
  border: 1px solid var(--fa-border);
  border-radius: 15px;
}
.report-section h3 {
  margin: 0 0 14px;
  font-size: 15px;
}
.report-section > p {
  color: var(--fa-muted-foreground);
  font-size: 12px;
}
.kind-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.kind-list span {
  display: flex;
  padding: 8px 11px;
  color: var(--fa-muted-foreground);
  font-size: 11px;
  background: var(--fa-muted);
  border-radius: 10px;
  gap: 8px;
}
.kind-list b {
  color: var(--fa-foreground);
}
.report-section ol {
  margin: 0;
  padding-left: 22px;
}
.report-section li {
  padding: 8px 0;
}
.report-section li strong,
.report-section li span {
  display: block;
}
.report-section li span {
  margin-top: 3px;
  color: var(--fa-muted-foreground);
  font-size: 10px;
}
.markdown-section pre {
  overflow: auto;
  margin: 0;
  color: var(--fa-foreground);
  font-family: "Noto Sans SC Variable", sans-serif;
  font-size: 12px;
  line-height: 1.8;
  white-space: pre-wrap;
}
@media (width <= 760px) {
  .report-grid {
    grid-template-columns: 1fr;
  }
  .metric-strip {
    grid-template-columns: repeat(2, 1fr);
  }
  .header-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
}
</style>
