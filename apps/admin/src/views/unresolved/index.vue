<script setup lang="ts">
import { onMounted, reactive, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { api, type UnresolvedCase } from "@/api/feedback";
import { useAppScopeStore } from "@/store/modules/appScope";
import { errorMessage, formatDate } from "@/utils/feedback";
import { message } from "@/utils/message";
import StatusPill from "@/components/StatusPill/index.vue";
import RefreshCw from "~icons/lucide/refresh-cw";
import CircleCheck from "~icons/lucide/circle-check";
import ClipboardPenLine from "~icons/lucide/clipboard-pen-line";
import MessageCircleWarning from "~icons/lucide/message-circle-warning";

defineOptions({ name: "Unresolved" });

const scope = useAppScopeStore();
const { selectedAppId } = storeToRefs(scope);
const loading = ref(true);
const saving = ref(false);
const loadError = ref("");
const items = ref<UnresolvedCase[]>([]);
const resolutionOpen = ref(false);
const selected = ref<UnresolvedCase | null>(null);
const resolution = reactive({ text: "" });

async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    items.value = await api.unresolved.list();
  } catch (error) {
    loadError.value = errorMessage(error);
  } finally {
    loading.value = false;
  }
}

async function markProcessing(item: UnresolvedCase) {
  saving.value = true;
  try {
    await api.unresolved.update(item.id, { status: "PROCESSING" });
    message("已标记为处理中", { type: "success" });
    await load();
  } catch (error) {
    message(errorMessage(error), { type: "error" });
  } finally {
    saving.value = false;
  }
}

function openResolution(item: UnresolvedCase) {
  selected.value = item;
  resolution.text = "";
  resolutionOpen.value = true;
}

async function resolveItem() {
  if (!selected.value || !resolution.text.trim()) return;
  saving.value = true;
  try {
    await api.unresolved.update(selected.value.id, {
      status: "RESOLVED",
      resolution: resolution.text.trim()
    });
    message("问题已解决并完成归档", { type: "success" });
    resolutionOpen.value = false;
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
  <div class="fa-page unresolved-page">
    <header class="fa-page-header">
      <div>
        <p class="fa-eyebrow">Human review queue</p>
        <h1 class="fa-page-title">未解决队列</h1>
        <p class="fa-page-description">
          AI
          置信度不足或用户明确表示未解决时，问题会进入这里。当前版本由管理员异步处理，不提供实时人工接管。
        </p>
      </div>
      <el-button :icon="RefreshCw" :loading="loading" @click="load"
        >刷新队列</el-button
      >
    </header>

    <el-alert
      v-if="loadError"
      type="error"
      :title="loadError"
      show-icon
      class="page-alert"
    />

    <div v-if="loading" class="fa-card loading-panel">
      <el-skeleton :rows="10" animated />
    </div>
    <div v-else-if="items.length === 0" class="fa-card fa-empty">
      <div>
        <IconifyIconOffline :icon="CircleCheck" class="empty-icon" />
        <strong>所有问题都已得到处理</strong>
        <span>新的低置信度会话会自动进入队列。</span>
      </div>
    </div>
    <section v-else class="unresolved-list">
      <article
        v-for="item in items"
        :key="item.id"
        class="fa-card unresolved-card"
      >
        <div :class="['priority-rail', `priority-rail--${item.priority}`]" />
        <div class="card-main">
          <header>
            <div class="priority-label">
              P{{ item.priority }} · {{ item.conversation.app.name }}
            </div>
            <StatusPill :value="item.status" />
          </header>
          <h2>{{ item.conversation.subject || item.reason }}</h2>
          <p>{{ item.reason }}</p>
          <div v-if="item.conversation.messages?.[0]" class="last-message">
            <IconifyIconOffline :icon="MessageCircleWarning" />
            <span>{{ item.conversation.messages[0].content }}</span>
          </div>
          <footer>
            <span
              >{{ item.conversation.endUser.displayName || "匿名用户" }} ·
              {{ formatDate(item.createdAt) }}</span
            >
            <div class="actions">
              <el-button
                v-if="item.status === 'OPEN'"
                :icon="ClipboardPenLine"
                :loading="saving"
                @click="markProcessing(item)"
                >开始处理</el-button
              >
              <el-button
                type="primary"
                :icon="CircleCheck"
                @click="openResolution(item)"
                >标记已解决</el-button
              >
            </div>
          </footer>
        </div>
      </article>
    </section>

    <el-dialog
      v-model="resolutionOpen"
      title="记录解决结果"
      width="min(520px, 92vw)"
    >
      <p class="dialog-help">请写下实际处理方式，方便后续复盘与知识库补充。</p>
      <el-input
        v-model="resolution.text"
        type="textarea"
        :rows="5"
        maxlength="5000"
        show-word-limit
        placeholder="例如：确认是 2.4.1 版本问题，已提供升级方案并补充 FAQ。"
      />
      <template #footer>
        <el-button @click="resolutionOpen = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="!resolution.text.trim()"
          :loading="saving"
          @click="resolveItem"
          >确认解决</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-alert {
  margin-bottom: 16px;
}
.loading-panel {
  padding: 28px;
}
.empty-icon {
  width: 34px;
  height: 34px;
  margin-bottom: 12px;
  color: var(--fa-success);
}
.fa-empty span {
  display: block;
  margin-top: 5px;
  font-size: 12px;
}
.unresolved-list {
  display: grid;
  gap: 14px;
}
.unresolved-card {
  position: relative;
  display: grid;
  overflow: hidden;
  grid-template-columns: 5px 1fr;
  transition:
    box-shadow 180ms ease,
    transform 180ms ease;
}
.unresolved-card:hover {
  box-shadow: var(--fa-shadow);
  transform: translateY(-2px);
}
.priority-rail {
  background: var(--fa-primary);
}
.priority-rail--3,
.priority-rail--4 {
  background: var(--fa-danger);
}
.card-main {
  padding: 20px 22px;
}
.card-main > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.priority-label {
  color: var(--fa-primary);
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0.04em;
}
.card-main h2 {
  margin: 12px 0 5px;
  font-size: 18px;
  letter-spacing: -0.025em;
}
.card-main > p {
  margin: 0;
  color: var(--fa-muted-foreground);
  font-size: 13px;
}
.last-message {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin: 15px 0;
  padding: 12px 14px;
  color: var(--fa-muted-foreground);
  font-size: 12px;
  line-height: 1.6;
  background: var(--fa-muted);
  border-radius: 12px;
}
.last-message svg {
  flex: none;
  margin-top: 2px;
  color: var(--fa-warning);
}
.card-main footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  color: var(--fa-muted-foreground);
  font-size: 11px;
}
.actions {
  display: flex;
  gap: 8px;
}
.dialog-help {
  margin-top: 0;
  color: var(--fa-muted-foreground);
  line-height: 1.6;
}

@media (width <= 680px) {
  .card-main {
    padding: 18px 16px;
  }
  .card-main footer {
    align-items: stretch;
    flex-direction: column;
  }
  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
}
</style>
