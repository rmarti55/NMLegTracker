import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth-helpers";

// GET: Retrieve recent searches for the logged-in user
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

// POST: Save a new search
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

// DELETE: Clear all searches for the user
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
