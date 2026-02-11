#!/usr/bin/env npx tsx
/**
 * Check NMLegis.gov Update Timestamp
 * 
 * Fetches the "Last legislative database update" timestamp from nmlegis.gov
 * and compares it to our last successful sync time.
 * 
 * Exit codes:
 *   0 - New data available (nmlegis.gov updated since our last sync)
 *   1 - No new data (our sync is current)
 *   2 - Error fetching timestamp
 * 
 * Usage: npx tsx scripts/check-nmlegis-update.ts [--verbose]
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const NMLEGIS_URL = "https://www.nmlegis.gov/Legislation/Legislation_List";
const LAST_UPDATE_FILE = join(process.cwd(), ".last-nmlegis-update");
const verbose = process.argv.includes("--verbose");

function log(...args: unknown[]) {
  if (verbose) {
    console.log("[check-nmlegis-update]", ...args);
  }
}

/**
 * Fetch the "Last legislative database update" timestamp from nmlegis.gov
 */
async function fetchNmlegisTimestamp(): Promise<Date | null> {
  try {
    const response = await fetch(NMLEGIS_URL, {
      headers: {
        "User-Agent": "NM-Legislature-Tracker/1.0 (educational purposes)",
      },
    });

    if (!response.ok) {
      console.error(`HTTP ${response.status} fetching nmlegis.gov`);
      return null;
    }

    const html = await response.text();
    
    // Extract: "Last legislative database update: 2/11/2026 12:05:42 PM"
    const match = html.match(/Last legislative database update:\s*([^<|]+)/i);
    if (!match) {
      console.error("Could not find 'Last legislative database update' on page");
      return null;
    }

    const timestampStr = match[1].trim();
    log("Found nmlegis.gov timestamp:", timestampStr);

    // Parse the timestamp (format: M/D/YYYY H:MM:SS AM/PM)
    const date = new Date(timestampStr);
    if (isNaN(date.getTime())) {
      console.error("Could not parse timestamp:", timestampStr);
      return null;
    }

    return date;
  } catch (error) {
    console.error("Error fetching nmlegis.gov:", error);
    return null;
  }
}

/**
 * Get our last recorded nmlegis.gov update timestamp
 */
function getLastKnownUpdate(): Date | null {
  if (!existsSync(LAST_UPDATE_FILE)) {
    log("No previous update file found");
    return null;
  }

  try {
    const content = readFileSync(LAST_UPDATE_FILE, "utf-8").trim();
    const date = new Date(content);
    if (isNaN(date.getTime())) {
      return null;
    }
    return date;
  } catch {
    return null;
  }
}

/**
 * Save the current nmlegis.gov update timestamp
 */
function saveLastKnownUpdate(date: Date): void {
  writeFileSync(LAST_UPDATE_FILE, date.toISOString());
  log("Saved nmlegis.gov timestamp:", date.toISOString());
}

async function main() {
  console.log("Checking nmlegis.gov for updates...");

  const nmlegisUpdate = await fetchNmlegisTimestamp();
  if (!nmlegisUpdate) {
    console.error("Failed to fetch nmlegis.gov timestamp");
    process.exit(2);
  }

  console.log(`nmlegis.gov last update: ${nmlegisUpdate.toLocaleString()}`);

  const lastKnown = getLastKnownUpdate();
  if (!lastKnown) {
    console.log("No previous sync recorded - new data available");
    saveLastKnownUpdate(nmlegisUpdate);
    process.exit(0);
  }

  console.log(`Our last sync:          ${lastKnown.toLocaleString()}`);

  // Compare timestamps
  if (nmlegisUpdate.getTime() > lastKnown.getTime()) {
    const diffMinutes = Math.round((nmlegisUpdate.getTime() - lastKnown.getTime()) / 60000);
    console.log(`NEW DATA AVAILABLE (${diffMinutes} minutes newer)`);
    saveLastKnownUpdate(nmlegisUpdate);
    process.exit(0);
  } else {
    console.log("No new data - nmlegis.gov has not updated since last sync");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(2);
});
