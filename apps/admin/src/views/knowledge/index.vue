<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import type { UploadRequestOptions } from "element-plus";
import { ElMessageBox } from "element-plus";
import { api, type KnowledgeSource } from "@/api/feedback";
import { useAppScopeStore } from "@/store/modules/appScope";
import { errorMessage, formatDate } from "@/utils/feedback";
import { message } from "@/utils/message";
import ScopeRequired from "@/components/ScopeRequired/index.vue";
import StatusPill from "@/components/StatusPill/index.vue";
import RefreshCw from "~icons/lucide/refresh-cw";
import Plus from "~icons/lucide/plus";
import BookOpenText from "~icons/lucide/book-open-text";
import FileText from "~icons/lucide/file-text";
import Link from "~icons/lucide/link";
import Trash2 from "~icons/lucide/trash-2";
import UploadCloud from "~icons/lucide/upload-cloud";

defineOptions({ name: "Knowledge" });

const scope = useAppScopeStore();
const { selectedAppId, isAllApps, selectedApp } = storeToRefs(scope);
const loading = ref(false);
const saving = ref(false);
const loadError = ref("");
const items = ref<KnowledgeSource[]>([]);
const faqOpen = ref(false);
const urlOpen = ref(false);
const pdfOpen = ref(false);
const faq = reactive({ question: "", answer: "" });
const urlForm = reactive({ url: "", title: "" });
let pollingTimer: ReturnType<typeof setInterval> | undefined;

async function load(showLoading = true) {
  if (isAllApps.value) {
    items.value = [];
    return;
  }
  if (showLoading) loading.value = true;
  loadError.value = "";
  try {
    items.value = await api.knowledge.list();
  } catch (error) {
    loadError.value = errorMessage(error);
  } finally {
    loading.value = false;
  }
}

async function createFaq() {
  saving.value = true;
  try {
    await api.knowledge.faq({
      appId: selectedAppId.value,
      question: faq.question,
      answer: faq.answer
    });
    message("FAQ 已加入知识库", { type: "success" });
    faqOpen.value = false;
    faq.question = "";
    faq.answer = "";
    await load();
  } catch (error) {
    message(errorMessage(error), { type: "error" });
  } finally {
    saving.value = false;
  }
}

async function createUrl() {
  saving.value = true;
  try {
    await api.knowledge.url({
      appId: selectedAppId.value,
      url: urlForm.url,
      title: urlForm.title || undefined
    });
    message("网页已进入导入队列", { type: "success" });
    urlOpen.value = false;
    urlForm.url = "";
    urlForm.title = "";
    await load();
  } catch (error) {
    message(errorMessage(error), { type: "error" });
  } finally {
    saving.value = false;
  }
}

async function uploadPdf(options: UploadRequestOptions) {
  saving.value = true;
  try {
    const form = new FormData();
    form.append("file", options.file);
    await api.knowledge.pdf(form);
    options.onSuccess({});
    message("PDF 已进入解析队列", { type: "success" });
    pdfOpen.value = false;
    await load();
  } catch (error) {
    options.onError(
      Object.assign(new Error(errorMessage(error)), {
        status: 0,
        method: "post",
        url: "/v1/admin/knowledge/pdf"
      })
    );
    message(errorMessage(error), { type: "error" });
  } finally {
    saving.value = false;
  }
}

async function remove(item: KnowledgeSource) {
  await ElMessageBox.confirm(
    `删除“${item.title}”及其全部知识片段？`,
    "删除知识源",
    {
      confirmButtonText: "删除",
      cancelButtonText: "取消",
      type: "warning"
    }
  );
  try {
    await api.knowledge.remove(item.id);
    message("知识源已删除", { type: "success" });
    await load();
  } catch (error) {
    message(errorMessage(error), { type: "error" });
  }
}

onMounted(() => {
  void load();
  pollingTimer = setInterval(() => {
    if (
      items.value.some(item => ["PENDING", "PROCESSING"].includes(item.status))
    )
      void load(false);
  }, 4000);
});
onUnmounted(() => pollingTimer && clearInterval(pollingTimer));
watch(selectedAppId, () => load());
</script>

<template>
  <div class="fa-page knowledge-page">
    <header class="fa-page-header">
      <div>
        <p class="fa-eyebrow">Grounded answers</p>
        <h1 class="fa-page-title">知识库</h1>
        <p class="fa-page-description">
          维护 {{ selectedApp?.name || "当前应用" }} 的已验证资料。支持
          FAQ、文本型 PDF 和单个网页，不执行 OCR 或递归爬取。
        </p>
      </div>
      <div class="header-actions">
        <el-button :icon="RefreshCw" :loading="loading" @click="load()"
          >刷新</el-button
        >
        <el-dropdown v-if="!isAllApps" trigger="click">
          <el-button type="primary" :icon="Plus">添加知识</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="faqOpen = true"
                ><IconifyIconOffline :icon="BookOpenText" />添加
                FAQ</el-dropdown-item
              >
              <el-dropdown-item @click="pdfOpen = true"
                ><IconifyIconOffline :icon="FileText" />上传
                PDF</el-dropdown-item
              >
              <el-dropdown-item @click="urlOpen = true"
                ><IconifyIconOffline :icon="Link" />导入单页
                URL</el-dropdown-item
              >
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </header>

    <ScopeRequired
      v-if="isAllApps"
      description="知识源严格按应用隔离，请在顶部选择一个应用后维护 FAQ、PDF 或网页。"
    />
    <template v-else>
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
          <IconifyIconOffline :icon="BookOpenText" class="empty-icon" /><strong
            >还没有知识源</strong
          ><span>建议先添加 5–10 条高频 FAQ，立即验证回答链路。</span
          ><el-button type="primary" :icon="Plus" @click="faqOpen = true"
            >添加第一条 FAQ</el-button
          >
        </div>
      </div>
      <section v-else class="knowledge-list">
        <article
          v-for="item in items"
          :key="item.id"
          class="fa-card knowledge-item"
        >
          <div
            :class="['source-icon', `source-icon--${item.type.toLowerCase()}`]"
          >
            <IconifyIconOffline
              :icon="
                item.type === 'FAQ'
                  ? BookOpenText
                  : item.type === 'PDF'
                    ? FileText
                    : Link
              "
            />
          </div>
          <div class="source-copy">
            <div>
              <span>{{ item.type }}</span
              ><StatusPill :value="item.status" />
            </div>
            <h2>{{ item.title }}</h2>
            <p v-if="item.error" class="source-error">{{ item.error }}</p>
            <footer>
              <span>{{ item._count.chunks }} 个片段</span
              ><span>{{ formatDate(item.updatedAt) }}</span
              ><a
                v-if="item.sourceUrl"
                :href="item.sourceUrl"
                target="_blank"
                rel="noreferrer"
                >查看来源</a
              >
            </footer>
          </div>
          <el-button
            text
            :icon="Trash2"
            aria-label="删除知识源"
            @click="remove(item)"
          />
        </article>
      </section>
    </template>

    <el-dialog v-model="faqOpen" title="添加 FAQ" width="min(620px, 92vw)">
      <el-form label-position="top">
        <el-form-item label="用户可能如何提问"
          ><el-input
            v-model="faq.question"
            maxlength="500"
            placeholder="例如：如何提交产品建议？"
        /></el-form-item>
        <el-form-item label="已验证回答"
          ><el-input
            v-model="faq.answer"
            type="textarea"
            :rows="7"
            maxlength="12000"
            show-word-limit
            placeholder="只写可以确认的产品事实，并尽量说明下一步。"
        /></el-form-item>
      </el-form>
      <template #footer
        ><el-button @click="faqOpen = false">取消</el-button
        ><el-button
          type="primary"
          :disabled="!faq.question.trim() || !faq.answer.trim()"
          :loading="saving"
          @click="createFaq"
          >保存 FAQ</el-button
        ></template
      >
    </el-dialog>

    <el-dialog v-model="urlOpen" title="导入单个网页" width="min(560px, 92vw)">
      <el-alert
        type="info"
        :closable="false"
        title="只抓取当前 URL，不递归访问站内链接；内网地址会被拒绝。"
        class="dialog-alert"
      />
      <el-form label-position="top">
        <el-form-item label="网页 URL"
          ><el-input
            v-model="urlForm.url"
            placeholder="https://example.com/help/article"
        /></el-form-item>
        <el-form-item label="标题（可选）"
          ><el-input v-model="urlForm.title" placeholder="留空时从网页标题提取"
        /></el-form-item>
      </el-form>
      <template #footer
        ><el-button @click="urlOpen = false">取消</el-button
        ><el-button
          type="primary"
          :disabled="!urlForm.url.trim()"
          :loading="saving"
          @click="createUrl"
          >开始导入</el-button
        ></template
      >
    </el-dialog>

    <el-dialog
      v-model="pdfOpen"
      title="上传文本型 PDF"
      width="min(560px, 92vw)"
    >
      <el-upload
        drag
        :limit="1"
        accept="application/pdf"
        :show-file-list="true"
        :http-request="uploadPdf"
        :disabled="saving"
      >
        <IconifyIconOffline :icon="UploadCloud" class="upload-icon" />
        <div class="el-upload__text">拖放 PDF 到这里，或 <em>选择文件</em></div>
        <template #tip
          ><div class="el-upload__tip">
            最大 20 MB。扫描件暂不支持 OCR，会在解析阶段标记失败。
          </div></template
        >
      </el-upload>
    </el-dialog>
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
  width: 34px;
  height: 34px;
  margin-bottom: 12px;
  color: var(--fa-primary);
}
.fa-empty span {
  display: block;
  margin: 5px 0 18px;
  font-size: 12px;
}
.knowledge-list {
  display: grid;
  gap: 12px;
}
.knowledge-item {
  display: grid;
  padding: 18px 20px;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 16px;
  align-items: center;
}
.source-icon {
  display: grid;
  width: 46px;
  height: 46px;
  color: var(--fa-primary);
  background: oklch(0.94 0.035 177);
  border-radius: 14px;
  place-items: center;
}
.source-icon--pdf {
  color: var(--fa-danger);
  background: oklch(0.95 0.035 28);
}
.source-icon--url {
  color: oklch(0.5 0.13 240);
  background: oklch(0.94 0.035 240);
}
.source-copy > div {
  display: flex;
  align-items: center;
  gap: 9px;
}
.source-copy > div > span:first-child {
  color: var(--fa-primary);
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.08em;
}
.source-copy h2 {
  margin: 7px 0 4px;
  font-size: 15px;
}
.source-copy footer {
  display: flex;
  flex-wrap: wrap;
  color: var(--fa-muted-foreground);
  font-size: 10px;
  gap: 13px;
}
.source-copy footer a {
  color: var(--fa-primary);
}
.source-error {
  margin: 5px 0;
  color: var(--fa-danger);
  font-size: 11px;
}
.dialog-alert {
  margin-bottom: 18px;
}
.upload-icon {
  width: 38px;
  height: 38px;
  margin-bottom: 10px;
  color: var(--fa-primary);
}

@media (width <= 640px) {
  .header-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  .knowledge-item {
    padding: 16px;
    grid-template-columns: auto 1fr;
  }
  .knowledge-item > .el-button {
    grid-column: 2;
    justify-self: end;
  }
}
</style>
