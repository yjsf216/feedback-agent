import { defineStore } from "pinia";
import { api, type AppSummary } from "@/api/feedback";
import { store } from "../utils";
import { ALL_APPS_SCOPE, APP_SCOPE_STORAGE_KEY } from "@/config/app-scope";

type ScopeState = {
  apps: AppSummary[];
  selectedAppId: string;
  loading: boolean;
  loaded: boolean;
};

export const useAppScopeStore = defineStore("feedback-app-scope", {
  state: (): ScopeState => ({
    apps: [],
    selectedAppId:
      window.localStorage.getItem(APP_SCOPE_STORAGE_KEY) || ALL_APPS_SCOPE,
    loading: false,
    loaded: false
  }),
  getters: {
    selectedApp(state) {
      return state.apps.find(app => app.id === state.selectedAppId) ?? null;
    },
    isAllApps(state) {
      return state.selectedAppId === ALL_APPS_SCOPE;
    }
  },
  actions: {
    select(appId: string) {
      this.selectedAppId = appId;
      window.localStorage.setItem(APP_SCOPE_STORAGE_KEY, appId);
    },
    async loadApps(force = false) {
      if ((this.loaded && !force) || this.loading) return;
      this.loading = true;
      try {
        this.apps = await api.apps.list();
        if (
          this.selectedAppId !== ALL_APPS_SCOPE &&
          !this.apps.some(app => app.id === this.selectedAppId)
        ) {
          this.select(ALL_APPS_SCOPE);
        }
        this.loaded = true;
      } finally {
        this.loading = false;
      }
    }
  }
});

export function useAppScopeStoreHook() {
  return useAppScopeStore(store);
}
