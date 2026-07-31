<script setup lang="ts">
import { useRouter } from "vue-router";
import Boxes from "~icons/lucide/boxes";
import ArrowRight from "~icons/lucide/arrow-right";

defineProps<{
  title?: string;
  description?: string;
}>();

const router = useRouter();
</script>

<template>
  <div class="fa-card scope-required">
    <div class="scope-mark"><IconifyIconOffline :icon="Boxes" /></div>
    <div>
      <strong>{{ title ?? "请先选择一个应用" }}</strong>
      <p>
        {{
          description ??
          "此页面的数据和操作属于具体应用，请在顶部切换应用后继续。"
        }}
      </p>
    </div>
    <el-button text type="primary" @click="router.push('/apps')">
      管理应用 <IconifyIconOffline :icon="ArrowRight" />
    </el-button>
  </div>
</template>

<style scoped>
.scope-required {
  display: grid;
  min-height: 320px;
  padding: 44px;
  text-align: center;
  place-items: center;
  align-content: center;
  gap: 18px;
}

.scope-mark {
  display: grid;
  width: 58px;
  height: 58px;
  color: var(--fa-primary);
  background: oklch(0.93 0.04 177);
  border-radius: 18px;
  place-items: center;
}

.scope-mark svg {
  width: 25px;
  height: 25px;
}

strong {
  font-size: 19px;
}

p {
  max-width: 460px;
  margin: 7px auto 0;
  color: var(--fa-muted-foreground);
  line-height: 1.7;
}
</style>
