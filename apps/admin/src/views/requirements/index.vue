<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { api, type Requirement } from "@/api/feedback";
import { useAppScopeStore } from "@/store/modules/appScope";
import { errorMessage, formatDate, formatPercent } from "@/utils/feedback";
import { message } from "@/utils/message";
import StatusPill from "@/components/StatusPill/index.vue";
import RefreshCw from "~icons/lucide/refresh-cw";
import ListTodo from "~icons/lucide/list-todo";
import Check from "~icons/lucide/check";
import X from "~icons/lucide/x";
import Merge from "~icons/lucide/merge";
import ArrowRight from "~icons/lucide/arrow-right";

defineOptions({ name: "Requirements" });

const scope = useAppScopeStore();
const { selectedAppId, isAllApps } = storeToRefs(scope);
const loading = ref(true);
const saving = ref(false);
const loadError = ref("");
const items = ref<Requirement[]>([]);
const status = ref("");
const selected = ref<Requirement | null>(null);
const drawerOpen = ref(false);
const mergeOpen = ref(false);
const mergeIds = ref<string[]>([]);

const mergeCandidates = computed(() =>
  items.value.filter(
    item =>
      item.id !== selected.value?.id &&
      item.app.id === selected.value?.app.id &&
      item.status !== "REJECTED"
  )
);

const statusCounts = computed(() => {
  const counts: Record<string, number> = { ALL: items.value.length };
  for (const item of items.value)
    counts[item.status] = (counts[item.status] ?? 0) + 1;
  return counts;
});

async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    items.value = await api.requirements.list({
      status: status.value || undefined
    });
  } catch (error) {
    loadError.value = errorMessage(error);
  } finally {
    loading.value = false;
  }
}

function inspect(item: Requirement) {
  selected.value = item;
  drawerOpen.value = true;
}

async function changeStatus(nextStatus: string) {
  if (!selected.value) return;
  saving.value = true;
  try {
    const updated = await api.requirements.update(selected.value.id, {
      status: nextStatus
    });
    selected.value = { ...selected.value, ...updated };
    message(nextStatus === "APPROVED" ? "需求已确认" : "需求已拒绝", {
      type: "success"
    });
    await load();
  } catch (error) {
    message(errorMessage(error), { type: "error" });
  } finally {
    saving.value = false;
  }
}

function openMerge() {
  if (isAllApps.value) {
    message("合并前请在顶部选择具体应用", { type: "warning" });
    return;
  }
  mergeIds.value = [];
  mergeOpen.value = true;
}

async function mergeRequirement() {
  if (!selected.value || mergeIds.value.length === 0) return;
  saving.value = true;
  try {
    await api.requirements.merge(selected.value.id, mergeIds.value);
    message("需求已合并，来源草稿保留为已拒绝状态", { type: "success" });
    mergeOpen.value = false;
    drawerOpen.value = false;
    await load();
  } catch (error) {
    message(errorMessage(error), { type: "error" });
  } finally {
    saving.value = false;
  }
}

onMounted(load);
watch(selectedAppId, load);
</script>

<template>
  <div class="fa-page requirements-page">
    <header class="fa-page-header">
      <div>
        <p class="fa-eyebrow">Evidence-backed backlog</p>
        <h1 class="fa-page-title">需求池</h1>
        <p class="fa-page-description">
          AI
          只生成草稿。你负责确认价值、合并重复信号，并决定需求何时进入规划与交付。
        </p>
      </div>
      <el-button :icon="RefreshCw" :loading="loading" @click="load"
        >刷新</el-button
      >
    </header>

    <el-alert
      v-if="loadError"
      type="error"
      :title="loadError"
      show-icon
      class="page-alert"
    />

    <section class="fa-card status-filter">
      <button
        :class="{ active: status === '' }"
        @click="
          status = '';
          load();
        "
      >
        全部 <span>{{ statusCounts.ALL || 0 }}</span>
      </button>
      <button
        :class="{ active: status === 'DRAFT' }"
        @click="
          status = 'DRAFT';
          load();
        "
      >
        待确认 <span>{{ statusCounts.DRAFT || 0 }}</span>
      </button>
      <button
        :class="{ active: status === 'APPROVED' }"
        @click="
          status = 'APPROVED';
          load();
        "
      >
        已确认 <span>{{ statusCounts.APPROVED || 0 }}</span>
      </button>
      <button
        :class="{ active: status === 'PLANNED' }"
        @click="
          status = 'PLANNED';
          load();
        "
      >
        已规划 <span>{{ statusCounts.PLANNED || 0 }}</span>
      </button>
      <button
        :class="{ active: status === 'IN_PROGRESS' }"
        @click="
          status = 'IN_PROGRESS';
          load();
        "
      >
        进行中 <span>{{ statusCounts.IN_PROGRESS || 0 }}</span>
      </button>
    </section>

    <div v-if="loading" class="fa-card loading-panel">
      <el-skeleton :rows="10" animated />
    </div>
    <div v-else-if="items.length === 0" class="fa-card fa-empty">
      <div>
        <IconifyIconOffline :icon="ListTodo" class="empty-icon" /><strong
          >当前阶段没有需求</strong
        ><span>Worker 会从缺陷、建议和投诉中生成带证据的草稿。</span>
      </div>
    </div>
    <section v-else class="requirement-list">
      <article
        v-for="item in items"
        :key="item.id"
        class="fa-card requirement-row"
        @click="inspect(item)"
      >
        <div class="priority-block">
          <span>P{{ item.priority }}</span
          ><small>{{ item.frequency }} 条信号</small>
        </div>
        <div class="requirement-copy">
          <div class="row-top">
            <span>{{ item.app.name }} · {{ item.category || "未分类" }}</span
            ><StatusPill :value="item.status" />
          </div>
          <h2>{{ item.title }}</h2>
          <p>{{ item.painPoint }}</p>
          <footer>
            <span>{{ item.source === "AI" ? "AI 草稿" : "人工创建" }}</span
            ><span>置信度 {{ formatPercent(item.aiConfidence) }}</span
            ><span>更新于 {{ formatDate(item.updatedAt) }}</span>
          </footer>
        </div>
        <IconifyIconOffline :icon="ArrowRight" class="row-arrow" />
      </article>
    </section>

    <el-drawer
      v-model="drawerOpen"
      size="min(660px, 94vw)"
      :with-header="false"
    >
      <div v-if="selected" class="requirement-drawer">
        <p class="fa-eyebrow">Requirement draft</p>
        <div class="drawer-title">
          <h2>{{ selected.title }}</h2>
          <StatusPill :value="selected.status" />
        </div>
        <div class="drawer-meta">
          <span>P{{ selected.priority }}</span
          ><span>{{ selected.frequency }} 条反馈</span
          ><span>{{ selected.category || "未分类" }}</span
          ><span>{{ selected.source === "AI" ? "AI 生成" : "人工创建" }}</span>
        </div>
        <section>
          <h3>需求摘要</h3>
          <p>{{ selected.summary }}</p>
        </section>
        <section>
          <h3>用户痛点</h3>
          <p class="pain-point">{{ selected.painPoint }}</p>
        </section>
        <section>
          <h3>建议方向</h3>
          <p>
            {{
              selected.proposedSolution ||
              "尚未形成解决方案，确认需求后再进入方案设计。"
            }}
          </p>
        </section>
        <section>
          <h3>证据</h3>
          <div class="evidence-count">
            已关联
            {{ selected.feedbackItems?.length || selected.frequency }}
            条原始反馈
          </div>
        </section>
        <div class="drawer-actions">
          <el-button
            v-if="selected.status === 'DRAFT'"
            type="primary"
            :icon="Check"
            :loading="saving"
            @click="changeStatus('APPROVED')"
            >确认需求</el-button
          >
          <el-button
            v-if="selected.status === 'DRAFT'"
            :icon="X"
            :loading="saving"
            @click="changeStatus('REJECTED')"
            >拒绝草稿</el-button
          >
          <el-button :icon="Merge" @click="openMerge">合并重复需求</el-button>
        </div>
      </div>
    </el-drawer>

    <el-dialog
      v-model="mergeOpen"
      title="合并重复需求"
      width="min(560px, 92vw)"
    >
      <p class="dialog-help">
        选中的草稿会把反馈证据合并到“{{
          selected?.title
        }}”，并保留为已拒绝状态，方便审计。
      </p>
      <el-select
        v-model="mergeIds"
        multiple
        filterable
        class="merge-select"
        placeholder="选择要合并的需求草稿"
      >
        <el-option
          v-for="item in mergeCandidates"
          :key="item.id"
          :label="item.title"
          :value="item.id"
        />
      </el-select>
      <template #footer
        ><el-button @click="mergeOpen = false">取消</el-button
        ><el-button
          type="primary"
          :disabled="mergeIds.length === 0"
          :loading="saving"
          @click="mergeRequirement"
          >确认合并</el-button
        ></template
      >
    </el-dialog>
  </div>
</template>

<style scoped>
.page-alert {
  margin-bottom: 16px;
}
.status-filter {
  display: flex;
  gap: 6px;
  margin-bottom: 16px;
  padding: 8px;
  overflow-x: auto;
}
.status-filter button {
  display: flex;
  align-items: center;
  padding: 9px 13px;
  color: var(--fa-muted-foreground);
  font-size: 12px;
  background: transparent;
  border: 0;
  border-radius: 10px;
  cursor: pointer;
  gap: 7px;
  white-space: nowrap;
}
.status-filter button span {
  display: grid;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  background: var(--fa-muted);
  border-radius: 999px;
  place-items: center;
}
.status-filter button.active {
  color: var(--fa-primary);
  font-weight: 720;
  background: oklch(0.94 0.035 177);
}
.status-filter button.active span {
  color: white;
  background: var(--fa-primary);
}
.loading-panel {
  padding: 28px;
}
.empty-icon {
  width: 32px;
  height: 32px;
  margin-bottom: 12px;
  color: var(--fa-primary);
}
.fa-empty span {
  display: block;
  margin-top: 5px;
  font-size: 12px;
}
.requirement-list {
  display: grid;
  gap: 12px;
}
.requirement-row {
  display: grid;
  padding: 20px;
  cursor: pointer;
  grid-template-columns: 86px minmax(0, 1fr) auto;
  gap: 18px;
  align-items: center;
  transition:
    box-shadow 180ms ease,
    transform 180ms ease;
}
.requirement-row:hover {
  box-shadow: var(--fa-shadow);
  transform: translateY(-2px);
}
.priority-block {
  display: flex;
  align-items: center;
  padding-right: 18px;
  border-right: 1px solid var(--fa-border);
  flex-direction: column;
}
.priority-block > span {
  color: var(--fa-primary);
  font-size: 24px;
  font-weight: 760;
  letter-spacing: -0.05em;
}
.priority-block small {
  color: var(--fa-muted-foreground);
  font-size: 10px;
}
.row-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.row-top > span {
  color: var(--fa-primary);
  font-size: 11px;
  font-weight: 700;
}
.requirement-copy h2 {
  margin: 8px 0 5px;
  font-size: 17px;
  letter-spacing: -0.02em;
}
.requirement-copy p {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--fa-muted-foreground);
  font-size: 12px;
  line-height: 1.6;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.requirement-copy footer {
  display: flex;
  flex-wrap: wrap;
  margin-top: 9px;
  color: var(--fa-muted-foreground);
  font-size: 10px;
  gap: 14px;
}
.row-arrow {
  color: var(--fa-muted-foreground);
}
.requirement-drawer {
  min-height: 100%;
  padding: 25px 18px;
}
.drawer-title {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 15px;
}
.drawer-title h2 {
  margin: 0;
  font-size: 28px;
  letter-spacing: -0.045em;
}
.drawer-meta {
  display: flex;
  flex-wrap: wrap;
  margin: 14px 0 28px;
  color: var(--fa-muted-foreground);
  font-size: 11px;
  gap: 8px 15px;
}
.requirement-drawer section {
  padding: 17px 0;
  border-top: 1px solid var(--fa-border);
}
.requirement-drawer h3 {
  margin: 0 0 8px;
  font-size: 13px;
}
.requirement-drawer p {
  margin: 0;
  color: var(--fa-muted-foreground);
  line-height: 1.75;
  white-space: pre-wrap;
}
.requirement-drawer .pain-point {
  padding: 14px;
  color: var(--fa-foreground);
  background: oklch(0.95 0.035 80);
  border-radius: 12px;
}
.evidence-count {
  color: var(--fa-primary);
  font-size: 13px;
  font-weight: 680;
}
.drawer-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 22px;
}
.dialog-help {
  color: var(--fa-muted-foreground);
  line-height: 1.65;
}
.merge-select {
  width: 100%;
}

@media (width <= 680px) {
  .requirement-row {
    grid-template-columns: 54px minmax(0, 1fr);
    gap: 12px;
  }
  .priority-block {
    padding-right: 12px;
  }
  .row-arrow {
    display: none;
  }
  .row-top {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
