#!/usr/bin/env npx tsx
/**
 * Scraping Health Check CLI
 * 
 * Validates the nmlegis JSON files to detect parsing issues.
 * Run after scraping to verify data quality.
 * 
 * Exit codes:
 *   0 - Healthy (all checks pass)
 *   1 - Critical (scraping likely broken)
 *   2 - Degraded (some warnings, but usable)
 * 
 * Usage: npx tsx scripts/check-scraping-health.ts [--json] [--alert]
 */

import { 
  runScrapingHealthCheck, 
  analyzeNmlegisJson,
  type ScrapingHealthResult 
} from "../src/lib/scraping-health";

const args = process.argv.slice(2);
const jsonOutput = args.includes("--json");
const shouldAlert = args.includes("--alert");

async function sendAlert(result: ScrapingHealthResult): Promise<void> {
  // For now, just log to stderr - can be extended to send to Slack, email, etc.
  console.error("\n🚨 SCRAPING HEALTH ALERT 🚨");
  console.error(`Status: ${result.status.toUpperCase()}`);
  console.error(`Summary: ${result.summary}`);
  console.error("\nFailed checks:");
  
  for (const check of result.checks) {
    if (check.status !== "pass") {
      console.error(`  - ${check.name}: ${check.message}`);
    }
  }
  
  // TODO: Add webhook/email integration
  // Example: await fetch(process.env.ALERT_WEBHOOK_URL, { ... })
}

async function main(): Promise<void> {
  const result = runScrapingHealthCheck();
  const stats = analyzeNmlegisJson();

  if (jsonOutput) {
    console.log(JSON.stringify({
      ...result,
      stats,
      timestamp: result.timestamp.toISOString(),
    }, null, 2));
  } else {
    console.log("🔍 Scraping Health Check");
    console.log("========================\n");

    // Show stats if available
    if (stats) {
      console.log("📊 Scraped Data Stats:");
      console.log(`   Legislators: ${stats.legislatorCount} (H: ${stats.houseLegislators}, S: ${stats.senateLegislators})`);
      console.log(`   Bills: ${stats.billCount} (H: ${stats.houseBills}, S: ${stats.senateBills})`);
      console.log(`   Bills with sponsors: ${stats.billsWithSponsors} (${Math.round(stats.billsWithSponsors / stats.billCount * 100)}%)`);
      console.log(`   Bills with actions: ${stats.billsWithActions} (${Math.round(stats.billsWithActions / stats.billCount * 100)}%)`);
      console.log(`   Floor votes: ${stats.floorVoteCount}`);
      console.log(`   Committee reports: ${stats.committeeReportCount}`);
      console.log(`   JSON file size: ${Math.round(stats.jsonFileSize / 1024)}KB`);
      if (stats.lastModified) {
        const ageHours = (Date.now() - stats.lastModified.getTime()) / 3600000;
        console.log(`   Last modified: ${Math.round(ageHours)} hours ago`);
      }
      console.log("");
    }

    // Show status
    const statusIcon = result.status === "healthy" ? "✅" : result.status === "degraded" ? "⚠️" : "❌";
    console.log(`${statusIcon} Status: ${result.status.toUpperCase()}`);
    console.log(`   ${result.summary}\n`);

    // Show individual checks
    console.log("📋 Health Checks:");
    for (const check of result.checks) {
      const icon = check.status === "pass" ? "✅" : check.status === "warn" ? "⚠️" : "❌";
      console.log(`   ${icon} ${check.name}: ${check.message}`);
    }
    console.log("");
  }

  // Send alert if requested and status is not healthy
  if (shouldAlert && result.status !== "healthy") {
    await sendAlert(result);
  }

  // Exit with appropriate code
  if (result.status === "critical") {
    process.exit(1);
  } else if (result.status === "degraded") {
    process.exit(2);
  } else {
    process.exit(0);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
