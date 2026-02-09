/**
 * Import legislation data into the new database
 * 
 * Usage: DATABASE_URL=<new_db_url> npx tsx scripts/import-data.ts
 * 
 * Prerequisites:
 *   1. Run prisma migrate dev first to create tables
 *   2. Have data-export/ directory with JSON files from export-data.ts
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

async function importData() {
  const exportDir = path.join(process.cwd(), "data-export");
  
  if (!fs.existsSync(exportDir)) {
    console.error("Error: data-export/ directory not found");
    console.error("Run export-data.ts first to export data from source database");
    process.exit(1);
  }

  console.log("Importing legislation data...\n");

  // Import LegiSession
  console.log("Importing sessions...");
  const sessionsFile = path.join(exportDir, "sessions.json");
  if (fs.existsSync(sessionsFile)) {
    const sessions = JSON.parse(fs.readFileSync(sessionsFile, "utf-8"));
    for (const session of sessions) {
      await prisma.legiSession.upsert({
        where: { id: session.id },
        update: session,
        create: session,
      });
    }
    console.log(`  Imported ${sessions.length} sessions`);
  }

  // Import LegiPerson (legislators)
  console.log("Importing legislators...");
  const legislatorsFile = path.join(exportDir, "legislators.json");
  if (fs.existsSync(legislatorsFile)) {
    const legislators = JSON.parse(fs.readFileSync(legislatorsFile, "utf-8"));
    for (const legislator of legislators) {
      await prisma.legiPerson.upsert({
        where: { id: legislator.id },
        update: legislator,
        create: legislator,
      });
    }
    console.log(`  Imported ${legislators.length} legislators`);
  }

  // Import LegiBill
  console.log("Importing bills...");
  const billsFile = path.join(exportDir, "bills.json");
  if (fs.existsSync(billsFile)) {
    const bills = JSON.parse(fs.readFileSync(billsFile, "utf-8"));
    for (const bill of bills) {
      await prisma.legiBill.upsert({
        where: { id: bill.id },
        update: bill,
        create: bill,
      });
    }
    console.log(`  Imported ${bills.length} bills`);
  }

  // Import LegiBillSponsor
  console.log("Importing sponsors...");
  const sponsorsFile = path.join(exportDir, "sponsors.json");
  if (fs.existsSync(sponsorsFile)) {
    const sponsors = JSON.parse(fs.readFileSync(sponsorsFile, "utf-8"));
    for (const sponsor of sponsors) {
      await prisma.legiBillSponsor.upsert({
        where: { id: sponsor.id },
        update: sponsor,
        create: sponsor,
      });
    }
    console.log(`  Imported ${sponsors.length} sponsor records`);
  }

  // Import LegiRollCall
  console.log("Importing roll calls...");
  const rollCallsFile = path.join(exportDir, "rollcalls.json");
  if (fs.existsSync(rollCallsFile)) {
    const rollCalls = JSON.parse(fs.readFileSync(rollCallsFile, "utf-8"));
    for (const rollCall of rollCalls) {
      await prisma.legiRollCall.upsert({
        where: { id: rollCall.id },
        update: rollCall,
        create: rollCall,
      });
    }
    console.log(`  Imported ${rollCalls.length} roll calls`);
  }

  // Import LegiVoteRecord
  console.log("Importing vote records...");
  const votesFile = path.join(exportDir, "votes.json");
  if (fs.existsSync(votesFile)) {
    const voteRecords = JSON.parse(fs.readFileSync(votesFile, "utf-8"));
    for (const vote of voteRecords) {
      await prisma.legiVoteRecord.upsert({
        where: { id: vote.id },
        update: vote,
        create: vote,
      });
    }
    console.log(`  Imported ${voteRecords.length} vote records`);
  }

  console.log("\nImport complete!");
}

importData()
  .catch((e) => {
    console.error("Import failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
