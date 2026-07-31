<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { api, type FeedbackItem } from "@/api/feedback";
import { useAppScopeStore } from "@/store/modules/appScope";
import {
  errorMessage,
  formatDate,
  formatPercent,
  statusLabel
} from "@/utils/feedback";
import { message } from "@/utils/message";
import StatusPill from "@/components/StatusPill/index.vue";
import RefreshCw from "~icons/lucide/refresh-cw";
import Tags from "~icons/lucide/tags";
import Check from "~icons/lucide/check";
import Archive from "~icons/lucide/archive";

defineOptions({ name: "Feedback" });

const scope = useAppScopeStore();
const { selectedAppId } = storeToRefs(scope);
const loading = ref(true);
const savingId = ref("");
const loadError = ref("");
const items = ref<FeedbackItem[]>([]);
const kind = ref("");
const status = ref("");
const drawerOpen = ref(false);
const selected = ref<FeedbackItem | null>(null);

const counts = computed(() => ({
  total: items.value.length,
  urgent: items.value.filter(item => item.severity >= 3).length,
  linked: items.value.filter(item => item.status === "LINKED").length
}));

async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    items.value = await api.feedback.list({
      kind: kind.value || undefined,
      status: status.value || undefined
    });
  } catch (error) {
    loadError.value = errorMessage(error);
  } finally {
    loading.value = false;
  }
}

function inspect(item: FeedbackItem) {
  selected.value = item;
  drawerOpen.value = true;
}

async function updateStatus(item: FeedbackItem, nextStatus: string) {
  savingId.value = item.id;
  try {
    await api.feedback.update(item.id, { status: nextStatus });
    message(`反馈已${nextStatus === "ARCHIVED" ? "归档" : "复核"}`, {
      type: "success"
    });
    if (selected.value?.id === item.id) selected.value.status = nextStatus;
    await load();
  } catch (error) {
    message(errorMessage(error), { type: "error" });
  } finally {
    savingId.value = "";
  }
}

onMounted(load);
watch(selectedAppId, load);
</script>

<template>
  <div class="fa-page">
    <header class="fa-page-header">
      <div>
        <p class="fa-eyebrow">Structured signals</p>
        <h1 class="fa-page-title">反馈明细</h1>
        <p class="fa-page-description">
          每条记录都保留用户原话、痛点、分类和 AI
          置信度；需求池只引用这些证据，不替代证据。
        </p>
      </div>
      <el-button :icon="RefreshCw" :loading="loading" @click="load"
        >刷新</el-button
      >
    </header>

    <section class="summary-strip fa-card">
      <div>
        <span>当前结果</span><strong>{{ counts.total }}</strong>
      </div>
      <div>
        <span>高优先信号</span><strong>{{ counts.urgent }}</strong>
      </div>
      <div>
        <span>已关联需求</span><strong>{{ counts.linked }}</strong>
      </div>
    </section>

    <el-alert
      v-if="loadError"
      type="error"
      :title="loadError"
      show-icon
      class="page-alert"
    />

    <section class="fa-card fa-toolbar">
      <el-select v-model="kind" clearable placeholder="全部类型" @change="load">
        <el-option label="缺陷" value="BUG" />
        <el-option label="功能建议" value="FEATURE_REQUEST" />
        <el-option label="投诉" value="COMPLAINT" />
        <el-option label="咨询" value="QUESTION" />
        <el-option label="表扬" value="PRAISE" />
        <el-option label="其他" value="OTHER" />
      </el-select>
      <el-select
        v-model="status"
        clearable
        placeholder="全部状态"
        @change="load"
      >
        <el-option label="新反馈" value="NEW" />
        <el-option label="已复核" value="REVIEWED" />
        <el-option label="已关联" value="LINKED" />
        <el-option label="已归档" value="ARCHIVED" />
      </el-select>
    </section>

    <section class="fa-card feedback-panel">
      <el-skeleton v-if="loading" :rows="9" animated class="panel-loading" />
      <div v-else-if="items.length === 0" class="fa-empty">
        <div>
          <IconifyIconOffline :icon="Tags" class="empty-icon" /><strong
            >没有匹配的反馈</strong
          ><span>调整筛选条件，或等待新对话产生反馈信号。</span>
        </div>
      </div>
      <el-table v-else :data="items" @row-click="inspect">
        <el-table-column label="反馈" min-width="320">
          <template #default="{ row }">
            <div class="feedback-cell">
              <div>
                <StatusPill :value="row.kind" /><span>P{{ row.severity }}</span>
              </div>
              <strong>{{ row.title }}</strong>
              <small
                >{{ row.app.name }} ·
                {{ row.endUser.displayName || "匿名用户" }}</small
              >
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110"
          ><template #default="{ row }"
            ><StatusPill :value="row.status" /></template
        ></el-table-column>
        <el-table-column label="置信度" width="95"
          ><template #default="{ row }">{{
            formatPercent(row.aiConfidence)
          }}</template></el-table-column
        >
        <el-table-column label="时间" width="125"
          ><template #default="{ row }">{{
            formatDate(row.createdAt)
          }}</template></el-table-column
        >
      </el-table>
    </section>

    <el-drawer
      v-model="drawerOpen"
      size="min(580px, 94vw)"
      :with-header="false"
    >
      <div v-if="selected" class="feedback-drawer">
        <p class="fa-eyebrow">Feedback evidence</p>
        <div class="drawer-title">
          <h2>{{ selected.title }}</h2>
          <StatusPill :value="selected.status" />
        </div>
        <div class="drawer-tags">
          <StatusPill :value="selected.kind" /><span
            >P{{ selected.severity }}</span
          ><span>置信度 {{ formatPercent(selected.aiConfidence) }}</span>
        </div>
        <section>
          <h3>用户原话</h3>
          <p class="evidence">{{ selected.description }}</p>
        </section>
        <section>
          <h3>提炼痛点</h3>
          <p>{{ selected.painPoint || "Worker 尚未完成痛点提炼。" }}</p>
        </section>
        <section>
          <h3>归属</h3>
          <p>
            {{ selected.app.name }} ·
            {{ selected.endUser.displayName || "匿名用户" }} ·
            {{ formatDate(selected.createdAt) }}
          </p>
        </section>
        <div class="drawer-actions">
          <el-button
            :icon="Check"
            :loading="savingId === selected.id"
            @click="updateStatus(selected, 'REVIEWED')"
            >标记已复核</el-button
          >
          <el-button
            :icon="Archive"
            :loading="savingId === selected.id"
            @click="updateStatus(selected, 'ARCHIVED')"
            >归档</el-button
          >
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<style scoped>
.summary-strip {
  display: grid;
  margin-bottom: 16px;
  padding: 18px 22px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.summary-strip > div {
  display: flex;
  align-items: baseline;
  gap: 10px;
  border-right: 1px solid var(--fa-border);
}
.summary-strip > div:last-child {
  border-right: 0;
}
.summary-strip span {
  color: var(--fa-muted-foreground);
  font-size: 12px;
}
.summary-strip strong {
  font-size: 22px;
  letter-spacing: -0.04em;
}
.page-alert {
  margin-bottom: 16px;
}
.fa-toolbar .el-select {
  width: 170px;
}
.feedback-panel {
  padding: 14px;
  overflow: hidden;
}
.panel-loading {
  padding: 18px;
}
.empty-icon {
  width: 30px;
  height: 30px;
  margin-bottom: 12px;
  color: var(--fa-primary);
}
.fa-empty span {
  display: block;
  margin-top: 5px;
  font-size: 12px;
}
.feedback-cell {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 5px;
}
.feedback-cell > div {
  display: flex;
  align-items: center;
  gap: 8px;
}
.feedback-cell > div > span:last-child {
  color: var(--fa-danger);
  font-size: 11px;
  font-weight: 730;
}
.feedback-cell strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.feedback-cell small {
  color: var(--fa-muted-foreground);
}
.feedback-drawer {
  min-height: 100%;
  padding: 24px 18px;
}
.drawer-title {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}
.drawer-title h2 {
  margin: 0;
  font-size: 26px;
  letter-spacing: -0.04em;
}
.drawer-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
  margin: 14px 0 30px;
  color: var(--fa-muted-foreground);
  font-size: 12px;
}
.feedback-drawer section {
  padding: 18px 0;
  border-top: 1px solid var(--fa-border);
}
.feedback-drawer h3 {
  margin: 0 0 9px;
  font-size: 13px;
}
.feedback-drawer p {
  margin: 0;
  color: var(--fa-muted-foreground);
  line-height: 1.75;
  white-space: pre-wrap;
}
.feedback-drawer .evidence {
  padding: 14px;
  color: var(--fa-foreground);
  background: var(--fa-muted);
  border-radius: 12px;
}
.drawer-actions {
  display: flex;
  gap: 9px;
  margin-top: 22px;
}

@media (width <= 620px) {
  .summary-strip {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .summary-strip > div {
    padding-bottom: 10px;
    border-right: 0;
    border-bottom: 1px solid var(--fa-border);
  }
  .summary-strip > div:last-child {
    border-bottom: 0;
  }
  .feedback-panel {
    overflow-x: auto;
  }
}
</style>
