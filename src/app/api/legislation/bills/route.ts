/**
 * Bills API Route
 *
 * GET /api/legislation/bills
 *
 * Search and list bills with filtering, pagination, and smart bill number matching.
 *
 * @module api/legislation/bills
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Check if a search term looks like a bill number pattern.
 *
 * Matches patterns like: HB, SB, HJR, SJR, HM, SM, HR, SR, HCR, SCR, HJM, SJM
 * optionally followed by numbers.
 *
 * @param search - The search term to check
 * @returns True if the search looks like a bill number
 *
 * @example
 * isBillNumberPattern("HB9")   // true
 * isBillNumberPattern("SB123") // true
 * isBillNumberPattern("tax")   // false
 */
function isBillNumberPattern(search: string): boolean {
  // Match patterns like HB, SB, HJR, SJR, HM, SM, HR, SR followed by optional numbers
  return /^(H|S)(B|JR|M|R|CR|JM)?\d*$/i.test(search.trim());
}

/**
 * GET handler for bill search and listing.
 *
 * Query Parameters:
 * - search: Bill number (HB9) or keyword search
 * - status: Filter by status code (1-6)
 * - body: Filter by chamber ("H" or "S")
 * - sessionId: Filter by session
 * - page: Page number (default: 1)
 * - limit: Results per page (default: 50)
 *
 * @param request - The incoming request with search parameters
 * @returns JSON response with bills array and pagination info
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status");
    const body = searchParams.get("body"); // "H" or "S"
    const sessionId = searchParams.get("sessionId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (search) {
      const trimmedSearch = search.trim();
      
      if (isBillNumberPattern(trimmedSearch)) {
        // For bill number searches, use startsWith for exact prefix matching
        // This ensures "HB9" matches "HB9", "HB90", "HB91" but NOT "HB195"
        where.billNumber = { startsWith: trimmedSearch.toUpperCase(), mode: "insensitive" };
      } else {
        // For keyword searches, check bill number prefix OR title/description contains
        where.OR = [
          { billNumber: { startsWith: trimmedSearch, mode: "insensitive" } },
          { title: { contains: trimmedSearch, mode: "insensitive" } },
          { description: { contains: trimmedSearch, mode: "insensitive" } },
        ];
      }
    }

    if (status) {
      where.status = parseInt(status);
    }

    if (body) {
      where.body = body;
    }

    if (sessionId) {
      where.sessionId = sessionId;
    }

    // Get bills with sponsors
    // When searching, sort by bill number length (shorter = more relevant) then alphabetically
    // This ensures HB9 comes before HB90, HB91, etc.
    const [bills, total] = await Promise.all([
      prisma.legiBill.findMany({
        where,
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
          _count: {
            select: {
              votes: true,
            },
          },
        },
        orderBy: search
          ? [{ billNumber: "asc" }]  // When searching, sort by bill number for relevance
          : [{ statusDate: "desc" }, { billNumber: "asc" }],  // Default: recent activity first
        skip,
        take: limit,
      }),
      prisma.legiBill.count({ where }),
    ]);
    
    // When searching by bill number, sort results by bill number length for better relevance
    // This ensures exact/shorter matches appear first (HB9 before HB90)
    let sortedBills = bills;
    if (search && isBillNumberPattern(search.trim())) {
      sortedBills = [...bills].sort((a, b) => {
        // First sort by length (shorter = more relevant)
        const lenDiff = a.billNumber.length - b.billNumber.length;
        if (lenDiff !== 0) return lenDiff;
        // Then alphabetically
        return a.billNumber.localeCompare(b.billNumber);
      });
    }

    return NextResponse.json({
      bills: sortedBills,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching bills:", error);
    return NextResponse.json(
      { error: "Failed to fetch bills" },
      { status: 500 }
    );
  }
}
