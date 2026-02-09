import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/legislation/sync-status
 * Returns the current sync status for legislation data
 */
export async function GET() {
  try {
    // Check last sync time from file
    const lastSyncFile = join(process.cwd(), ".last-sync");
    let lastSync: string | null = null;
    if (existsSync(lastSyncFile)) {
      lastSync = readFileSync(lastSyncFile, "utf-8").trim();
    }

    // Get database counts
    const [billCount, legislatorCount, rollCallCount, voteRecordCount] =
      await Promise.all([
        prisma.legiBill.count(),
        prisma.legiPerson.count(),
        prisma.legiRollCall.count(),
        prisma.legiVoteRecord.count(),
      ]);

    // Get most recent bill update
    const recentBill = await prisma.legiBill.findFirst({
      orderBy: { updatedAt: "desc" },
      select: { billNumber: true, updatedAt: true },
    });

    // Determine health status
    let health: "healthy" | "stale" | "unknown" = "unknown";
    if (lastSync) {
      const lastSyncDate = new Date(lastSync);
      const hoursSinceSync =
        (Date.now() - lastSyncDate.getTime()) / (1000 * 60 * 60);
      // During business hours (8am-6pm), data should be < 30 mins old
      // Otherwise, < 2 hours is acceptable
      const hour = new Date().getHours();
      const isBusinessHours = hour >= 8 && hour < 18;
      const threshold = isBusinessHours ? 0.5 : 2;
      health = hoursSinceSync < threshold ? "healthy" : "stale";
    }

    return NextResponse.json({
      lastSync,
      health,
      counts: {
        bills: billCount,
        legislators: legislatorCount,
        rollCalls: rollCallCount,
        voteRecords: voteRecordCount,
      },
      recentUpdate: recentBill
        ? {
            billNumber: recentBill.billNumber,
            updatedAt: recentBill.updatedAt,
          }
        : null,
      source: "nmlegis",
      schedule: {
        businessHours: "Every 15 minutes (8am-6pm weekdays)",
        offHours: "Every hour",
      },
    });
  } catch (error) {
    console.error("Error getting sync status:", error);
    return NextResponse.json(
      { error: "Failed to get sync status" },
      { status: 500 }
    );
  }
}
