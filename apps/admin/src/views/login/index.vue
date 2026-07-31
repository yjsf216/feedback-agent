<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import type { FormInstance, FormRules } from "element-plus";
import { message } from "@/utils/message";
import { useUserStoreHook } from "@/store/modules/user";
import Bot from "~icons/lucide/bot";
import Mail from "~icons/lucide/mail";
import LockKeyhole from "~icons/lucide/lock-keyhole";
import ArrowRight from "~icons/lucide/arrow-right";
import ShieldCheck from "~icons/lucide/shield-check";
import MessagesSquare from "~icons/lucide/messages-square";
import ListChecks from "~icons/lucide/list-checks";

defineOptions({ name: "Login" });

const router = useRouter();
const formRef = ref<FormInstance>();
const loading = ref(false);
const form = reactive({ email: "admin@example.com", password: "" });
const rules: FormRules = {
  email: [
    { required: true, message: "请输入管理员邮箱", trigger: "blur" },
    { type: "email", message: "邮箱格式不正确", trigger: "blur" }
  ],
  password: [
    { required: true, message: "请输入密码", trigger: "blur" },
    { min: 8, message: "密码至少 8 位", trigger: "blur" }
  ]
};

async function login() {
  if (!(await formRef.value?.validate().catch(() => false))) return;
  loading.value = true;
  try {
    await useUserStoreHook().loginByUsername(form);
    message("欢迎回来", { type: "success" });
    await router.push("/dashboard");
  } catch (error: any) {
    message(error?.response?.data?.message ?? "登录失败，请检查账号和密码", {
      type: "error"
    });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="login-shell">
    <section class="login-story">
      <div class="story-grid" />
      <div class="brand-lockup">
        <div class="brand-mark"><IconifyIconOffline :icon="Bot" /></div>
        <span>Feedback Agent</span>
      </div>
      <div class="story-copy">
        <p class="story-kicker">从每一次对话里，看见真正的产品信号</p>
        <h1>把零散反馈，<br />变成可行动的需求。</h1>
        <p>
          对话采集、意图识别、痛点提炼和需求归类在同一条工作流里完成，重要问题由人最终确认。
        </p>
      </div>
      <div class="story-flow">
        <div>
          <IconifyIconOffline :icon="MessagesSquare" /><span>听见用户</span>
        </div>
        <span class="flow-line" />
        <div>
          <IconifyIconOffline :icon="ListChecks" /><span>形成行动</span>
        </div>
      </div>
    </section>

    <section class="login-form-panel">
      <div class="login-form-wrap">
        <div class="mobile-brand">
          <div class="brand-mark"><IconifyIconOffline :icon="Bot" /></div>
          <span>Feedback Agent</span>
        </div>
        <div class="form-heading">
          <p>管理控制台</p>
          <h2>登录后继续处理反馈</h2>
          <span>单管理员 MVP · 所有关键操作保留审计记录</span>
        </div>

        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          size="large"
          @keyup.enter="login"
        >
          <el-form-item prop="email">
            <el-input
              v-model="form.email"
              placeholder="管理员邮箱"
              :prefix-icon="Mail"
            />
          </el-form-item>
          <el-form-item prop="password">
            <el-input
              v-model="form.password"
              type="password"
              show-password
              placeholder="密码"
              :prefix-icon="LockKeyhole"
            />
          </el-form-item>
          <el-button
            class="login-button"
            type="primary"
            :loading="loading"
            @click="login"
          >
            进入控制台
            <IconifyIconOffline :icon="ArrowRight" />
          </el-button>
        </el-form>

        <div class="security-note">
          <IconifyIconOffline :icon="ShieldCheck" />
          <span>访问令牌短期有效，刷新令牌会自动轮换。</span>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.login-shell {
  display: grid;
  min-height: 100vh;
  grid-template-columns: minmax(440px, 1.08fr) minmax(420px, 0.92fr);
  background: var(--fa-background);
}

.login-story {
  position: relative;
  display: flex;
  min-height: 100vh;
  padding: clamp(34px, 5vw, 76px);
  overflow: hidden;
  color: oklch(0.96 0.01 180);
  background: oklch(0.27 0.055 187);
  flex-direction: column;
  justify-content: space-between;
}

.login-story::after {
  position: absolute;
  right: -10%;
  bottom: -18%;
  width: 62%;
  aspect-ratio: 1;
  background: oklch(0.68 0.11 175 / 18%);
  border: 1px solid oklch(0.82 0.08 175 / 20%);
  border-radius: 48% 52% 42% 58%;
  content: "";
  transform: rotate(-18deg);
}

.story-grid {
  position: absolute;
  inset: 0;
  opacity: 0.12;
  background-image:
    linear-gradient(oklch(0.9 0.02 180 / 24%) 1px, transparent 1px),
    linear-gradient(90deg, oklch(0.9 0.02 180 / 24%) 1px, transparent 1px);
  background-size: 44px 44px;
  mask-image: linear-gradient(to bottom right, black, transparent 78%);
}

.brand-lockup,
.mobile-brand {
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 15px;
  font-weight: 740;
  letter-spacing: 0.02em;
}

.brand-mark {
  display: grid;
  width: 40px;
  height: 40px;
  color: oklch(0.29 0.06 187);
  background: var(--fa-accent);
  border-radius: 13px;
  place-items: center;
}

.story-copy {
  z-index: 1;
  max-width: 670px;
}

.story-kicker {
  margin-bottom: 22px !important;
  color: oklch(0.82 0.09 175);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.story-copy h1 {
  margin: 0;
  font-size: clamp(46px, 6vw, 82px);
  font-weight: 730;
  letter-spacing: -0.065em;
  line-height: 0.99;
}

.story-copy > p:last-child {
  max-width: 560px;
  margin: 28px 0 0;
  color: oklch(0.82 0.02 185);
  font-size: 16px;
  line-height: 1.85;
}

.story-flow {
  z-index: 1;
  display: flex;
  align-items: center;
  width: min(100%, 520px);
  gap: 16px;
}

.story-flow > div {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 13px;
  font-weight: 650;
  white-space: nowrap;
}

.flow-line {
  width: 100%;
  height: 1px;
  background: linear-gradient(90deg, oklch(0.8 0.08 175 / 60%), transparent);
}

.login-form-panel {
  display: grid;
  padding: 32px;
  place-items: center;
}

.login-form-wrap {
  width: min(100%, 430px);
}

.mobile-brand {
  display: none;
  margin-bottom: 46px;
}

.form-heading p {
  margin: 0 0 10px;
  color: var(--fa-primary);
  font-size: 12px;
  font-weight: 760;
  letter-spacing: 0.12em;
}

.form-heading h2 {
  margin: 0;
  font-size: clamp(29px, 3vw, 42px);
  font-weight: 750;
  letter-spacing: -0.045em;
  line-height: 1.15;
}

.form-heading > span {
  display: block;
  margin: 13px 0 34px;
  color: var(--fa-muted-foreground);
  font-size: 13px;
}

.login-form-wrap :deep(.el-input__wrapper) {
  min-height: 52px;
  padding: 0 15px;
  background: var(--fa-card);
  border-radius: 13px;
  box-shadow: 0 0 0 1px var(--fa-border) inset;
}

.login-form-wrap :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 2px var(--fa-ring) inset;
}

.login-button {
  display: flex;
  width: 100%;
  height: 52px;
  margin-top: 8px;
  border-radius: 13px;
  font-size: 15px;
  font-weight: 700;
  gap: 9px;
}

.security-note {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 22px;
  color: var(--fa-muted-foreground);
  font-size: 12px;
}

.security-note svg {
  color: var(--fa-success);
}

@media (width <= 900px) {
  .login-shell {
    display: block;
  }

  .login-story {
    display: none;
  }

  .login-form-panel {
    min-height: 100vh;
    padding: 24px;
  }

  .mobile-brand {
    display: flex;
  }
}
</style>
