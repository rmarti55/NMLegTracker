import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { 
  runScrapingHealthCheck, 
  getHealthHistory,
  type ScrapingHealthResult 
} from "@/lib/scraping-health";

export const dynamic = "force-dynamic";

// Cache the nmlegis.gov timestamp for 5 minutes to avoid hammering their server
let cachedNmlegisUpdate: { timestamp: Date | null; fetchedAt: Date } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Cache scraping health for 10 minutes (it reads files, so slightly expensive)
let cachedScrapingHealth: { result: ScrapingHealthResult; fetchedAt: Date } | null = null;
const SCRAPING_HEALTH_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Fetch the "Last legislative database update" timestamp from nmlegis.gov
 */
async function fetchNmlegisTimestamp(): Promise<Date | null> {
  // Return cached value if fresh
  if (cachedNmlegisUpdate && 
      Date.now() - cachedNmlegisUpdate.fetchedAt.getTime() < CACHE_TTL_MS) {
    return cachedNmlegisUpdate.timestamp;
  }

  try {
    const response = await fetch("https://www.nmlegis.gov/Legislation/Legislation_List", {
      headers: {
        "User-Agent": "NM-Legislature-Tracker/1.0 (educational purposes)",
      },
      // Short timeout to avoid blocking the health check
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.error(`HTTP ${response.status} fetching nmlegis.gov`);
      return cachedNmlegisUpdate?.timestamp ?? null;
    }

    const html = await response.text();
    
    // Extract: "Last legislative database update: 2/11/2026 12:05:42 PM"
    const match = html.match(/Last legislative database update:\s*([^<|]+)/i);
    if (!match) {
      console.error("Could not find 'Last legislative database update' on page");
      return cachedNmlegisUpdate?.timestamp ?? null;
    }

    const timestampStr = match[1].trim();
    const date = new Date(timestampStr);
    
    if (isNaN(date.getTime())) {
      console.error("Could not parse timestamp:", timestampStr);
      return cachedNmlegisUpdate?.timestamp ?? null;
    }

    // Update cache
    cachedNmlegisUpdate = { timestamp: date, fetchedAt: new Date() };
    return date;
  } catch (error) {
    console.error("Error fetching nmlegis.gov:", error);
    return cachedNmlegisUpdate?.timestamp ?? null;
  }
}

/**
 * Get scraping health with caching
 */
function getScrapingHealth(): ScrapingHealthResult {
  if (cachedScrapingHealth && 
      Date.now() - cachedScrapingHealth.fetchedAt.getTime() < SCRAPING_HEALTH_CACHE_TTL_MS) {
    return cachedScrapingHealth.result;
  }

  const result = runScrapingHealthCheck();
  cachedScrapingHealth = { result, fetchedAt: new Date() };
  return result;
}

export async function GET() {
  try {
    // Get our last sync time from the database
    const session = await prisma.legiSession.findFirst({
      where: { state: "NM", yearStart: new Date().getFullYear() },
      select: { datasetDate: true, sessionName: true },
    });

    // Get bill counts
    const [totalBills, billsWithText, billsWithSponsors] = await Promise.all([
      prisma.legiBill.count(),
      prisma.legiBill.count({ where: { fullText: { not: null } } }),
      prisma.legiBill.count({ where: { sponsors: { some: {} } } }),
    ]);

    // Fetch nmlegis.gov timestamp
    const nmlegisUpdate = await fetchNmlegisTimestamp();

    // Run scraping health check
    const scrapingHealth = getScrapingHealth();

    const ourLastSync = session?.datasetDate ?? null;
    const now = new Date();

    // Calculate staleness
    let staleness: "current" | "stale" | "very_stale" | "unknown" = "unknown";
    let staleMinutes = 0;

    if (ourLastSync && nmlegisUpdate) {
      staleMinutes = Math.round((nmlegisUpdate.getTime() - ourLastSync.getTime()) / 60000);
      
      if (staleMinutes <= 0) {
        staleness = "current";
      } else if (staleMinutes <= 120) {
        staleness = "stale"; // 0-2 hours behind
      } else {
        staleness = "very_stale"; // >2 hours behind
      }
    } else if (ourLastSync) {
      // Can't check nmlegis.gov, but we have sync data
      const hoursSinceSync = (now.getTime() - ourLastSync.getTime()) / 3600000;
      staleness = hoursSinceSync > 24 ? "very_stale" : "current";
    }

    // Determine overall status based on both staleness and scraping health
    let overallStatus: "ok" | "warning" | "critical" = "ok";
    
    if (scrapingHealth.status === "critical") {
      overallStatus = "critical";
    } else if (staleness === "very_stale" || scrapingHealth.status === "degraded") {
      overallStatus = "warning";
    }

    return NextResponse.json({
      status: overallStatus,
      staleness,
      staleMinutes: staleMinutes > 0 ? staleMinutes : 0,
      
      ourLastSync: ourLastSync?.toISOString() ?? null,
      nmlegisLastUpdate: nmlegisUpdate?.toISOString() ?? null,
      
      session: session?.sessionName ?? null,
      
      // Database stats
      stats: {
        totalBills,
        billsWithText,
        billsWithSponsors,
        textCoverage: totalBills > 0 ? Math.round((billsWithText / totalBills) * 100) : 0,
        sponsorCoverage: totalBills > 0 ? Math.round((billsWithSponsors / totalBills) * 100) : 0,
      },
      
      // Scraping health (from JSON files)
      scrapingHealth: {
        status: scrapingHealth.status,
        summary: scrapingHealth.summary,
        checks: scrapingHealth.checks,
        lastChecked: scrapingHealth.timestamp.toISOString(),
      },
      
      // Recent health history
      healthHistory: getHealthHistory(5).map(h => ({
        timestamp: h.timestamp,
        status: h.status,
        summary: h.summary,
      })),
      
      checkedAt: now.toISOString(),
    });
  } catch (error) {
    console.error("Health check error:", error);
    return NextResponse.json(
      { 
        status: "error", 
        error: "Failed to check health",
        checkedAt: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
