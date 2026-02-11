/**
 * Single Legislator API Route
 *
 * GET /api/legislation/legislators/[id]
 *
 * Retrieve a single legislator by ID with sponsorships, voting history,
 * and calculated vote statistics.
 *
 * @module api/legislation/legislators/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET handler for retrieving a single legislator.
 *
 * Accepts either a CUID or numeric LegiScan people ID.
 * Returns legislator data with:
 * - Sponsored bills
 * - Recent vote records (last 50)
 * - Vote statistics (yea/nay/absent/nv counts)
 *
 * @param request - The incoming request
 * @param params - Route parameters containing the legislator ID
 * @returns JSON response with legislator data or 404 if not found
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Try to find by cuid first, then by peopleId (LegiScan ID)
    let legislator = await prisma.legiPerson.findUnique({
      where: { id },
      include: {
        sponsorships: {
          include: {
            bill: {
              include: {
                session: true,
              },
            },
          },
          orderBy: {
            bill: {
              statusDate: "desc",
            },
          },
        },
        voteRecords: {
          include: {
            rollCall: {
              include: {
                bill: true,
              },
            },
          },
          orderBy: {
            rollCall: {
              date: "desc",
            },
          },
          take: 50, // Limit recent votes
        },
      },
    });

    // If not found by cuid, try by peopleId
    if (!legislator) {
      const peopleId = parseInt(id);
      if (!isNaN(peopleId)) {
        legislator = await prisma.legiPerson.findUnique({
          where: { peopleId },
          include: {
            sponsorships: {
              include: {
                bill: {
                  include: {
                    session: true,
                  },
                },
              },
              orderBy: {
                bill: {
                  statusDate: "desc",
                },
              },
            },
            voteRecords: {
              include: {
                rollCall: {
                  include: {
                    bill: true,
                  },
                },
              },
              orderBy: {
                rollCall: {
                  date: "desc",
                },
              },
              take: 50,
            },
          },
        });
      }
    }

    if (!legislator) {
      return NextResponse.json(
        { error: "Legislator not found" },
        { status: 404 }
      );
    }

    // Calculate vote statistics
    const voteStats = {
      yea: 0,
      nay: 0,
      absent: 0,
      nv: 0,
    };

    // Get all vote records for stats
    const allVotes = await prisma.legiVoteRecord.findMany({
      where: { personId: legislator.id },
    });

    for (const vote of allVotes) {
      switch (vote.voteText.toLowerCase()) {
        case "yea":
          voteStats.yea++;
          break;
        case "nay":
          voteStats.nay++;
          break;
        case "absent":
          voteStats.absent++;
          break;
        case "nv":
          voteStats.nv++;
          break;
      }
    }

    return NextResponse.json({
      ...legislator,
      voteStats,
    });
  } catch (error) {
    console.error("Error fetching legislator:", error);
    return NextResponse.json(
      { error: "Failed to fetch legislator" },
      { status: 500 }
    );
  }
}
