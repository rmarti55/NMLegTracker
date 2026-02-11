/**
 * Statistics API Route
 *
 * GET /api/legislation/stats
 *
 * Returns overall statistics about legislation data including
 * totals, breakdowns by status/chamber, and recent bills.
 *
 * @module api/legislation/stats
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET handler for legislation statistics.
 *
 * Returns:
 * - Total counts (bills, legislators, votes)
 * - Available sessions
 * - Bills grouped by status
 * - Bills grouped by chamber (House/Senate)
 * - 10 most recently updated bills
 *
 * @returns JSON response with statistics data
 */
export async function GET() {
  try {
    // Get overall stats
    const [
      totalBills,
      totalLegislators,
      totalVotes,
      sessions,
      billsByStatus,
      billsByBody,
      recentBills,
    ] = await Promise.all([
      prisma.legiBill.count(),
      prisma.legiPerson.count(),
      prisma.legiRollCall.count(),
      prisma.legiSession.findMany({
        orderBy: { yearStart: "desc" },
      }),
      prisma.legiBill.groupBy({
        by: ["status"],
        _count: true,
      }),
      prisma.legiBill.groupBy({
        by: ["body"],
        _count: true,
      }),
      prisma.legiBill.findMany({
        take: 10,
        orderBy: { statusDate: "desc" },
        include: {
          sponsors: {
            include: {
              person: true,
            },
            where: {
              sponsorType: 1, // Primary sponsors only
            },
            take: 1,
          },
        },
      }),
    ]);

    // Map status codes to names
    const statusNames: Record<number, string> = {
      1: "Introduced",
      2: "Engrossed",
      3: "Enrolled",
      4: "Passed",
      5: "Vetoed",
      6: "Failed",
    };

    const bodyNames: Record<string, string> = {
      H: "House",
      S: "Senate",
    };

    return NextResponse.json({
      totals: {
        bills: totalBills,
        legislators: totalLegislators,
        votes: totalVotes,
      },
      sessions,
      billsByStatus: billsByStatus.map((s) => ({
        status: s.status,
        statusName: statusNames[s.status] || `Status ${s.status}`,
        count: s._count,
      })),
      billsByBody: billsByBody.map((b) => ({
        body: b.body,
        bodyName: bodyNames[b.body] || b.body,
        count: b._count,
      })),
      recentBills,
    });
  } catch (error) {
    console.error("Error fetching legislation stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch legislation stats" },
      { status: 500 }
    );
  }
}
