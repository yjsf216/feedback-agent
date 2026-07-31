import Library from "~icons/lucide/library";
import BookOpenText from "~icons/lucide/book-open-text";
import ChartNoAxesCombined from "~icons/lucide/chart-no-axes-combined";

const Layout = () => import("@/layout/index.vue");

export default {
  path: "/intelligence",
  name: "Intelligence",
  component: Layout,
  redirect: "/knowledge",
  meta: { icon: Library, title: "智能资产", rank: 2 },
  children: [
    {
      path: "/knowledge",
      name: "Knowledge",
      component: () => import("@/views/knowledge/index.vue"),
      meta: { icon: BookOpenText, title: "知识库" }
    },
    {
      path: "/reports",
      name: "Reports",
      component: () => import("@/views/reports/index.vue"),
      meta: { icon: ChartNoAxesCombined, title: "分析报告" }
    }
  ]
} satisfies RouteConfigsTable;
