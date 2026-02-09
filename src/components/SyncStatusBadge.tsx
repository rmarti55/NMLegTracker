"use client";

import { useEffect, useState } from "react";

interface SyncStatus {
  lastSync: string | null;
  recentUpdate: {
    billNumber: string;
    updatedAt: string;
  } | null;
}

export default function SyncStatusBadge() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSyncStatus() {
      try {
        const response = await fetch("/api/legislation/sync-status");
        if (response.ok) {
          const data = await response.json();
          setSyncStatus(data);
        }
      } catch (error) {
        console.error("Failed to fetch sync status:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchSyncStatus();
  }, []);

  if (loading) {
    return (
      <span className="text-sm text-gray-400 animate-pulse">
        Loading sync status...
      </span>
    );
  }

  // Get the timestamp to display - prefer lastSync, fall back to recentUpdate
  const timestamp = syncStatus?.lastSync || syncStatus?.recentUpdate?.updatedAt;

  if (!timestamp) {
    return null;
  }

  // Format date in Mountain Time
  const date = new Date(timestamp);
  const formattedDate = date.toLocaleString("en-US", {
    timeZone: "America/Denver",
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  return (
    <span className="text-sm text-gray-500">
      Last legislative database update: {formattedDate}
    </span>
  );
}
