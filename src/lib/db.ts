import { PrismaClient } from "@prisma/client";

// Ein PrismaClient pro Prozess (Next.js Hot-Reload sicher).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.APP_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.APP_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
