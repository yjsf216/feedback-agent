import MessagesSquare from "~icons/lucide/messages-square";
import MessageCircleWarning from "~icons/lucide/message-circle-warning";
import Inbox from "~icons/lucide/inbox";
import ListTodo from "~icons/lucide/list-todo";
import Tags from "~icons/lucide/tags";

const Layout = () => import("@/layout/index.vue");

export default {
  path: "/feedback-center",
  name: "FeedbackCenter",
  component: Layout,
  redirect: "/conversations",
  meta: { icon: MessagesSquare, title: "反馈中心", rank: 1 },
  children: [
    {
      path: "/conversations",
      name: "Conversations",
      component: () => import("@/views/conversations/index.vue"),
      meta: { icon: Inbox, title: "对话记录" }
    },
    {
      path: "/unresolved",
      name: "Unresolved",
      component: () => import("@/views/unresolved/index.vue"),
      meta: { icon: MessageCircleWarning, title: "未解决队列" }
    },
    {
      path: "/feedback",
      name: "Feedback",
      component: () => import("@/views/feedback/index.vue"),
      meta: { icon: Tags, title: "反馈明细" }
    },
    {
      path: "/requirements",
      name: "Requirements",
      component: () => import("@/views/requirements/index.vue"),
      meta: { icon: ListTodo, title: "需求池" }
    }
  ]
} satisfies RouteConfigsTable;
