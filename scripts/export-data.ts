/**
 * Export legislation data from the source database
 * 
 * Usage: DATABASE_URL=<source_db_url> npx tsx scripts/export-data.ts
 * 
 * This exports all legislation-related tables to JSON files that can be
 * imported into a new database.
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

async function exportData() {
  const exportDir = path.join(process.cwd(), "data-export");
  
  // Create export directory
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  console.log("Exporting legislation data...\n");

  // Export LegiSession
  console.log("Exporting sessions...");
  const sessions = await prisma.legiSession.findMany();
  fs.writeFileSync(
    path.join(exportDir, "sessions.json"),
    JSON.stringify(sessions, null, 2)
  );
  console.log(`  Exported ${sessions.length} sessions`);

  // Export LegiPerson (legislators)
  console.log("Exporting legislators...");
  const legislators = await prisma.legiPerson.findMany();
  fs.writeFileSync(
    path.join(exportDir, "legislators.json"),
    JSON.stringify(legislators, null, 2)
  );
  console.log(`  Exported ${legislators.length} legislators`);

  // Export LegiBill
  console.log("Exporting bills...");
  const bills = await prisma.legiBill.findMany();
  fs.writeFileSync(
    path.join(exportDir, "bills.json"),
    JSON.stringify(bills, null, 2)
  );
  console.log(`  Exported ${bills.length} bills`);

  // Export LegiBillSponsor
  console.log("Exporting sponsors...");
  const sponsors = await prisma.legiBillSponsor.findMany();
  fs.writeFileSync(
    path.join(exportDir, "sponsors.json"),
    JSON.stringify(sponsors, null, 2)
  );
  console.log(`  Exported ${sponsors.length} sponsor records`);

  // Export LegiRollCall
  console.log("Exporting roll calls...");
  const rollCalls = await prisma.legiRollCall.findMany();
  fs.writeFileSync(
    path.join(exportDir, "rollcalls.json"),
    JSON.stringify(rollCalls, null, 2)
  );
  console.log(`  Exported ${rollCalls.length} roll calls`);

  // Export LegiVoteRecord
  console.log("Exporting vote records...");
  const voteRecords = await prisma.legiVoteRecord.findMany();
  fs.writeFileSync(
    path.join(exportDir, "votes.json"),
    JSON.stringify(voteRecords, null, 2)
  );
  console.log(`  Exported ${voteRecords.length} vote records`);

  console.log(`\nData exported to: ${exportDir}`);
  console.log("\nTo import into new database:");
  console.log("  1. Set DATABASE_URL to the new database");
  console.log("  2. Run: npx prisma migrate dev");
  console.log("  3. Run: npx tsx scripts/import-data.ts");
}

exportData()
  .catch((e) => {
    console.error("Export failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
