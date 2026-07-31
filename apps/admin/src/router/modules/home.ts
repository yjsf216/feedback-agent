const { VITE_HIDE_HOME } = import.meta.env;
const Layout = () => import("@/layout/index.vue");
import LayoutDashboard from "~icons/lucide/layout-dashboard";

export default {
  path: "/",
  name: "Home",
  component: Layout,
  redirect: "/dashboard",
  meta: {
    icon: LayoutDashboard,
    title: "工作台",
    rank: 0
  },
  children: [
    {
      path: "/dashboard",
      name: "Dashboard",
      component: () => import("@/views/dashboard/index.vue"),
      meta: {
        title: "工作台",
        showLink: VITE_HIDE_HOME === "true" ? false : true
      }
    }
  ]
} satisfies RouteConfigsTable;
