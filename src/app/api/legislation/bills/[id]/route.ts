/**
 * Single Bill API Route
 *
 * GET /api/legislation/bills/[id]
 *
 * Retrieve a single bill by ID with all related data including
 * session, sponsors, and vote records.
 *
 * @module api/legislation/bills/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET handler for retrieving a single bill.
 *
 * Accepts either a CUID or numeric LegiScan bill ID.
 *
 * @param request - The incoming request
 * @param params - Route parameters containing the bill ID
 * @returns JSON response with bill data or 404 if not found
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Try to find by cuid first, then by billId (LegiScan ID)
    let bill = await prisma.legiBill.findUnique({
      where: { id },
      include: {
        session: true,
        sponsors: {
          include: {
            person: true,
          },
          orderBy: {
            sponsorOrder: "asc",
          },
        },
        votes: {
          include: {
            votes: {
              include: {
                person: true,
              },
            },
          },
          orderBy: {
            date: "desc",
          },
        },
      },
    });

    // If not found by cuid, try by billId
    if (!bill) {
      const billId = parseInt(id);
      if (!isNaN(billId)) {
        bill = await prisma.legiBill.findUnique({
          where: { billId },
          include: {
            session: true,
            sponsors: {
              include: {
                person: true,
              },
              orderBy: {
                sponsorOrder: "asc",
              },
            },
            votes: {
              include: {
                votes: {
                  include: {
                    person: true,
                  },
                },
              },
              orderBy: {
                date: "desc",
              },
            },
          },
        });
      }
    }

    if (!bill) {
      return NextResponse.json(
        { error: "Bill not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(bill);
  } catch (error) {
    console.error("Error fetching bill:", error);
    return NextResponse.json(
      { error: "Failed to fetch bill" },
      { status: 500 }
    );
  }
}
