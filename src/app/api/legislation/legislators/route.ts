/**
 * Legislators API Route
 *
 * GET /api/legislation/legislators
 *
 * List legislators with filtering, pagination, and automatic de-duplication
 * to handle name variations between data sources.
 *
 * @module api/legislation/legislators
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Legislator data with sponsorship and vote counts */
interface LegislatorWithCount {
  id: string;
  peopleId: number;
  name: string;
  firstName: string;
  lastName: string;
  party: string;
  role: string;
  district: string;
  email: string | null;
  imageUrl: string | null;
  bio: unknown;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    sponsorships: number;
    voteRecords: number;
  };
}

/**
 * De-duplicate legislators by lastName + district.
 * This handles name variations between LegiScan and NMLegis imports:
 * e.g., "Brian G. Baca" vs "Brian Baca" both map to "baca|hd-008"
 * Prefer the record with imageUrl and combine the counts.
 */
function deduplicateLegislators(legislators: LegislatorWithCount[]): LegislatorWithCount[] {
  const grouped = new Map<string, LegislatorWithCount[]>();
  
  // Group by lastName + district (handles middle name variations)
  for (const leg of legislators) {
    const key = `${leg.lastName.toLowerCase().trim()}|${leg.district.toLowerCase().trim()}`;
    const existing = grouped.get(key) || [];
    existing.push(leg);
    grouped.set(key, existing);
  }
  
  // For each group, pick the best record and combine counts
  const deduplicated: LegislatorWithCount[] = [];
  
  for (const group of grouped.values()) {
    if (group.length === 1) {
      deduplicated.push(group[0]);
    } else {
      // Sort so records with imageUrl come first, then by most data (bio, email)
      group.sort((a, b) => {
        // Prefer records with images
        if (a.imageUrl && !b.imageUrl) return -1;
        if (!a.imageUrl && b.imageUrl) return 1;
        // Then prefer records with bio
        if (a.bio && !b.bio) return -1;
        if (!a.bio && b.bio) return 1;
        // Then prefer records with email
        if (a.email && !b.email) return -1;
        if (!a.email && b.email) return 1;
        return 0;
      });
      
      // Take the best record and combine counts from all duplicates
      const best = { ...group[0] };
      best._count = {
        sponsorships: group.reduce((sum, l) => sum + l._count.sponsorships, 0),
        voteRecords: group.reduce((sum, l) => sum + l._count.voteRecords, 0),
      };
      
      deduplicated.push(best);
    }
  }
  
  return deduplicated;
}

/**
 * GET handler for legislator listing.
 *
 * Query Parameters:
 * - search: Search by name or district
 * - party: Filter by party ("D" or "R")
 * - role: Filter by role ("Rep" or "Sen")
 * - page: Page number (default: 1)
 * - limit: Results per page (default: 100)
 *
 * @param request - The incoming request with search parameters
 * @returns JSON response with legislators array and pagination info
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search") || "";
    const party = searchParams.get("party"); // "D" or "R"
    const role = searchParams.get("role"); // "Rep" or "Sen"
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "100");

    // Build where clause
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { district: { contains: search, mode: "insensitive" } },
      ];
    }

    if (party) {
      where.party = party;
    }

    if (role) {
      where.role = role;
    }

    // Fetch all matching legislators (we need all for de-duplication)
    const allLegislators = await prisma.legiPerson.findMany({
      where,
      include: {
        _count: {
          select: {
            sponsorships: true,
            voteRecords: true,
          },
        },
      },
      orderBy: [
        { role: "asc" },
        { lastName: "asc" },
      ],
    });

    // De-duplicate by lastName + district (handles name variations)
    const deduplicated = deduplicateLegislators(allLegislators);
    
    // Sort again after deduplication
    deduplicated.sort((a, b) => {
      if (a.role !== b.role) return a.role.localeCompare(b.role);
      return a.lastName.localeCompare(b.lastName);
    });

    // Apply pagination after deduplication
    const total = deduplicated.length;
    const skip = (page - 1) * limit;
    const legislators = deduplicated.slice(skip, skip + limit);

    return NextResponse.json({
      legislators,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching legislators:", error);
    return NextResponse.json(
      { error: "Failed to fetch legislators" },
      { status: 500 }
    );
  }
}
