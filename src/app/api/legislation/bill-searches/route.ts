/**
 * Bill Search History API Route
 *
 * Manages user's bill search history for quick access to recent searches.
 *
 * - GET: Retrieve recent searches (returns empty if not authenticated)
 * - POST: Save a new search (requires authentication)
 * - DELETE: Clear all search history (requires authentication)
 *
 * @module api/legislation/bill-searches
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth-helpers";

/**
 * GET handler for retrieving recent searches.
 *
 * Returns the 8 most recent searches for the authenticated user.
 * Returns empty array if not authenticated (no error).
 *
 * @returns JSON response with searches array
 */
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ searches: [] });
    }

    const searches = await prisma.billSearchHistory.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: {
        id: true,
        query: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ searches });
  } catch (error) {
    console.error("Error fetching bill searches:", error);
    return NextResponse.json({ searches: [] });
  }
}

/**
 * POST handler for saving a search query.
 *
 * Saves or updates a search query for the authenticated user.
 * Queries are normalized to uppercase and deduplicated.
 *
 * @param request - Request with JSON body containing { query: string }
 * @returns JSON response with saved search or error
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { query } = await request.json();
    
    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    const trimmedQuery = query.trim().toUpperCase();

    // Upsert: create if not exists, update timestamp if exists
    const search = await prisma.billSearchHistory.upsert({
      where: {
        userId_query: {
          userId: session.user.id,
          query: trimmedQuery,
        },
      },
      update: {
        updatedAt: new Date(),
      },
      create: {
        userId: session.user.id,
        query: trimmedQuery,
      },
    });

    return NextResponse.json({ search });
  } catch (error) {
    console.error("Error saving bill search:", error);
    return NextResponse.json(
      { error: "Failed to save search" },
      { status: 500 }
    );
  }
}

/**
 * DELETE handler for clearing search history.
 *
 * Deletes all saved searches for the authenticated user.
 *
 * @returns JSON response with success status or error
 */
export async function DELETE() {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    await prisma.billSearchHistory.deleteMany({
      where: { userId: session.user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error clearing bill searches:", error);
    return NextResponse.json(
      { error: "Failed to clear searches" },
      { status: 500 }
    );
  }
}
