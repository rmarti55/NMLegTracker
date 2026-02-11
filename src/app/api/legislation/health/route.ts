import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Cache the nmlegis.gov timestamp for 5 minutes to avoid hammering their server
let cachedNmlegisUpdate: { timestamp: Date | null; fetchedAt: Date } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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

export async function GET() {
  try {
    // Get our last sync time from the database
    const session = await prisma.legiSession.findFirst({
      where: { state: "NM", yearStart: new Date().getFullYear() },
      select: { datasetDate: true, sessionName: true },
    });

    // Get bill counts
    const [totalBills, billsWithText] = await Promise.all([
      prisma.legiBill.count(),
      prisma.legiBill.count({ where: { fullText: { not: null } } }),
    ]);

    // Fetch nmlegis.gov timestamp
    const nmlegisUpdate = await fetchNmlegisTimestamp();

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

    return NextResponse.json({
      status: staleness === "very_stale" ? "warning" : "ok",
      staleness,
      staleMinutes: staleMinutes > 0 ? staleMinutes : 0,
      
      ourLastSync: ourLastSync?.toISOString() ?? null,
      nmlegisLastUpdate: nmlegisUpdate?.toISOString() ?? null,
      
      session: session?.sessionName ?? null,
      
      stats: {
        totalBills,
        billsWithText,
        textCoverage: totalBills > 0 ? Math.round((billsWithText / totalBills) * 100) : 0,
      },
      
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
