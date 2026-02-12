#!/usr/bin/env npx tsx
/**
 * Import nmlegis JSON to Database
 * 
 * Primary data import script for New Mexico legislation data.
 * Imports data from Ed Santiago's nmlegis Perl scripts:
 *   - legislators.json - Legislator data
 *   - bills-YYYY.json - Bill data with sponsors
 *   - floor-votes-YYYY.json - Floor vote records
 *   - committee-reports-YYYY.json - Committee vote records
 * 
 * Usage: npx tsx scripts/import-nmlegis-json.ts [--dry-run] [--verbose]
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "@prisma/client";
import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import "dotenv/config";
import { convertActionsToHistoryArray, getCommitteeMeaning } from "../src/lib/legislative-codes";

// Initialize Prisma client
function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

const prisma = createPrismaClient();

// Configuration
const NMLEGIS_DATA_DIR = join(homedir(), ".local/share/nmlegis");
const CURRENT_YEAR = 2026;
const SESSION_NAME = "2026 Regular Session";
// Session start date for calculating actual dates from legislative days
// The 2026 Regular Session starts January 21, 2026
const SESSION_START_DATE = new Date("2026-01-21");

// Interfaces for nmlegis JSON format
interface NmlegisLegislator {
  id: string;        // Sponsor code like "HSZCZ"
  name: string;      // Full name like "Reena Szczepanski"
  firstname: string;
  lastname: string;
  party: string;     // "R" or "D"
  chamber: string;   // "H" or "S"
  district: string;  // "1", "2", etc.
  email?: string;
  "office phone"?: string;
  "office room number"?: string;
  occupation?: string;
  county?: string;
  service?: string;
}

// Detailed history item from nmlegis bill page (with actual calendar dates)
interface DetailedHistoryItem {
  legislative_day: number;
  calendar_day: string;  // YYYY-MM-DD format
  action: string;
}

interface NmlegisBill {
  title: string;
  actions: string;
  sponsors: string[];  // Array of sponsor codes like ["HSZCZ", "HHEPA"]
  emergency?: string;  // "*" if emergency
  detailed_history?: DetailedHistoryItem[];  // New: actual dates from bill page
}

interface NmlegisBillsJson {
  H: { [type: string]: { [num: string]: NmlegisBill } };
  S: { [type: string]: { [num: string]: NmlegisBill } };
  _schema?: string;
}

interface NmlegisLegislatorsJson {
  H: (NmlegisLegislator | null)[];  // Index 0 is null, index 1 is district 1, etc.
  S: (NmlegisLegislator | null)[];
}

// Floor vote structure from nmlegis-parse-floor-votes
interface FloorVote {
  date: string;        // "2026-01-28"
  yes?: string[];      // Legislator codes: ["H001", "H002", ...]
  no?: string[];
  excused?: string[];
  absent?: string[];
  rollcall?: string;   // URL to PDF
}

interface FloorVotesJson {
  schema: string;
  session: number;
  votes: {
    [billCode: string]: {
      [chamber: string]: FloorVote;  // "H" or "S"
    };
  };
}

// Committee report structure from nmlegis-parse-committee-reports
interface CommitteeVote {
  date: string;
  votes?: {
    yes?: string[];
    no?: string[];
    excused?: string[];
    absent?: string[];
  };
  report?: string;  // URL to HTML
  cs?: string;      // Committee substitute URL
}

interface CommitteeReportsJson {
  schema: string;
  session: string;
  reports: {
    [billCode: string]: {
      [committee: string]: (CommitteeVote | null)[];  // Array indexed by report number
    };
  };
}

// Committee member from committees.json
interface NmlegisCommitteeMember {
  code: string;     // Sponsor code like "SHAMB"
  title: string;    // "Senator"
  name: string;     // Full name
  district: string; // "38"
  party: string;    // "D" or "R"
  role: string;     // "Chair", "Vice Chair", "Ranking Member", "Member"
}

// Committee structure from committees.json
interface NmlegisCommittee {
  abbr: string;        // "STBTC"
  chamber: string;     // "H" or "S"
  name: string;        // Full committee name
  room?: string;       // Default meeting room
  time?: string;       // Default meeting time
  days?: string;       // Meeting days like "Tuesday & Thursday"
  days_parsed?: string[];
  url?: string;        // nmlegis committee page URL
  members: NmlegisCommitteeMember[];
}

interface NmlegisCommitteesJson {
  _schema?: string;
  [code: string]: NmlegisCommittee | string | undefined;
}

// Schedule/hearing structure from schedule.json
interface NmlegisHearing {
  name: string;        // Committee code or "House"/"Senate" for floor
  date: string;        // YYYY-MM-DD
  time?: string;       // Human-readable time
  datetime?: string;   // ISO datetime
  room?: string;
  zoom?: string;       // Zoom link
  url?: string;        // Source PDF URL
  urls?: string[];     // Multiple source URLs (for supplementals)
  mtime?: string;      // Modification time
  bills?: string[];    // Bill codes like ["SB251", "HB123"]
  billh?: string[];    // Bills from HTML source (alternative)
  cancelled?: boolean; // If meeting was cancelled
  isFloor?: boolean;   // If this is a floor session
}

interface NmlegisScheduleJson {
  _schema?: string;
  [date: string]: {
    [time: string]: {
      [committee: string]: NmlegisHearing;
    };
  } | string | undefined;
}

/**
 * Load JSON file
 */
function loadJson<T>(filename: string): T | null {
  const filepath = join(NMLEGIS_DATA_DIR, filename);
  if (!existsSync(filepath)) {
    console.error(`File not found: ${filepath}`);
    return null;
  }
  const content = readFileSync(filepath, "utf-8");
  return JSON.parse(content) as T;
}

/**
 * Get or create session
 */
async function getOrCreateSession(): Promise<string> {
  let session = await prisma.legiSession.findFirst({
    where: { yearStart: CURRENT_YEAR, state: "NM" },
  });

  if (!session) {
    console.log("Creating new session...");
    session = await prisma.legiSession.create({
      data: {
        sessionId: CURRENT_YEAR * 100 + 1,
        stateId: 32,
        state: "NM",
        yearStart: CURRENT_YEAR,
        yearEnd: CURRENT_YEAR,
        sessionName: SESSION_NAME,
      },
    });
  }

  return session.id;
}

/**
 * Build sponsor code to person ID map
 */
async function buildSponsorMap(
  legislators: NmlegisLegislatorsJson,
  dryRun: boolean,
  verbose: boolean
): Promise<Map<string, string>> {
  const sponsorMap = new Map<string, string>();
  
  // Process House legislators
  for (const leg of legislators.H) {
    if (!leg) continue;
    const personId = await upsertLegislator(leg, "H", dryRun, verbose);
    if (personId) {
      // Use the legislator's ID (sponsor code) as the key
      sponsorMap.set(leg.id, personId);
    }
  }
  
  // Process Senate legislators
  for (const leg of legislators.S) {
    if (!leg) continue;
    const personId = await upsertLegislator(leg, "S", dryRun, verbose);
    if (personId) {
      sponsorMap.set(leg.id, personId);
    }
  }
  
  return sponsorMap;
}

/**
 * Update sponsor links for existing bills that don't have them
 */
async function updateBillSponsors(
  bills: NmlegisBillsJson,
  sessionId: string,
  sponsorMap: Map<string, string>,
  dryRun: boolean,
  verbose: boolean
): Promise<number> {
  let updated = 0;
  
  // Get all bills without sponsors
  const billsWithoutSponsors = await prisma.legiBill.findMany({
    where: { 
      sessionId,
      sponsors: { none: {} } 
    },
    select: { id: true, billNumber: true }
  });
  
  for (const bill of billsWithoutSponsors) {
    // Parse bill number
    const match = bill.billNumber.match(/^([HS])([A-Z]*)(\d+)$/);
    if (!match) continue;
    
    const [, chamber, type, numStr] = match;
    const num = parseInt(numStr, 10);
    
    // Find in nmlegis JSON
    const billData = bills[chamber as "H" | "S"]?.[type || "B"]?.[num];
    if (!billData?.sponsors?.length) continue;
    
    // Link sponsors
    for (let i = 0; i < billData.sponsors.length; i++) {
      const sponsorCode = billData.sponsors[i];
      const personId = sponsorMap.get(sponsorCode);
      
      if (personId && !dryRun) {
        try {
          await prisma.legiBillSponsor.create({
            data: {
              billId: bill.id,
              personId,
              sponsorType: i === 0 ? 1 : 2,
              sponsorOrder: i + 1,
            },
          });
          updated++;
          if (verbose) {
            console.log(`  Linked ${sponsorCode} to ${bill.billNumber}`);
          }
        } catch {
          // Ignore duplicates
        }
      }
    }
  }
  
  return updated;
}

/**
 * Build a map from legislator codes (H001, S045) to person database IDs.
 * This is used for vote imports.
 */
async function buildLegislatorCodeMap(): Promise<Map<string, string>> {
  const codeMap = new Map<string, string>();
  
  const legislators = await prisma.legiPerson.findMany({
    select: { id: true, role: true, district: true },
  });
  
  for (const leg of legislators) {
    // Convert district format (HD-001 -> H001, SD-45 -> S045)
    if (leg.district.startsWith("HD-")) {
      const distNum = parseInt(leg.district.slice(3), 10);
      const code = `H${distNum.toString().padStart(3, "0")}`;
      codeMap.set(code, leg.id);
    } else if (leg.district.startsWith("SD-")) {
      const distNum = parseInt(leg.district.slice(3), 10);
      const code = `S${distNum.toString().padStart(3, "0")}`;
      codeMap.set(code, leg.id);
    }
  }
  
  return codeMap;
}

/**
 * Import floor votes from nmlegis JSON
 */
async function importFloorVotes(
  floorVotes: FloorVotesJson,
  sessionId: string,
  codeMap: Map<string, string>,
  dryRun: boolean,
  verbose: boolean
): Promise<{ newCount: number; voteRecords: number; errorCount: number }> {
  let newCount = 0;
  let voteRecords = 0;
  let errorCount = 0;
  
  for (const [billCode, chambers] of Object.entries(floorVotes.votes || {})) {
    for (const [chamber, vote] of Object.entries(chambers)) {
      try {
        // Find the bill
        const bill = await prisma.legiBill.findFirst({
          where: { billNumber: billCode, sessionId },
        });
        
        if (!bill) {
          if (verbose) {
            console.log(`  Skipping floor vote for ${billCode}: bill not found`);
          }
          continue;
        }
        
        // Generate synthetic rollCallId: YYYY + chamber code + bill type code + bill number
        const typeCode: Record<string, number> = { B: 1, M: 2, JM: 3, R: 4, JR: 5, CR: 6 };
        const billType = billCode.replace(/^[HS]/, "").replace(/\d+$/, "") || "B";
        const billNum = parseInt(billCode.match(/\d+$/)?.[0] || "0", 10);
        const chamberCode = chamber === "H" ? 1 : 2;
        const rollCallId = CURRENT_YEAR * 100000000 + chamberCode * 10000000 + (typeCode[billType] || 1) * 1000000 + billNum;
        
        // Check if roll call already exists
        const existing = await prisma.legiRollCall.findUnique({
          where: { rollCallId },
        });
        
        if (existing) {
          if (verbose) {
            console.log(`  Floor vote ${billCode}/${chamber} already exists`);
          }
          continue;
        }
        
        // Count votes
        const yeaCount = vote.yes?.length || 0;
        const nayCount = vote.no?.length || 0;
        const excusedCount = vote.excused?.length || 0;
        const absentCount = vote.absent?.length || 0;
        const total = yeaCount + nayCount + excusedCount + absentCount;
        const passed = yeaCount > nayCount;
        
        if (!dryRun) {
          // Create roll call
          const rollCall = await prisma.legiRollCall.create({
            data: {
              rollCallId,
              billId: bill.id,
              date: new Date(vote.date),
              description: `Floor Vote - ${chamber === "H" ? "House" : "Senate"}`,
              chamber,
              yea: yeaCount,
              nay: nayCount,
              nv: 0,
              absent: excusedCount + absentCount,
              total,
              passed,
              url: vote.rollcall || null,
              stateLink: vote.rollcall || null,
            },
          });
          
          // Create individual vote records
          const voteTypes: { field: keyof FloorVote; text: string; id: number }[] = [
            { field: "yes", text: "Yea", id: 1 },
            { field: "no", text: "Nay", id: 2 },
            { field: "excused", text: "Excused", id: 3 },
            { field: "absent", text: "Absent", id: 4 },
          ];
          
          for (const vt of voteTypes) {
            const codes = vote[vt.field] as string[] | undefined;
            if (!codes) continue;
            
            for (const code of codes) {
              const personId = codeMap.get(code);
              if (!personId) {
                if (verbose) {
                  console.log(`    Unknown legislator code: ${code}`);
                }
                continue;
              }
              
              try {
                await prisma.legiVoteRecord.create({
                  data: {
                    rollCallId: rollCall.id,
                    personId,
                    voteId: vt.id,
                    voteText: vt.text,
                  },
                });
                voteRecords++;
              } catch {
                // Ignore duplicates
              }
            }
          }
        }
        
        newCount++;
        if (verbose) {
          console.log(`  Floor vote: ${billCode}/${chamber} (${yeaCount}-${nayCount})`);
        }
      } catch (error) {
        errorCount++;
        if (verbose) {
          console.error(`  Error importing floor vote ${billCode}/${chamber}:`, error);
        }
      }
    }
  }
  
  return { newCount, voteRecords, errorCount };
}

/**
 * Import committee votes from nmlegis JSON
 */
async function importCommitteeVotes(
  committeeReports: CommitteeReportsJson,
  sessionId: string,
  codeMap: Map<string, string>,
  dryRun: boolean,
  verbose: boolean
): Promise<{ newCount: number; voteRecords: number; errorCount: number }> {
  let newCount = 0;
  let voteRecords = 0;
  let errorCount = 0;
  
  for (const [billCode, committees] of Object.entries(committeeReports.reports || {})) {
    for (const [committee, reports] of Object.entries(committees)) {
      for (let reportNum = 0; reportNum < reports.length; reportNum++) {
        const report = reports[reportNum];
        if (!report?.votes) continue;
        
        try {
          // Find the bill
          const bill = await prisma.legiBill.findFirst({
            where: { billNumber: billCode, sessionId },
          });
          
          if (!bill) {
            if (verbose) {
              console.log(`  Skipping committee vote for ${billCode}: bill not found`);
            }
            continue;
          }
          
          // Generate synthetic rollCallId for committee votes
          // Use different range to avoid conflicts with floor votes
          const typeCode: Record<string, number> = { B: 1, M: 2, JM: 3, R: 4, JR: 5, CR: 6 };
          const billType = billCode.replace(/^[HS]/, "").replace(/\d+$/, "") || "B";
          const billNum = parseInt(billCode.match(/\d+$/)?.[0] || "0", 10);
          const committeeHash = committee.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 100;
          const rollCallId = CURRENT_YEAR * 100000000 + 9 * 10000000 + committeeHash * 100000 + (typeCode[billType] || 1) * 10000 + billNum * 10 + reportNum;
          
          // Check if roll call already exists
          const existing = await prisma.legiRollCall.findUnique({
            where: { rollCallId },
          });
          
          if (existing) {
            if (verbose) {
              console.log(`  Committee vote ${billCode}/${committee}#${reportNum} already exists`);
            }
            continue;
          }
          
          // Count votes
          const yeaCount = report.votes.yes?.length || 0;
          const nayCount = report.votes.no?.length || 0;
          const excusedCount = report.votes.excused?.length || 0;
          const absentCount = report.votes.absent?.length || 0;
          const total = yeaCount + nayCount + excusedCount + absentCount;
          const passed = yeaCount > nayCount;
          
          // Determine chamber from committee code
          const chamber = committee.startsWith("H") ? "H" : committee.startsWith("S") ? "S" : "H";
          
          // Get full committee name for human-readable description
          const committeeName = getCommitteeMeaning(committee) || committee;
          
          if (!dryRun) {
            // Create roll call
            const rollCall = await prisma.legiRollCall.create({
              data: {
                rollCallId,
                billId: bill.id,
                date: new Date(report.date),
                description: `${committeeName} Committee Vote`,
                chamber,
                yea: yeaCount,
                nay: nayCount,
                nv: 0,
                absent: excusedCount + absentCount,
                total,
                passed,
                url: report.report || null,
                stateLink: report.report || null,
              },
            });
            
            // Create individual vote records
            const voteTypes: { field: "yes" | "no" | "excused" | "absent"; text: string; id: number }[] = [
              { field: "yes", text: "Yea", id: 1 },
              { field: "no", text: "Nay", id: 2 },
              { field: "excused", text: "Excused", id: 3 },
              { field: "absent", text: "Absent", id: 4 },
            ];
            
            for (const vt of voteTypes) {
              const codes = report.votes[vt.field];
              if (!codes) continue;
              
              for (const code of codes) {
                const personId = codeMap.get(code);
                if (!personId) {
                  if (verbose) {
                    console.log(`    Unknown legislator code: ${code}`);
                  }
                  continue;
                }
                
                try {
                  await prisma.legiVoteRecord.create({
                    data: {
                      rollCallId: rollCall.id,
                      personId,
                      voteId: vt.id,
                      voteText: vt.text,
                    },
                  });
                  voteRecords++;
                } catch {
                  // Ignore duplicates
                }
              }
            }
          }
          
          newCount++;
          if (verbose) {
            console.log(`  Committee vote: ${billCode}/${committee}#${reportNum} (${yeaCount}-${nayCount})`);
          }
        } catch (error) {
          errorCount++;
          if (verbose) {
            console.error(`  Error importing committee vote ${billCode}/${committee}#${reportNum}:`, error);
          }
        }
      }
    }
  }
  
  return { newCount, voteRecords, errorCount };
}

/**
 * Upsert a legislator - matches by lastName + district to avoid duplicates
 * with LegiScan imports (which use different name formats).
 * 
 * This handles variations like:
 *   - "Brian G. Baca" (LegiScan) vs "Brian Baca" (NMLegis)
 *   - "Cathrynn N. Brown" vs "Cathrynn Brown"
 */
async function upsertLegislator(
  leg: NmlegisLegislator,
  chamber: string,
  dryRun: boolean,
  verbose: boolean
): Promise<string | null> {
  const role = chamber === "H" ? "Rep" : "Sen";
  const district = chamber === "H" ? `HD-${leg.district.padStart(3, "0")}` : `SD-${leg.district.padStart(2, "0")}`;
  
  if (verbose) {
    console.log(`  ${leg.id}: ${leg.name} (${leg.party}-${district})`);
  }
  
  if (dryRun) {
    return `dry-run-${leg.id}`;
  }
  
  try {
    // PRIMARY MATCH: lastName + district
    // This is the most reliable match because it handles name format variations
    // e.g., "Brian G. Baca" vs "Brian Baca" both have lastName="Baca"
    let person = await prisma.legiPerson.findFirst({
      where: {
        district,
        role,
        lastName: { equals: leg.lastname, mode: "insensitive" },
      },
    });
    
    if (person) {
      // Found existing legislator (likely from LegiScan import with imageUrl)
      // Only update fields that nmlegis has that LegiScan might not
      // Don't overwrite imageUrl or bio from LegiScan
      if (verbose) {
        console.log(`    Found by lastName+district: ${person.name} (id: ${person.id})`);
      }
      
      // Update email and county if we have them and they don't
      const updates: { email?: string; county?: string } = {};
      if (leg.email && !person.email) {
        updates.email = leg.email;
      }
      if (leg.county && !(person as { county?: string }).county) {
        updates.county = leg.county;
      }
      
      if (Object.keys(updates).length > 0) {
        person = await prisma.legiPerson.update({
          where: { id: person.id },
          data: updates,
        });
      }
      
      return person.id;
    }
    
    // FALLBACK: Try exact name match (shouldn't be needed but just in case)
    person = await prisma.legiPerson.findFirst({
      where: {
        district,
        role,
        name: { equals: leg.name, mode: "insensitive" },
      },
    });
    
    if (person) {
      if (verbose) {
        console.log(`    Found by exact name: ${person.name} (id: ${person.id})`);
      }
      return person.id;
    }
    
    // No match found at all - create new record with synthetic peopleId
    // This should only happen for legislators not in LegiScan
    const syntheticPeopleId = leg.id.split("").reduce((acc, c) => acc * 26 + c.charCodeAt(0), 0) % 1000000;
    
    // Check if this synthetic ID already exists (from previous nmlegis import)
    const existingBySyntheticId = await prisma.legiPerson.findUnique({
      where: { peopleId: syntheticPeopleId },
    });
    
    if (existingBySyntheticId) {
      // Update existing record created by previous nmlegis import
      person = await prisma.legiPerson.update({
        where: { id: existingBySyntheticId.id },
        data: {
          name: leg.name,
          firstName: leg.firstname,
          lastName: leg.lastname,
          party: leg.party,
          role,
          district,
          county: leg.county || (existingBySyntheticId as { county?: string }).county || null,
          email: leg.email || existingBySyntheticId.email,
        },
      });
    } else {
      // Create truly new record
      if (verbose) {
        console.log(`    Creating new legislator (not found in LegiScan)`);
      }
      person = await prisma.legiPerson.create({
        data: {
          peopleId: syntheticPeopleId,
          name: leg.name,
          firstName: leg.firstname,
          lastName: leg.lastname,
          party: leg.party,
          role,
          district,
          county: leg.county || null,
          email: leg.email || null,
        },
      });
    }
    
    return person.id;
  } catch (error) {
    if (verbose) {
      console.error(`    Error upserting ${leg.id}:`, error);
    }
    return null;
  }
}

/**
 * Convert detailed_history (with actual calendar dates) to LegiScan-compatible format
 */
function convertDetailedHistoryToLegiScanFormat(
  detailedHistory: DetailedHistoryItem[],
  chamber: string
): Array<{ date: string; action: string; chamber: number; importance: number; sequence: number }> {
  return detailedHistory.map((item, index) => ({
    date: item.calendar_day, // Already in YYYY-MM-DD format
    action: item.action,
    chamber: chamber === "H" ? 1 : 2,
    importance: 1,
    sequence: index + 1,
  }));
}

/**
 * Parse bill status from actions string
 */
function parseStatus(actions: string): { status: number; currentCommittee: string | null } {
  // Status codes: 1=Intro, 2=Engrossed, 3=Enrolled, 4=Passed, 5=Vetoed, 6=Failed
  
  if (actions.includes("VETO") && !actions.includes("OVERRIDE")) {
    return { status: 5, currentCommittee: null };
  }
  if (actions.includes("SGND BY GOV") || actions.includes("LAW WITHOUT SIGNATURE")) {
    return { status: 4, currentCommittee: null };
  }
  if (actions.includes("FAILED/") || actions.includes("API") || actions.includes("TBLD INDEF")) {
    return { status: 6, currentCommittee: null };
  }
  
  // Check if passed both chambers
  const passedHouse = actions.includes("PASSED/H");
  const passedSenate = actions.includes("PASSED/S");
  
  if (passedHouse && passedSenate) {
    return { status: 3, currentCommittee: null }; // Enrolled
  }
  if (passedHouse || passedSenate) {
    return { status: 2, currentCommittee: null }; // Engrossed
  }
  
  // Extract current committee from actions
  // Look for last committee reference before any terminal state
  let currentCommittee: string | null = null;
  
  // Pattern: committee codes are like HAFC, SJC, HGEIC, etc.
  const committeeMatches = actions.match(/[HS][A-Z]{2,5}/g);
  if (committeeMatches && committeeMatches.length > 0) {
    // Get the last one that isn't a chamber reference
    for (let i = committeeMatches.length - 1; i >= 0; i--) {
      const code = committeeMatches[i];
      if (code.length > 2 && !["HPREF", "SPREF"].includes(code)) {
        currentCommittee = code;
        break;
      }
    }
  }
  
  return { status: 1, currentCommittee }; // Introduced
}

/**
 * Import bills from nmlegis JSON
 */
async function importBills(
  bills: NmlegisBillsJson,
  sessionId: string,
  sponsorMap: Map<string, string>,
  dryRun: boolean,
  verbose: boolean
): Promise<{ newCount: number; updatedCount: number; errorCount: number }> {
  let newCount = 0;
  let updatedCount = 0;
  let errorCount = 0;
  
  // Process each chamber
  for (const chamber of ["H", "S"] as const) {
    const chamberBills = bills[chamber];
    if (!chamberBills) continue;
    
    // Process each bill type
    for (const [type, typeBills] of Object.entries(chamberBills)) {
      // Skip non-bill entries like _schema
      if (type.startsWith("_")) continue;
      
      for (const [numStr, bill] of Object.entries(typeBills)) {
        const num = parseInt(numStr, 10);
        const billNumber = `${chamber}${type}${num}`;
        
        try {
          const { status, currentCommittee } = parseStatus(bill.actions);
          
          // Generate synthetic billId
          const typeCode: Record<string, number> = { B: 1, M: 2, JM: 3, R: 4, JR: 5, CR: 6 };
          const billIdSynthetic = CURRENT_YEAR * 100000 +
            (typeCode[type] || 0) * 10000 +
            (chamber === "S" ? 5000 : 0) +
            num;
          
          // Check if bill exists
          const existing = await prisma.legiBill.findFirst({
            where: { billNumber, sessionId },
          });
          
          // Convert to LegiScan-compatible history array
          // Prefer detailed_history (with actual calendar dates) over calculated dates
          const historyArray = bill.detailed_history && bill.detailed_history.length > 0
            ? convertDetailedHistoryToLegiScanFormat(bill.detailed_history, chamber)
            : convertActionsToHistoryArray(bill.actions, SESSION_START_DATE, chamber);
          
          if (existing) {
            // Update if actions changed - check against raw actions stored in first history item
            // or if history array format is different
            const existingHistory = existing.history;
            const needsUpdate = !Array.isArray(existingHistory) || 
              (existingHistory as { actions?: string })?.actions !== undefined ||
              historyArray.length !== (existingHistory as unknown[])?.length;
            
            if (needsUpdate) {
              if (!dryRun) {
                await prisma.legiBill.update({
                  where: { id: existing.id },
                  data: {
                    title: bill.title,
                    status,
                    statusDate: new Date(),
                    // Store as LegiScan-compatible array format
                    // Cast to satisfy Prisma's Json type
                    history: historyArray as unknown as Prisma.InputJsonValue,
                  },
                });
              }
              if (verbose) {
                console.log(`  Updated: ${billNumber} (${historyArray.length} history items)`);
              }
              updatedCount++;
            }
          } else {
            // Create new bill
            if (!dryRun) {
              const newBill = await prisma.legiBill.create({
                data: {
                  billId: billIdSynthetic,
                  billNumber,
                  billType: type,
                  body: chamber,
                  title: bill.title,
                  description: bill.title,
                  status,
                  statusDate: new Date(),
                  stateLink: `https://www.nmlegis.gov/Legislation/Legislation?Chamber=${chamber}&LegType=${type}&LegNo=${num}&year=${CURRENT_YEAR.toString().slice(-2)}`,
                  sessionId,
                  // Store as LegiScan-compatible array format
                  // Cast to satisfy Prisma's Json type
                  history: historyArray as unknown as Prisma.InputJsonValue,
                },
              });
              
              // Link sponsors
              for (let i = 0; i < bill.sponsors.length; i++) {
                const sponsorCode = bill.sponsors[i];
                const personId = sponsorMap.get(sponsorCode);
                
                if (personId) {
                  try {
                    await prisma.legiBillSponsor.create({
                      data: {
                        billId: newBill.id,
                        personId,
                        sponsorType: i === 0 ? 1 : 2,
                        sponsorOrder: i + 1,
                      },
                    });
                  } catch {
                    // Ignore duplicate errors
                  }
                }
              }
            }
            
            if (verbose) {
              console.log(`  New: ${billNumber} - ${bill.title.slice(0, 50)}...`);
            }
            newCount++;
          }
        } catch (error) {
          errorCount++;
          if (verbose) {
            console.error(`  Error processing ${billNumber}:`, error);
          }
        }
      }
    }
  }
  
  return { newCount, updatedCount, errorCount };
}

/**
 * Import committees from committees.json
 */
async function importCommittees(
  committees: NmlegisCommitteesJson,
  sponsorMap: Map<string, string>,
  dryRun: boolean,
  verbose: boolean
): Promise<{ committees: number; members: number; errorCount: number }> {
  let committeeCount = 0;
  let memberCount = 0;
  let errorCount = 0;

  for (const [code, committee] of Object.entries(committees)) {
    // Skip schema and non-committee entries
    if (code.startsWith("_") || typeof committee === "string" || !committee) continue;

    try {
      if (verbose) {
        console.log(`  ${code}: ${committee.name}`);
      }

      if (!dryRun) {
        // Upsert committee
        const dbCommittee = await prisma.legiCommittee.upsert({
          where: { code },
          create: {
            code,
            name: committee.name,
            chamber: committee.chamber,
            room: committee.room || null,
            meetingDays: committee.days || null,
            meetingTime: committee.time || null,
            url: committee.url || null,
          },
          update: {
            name: committee.name,
            chamber: committee.chamber,
            room: committee.room || null,
            meetingDays: committee.days || null,
            meetingTime: committee.time || null,
            url: committee.url || null,
          },
        });

        committeeCount++;

        // Import committee members
        for (const member of committee.members || []) {
          const personId = sponsorMap.get(member.code);
          if (!personId) {
            if (verbose) {
              console.log(`    Warning: Unknown sponsor code ${member.code} for ${member.name}`);
            }
            continue;
          }

          try {
            await prisma.legiCommitteeMember.upsert({
              where: {
                committeeId_personId: {
                  committeeId: dbCommittee.id,
                  personId,
                },
              },
              create: {
                committeeId: dbCommittee.id,
                personId,
                role: member.role || "Member",
              },
              update: {
                role: member.role || "Member",
              },
            });
            memberCount++;
          } catch (err) {
            if (verbose) {
              console.log(`    Error linking member ${member.code}:`, err);
            }
          }
        }
      } else {
        committeeCount++;
        memberCount += committee.members?.length || 0;
      }
    } catch (error) {
      errorCount++;
      if (verbose) {
        console.error(`  Error importing committee ${code}:`, error);
      }
    }
  }

  return { committees: committeeCount, members: memberCount, errorCount };
}

/**
 * Import schedule/hearings from schedule.json
 */
async function importSchedule(
  schedule: NmlegisScheduleJson,
  sessionId: string,
  dryRun: boolean,
  verbose: boolean
): Promise<{ hearings: number; hearingBills: number; errorCount: number }> {
  let hearingCount = 0;
  let hearingBillCount = 0;
  let errorCount = 0;

  // Build a map of committee codes to database IDs
  const committeeMap = new Map<string, string>();
  const dbCommittees = await prisma.legiCommittee.findMany({
    select: { id: true, code: true },
  });
  for (const c of dbCommittees) {
    committeeMap.set(c.code, c.id);
  }

  // Also handle floor sessions - create pseudo-committees for House and Senate floors
  if (!dryRun) {
    for (const floor of ["House", "Senate"]) {
      const code = floor;
      if (!committeeMap.has(code)) {
        const dbFloor = await prisma.legiCommittee.upsert({
          where: { code },
          create: {
            code,
            name: `${floor} Floor`,
            chamber: floor === "House" ? "H" : "S",
            room: `${floor} Floor`,
          },
          update: {},
        });
        committeeMap.set(code, dbFloor.id);
      }
    }
  }

  // Process each date in the schedule
  for (const [dateStr, times] of Object.entries(schedule)) {
    // Skip schema and non-date entries
    if (dateStr.startsWith("_") || typeof times === "string" || !times) continue;

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;

    for (const [timeStr, committees] of Object.entries(times)) {
      for (const [committeeCode, hearing] of Object.entries(committees)) {
        try {
          const committeeId = committeeMap.get(committeeCode);
          if (!committeeId) {
            if (verbose) {
              console.log(`  Warning: Unknown committee ${committeeCode}, skipping hearing on ${dateStr}`);
            }
            continue;
          }

          // Parse datetime
          let hearingDate: Date;
          if (hearing.datetime) {
            hearingDate = new Date(hearing.datetime);
          } else {
            // Construct from date and time
            hearingDate = new Date(`${dateStr}T${timeStr || "00:00:00"}`);
          }

          // Determine if this is a floor session
          const isFloor = committeeCode === "House" || committeeCode === "Senate";

          // Get bills - prefer 'bills' over 'billh' (HTML source)
          const billCodes = hearing.bills || hearing.billh || [];

          if (verbose) {
            console.log(`  ${committeeCode} ${dateStr} ${hearing.time || timeStr}: ${billCodes.length} bills`);
          }

          if (!dryRun) {
            // Upsert hearing - use committeeId + date as unique key
            const dbHearing = await prisma.legiHearing.upsert({
              where: {
                committeeId_date: {
                  committeeId,
                  date: hearingDate,
                },
              },
              create: {
                committeeId,
                date: hearingDate,
                time: hearing.time || null,
                room: hearing.room || null,
                zoomLink: hearing.zoom || null,
                sourceUrl: hearing.url || null,
                isFloor,
                cancelled: hearing.cancelled || false,
              },
              update: {
                time: hearing.time || null,
                room: hearing.room || null,
                zoomLink: hearing.zoom || null,
                sourceUrl: hearing.url || null,
                isFloor,
                cancelled: hearing.cancelled || false,
              },
            });

            hearingCount++;

            // Link bills to hearing
            for (let i = 0; i < billCodes.length; i++) {
              const billCode = billCodes[i];
              
              // Find the bill in the database
              const bill = await prisma.legiBill.findFirst({
                where: { billNumber: billCode, sessionId },
                select: { id: true },
              });

              if (!bill) {
                if (verbose) {
                  console.log(`    Warning: Bill ${billCode} not found in database`);
                }
                continue;
              }

              try {
                await prisma.legiHearingBill.upsert({
                  where: {
                    hearingId_billId: {
                      hearingId: dbHearing.id,
                      billId: bill.id,
                    },
                  },
                  create: {
                    hearingId: dbHearing.id,
                    billId: bill.id,
                    order: i + 1,
                  },
                  update: {
                    order: i + 1,
                  },
                });
                hearingBillCount++;
              } catch {
                // Ignore duplicate errors
              }
            }
          } else {
            hearingCount++;
            hearingBillCount += billCodes.length;
          }
        } catch (error) {
          errorCount++;
          if (verbose) {
            console.error(`  Error importing hearing ${committeeCode} ${dateStr}:`, error);
          }
        }
      }
    }
  }

  return { hearings: hearingCount, hearingBills: hearingBillCount, errorCount };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const verbose = args.includes("--verbose");
  
  console.log("🏛️  NMLegis JSON Importer");
  console.log("=========================\n");
  
  if (dryRun) {
    console.log("⚠️  DRY RUN MODE - No database changes\n");
  }
  
  // Load JSON files
  console.log(`📂 Loading JSON from ${NMLEGIS_DATA_DIR}...`);
  
  const legislators = loadJson<NmlegisLegislatorsJson>("legislators.json");
  const bills = loadJson<NmlegisBillsJson>(`bills-${CURRENT_YEAR}.json`);
  const floorVotes = loadJson<FloorVotesJson>(`floor-votes-${CURRENT_YEAR}.json`);
  const committeeReports = loadJson<CommitteeReportsJson>(`committee-reports-${CURRENT_YEAR}.json`);
  const committees = loadJson<NmlegisCommitteesJson>("committees.json");
  const schedule = loadJson<NmlegisScheduleJson>("schedule.json");
  
  if (!legislators) {
    console.error("❌ legislators.json not found. Run nmlegis-get-legislators first.");
    await prisma.$disconnect();
    process.exit(1);
  }
  
  if (!bills) {
    console.error(`❌ bills-${CURRENT_YEAR}.json not found. Run nmlegis-get-bills first.`);
    await prisma.$disconnect();
    process.exit(1);
  }
  
  console.log("✅ JSON files loaded");
  console.log(`   - legislators.json: ✓`);
  console.log(`   - bills-${CURRENT_YEAR}.json: ✓`);
  console.log(`   - floor-votes-${CURRENT_YEAR}.json: ${floorVotes ? "✓" : "not found (optional)"}`);
  console.log(`   - committee-reports-${CURRENT_YEAR}.json: ${committeeReports ? "✓" : "not found (optional)"}`);
  console.log(`   - committees.json: ${committees ? "✓" : "not found (optional)"}`);
  console.log(`   - schedule.json: ${schedule ? "✓" : "not found (optional)"}\n`);
  
  // Get/create session
  const sessionId = await getOrCreateSession();
  console.log(`📅 Session: ${SESSION_NAME}\n`);
  
  // Import legislators
  console.log("👥 Importing legislators...");
  const sponsorMap = await buildSponsorMap(legislators, dryRun, verbose);
  console.log(`   ${sponsorMap.size} legislators processed\n`);
  
  // Import bills
  console.log("📜 Importing bills...");
  const result = await importBills(bills, sessionId, sponsorMap, dryRun, verbose);
  
  // Update sponsor links for existing bills
  console.log("\n🔗 Updating sponsor links...");
  const sponsorLinksAdded = await updateBillSponsors(bills, sessionId, sponsorMap, dryRun, verbose);
  console.log(`   ${sponsorLinksAdded} sponsor links added\n`);
  
  // Build legislator code map for vote imports
  console.log("🗺️  Building legislator code map...");
  const codeMap = await buildLegislatorCodeMap();
  console.log(`   ${codeMap.size} legislators mapped\n`);
  
  // Import floor votes
  let floorVoteResult = { newCount: 0, voteRecords: 0, errorCount: 0 };
  if (floorVotes) {
    console.log("🗳️  Importing floor votes...");
    floorVoteResult = await importFloorVotes(floorVotes, sessionId, codeMap, dryRun, verbose);
    console.log(`   ${floorVoteResult.newCount} roll calls, ${floorVoteResult.voteRecords} vote records\n`);
  }
  
  // Import committee votes
  let committeeVoteResult = { newCount: 0, voteRecords: 0, errorCount: 0 };
  if (committeeReports) {
    console.log("📋 Importing committee votes...");
    committeeVoteResult = await importCommitteeVotes(committeeReports, sessionId, codeMap, dryRun, verbose);
    console.log(`   ${committeeVoteResult.newCount} roll calls, ${committeeVoteResult.voteRecords} vote records\n`);
  }

  // Import committees
  let committeeResult = { committees: 0, members: 0, errorCount: 0 };
  if (committees) {
    console.log("🏛️  Importing committees...");
    committeeResult = await importCommittees(committees, sponsorMap, dryRun, verbose);
    console.log(`   ${committeeResult.committees} committees, ${committeeResult.members} members\n`);
  }

  // Import schedule/hearings
  let scheduleResult = { hearings: 0, hearingBills: 0, errorCount: 0 };
  if (schedule) {
    console.log("📅 Importing schedule/hearings...");
    scheduleResult = await importSchedule(schedule, sessionId, dryRun, verbose);
    console.log(`   ${scheduleResult.hearings} hearings, ${scheduleResult.hearingBills} bill assignments\n`);
  }
  
  // Summary
  console.log("=========================");
  console.log("📊 Summary:");
  console.log(`   🆕 New bills: ${result.newCount}`);
  console.log(`   📝 Updated bills: ${result.updatedCount}`);
  console.log(`   🔗 Sponsors linked: ${sponsorLinksAdded}`);
  console.log(`   🗳️  Floor votes: ${floorVoteResult.newCount} (${floorVoteResult.voteRecords} records)`);
  console.log(`   📋 Committee votes: ${committeeVoteResult.newCount} (${committeeVoteResult.voteRecords} records)`);
  console.log(`   🏛️  Committees: ${committeeResult.committees} (${committeeResult.members} members)`);
  console.log(`   📅 Hearings: ${scheduleResult.hearings} (${scheduleResult.hearingBills} bill assignments)`);
  console.log(`   ❌ Errors: ${result.errorCount + floorVoteResult.errorCount + committeeVoteResult.errorCount + committeeResult.errorCount + scheduleResult.errorCount}`);
  console.log("=========================\n");
  
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error("Fatal error:", error);
  await prisma.$disconnect();
  process.exit(1);
});
