import { DefaultSession } from "next-auth";

/**
 * Module augmentation for NextAuth.js types.
 * 
 * Extends the default Session type to include the user ID,
 * which is added in our session callback in lib/auth.ts.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
