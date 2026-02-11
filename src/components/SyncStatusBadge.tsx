"use client";

import { useEffect, useState } from "react";

interface HealthStatus {
  status: "ok" | "warning" | "error";
  staleness: "current" | "stale" | "very_stale" | "unknown";
  staleMinutes: number;
  ourLastSync: string | null;
  nmlegisLastUpdate: string | null;
  session: string | null;
  stats: {
    totalBills: number;
    billsWithText: number;
    textCoverage: number;
  };
}

export default function SyncStatusBadge() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    async function fetchHealth() {
      try {
        const response = await fetch("/api/legislation/health");
        if (response.ok) {
          const data = await response.json();
          setHealth(data);
        }
      } catch (error) {
        console.error("Failed to fetch health status:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchHealth();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchHealth, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <span className="text-sm text-gray-400 animate-pulse">
        Loading sync status...
      </span>
    );
  }

  if (!health) {
    return null;
  }

  // Format date in Mountain Time
  const formatDate = (isoString: string | null) => {
    if (!isoString) return "Unknown";
    const date = new Date(isoString);
    return date.toLocaleString("en-US", {
      timeZone: "America/Denver",
      month: "numeric",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Determine status color and icon
  const getStatusStyle = () => {
    switch (health.staleness) {
      case "current":
        return {
          bgColor: "bg-green-50",
          textColor: "text-green-700",
          borderColor: "border-green-200",
          icon: (
            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ),
        };
      case "stale":
        return {
          bgColor: "bg-yellow-50",
          textColor: "text-yellow-700",
          borderColor: "border-yellow-200",
          icon: (
            <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        };
      case "very_stale":
        return {
          bgColor: "bg-red-50",
          textColor: "text-red-700",
          borderColor: "border-red-200",
          icon: (
            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ),
        };
      default:
        return {
          bgColor: "bg-gray-50",
          textColor: "text-gray-600",
          borderColor: "border-gray-200",
          icon: (
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        };
    }
  };

  const style = getStatusStyle();

  return (
    <div className="inline-block">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${style.bgColor} ${style.borderColor} ${style.textColor} text-sm hover:opacity-80 transition-opacity`}
      >
        {style.icon}
        <span>
          {health.staleness === "current" && "Data current"}
          {health.staleness === "stale" && `Data ${health.staleMinutes}m behind`}
          {health.staleness === "very_stale" && `Data ${Math.round(health.staleMinutes / 60)}h behind`}
          {health.staleness === "unknown" && "Sync status unknown"}
        </span>
        <svg 
          className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className={`mt-2 p-3 rounded-lg border ${style.bgColor} ${style.borderColor} text-sm`}>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Our last sync:</span>
              <span className={style.textColor}>{formatDate(health.ourLastSync)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">nmlegis.gov updated:</span>
              <span className={style.textColor}>{formatDate(health.nmlegisLastUpdate)}</span>
            </div>
            <div className="border-t border-gray-200 pt-2 mt-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Total bills:</span>
                <span className="text-gray-700">{health.stats.totalBills.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Bills with text:</span>
                <span className="text-gray-700">
                  {health.stats.billsWithText.toLocaleString()} ({health.stats.textCoverage}%)
                </span>
              </div>
            </div>
            {health.staleness === "very_stale" && (
              <div className="border-t border-red-200 pt-2 mt-2 text-red-600 text-xs">
                Data may be out of date. Sync runs hourly.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
