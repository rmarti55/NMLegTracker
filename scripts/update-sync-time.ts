#!/usr/bin/env npx tsx
/**
 * Update the session's datasetDate to mark when data was last synced
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.legiSession.updateMany({
    where: { state: "NM", yearStart: 2026 },
    data: { datasetDate: new Date() }
  });
  
  console.log(`Updated ${result.count} session(s) datasetDate to now`);
  
  const session = await prisma.legiSession.findFirst({ 
    where: { state: "NM", yearStart: 2026 }
  });
  console.log("New datasetDate:", session?.datasetDate);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
