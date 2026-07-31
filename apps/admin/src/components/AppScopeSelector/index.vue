<script setup lang="ts">
import { onMounted } from "vue";
import { storeToRefs } from "pinia";
import { useRoute, useRouter } from "vue-router";
import { ALL_APPS_SCOPE } from "@/config/app-scope";
import { useAppScopeStore } from "@/store/modules/appScope";
import Layers from "~icons/lucide/layers-3";
import Plus from "~icons/lucide/plus";

const CREATE_APP_VALUE = "__create_app__";
const scope = useAppScopeStore();
const { apps, selectedAppId, loading } = storeToRefs(scope);
const route = useRoute();
const router = useRouter();

async function handleChange(value: string) {
  if (value === CREATE_APP_VALUE) {
    await router.push({ path: "/apps", query: { create: "1" } });
    return;
  }
  scope.select(value);
  const query = { ...route.query };
  if (value === ALL_APPS_SCOPE) delete query.appId;
  else query.appId = value;
  await router.replace({ query });
}

onMounted(async () => {
  await scope.loadApps();
  const routeAppId =
    typeof route.query.appId === "string" ? route.query.appId : "";
  if (routeAppId && apps.value.some(app => app.id === routeAppId)) {
    scope.select(routeAppId);
  }
});
</script>

<template>
  <div class="app-scope-selector">
    <IconifyIconOffline :icon="Layers" class="scope-icon" />
    <el-select
      :model-value="selectedAppId"
      :loading="loading"
      class="scope-select"
      popper-class="scope-select-popper"
      @change="handleChange"
    >
      <el-option label="全部应用" :value="ALL_APPS_SCOPE" />
      <el-option
        v-for="app in apps"
        :key="app.id"
        :label="app.name"
        :value="app.id"
      >
        <div class="scope-option">
          <span class="scope-dot" :style="{ background: app.primaryColor }" />
          <span>{{ app.name }}</span>
          <span v-if="app.status === 'DISABLED'" class="scope-disabled"
            >已停用</span
          >
        </div>
      </el-option>
      <el-option label="增加新的 App" :value="CREATE_APP_VALUE">
        <div class="scope-option scope-create">
          <IconifyIconOffline :icon="Plus" />
          <span>增加新的 App</span>
        </div>
      </el-option>
    </el-select>
  </div>
</template>

<style scoped>
.app-scope-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 220px;
  padding: 0 12px;
  border-right: 1px solid var(--fa-border);
}

.scope-icon {
  flex: none;
  color: var(--fa-primary);
}

.scope-select {
  width: 178px;
}

.scope-select :deep(.el-select__wrapper) {
  min-height: 34px;
  background: var(--fa-muted);
  border-radius: 10px;
  box-shadow: none;
}

.scope-option {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
}

.scope-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
}

.scope-disabled {
  margin-left: auto;
  color: var(--fa-muted-foreground);
  font-size: 11px;
}

.scope-create {
  color: var(--fa-primary);
  font-weight: 650;
}

@media (width <= 720px) {
  .app-scope-selector {
    min-width: 0;
    padding: 0 6px;
    border-right: 0;
  }

  .scope-icon {
    display: none;
  }

  .scope-select {
    width: 136px;
  }
}
</style>
