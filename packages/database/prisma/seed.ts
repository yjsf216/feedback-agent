import { hash } from "argon2";

import { prisma } from "../src";

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "change-me-now";

  await prisma.adminUser.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      name: "系统管理员",
      passwordHash: await hash(adminPassword),
    },
    update: {},
  });

  await prisma.app.upsert({
    where: { slug: "demo" },
    create: {
      slug: "demo",
      name: "示例应用",
      authConfig: { create: { allowGuest: true, allowEmail: false } },
      modelConfig: { create: {} },
      suggestedQuestionsZh: ["如何提交产品建议？", "我的问题没有解决怎么办？"],
      suggestedQuestionsEn: ["How do I submit product feedback?", "What if my issue is unresolved?"],
    },
    update: {},
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
