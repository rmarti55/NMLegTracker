/**
 * Scraping Health Monitoring
 * 
 * Validates scraping results to detect when nmlegis.gov HTML structure changes
 * or parsing fails. This enables early detection of scraping issues before
 * users notice stale data.
 * 
 * Expected values for NM Legislature:
 * - 112 legislators (70 House + 42 Senate)
 * - During session: 500-2000+ bills
 * - Bills should have sponsors, titles, and actions
 */

import { readFileSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// ============================================================================
// Types
// ============================================================================

export interface ScrapingHealthResult {
  status: "healthy" | "degraded" | "critical";
  timestamp: Date;
  checks: HealthCheck[];
  summary: string;
}

export interface HealthCheck {
  name: string;
  status: "pass" | "warn" | "fail";
  message: string;
  expected?: string;
  actual?: string;
}

export interface NmlegisJsonStats {
  legislatorCount: number;
  houseLegislators: number;
  senateLegislators: number;
  billCount: number;
  houseBills: number;
  senateBills: number;
  billsWithSponsors: number;
  billsWithActions: number;
  floorVoteCount: number;
  committeeReportCount: number;
  jsonFileSize: number;
  lastModified: Date | null;
}

// ============================================================================
// Constants
// ============================================================================

const NMLEGIS_DATA_DIR = join(homedir(), ".local/share/nmlegis");
const HEALTH_LOG_PATH = join(process.cwd(), ".scraping-health-log.json");

// Expected ranges for NM Legislature
const EXPECTED = {
  legislators: {
    total: 112,
    house: 70,
    senate: 42,
    tolerance: 5, // Allow some variance for vacancies
  },
  bills: {
    minDuringSession: 100, // At least this many bills during active session
    maxReasonable: 5000, // Sanity check upper bound
    sponsorCoverageMin: 0.8, // 80% of bills should have sponsors
    actionsCoverageMin: 0.5, // 50% of bills should have actions
  },
  jsonFile: {
    minSizeBytes: 10000, // Bills JSON should be at least 10KB
    maxAgeHours: 48, // Warn if JSON is older than 48 hours
  },
};

// ============================================================================
// JSON File Analysis
// ============================================================================

/**
 * Analyze the nmlegis JSON files to extract statistics
 */
export function analyzeNmlegisJson(year: number = new Date().getFullYear()): NmlegisJsonStats | null {
  const billsPath = join(NMLEGIS_DATA_DIR, `bills-${year}.json`);
  const legislatorsPath = join(NMLEGIS_DATA_DIR, "legislators.json");
  const floorVotesPath = join(NMLEGIS_DATA_DIR, `floor-votes-${year}.json`);
  const committeeReportsPath = join(NMLEGIS_DATA_DIR, `committee-reports-${year}.json`);

  if (!existsSync(billsPath)) {
    return null;
  }

  try {
    // Get file stats
    const stats = require("fs").statSync(billsPath);
    const jsonFileSize = stats.size;
    const lastModified = new Date(stats.mtime);

    // Parse bills JSON
    const billsJson = JSON.parse(readFileSync(billsPath, "utf-8"));
    
    let houseBills = 0;
    let senateBills = 0;
    let billsWithSponsors = 0;
    let billsWithActions = 0;

    // Count House bills
    if (billsJson.H) {
      for (const type of Object.keys(billsJson.H)) {
        if (type.startsWith("_")) continue;
        const typeBills = billsJson.H[type];
        for (const num of Object.keys(typeBills)) {
          houseBills++;
          const bill = typeBills[num];
          if (bill.sponsors?.length > 0) billsWithSponsors++;
          if (bill.actions?.length > 0) billsWithActions++;
        }
      }
    }

    // Count Senate bills
    if (billsJson.S) {
      for (const type of Object.keys(billsJson.S)) {
        if (type.startsWith("_")) continue;
        const typeBills = billsJson.S[type];
        for (const num of Object.keys(typeBills)) {
          senateBills++;
          const bill = typeBills[num];
          if (bill.sponsors?.length > 0) billsWithSponsors++;
          if (bill.actions?.length > 0) billsWithActions++;
        }
      }
    }

    // Parse legislators JSON
    let houseLegislators = 0;
    let senateLegislators = 0;

    if (existsSync(legislatorsPath)) {
      const legislatorsJson = JSON.parse(readFileSync(legislatorsPath, "utf-8"));
      houseLegislators = (legislatorsJson.H || []).filter((l: unknown) => l !== null).length;
      senateLegislators = (legislatorsJson.S || []).filter((l: unknown) => l !== null).length;
    }

    // Count floor votes
    let floorVoteCount = 0;
    if (existsSync(floorVotesPath)) {
      const floorVotesJson = JSON.parse(readFileSync(floorVotesPath, "utf-8"));
      for (const billVotes of Object.values(floorVotesJson.votes || {})) {
        floorVoteCount += Object.keys(billVotes as object).length;
      }
    }

    // Count committee reports
    let committeeReportCount = 0;
    if (existsSync(committeeReportsPath)) {
      const committeeReportsJson = JSON.parse(readFileSync(committeeReportsPath, "utf-8"));
      for (const billReports of Object.values(committeeReportsJson.reports || {})) {
        for (const committeeReports of Object.values(billReports as object)) {
          committeeReportCount += (committeeReports as unknown[]).filter((r) => r !== null).length;
        }
      }
    }

    return {
      legislatorCount: houseLegislators + senateLegislators,
      houseLegislators,
      senateLegislators,
      billCount: houseBills + senateBills,
      houseBills,
      senateBills,
      billsWithSponsors,
      billsWithActions,
      floorVoteCount,
      committeeReportCount,
      jsonFileSize,
      lastModified,
    };
  } catch (error) {
    console.error("Error analyzing nmlegis JSON:", error);
    return null;
  }
}

// ============================================================================
// Health Validation
// ============================================================================

/**
 * Run all health checks on the scraped data
 */
export function validateScrapingHealth(stats: NmlegisJsonStats): ScrapingHealthResult {
  const checks: HealthCheck[] = [];
  const now = new Date();

  // Check 1: Legislator count
  const legDiff = Math.abs(stats.legislatorCount - EXPECTED.legislators.total);
  if (legDiff <= EXPECTED.legislators.tolerance) {
    checks.push({
      name: "legislator_count",
      status: "pass",
      message: `${stats.legislatorCount} legislators found`,
      expected: String(EXPECTED.legislators.total),
      actual: String(stats.legislatorCount),
    });
  } else if (stats.legislatorCount > 0) {
    checks.push({
      name: "legislator_count",
      status: "warn",
      message: `Unexpected legislator count: ${stats.legislatorCount} (expected ~${EXPECTED.legislators.total})`,
      expected: String(EXPECTED.legislators.total),
      actual: String(stats.legislatorCount),
    });
  } else {
    checks.push({
      name: "legislator_count",
      status: "fail",
      message: "No legislators found - parsing may be broken",
      expected: String(EXPECTED.legislators.total),
      actual: "0",
    });
  }

  // Check 2: House/Senate balance
  const houseExpected = EXPECTED.legislators.house;
  const senateExpected = EXPECTED.legislators.senate;
  if (
    Math.abs(stats.houseLegislators - houseExpected) <= 3 &&
    Math.abs(stats.senateLegislators - senateExpected) <= 3
  ) {
    checks.push({
      name: "chamber_balance",
      status: "pass",
      message: `House: ${stats.houseLegislators}, Senate: ${stats.senateLegislators}`,
    });
  } else {
    checks.push({
      name: "chamber_balance",
      status: "warn",
      message: `Chamber imbalance: House ${stats.houseLegislators} (exp ${houseExpected}), Senate ${stats.senateLegislators} (exp ${senateExpected})`,
    });
  }

  // Check 3: Bill count
  if (stats.billCount >= EXPECTED.bills.minDuringSession) {
    if (stats.billCount <= EXPECTED.bills.maxReasonable) {
      checks.push({
        name: "bill_count",
        status: "pass",
        message: `${stats.billCount} bills found`,
      });
    } else {
      checks.push({
        name: "bill_count",
        status: "warn",
        message: `Unusually high bill count: ${stats.billCount}`,
      });
    }
  } else if (stats.billCount > 0) {
    checks.push({
      name: "bill_count",
      status: "warn",
      message: `Low bill count: ${stats.billCount} (expected at least ${EXPECTED.bills.minDuringSession} during session)`,
    });
  } else {
    checks.push({
      name: "bill_count",
      status: "fail",
      message: "No bills found - parsing may be broken",
    });
  }

  // Check 4: Sponsor coverage
  const sponsorCoverage = stats.billCount > 0 ? stats.billsWithSponsors / stats.billCount : 0;
  if (sponsorCoverage >= EXPECTED.bills.sponsorCoverageMin) {
    checks.push({
      name: "sponsor_coverage",
      status: "pass",
      message: `${Math.round(sponsorCoverage * 100)}% of bills have sponsors`,
    });
  } else if (sponsorCoverage > 0.5) {
    checks.push({
      name: "sponsor_coverage",
      status: "warn",
      message: `Low sponsor coverage: ${Math.round(sponsorCoverage * 100)}% (expected ${EXPECTED.bills.sponsorCoverageMin * 100}%+)`,
    });
  } else {
    checks.push({
      name: "sponsor_coverage",
      status: "fail",
      message: `Very low sponsor coverage: ${Math.round(sponsorCoverage * 100)}% - sponsor parsing may be broken`,
    });
  }

  // Check 5: Actions coverage
  const actionsCoverage = stats.billCount > 0 ? stats.billsWithActions / stats.billCount : 0;
  if (actionsCoverage >= EXPECTED.bills.actionsCoverageMin) {
    checks.push({
      name: "actions_coverage",
      status: "pass",
      message: `${Math.round(actionsCoverage * 100)}% of bills have actions`,
    });
  } else {
    checks.push({
      name: "actions_coverage",
      status: "warn",
      message: `Low actions coverage: ${Math.round(actionsCoverage * 100)}%`,
    });
  }

  // Check 6: JSON file size
  if (stats.jsonFileSize >= EXPECTED.jsonFile.minSizeBytes) {
    checks.push({
      name: "json_file_size",
      status: "pass",
      message: `Bills JSON is ${Math.round(stats.jsonFileSize / 1024)}KB`,
    });
  } else {
    checks.push({
      name: "json_file_size",
      status: "fail",
      message: `Bills JSON is suspiciously small: ${stats.jsonFileSize} bytes`,
    });
  }

  // Check 7: JSON freshness
  if (stats.lastModified) {
    const ageHours = (now.getTime() - stats.lastModified.getTime()) / 3600000;
    if (ageHours <= EXPECTED.jsonFile.maxAgeHours) {
      checks.push({
        name: "json_freshness",
        status: "pass",
        message: `JSON last modified ${Math.round(ageHours)} hours ago`,
      });
    } else {
      checks.push({
        name: "json_freshness",
        status: "warn",
        message: `JSON is ${Math.round(ageHours)} hours old (threshold: ${EXPECTED.jsonFile.maxAgeHours}h)`,
      });
    }
  }

  // Determine overall status
  const failCount = checks.filter((c) => c.status === "fail").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;

  let status: "healthy" | "degraded" | "critical";
  let summary: string;

  if (failCount > 0) {
    status = "critical";
    summary = `${failCount} critical issue(s) detected - scraping may be broken`;
  } else if (warnCount > 2) {
    status = "degraded";
    summary = `${warnCount} warnings - scraping may be partially broken`;
  } else if (warnCount > 0) {
    status = "degraded";
    summary = `${warnCount} minor warning(s) - monitoring recommended`;
  } else {
    status = "healthy";
    summary = "All checks passed - scraping is working correctly";
  }

  return {
    status,
    timestamp: now,
    checks,
    summary,
  };
}

// ============================================================================
// Health Logging
// ============================================================================

interface HealthLogEntry {
  timestamp: string;
  status: "healthy" | "degraded" | "critical";
  summary: string;
  stats: NmlegisJsonStats;
}

/**
 * Log health check result for historical tracking
 */
export function logHealthResult(result: ScrapingHealthResult, stats: NmlegisJsonStats): void {
  try {
    let log: HealthLogEntry[] = [];
    
    if (existsSync(HEALTH_LOG_PATH)) {
      log = JSON.parse(readFileSync(HEALTH_LOG_PATH, "utf-8"));
    }

    // Add new entry
    log.push({
      timestamp: result.timestamp.toISOString(),
      status: result.status,
      summary: result.summary,
      stats,
    });

    // Keep only last 100 entries
    if (log.length > 100) {
      log = log.slice(-100);
    }

    writeFileSync(HEALTH_LOG_PATH, JSON.stringify(log, null, 2));
  } catch (error) {
    console.error("Error logging health result:", error);
  }
}

/**
 * Get recent health history
 */
export function getHealthHistory(limit: number = 10): HealthLogEntry[] {
  try {
    if (!existsSync(HEALTH_LOG_PATH)) {
      return [];
    }
    const log: HealthLogEntry[] = JSON.parse(readFileSync(HEALTH_LOG_PATH, "utf-8"));
    return log.slice(-limit);
  } catch {
    return [];
  }
}

// ============================================================================
// Main Health Check Function
// ============================================================================

/**
 * Run a full health check on the scraping system
 */
export function runScrapingHealthCheck(year?: number): ScrapingHealthResult {
  const stats = analyzeNmlegisJson(year);

  if (!stats) {
    return {
      status: "critical",
      timestamp: new Date(),
      checks: [
        {
          name: "json_exists",
          status: "fail",
          message: "Could not read nmlegis JSON files - scraping may not be running",
        },
      ],
      summary: "Cannot read scraping output - system may be down",
    };
  }

  const result = validateScrapingHealth(stats);
  logHealthResult(result, stats);

  return result;
}

// ============================================================================
// CLI Support
// ============================================================================

if (require.main === module) {
  console.log("🔍 Running Scraping Health Check...\n");

  const result = runScrapingHealthCheck();

  console.log(`Status: ${result.status.toUpperCase()}`);
  console.log(`Summary: ${result.summary}\n`);

  console.log("Checks:");
  for (const check of result.checks) {
    const icon = check.status === "pass" ? "✅" : check.status === "warn" ? "⚠️" : "❌";
    console.log(`  ${icon} ${check.name}: ${check.message}`);
  }

  process.exit(result.status === "critical" ? 1 : 0);
}
