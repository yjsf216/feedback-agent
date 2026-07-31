import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var feedbackAgentPrisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.feedbackAgentPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.feedbackAgentPrisma = prisma;
}

export * from "@prisma/client";
