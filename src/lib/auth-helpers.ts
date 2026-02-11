/**
 * Authentication Helper Functions
 *
 * Provides convenience functions for accessing authentication state
 * in server components and API routes.
 *
 * @module lib/auth-helpers
 */

import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { authOptions } from "./auth";

/**
 * Get the current authentication session on the server.
 *
 * Use this in Server Components and API routes to check if a user
 * is authenticated and access their information.
 *
 * @param request - Optional NextRequest for API route context
 * @returns The session object if authenticated, null otherwise
 *
 * @example
 * ```typescript
 * // In a Server Component
 * const session = await getAuthSession();
 * if (!session) {
 *   redirect("/api/auth/signin");
 * }
 *
 * // In an API route
 * export async function GET(request: NextRequest) {
 *   const session = await getAuthSession(request);
 *   if (!session) {
 *     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 *   }
 *   // ... handle authenticated request
 * }
 * ```
 */
export async function getAuthSession(request?: NextRequest) {
  // Note: The request parameter is accepted for API route compatibility
  // but getServerSession doesn't actually need it in Next.js App Router
  return getServerSession(authOptions);
}
