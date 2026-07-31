import { Bot } from "lucide-react";

export default function LoadingFeedback() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading feedback"
      style={{
        display: "grid",
        minHeight: "100vh",
        placeItems: "center",
        background: "var(--background)",
      }}
    >
      <span
        style={{
          display: "grid",
          width: 64,
          height: 64,
          color: "oklch(0.98 0.005 175)",
          background: "var(--primary)",
          borderRadius: 20,
          placeItems: "center",
        }}
      >
        <Bot aria-hidden="true" />
      </span>
    </main>
  );
}
