<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { api, type Conversation } from "@/api/feedback";
import { useAppScopeStore } from "@/store/modules/appScope";
import { errorMessage, formatDate, formatPercent } from "@/utils/feedback";
import StatusPill from "@/components/StatusPill/index.vue";
import Search from "~icons/lucide/search";
import RefreshCw from "~icons/lucide/refresh-cw";
import MessagesSquare from "~icons/lucide/messages-square";
import BookOpenText from "~icons/lucide/book-open-text";

defineOptions({ name: "Conversations" });

const scope = useAppScopeStore();
const { selectedAppId } = storeToRefs(scope);
const loading = ref(true);
const detailLoading = ref(false);
const loadError = ref("");
const conversations = ref<Conversation[]>([]);
const detail = ref<Conversation | null>(null);
const drawerOpen = ref(false);
const query = ref("");
const status = ref("");

async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    conversations.value = await api.conversations.list({
      query: query.value || undefined,
      status: status.value || undefined
    });
  } catch (error) {
    loadError.value = errorMessage(error);
  } finally {
    loading.value = false;
  }
}

async function openConversation(row: Conversation) {
  drawerOpen.value = true;
  detailLoading.value = true;
  detail.value = row;
  try {
    detail.value = await api.conversations.detail(row.id);
  } catch (error) {
    loadError.value = errorMessage(error);
  } finally {
    detailLoading.value = false;
  }
}

onMounted(load);
watch(selectedAppId, load);
</script>

<template>
  <div class="fa-page">
    <header class="fa-page-header">
      <div>
        <p class="fa-eyebrow">Conversation archive</p>
        <h1 class="fa-page-title">对话记录</h1>
        <p class="fa-page-description">
          查看 AI 回答依据、意图和置信度，回到用户原话判断反馈是否被准确理解。
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

    <section class="fa-card fa-toolbar">
      <el-input
        v-model="query"
        clearable
        placeholder="搜索主题、摘要或消息"
        :prefix-icon="Search"
        @keyup.enter="load"
      />
      <el-select
        v-model="status"
        clearable
        placeholder="全部状态"
        @change="load"
      >
        <el-option label="处理中" value="OPEN" />
        <el-option label="未解决" value="UNRESOLVED" />
        <el-option label="已解决" value="RESOLVED" />
        <el-option label="已关闭" value="CLOSED" />
      </el-select>
      <el-button type="primary" :icon="Search" @click="load">查询</el-button>
      <span class="result-count">{{ conversations.length }} 条对话</span>
    </section>

    <section class="fa-card table-panel">
      <el-skeleton v-if="loading" :rows="8" animated class="table-loading" />
      <div v-else-if="conversations.length === 0" class="fa-empty">
        <div>
          <IconifyIconOffline :icon="MessagesSquare" class="empty-icon" />
          <strong>没有匹配的对话</strong>
          <span>用户开始反馈后，对话会按最近活动时间显示。</span>
        </div>
      </div>
      <el-table v-else :data="conversations" @row-click="openConversation">
        <el-table-column label="对话" min-width="280">
          <template #default="{ row }">
            <div class="conversation-cell">
              <strong>{{
                row.subject || row.messages?.[0]?.content || "未命名对话"
              }}</strong>
              <span
                >{{ row.endUser?.displayName || "匿名用户" }} ·
                {{ row.app?.name }}</span
              >
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }"
            ><StatusPill :value="row.status"
          /></template>
        </el-table-column>
        <el-table-column label="AI 置信度" width="125">
          <template #default="{ row }">
            <span
              :class="['confidence', { low: (row.aiConfidence ?? 0) < 0.72 }]"
            >
              {{ formatPercent(row.aiConfidence) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="最近活动" width="130">
          <template #default="{ row }">{{
            formatDate(row.lastMessageAt)
          }}</template>
        </el-table-column>
      </el-table>
    </section>

    <el-drawer
      v-model="drawerOpen"
      size="min(680px, 94vw)"
      :with-header="false"
    >
      <div v-if="detail" class="conversation-drawer">
        <header>
          <p class="fa-eyebrow">Conversation detail</p>
          <h2>{{ detail.subject || "对话详情" }}</h2>
          <div class="drawer-meta">
            <StatusPill :value="detail.status" />
            <span>{{ detail.app?.name }}</span>
            <span>{{ detail.endUser?.displayName || "匿名用户" }}</span>
            <span>置信度 {{ formatPercent(detail.aiConfidence) }}</span>
          </div>
        </header>
        <el-skeleton v-if="detailLoading" :rows="10" animated />
        <div v-else class="message-list">
          <article
            v-for="item in detail.messages"
            :key="item.id"
            :class="['message', `message--${item.role.toLowerCase()}`]"
          >
            <div class="message-role">
              {{
                item.role === "USER"
                  ? "用户"
                  : item.role === "ASSISTANT"
                    ? "AI 助手"
                    : "系统"
              }}
            </div>
            <p>{{ item.content }}</p>
            <div v-if="item.citations?.length" class="citation-list">
              <IconifyIconOffline :icon="BookOpenText" />
              <span v-for="source in item.citations" :key="source.id">{{
                source.title
              }}</span>
            </div>
            <time>{{ formatDate(item.createdAt) }}</time>
          </article>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<style scoped>
.page-alert {
  margin-bottom: 16px;
}
.fa-toolbar .el-input {
  width: min(380px, 100%);
}
.fa-toolbar .el-select {
  width: 150px;
}
.result-count {
  margin-left: auto;
  color: var(--fa-muted-foreground);
  font-size: 12px;
}
.table-panel {
  padding: 14px;
  overflow: hidden;
}
.table-loading {
  padding: 18px;
}
.empty-icon {
  width: 30px;
  height: 30px;
  margin-bottom: 14px;
  color: var(--fa-primary);
}
.fa-empty span {
  display: block;
  margin-top: 5px;
  font-size: 12px;
}
.conversation-cell {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}
.conversation-cell strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.conversation-cell span {
  color: var(--fa-muted-foreground);
  font-size: 12px;
}
.confidence {
  color: var(--fa-success);
  font-weight: 720;
}
.confidence.low {
  color: var(--fa-danger);
}

.conversation-drawer {
  min-height: 100%;
  padding: 12px 8px 40px;
  background: var(--fa-background);
}
.conversation-drawer header {
  padding: 12px 10px 24px;
}
.conversation-drawer h2 {
  margin: 0;
  font-size: 25px;
  letter-spacing: -0.04em;
}
.drawer-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
  margin-top: 12px;
  color: var(--fa-muted-foreground);
  font-size: 12px;
}
.message-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.message {
  max-width: 88%;
  padding: 15px 17px;
  background: var(--fa-card);
  border: 1px solid var(--fa-border);
  border-radius: 17px 17px 17px 5px;
}
.message--user {
  align-self: flex-end;
  background: oklch(0.92 0.04 177);
  border-radius: 17px 17px 5px;
}
.message-role {
  margin-bottom: 6px;
  color: var(--fa-primary);
  font-size: 11px;
  font-weight: 730;
}
.message p {
  margin: 0;
  white-space: pre-wrap;
  line-height: 1.75;
}
.message time {
  display: block;
  margin-top: 8px;
  color: var(--fa-muted-foreground);
  font-size: 10px;
}
.citation-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  color: var(--fa-primary);
  font-size: 11px;
}
.citation-list span {
  padding: 3px 7px;
  background: oklch(0.95 0.03 177);
  border-radius: 999px;
}

@media (width <= 720px) {
  .result-count {
    margin-left: 0;
  }
  .table-panel {
    overflow-x: auto;
  }
}
</style>
