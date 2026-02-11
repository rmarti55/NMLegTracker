/**
 * NextAuth.js Configuration
 *
 * Configures authentication for the NM Legislation Tracker using
 * NextAuth.js with Google OAuth and Prisma database adapter.
 *
 * @module lib/auth
 */

import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";

/**
 * NextAuth.js configuration options.
 *
 * Features:
 * - Google OAuth provider for authentication
 * - Prisma adapter for database session storage
 * - Database session strategy (not JWT)
 * - Custom session callback to include user ID
 *
 * Environment variables required:
 * - NEXTAUTH_SECRET or AUTH_SECRET: Session encryption secret
 * - GOOGLE_CLIENT_ID or AUTH_GOOGLE_ID: Google OAuth client ID
 * - GOOGLE_CLIENT_SECRET or AUTH_GOOGLE_SECRET: Google OAuth client secret
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  providers: [
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          access_type: "offline",
          prompt: "consent",
        },
      },
      // Allow linking accounts with same email from different providers
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  session: {
    // Use database sessions for better security and server-side access
    strategy: "database",
  },
  callbacks: {
    /**
     * Session callback - adds user ID to the session object.
     * This allows API routes to identify the authenticated user.
     */
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user?.id;
        session.user.email = user?.email || null;
      }
      return session;
    },
    /**
     * Redirect callback - ensures redirects stay within the app.
     * Prevents open redirect vulnerabilities.
     */
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
};
