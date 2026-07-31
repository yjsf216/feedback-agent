import Settings2 from "~icons/lucide/settings-2";
import Boxes from "~icons/lucide/boxes";
import BrainCircuit from "~icons/lucide/brain-circuit";

const Layout = () => import("@/layout/index.vue");

export default {
  path: "/settings",
  name: "Settings",
  component: Layout,
  redirect: "/apps",
  meta: { icon: Settings2, title: "平台设置", rank: 3 },
  children: [
    {
      path: "/apps",
      name: "Apps",
      component: () => import("@/views/apps/index.vue"),
      meta: { icon: Boxes, title: "应用管理" }
    },
    {
      path: "/model-settings",
      name: "ModelSettings",
      component: () => import("@/views/model-settings/index.vue"),
      meta: { icon: BrainCircuit, title: "模型配置" }
    }
  ]
} satisfies RouteConfigsTable;
