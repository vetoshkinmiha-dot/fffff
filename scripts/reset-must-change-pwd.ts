import { prisma } from "../lib/prisma";

async function main() {
  await prisma.user.updateMany({ data: { mustChangePwd: false } });
  console.log("Reset mustChangePwd for all users");
}

main().then(() => prisma.$disconnect()).catch(() => prisma.$disconnect());
