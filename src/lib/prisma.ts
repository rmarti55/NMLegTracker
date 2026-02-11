/**
 * Prisma Client Singleton
 *
 * Creates and exports a single Prisma client instance for database access.
 * In development, the client is cached on globalThis to prevent multiple
 * instances during hot reloading.
 *
 * @module lib/prisma
 */

import { PrismaClient } from "@prisma/client";

/**
 * Global type declaration for caching Prisma client in development.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Prisma client instance for database operations.
 *
 * Usage:
 * ```typescript
 * import { prisma } from "@/lib/prisma";
 *
 * const bills = await prisma.legiBill.findMany();
 * ```
 *
 * @see https://www.prisma.io/docs/concepts/components/prisma-client
 */
export const prisma = globalForPrisma.prisma ?? new PrismaClient();

// Cache the client in development to prevent multiple instances
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
