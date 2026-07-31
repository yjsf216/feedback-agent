<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { api, type AppSummary } from "@/api/feedback";
import { useAppScopeStore } from "@/store/modules/appScope";
import { errorMessage } from "@/utils/feedback";
import { message } from "@/utils/message";
import StatusPill from "@/components/StatusPill/index.vue";
import Plus from "~icons/lucide/plus";
import Boxes from "~icons/lucide/boxes";
import KeyRound from "~icons/lucide/key-round";
import Copy from "~icons/lucide/copy";
import Settings2 from "~icons/lucide/settings-2";
import ExternalLink from "~icons/lucide/external-link";
import ShieldCheck from "~icons/lucide/shield-check";

defineOptions({ name: "Apps" });

type Credential = { keyId: string; secret: string };

const route = useRoute();
const router = useRouter();
const scope = useAppScopeStore();
const { apps, loading } = storeToRefs(scope);
const saving = ref(false);
const loadError = ref("");
const createOpen = ref(false);
const editOpen = ref(false);
const credentialOpen = ref(false);
const editing = ref<AppSummary | null>(null);
const credential = ref<Credential | null>(null);
const form = reactive({
  name: "",
  slug: "",
  primaryColor: "#0F766E",
  allowGuest: true,
  allowEmail: false
});
const editForm = reactive({
  name: "",
  primaryColor: "#0F766E",
  publicWidgetEnabled: true,
  allowGuest: true,
  allowEmail: false
});

const activeCount = computed(
  () => apps.value.filter(app => app.status === "ACTIVE").length
);

async function load() {
  loadError.value = "";
  try {
    await scope.loadApps(true);
  } catch (error) {
    loadError.value = errorMessage(error);
  }
}

function openCreate() {
  createOpen.value = true;
}

function openEdit(app: AppSummary) {
  editing.value = app;
  editForm.name = app.name;
  editForm.primaryColor = app.primaryColor;
  editForm.publicWidgetEnabled = app.publicWidgetEnabled;
  editForm.allowGuest = app.authConfig?.allowGuest ?? true;
  editForm.allowEmail = app.authConfig?.allowEmail ?? false;
  editOpen.value = true;
}

async function createApp() {
  saving.value = true;
  try {
    const result = await api.apps.create({ ...form });
    credential.value = result.credential;
    createOpen.value = false;
    credentialOpen.value = true;
    message("应用已创建", { type: "success" });
    form.name = "";
    form.slug = "";
    await load();
    scope.select(result.app.id);
  } catch (error) {
    message(errorMessage(error), { type: "error" });
  } finally {
    saving.value = false;
  }
}

async function saveApp() {
  if (!editing.value) return;
  saving.value = true;
  try {
    await api.apps.update(editing.value.id, {
      name: editForm.name,
      primaryColor: editForm.primaryColor,
      publicWidgetEnabled: editForm.publicWidgetEnabled,
      auth: {
        allowGuest: editForm.allowGuest,
        allowEmail: editForm.allowEmail
      }
    });
    editOpen.value = false;
    message("应用配置已保存", { type: "success" });
    await load();
  } catch (error) {
    message(errorMessage(error), { type: "error" });
  } finally {
    saving.value = false;
  }
}

async function toggleStatus(app: AppSummary) {
  try {
    await api.apps.update(app.id, {
      status: app.status === "ACTIVE" ? "DISABLED" : "ACTIVE"
    });
    message(app.status === "ACTIVE" ? "应用已停用" : "应用已启用", {
      type: "success"
    });
    await load();
  } catch (error) {
    message(errorMessage(error), { type: "error" });
  }
}

async function createCredential(app: AppSummary) {
  try {
    const result = await api.apps.credential(app.id, `${app.name} SDK 凭证`);
    credential.value = result;
    credentialOpen.value = true;
  } catch (error) {
    message(errorMessage(error), { type: "error" });
  }
}

async function copy(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    message("已复制到剪贴板", { type: "success" });
  } catch {
    message("复制失败，请手动选择文本", { type: "warning" });
  }
}

function webChatUrl(app: AppSummary) {
  const publicOrigin =
    import.meta.env.VITE_PUBLIC_WEB_URL || "http://localhost:3000";
  return `${publicOrigin}/feedback/${app.slug}`;
}

async function clearCreateQuery() {
  if (route.query.create !== "1") return;
  const query = { ...route.query };
  delete query.create;
  await router.replace({ query });
}

onMounted(async () => {
  await load();
  if (route.query.create === "1") {
    openCreate();
    await clearCreateQuery();
  }
});
watch(
  () => route.query.create,
  async value => {
    if (value === "1") {
      openCreate();
      await clearCreateQuery();
    }
  }
);
</script>

<template>
  <div class="fa-page apps-page">
    <header class="fa-page-header">
      <div>
        <p class="fa-eyebrow">Multi-product workspace</p>
        <h1 class="fa-page-title">应用管理</h1>
        <p class="fa-page-description">
          每个 App 拥有独立知识库、模型配置、用户身份与反馈数据；Flutter、Web
          或后端都通过凭证接入。
        </p>
      </div>
      <el-button type="primary" :icon="Plus" @click="openCreate"
        >增加新的 App</el-button
      >
    </header>

    <section class="summary-rail">
      <div>
        <span>应用总数</span><strong>{{ apps.length }}</strong>
      </div>
      <div>
        <span>正在运行</span><strong>{{ activeCount }}</strong>
      </div>
      <div><span>隔离策略</span><strong>App Scope</strong></div>
    </section>

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
    <div v-else-if="apps.length === 0" class="fa-card fa-empty">
      <div>
        <IconifyIconOffline :icon="Boxes" class="empty-icon" /><strong
          >还没有接入任何应用</strong
        ><span>创建 App 后会立即生成一组只展示一次的 SDK 凭证。</span
        ><el-button type="primary" :icon="Plus" @click="openCreate"
          >创建第一个 App</el-button
        >
      </div>
    </div>
    <section v-else class="app-grid">
      <article v-for="app in apps" :key="app.id" class="fa-card app-card">
        <header>
          <span
            class="app-avatar"
            :style="{ '--app-color': app.primaryColor }"
            >{{ app.name.slice(0, 1).toUpperCase() }}</span
          >
          <div>
            <div>
              <h2>{{ app.name }}</h2>
              <StatusPill :value="app.status" />
            </div>
            <p>{{ app.slug }}</p>
          </div>
        </header>
        <div class="capability-row">
          <span
            ><IconifyIconOffline :icon="ShieldCheck" />{{
              app.authConfig?.allowGuest ? "允许访客" : "禁止访客"
            }}</span
          >
          <span>{{
            app.authConfig?.allowEmail ? "邮箱登录" : "未启用邮箱"
          }}</span>
          <span>{{
            app.publicWidgetEnabled ? "网页入口开启" : "网页入口关闭"
          }}</span>
        </div>
        <footer>
          <a :href="webChatUrl(app)" target="_blank" rel="noreferrer"
            ><IconifyIconOffline :icon="ExternalLink" />打开反馈页</a
          >
          <div>
            <el-button text :icon="KeyRound" @click="createCredential(app)"
              >新凭证</el-button
            >
            <el-button text :icon="Settings2" @click="openEdit(app)"
              >配置</el-button
            >
            <el-button
              text
              :type="app.status === 'ACTIVE' ? 'danger' : 'success'"
              @click="toggleStatus(app)"
              >{{ app.status === "ACTIVE" ? "停用" : "启用" }}</el-button
            >
          </div>
        </footer>
      </article>
    </section>

    <el-dialog
      v-model="createOpen"
      title="增加新的 App"
      width="min(600px, 92vw)"
    >
      <el-alert
        type="info"
        :closable="false"
        title="应用创建后，知识、对话和需求都会按 App ID 隔离。"
        class="dialog-alert"
      />
      <el-form label-position="top">
        <el-form-item label="应用名称"
          ><el-input
            v-model="form.name"
            maxlength="120"
            placeholder="例如：会员中心"
        /></el-form-item>
        <el-form-item label="应用标识"
          ><el-input
            v-model="form.slug"
            maxlength="80"
            placeholder="membership-center"
            ><template #prepend>/feedback/</template></el-input
          >
          <p class="field-help">
            仅小写字母、数字和连字符，创建后不建议修改。
          </p></el-form-item
        >
        <div class="form-grid">
          <el-form-item label="品牌色"
            ><el-color-picker v-model="form.primaryColor" /></el-form-item
          ><el-form-item label="访客入口"
            ><el-switch v-model="form.allowGuest" active-text="允许匿名反馈"
          /></el-form-item>
        </div>
        <el-form-item label="邮箱身份"
          ><el-switch v-model="form.allowEmail" active-text="允许邮箱登录"
        /></el-form-item>
      </el-form>
      <template #footer
        ><el-button @click="createOpen = false">取消</el-button
        ><el-button
          type="primary"
          :disabled="
            form.name.trim().length < 2 ||
            !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)
          "
          :loading="saving"
          @click="createApp"
          >创建并生成凭证</el-button
        ></template
      >
    </el-dialog>

    <el-dialog v-model="editOpen" title="应用配置" width="min(600px, 92vw)">
      <el-form label-position="top">
        <el-form-item label="应用名称"
          ><el-input v-model="editForm.name" maxlength="120"
        /></el-form-item>
        <div class="form-grid">
          <el-form-item label="品牌色"
            ><el-color-picker v-model="editForm.primaryColor" /></el-form-item
          ><el-form-item label="公开反馈页"
            ><el-switch
              v-model="editForm.publicWidgetEnabled"
              active-text="启用"
          /></el-form-item>
        </div>
        <el-divider content-position="left">用户身份</el-divider>
        <el-form-item
          ><el-switch v-model="editForm.allowGuest" active-text="允许匿名访客"
        /></el-form-item>
        <el-form-item
          ><el-switch v-model="editForm.allowEmail" active-text="允许邮箱登录"
        /></el-form-item>
      </el-form>
      <template #footer
        ><el-button @click="editOpen = false">取消</el-button
        ><el-button type="primary" :loading="saving" @click="saveApp"
          >保存配置</el-button
        ></template
      >
    </el-dialog>

    <el-dialog
      v-model="credentialOpen"
      title="保存 SDK 凭证"
      width="min(620px, 92vw)"
      :close-on-click-modal="false"
    >
      <el-alert
        type="warning"
        :closable="false"
        title="Secret 只在本次显示。请立即保存到服务端密钥管理中，不要写进 Flutter 或网页源码。"
        class="dialog-alert"
      />
      <div v-if="credential" class="credential-box">
        <label>Key ID</label>
        <div>
          <code>{{ credential.keyId }}</code
          ><el-button
            text
            :icon="Copy"
            aria-label="复制 Key ID"
            @click="copy(credential.keyId)"
          />
        </div>
        <label>Secret</label>
        <div>
          <code>{{ credential.secret }}</code
          ><el-button
            text
            :icon="Copy"
            aria-label="复制 Secret"
            @click="copy(credential.secret)"
          />
        </div>
      </div>
      <p class="credential-note">
        推荐由你的业务后端使用 Key ID + Secret 换取短期用户令牌，再把令牌交给
        Flutter SDK。
      </p>
      <template #footer
        ><el-button type="primary" @click="credentialOpen = false"
          >我已安全保存</el-button
        ></template
      >
    </el-dialog>
  </div>
</template>

<style scoped>
.summary-rail {
  display: flex;
  max-width: 650px;
  margin: -4px 0 20px;
  border: 1px solid var(--fa-border);
  background: color-mix(in oklch, var(--fa-card) 88%, transparent);
  border-radius: 16px;
}
.summary-rail div {
  flex: 1;
  padding: 14px 18px;
  border-right: 1px solid var(--fa-border);
}
.summary-rail div:last-child {
  border-right: 0;
}
.summary-rail span {
  display: block;
  color: var(--fa-muted-foreground);
  font-size: 10px;
}
.summary-rail strong {
  display: block;
  margin-top: 5px;
  font-size: 16px;
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
.app-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 15px;
}
.app-card {
  overflow: hidden;
  padding: 22px;
}
.app-card > header {
  display: flex;
  align-items: center;
  gap: 14px;
}
.app-avatar {
  display: grid;
  width: 50px;
  height: 50px;
  flex: none;
  color: oklch(0.99 0 0);
  font-size: 18px;
  font-weight: 760;
  background: var(--app-color);
  border-radius: 15px;
  place-items: center;
  box-shadow: inset 0 0 0 1px oklch(1 0 0 / 20%);
}
.app-card header > div {
  min-width: 0;
}
.app-card header > div > div {
  display: flex;
  align-items: center;
  gap: 9px;
}
.app-card h2 {
  overflow: hidden;
  margin: 0;
  font-size: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.app-card header p {
  margin: 5px 0 0;
  color: var(--fa-muted-foreground);
  font-family: "Manrope Variable", sans-serif;
  font-size: 11px;
}
.capability-row {
  display: flex;
  flex-wrap: wrap;
  margin: 20px 0;
  gap: 8px;
}
.capability-row span {
  display: inline-flex;
  align-items: center;
  padding: 6px 9px;
  color: var(--fa-muted-foreground);
  font-size: 10px;
  background: var(--fa-muted);
  border-radius: 8px;
  gap: 5px;
}
.app-card > footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 15px;
  border-top: 1px solid var(--fa-border);
  gap: 12px;
}
.app-card footer > a {
  display: flex;
  align-items: center;
  color: var(--fa-primary);
  font-size: 11px;
  font-weight: 650;
  gap: 6px;
}
.app-card footer > div {
  display: flex;
}
.dialog-alert {
  margin-bottom: 18px;
}
.form-grid {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 18px;
}
.field-help {
  margin: 6px 0 0;
  color: var(--fa-muted-foreground);
  font-size: 10px;
}
.credential-box {
  padding: 16px;
  background: oklch(0.96 0.012 180);
  border: 1px solid var(--fa-border);
  border-radius: 14px;
}
.credential-box label {
  display: block;
  margin: 10px 0 5px;
  color: var(--fa-muted-foreground);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
}
.credential-box label:first-child {
  margin-top: 0;
}
.credential-box > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.credential-box code {
  overflow: auto;
  color: var(--fa-foreground);
  font-size: 12px;
  white-space: nowrap;
}
.credential-note {
  color: var(--fa-muted-foreground);
  font-size: 11px;
  line-height: 1.7;
}
@media (width <= 800px) {
  .app-grid {
    grid-template-columns: 1fr;
  }
}
@media (width <= 600px) {
  .summary-rail {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  .summary-rail div {
    border-bottom: 1px solid var(--fa-border);
  }
  .summary-rail div:last-child {
    grid-column: 1 / -1;
  }
  .app-card > footer {
    align-items: flex-start;
    flex-direction: column;
  }
  .app-card footer > div {
    flex-wrap: wrap;
  }
  .form-grid {
    grid-template-columns: 1fr;
    gap: 0;
  }
}
</style>
