// Permission helpers for NM Legislation Tracker

// Admin email addresses
const ADMIN_EMAILS = [
  "admin@nmlegtracker.com",
  // Add additional admin emails here
];

/**
 * Check if a user email belongs to an admin
 */
export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
