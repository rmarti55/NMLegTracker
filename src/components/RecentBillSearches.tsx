"use client";

import { useState, useEffect, useCallback } from "react";

interface RecentSearch {
  id: string;
  query: string;
  updatedAt: string;
}

interface RecentBillSearchesProps {
  onSearchClick: (query: string) => void;
  onSearchSaved?: () => void;
}

export default function RecentBillSearches({ onSearchClick, onSearchSaved }: RecentBillSearchesProps) {
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);

  // Fetch recent searches on mount
  const fetchRecentSearches = useCallback(async () => {
    try {
      const res = await fetch("/api/legislation/bill-searches");
      if (res.ok) {
        const data = await res.json();
        setRecentSearches(data.searches || []);
      }
    } catch (error) {
      console.error("Error fetching recent searches:", error);
    }
  }, []);

  useEffect(() => {
    fetchRecentSearches();
  }, [fetchRecentSearches]);

  // Re-fetch when a search is saved (called by parent)
  useEffect(() => {
    if (onSearchSaved) {
      // This allows parent to trigger a refresh
    }
  }, [onSearchSaved]);

  const clearRecentSearches = async () => {
    try {
      const res = await fetch("/api/legislation/bill-searches", {
        method: "DELETE",
      });
      if (res.ok) {
        setRecentSearches([]);
      }
    } catch (error) {
      console.error("Error clearing searches:", error);
    }
  };

  if (recentSearches.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
      <span className="text-sm text-gray-500">Recent:</span>
      <div className="flex flex-wrap gap-2">
        {recentSearches.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSearchClick(item.query)}
            className="px-2.5 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-blue-100 hover:text-blue-700 transition-colors"
          >
            {item.query}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={clearRecentSearches}
        className="ml-auto text-xs text-gray-400 hover:text-gray-600 transition-colors"
        title="Clear recent searches"
      >
        Clear all
      </button>
    </div>
  );
}

// Helper function to save a search - can be called from any page
export async function saveRecentSearch(query: string): Promise<boolean> {
  if (!query || !isBillNumberPattern(query)) return false;
  
  const normalized = query.trim().toUpperCase();
  
  try {
    const res = await fetch("/api/legislation/bill-searches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: normalized }),
    });
    return res.ok;
  } catch (error) {
    console.error("Error saving search:", error);
    return false;
  }
}

// Check if search term looks like a bill number (e.g., HB9, SB123, HJR5)
function isBillNumberPattern(search: string): boolean {
  return /^(H|S)(B|JR|M|R|CR|JM)?\d*$/i.test(search.trim());
}
