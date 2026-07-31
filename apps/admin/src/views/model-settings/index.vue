<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { api, type ModelConfig } from "@/api/feedback";
import { useAppScopeStore } from "@/store/modules/appScope";
import { errorMessage } from "@/utils/feedback";
import { message } from "@/utils/message";
import ScopeRequired from "@/components/ScopeRequired/index.vue";
import BrainCircuit from "~icons/lucide/brain-circuit";
import DatabaseZap from "~icons/lucide/database-zap";
import KeyRound from "~icons/lucide/key-round";
import Sparkles from "~icons/lucide/sparkles";
import Save from "~icons/lucide/save";

defineOptions({ name: "ModelSettings" });

const scope = useAppScopeStore();
const { selectedAppId, selectedApp, isAllApps } = storeToRefs(scope);
const loading = ref(false);
const saving = ref(false);
const loadError = ref("");
const config = ref<ModelConfig | null>(null);
const form = reactive({
  provider: "deepseek",
  baseUrl: "https://api.deepseek.com/v1",
  model: "deepseek-chat",
  apiKey: "",
  temperature: 0.2,
  confidenceThreshold: 0.72,
  enabled: true
});

const confidenceLabel = computed(
  () => `${Math.round(form.confidenceThreshold * 100)}%`
);

function applyConfig(value: ModelConfig) {
  config.value = value;
  form.provider = value.provider;
  form.baseUrl = value.baseUrl ?? "";
  form.model = value.model;
  form.apiKey = "";
  form.temperature = value.temperature;
  form.confidenceThreshold = value.confidenceThreshold;
  form.enabled = value.enabled;
}

async function load() {
  if (isAllApps.value) {
    config.value = null;
    return;
  }
  loading.value = true;
  loadError.value = "";
  try {
    applyConfig(await api.apps.model(selectedAppId.value));
  } catch (error) {
    loadError.value = errorMessage(error);
  } finally {
    loading.value = false;
  }
}

function useDeepSeekPreset() {
  form.provider = "deepseek";
  form.baseUrl = "https://api.deepseek.com/v1";
  form.model = "deepseek-chat";
  form.temperature = 0.2;
  message("已应用 DeepSeek 对话预设，保存后生效", { type: "success" });
}

async function save() {
  if (isAllApps.value) return;
  saving.value = true;
  try {
    const payload: Record<string, string | number | boolean | null> = {
      provider: form.provider,
      baseUrl: form.baseUrl || null,
      model: form.model,
      temperature: form.temperature,
      confidenceThreshold: form.confidenceThreshold,
      enabled: form.enabled
    };
    if (form.apiKey.trim()) payload.apiKey = form.apiKey.trim();
    applyConfig(await api.apps.updateModel(selectedAppId.value, payload));
    message("模型配置已保存", { type: "success" });
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
  <div class="fa-page model-page">
    <header class="fa-page-header">
      <div>
        <p class="fa-eyebrow">OpenAI-compatible runtime</p>
        <h1 class="fa-page-title">模型配置</h1>
        <p class="fa-page-description">
          为每个 App
          配置独立对话模型。知识库向量模型是平台级配置，避免不同维度写入同一索引。
        </p>
      </div>
      <el-button
        v-if="!isAllApps"
        type="primary"
        :icon="Save"
        :loading="saving"
        @click="save"
        >保存配置</el-button
      >
    </header>

    <ScopeRequired
      v-if="isAllApps"
      description="对话模型按应用独立配置，请在顶部选择一个应用后继续。"
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
        <el-skeleton :rows="11" animated />
      </div>
      <section v-else class="settings-layout">
        <div class="fa-card model-form">
          <div class="section-heading">
            <span><IconifyIconOffline :icon="BrainCircuit" /></span>
            <div>
              <h2>{{ selectedApp?.name }} 的对话模型</h2>
              <p>支持任意 OpenAI Chat Completions 兼容服务。</p>
            </div>
            <el-switch v-model="form.enabled" active-text="启用模型" />
          </div>
          <el-alert
            v-if="!config?.apiKeyConfigured"
            type="warning"
            :closable="false"
            title="尚未配置 API Key；系统会使用无模型回退回答，并降低置信度。"
            class="inline-alert"
          />
          <el-form label-position="top">
            <div class="preset-row">
              <span>快速预设</span
              ><el-button plain :icon="Sparkles" @click="useDeepSeekPreset"
                >DeepSeek Chat</el-button
              >
            </div>
            <div class="form-grid">
              <el-form-item label="服务商标识"
                ><el-input
                  v-model="form.provider"
                  placeholder="deepseek" /></el-form-item
              ><el-form-item label="模型名称"
                ><el-input v-model="form.model" placeholder="deepseek-chat"
              /></el-form-item>
            </div>
            <el-form-item label="兼容 API Base URL"
              ><el-input
                v-model="form.baseUrl"
                placeholder="https://api.deepseek.com/v1"
            /></el-form-item>
            <el-form-item label="API Key"
              ><el-input
                v-model="form.apiKey"
                type="password"
                show-password
                autocomplete="new-password"
                :placeholder="
                  config?.apiKeyConfigured
                    ? '已配置；留空保持不变'
                    : '输入服务端 API Key'
                "
                ><template #prefix
                  ><IconifyIconOffline :icon="KeyRound" /></template
              ></el-input>
              <p class="field-help">
                密钥只发送到服务端并加密保存，管理台不会再次读取明文。
              </p></el-form-item
            >
            <div class="slider-grid">
              <el-form-item label="回答温度"
                ><el-slider
                  v-model="form.temperature"
                  :min="0"
                  :max="1.5"
                  :step="0.1"
                  show-input
                />
                <p class="field-help">
                  反馈客服建议 0.1–0.4，优先稳定、可核验的回答。
                </p></el-form-item
              >
              <el-form-item :label="`自动回复置信度阈值 · ${confidenceLabel}`"
                ><el-slider
                  v-model="form.confidenceThreshold"
                  :min="0.3"
                  :max="0.99"
                  :step="0.01"
                />
                <p class="field-help">
                  低于阈值的问题会进入“未解决队列”，而不是伪装成确定答案。
                </p></el-form-item
              >
            </div>
          </el-form>
        </div>

        <aside class="fa-card embedding-card">
          <div class="embedding-icon">
            <IconifyIconOffline :icon="DatabaseZap" />
          </div>
          <p class="fa-eyebrow">Platform scope</p>
          <h2>知识向量模型</h2>
          <p>
            Embedding
            在服务端环境变量中全局配置。变更模型或维度后，需要重建所有知识索引。
          </p>
          <dl>
            <div>
              <dt>状态</dt>
              <dd :class="{ ready: config?.embedding.configured }">
                {{ config?.embedding.configured ? "已配置" : "未配置" }}
              </dd>
            </div>
            <div>
              <dt>模型</dt>
              <dd>{{ config?.embedding.model || "—" }}</dd>
            </div>
            <div>
              <dt>维度</dt>
              <dd>{{ config?.embedding.dimensions || "—" }}</dd>
            </div>
            <div>
              <dt>Base URL</dt>
              <dd>{{ config?.embedding.baseUrl || "—" }}</dd>
            </div>
          </dl>
          <el-alert
            type="info"
            :closable="false"
            title="未配置向量模型时，系统仍会使用 PostgreSQL 全文检索回答。"
          />
        </aside>
      </section>
    </template>
  </div>
</template>

<style scoped>
.page-alert {
  margin-bottom: 16px;
}
.loading-panel {
  padding: 28px;
}
.settings-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 310px;
  gap: 16px;
  align-items: start;
}
.model-form {
  padding: 24px;
}
.section-heading {
  display: grid;
  margin-bottom: 20px;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 13px;
  align-items: center;
}
.section-heading > span,
.embedding-icon {
  display: grid;
  width: 46px;
  height: 46px;
  color: var(--fa-primary);
  background: oklch(0.94 0.035 177);
  border-radius: 14px;
  place-items: center;
}
.section-heading h2,
.embedding-card h2 {
  margin: 0;
  font-size: 18px;
}
.section-heading p {
  margin: 4px 0 0;
  color: var(--fa-muted-foreground);
  font-size: 11px;
}
.inline-alert {
  margin-bottom: 20px;
}
.preset-row {
  display: flex;
  align-items: center;
  margin-bottom: 18px;
  padding: 10px 12px;
  background: var(--fa-muted);
  border-radius: 12px;
  gap: 12px;
}
.preset-row span {
  margin-right: auto;
  color: var(--fa-muted-foreground);
  font-size: 11px;
  font-weight: 650;
}
.form-grid,
.slider-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.field-help {
  margin: 6px 0 0;
  color: var(--fa-muted-foreground);
  font-size: 10px;
  line-height: 1.5;
}
.embedding-card {
  position: sticky;
  top: 78px;
  padding: 24px;
}
.embedding-card .fa-eyebrow {
  margin-top: 20px;
}
.embedding-card > p:not(.fa-eyebrow) {
  color: var(--fa-muted-foreground);
  font-size: 11px;
  line-height: 1.7;
}
.embedding-card dl {
  margin: 20px 0;
}
.embedding-card dl > div {
  display: flex;
  justify-content: space-between;
  padding: 11px 0;
  border-bottom: 1px solid var(--fa-border);
  gap: 12px;
}
.embedding-card dt {
  color: var(--fa-muted-foreground);
  font-size: 10px;
}
.embedding-card dd {
  overflow: hidden;
  margin: 0;
  font-size: 10px;
  font-weight: 650;
  text-align: right;
  text-overflow: ellipsis;
}
.embedding-card dd.ready {
  color: var(--fa-success);
}
@media (width <= 980px) {
  .settings-layout {
    grid-template-columns: 1fr;
  }
  .embedding-card {
    position: static;
  }
}
@media (width <= 640px) {
  .section-heading {
    grid-template-columns: auto 1fr;
  }
  .section-heading .el-switch {
    grid-column: 2;
    justify-self: start;
  }
  .form-grid,
  .slider-grid {
    grid-template-columns: 1fr;
    gap: 0;
  }
}
</style>
