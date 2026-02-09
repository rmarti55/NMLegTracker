"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import BillCard from "./BillCard";
import Link from "next/link";
import RecentBillSearches, { saveRecentSearch } from "./RecentBillSearches";

interface Sponsor {
  person: {
    id: string;
    name: string;
    party: string;
    district: string;
  };
  sponsorType: number;
}

interface Bill {
  id: string;
  billNumber: string;
  title: string;
  description: string | null;
  status: number;
  statusDate: string | null;
  body: string;
  url: string | null;
  sponsors: Sponsor[];
  _count: {
    votes: number;
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface RecentBill {
  id: string;
  billNumber: string;
  title: string;
  description: string | null;
  status: number;
  statusDate: string | null;
  body: string;
  url: string | null;
  sponsors: Sponsor[];
  _count: {
    votes: number;
  };
}

interface BillSearchSectionProps {
  recentBills: RecentBill[];
}

export default function BillSearchSection({ recentBills }: BillSearchSectionProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [body, setBody] = useState("");
  const [bills, setBills] = useState<Bill[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [recentSearchKey, setRecentSearchKey] = useState(0);
  const lastSavedSearch = useRef<string>("");

  const fetchBills = useCallback(async (saveToHistory = false) => {
    if (!search && !status && !body) {
      setBills([]);
      setPagination(null);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);
    
    // Save to history if this is a form submission
    if (saveToHistory && search) {
      const normalized = search.trim().toUpperCase();
      if (normalized !== lastSavedSearch.current) {
        lastSavedSearch.current = normalized;
        const saved = await saveRecentSearch(search);
        if (saved) {
          // Trigger re-render of RecentBillSearches
          setRecentSearchKey(k => k + 1);
        }
      }
    }
    
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      if (body) params.set("body", body);
      params.set("limit", "10");

      const res = await fetch(`/api/legislation/bills?${params}`);
      if (res.ok) {
        const data = await res.json();
        setBills(data.bills);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Error fetching bills:", error);
    } finally {
      setLoading(false);
    }
  }, [search, status, body]);

  // Debounce search (don't save to history on auto-search)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBills(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchBills]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchBills(true); // Save to history on form submit
  };

  const handleRecentSearchClick = (query: string) => {
    setSearch(query);
    // The useEffect will trigger fetchBills automatically
  };

  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setBody("");
    setBills([]);
    setPagination(null);
    setHasSearched(false);
  };

  const hasFilters = search || status || body;

  // Build URL for "View all results" link
  const buildSearchUrl = () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (body) params.set("body", body);
    return `/legislation/bills${params.toString() ? `?${params}` : ""}`;
  };

  return (
    <div className="mb-8">
      {/* Search Form */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <form onSubmit={handleSubmit} className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="bill-search" className="block text-sm font-medium text-gray-700 mb-1">
              Search Bills
            </label>
            <input
              id="bill-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by bill number (e.g., HB9) or keyword..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div className="w-40">
            <label htmlFor="bill-status" className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              id="bill-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All</option>
              <option value="1">Introduced</option>
              <option value="2">Engrossed</option>
              <option value="3">Enrolled</option>
              <option value="4">Passed</option>
              <option value="5">Vetoed</option>
              <option value="6">Failed</option>
            </select>
          </div>
          
          <div className="w-36">
            <label htmlFor="bill-chamber" className="block text-sm font-medium text-gray-700 mb-1">
              Chamber
            </label>
            <select
              id="bill-chamber"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All</option>
              <option value="H">House</option>
              <option value="S">Senate</option>
            </select>
          </div>
          
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Search
            </button>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </form>

        {/* Recent Searches */}
        <RecentBillSearches 
          key={recentSearchKey} 
          onSearchClick={handleRecentSearchClick} 
        />
      </div>

      {/* Results Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {hasSearched ? "Search Results" : "Recent Activity"}
          </h2>
          {hasSearched && pagination && pagination.total > 10 && (
            <Link
              href={buildSearchUrl()}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View all {pagination.total} results →
            </Link>
          )}
          {!hasSearched && (
            <Link
              href="/legislation/bills"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View all bills →
            </Link>
          )}
        </div>

        {/* Results count when searching */}
        {hasSearched && pagination && (
          <p className="text-sm text-gray-600 mb-4">
            {pagination.total === 0 
              ? "No bills found" 
              : `Showing ${Math.min(10, pagination.total)} of ${pagination.total} bills`}
          </p>
        )}

        {/* Loading state */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : hasSearched ? (
          // Search results
          bills.length === 0 ? (
            <div className="text-center py-12 text-gray-500 bg-white rounded-lg border border-gray-200">
              No bills found matching your search
            </div>
          ) : (
            <div className="space-y-3">
              {bills.map((bill) => (
                <BillCard key={bill.id} bill={bill} showDescription={false} />
              ))}
            </div>
          )
        ) : (
          // Recent bills (default view)
          <div className="space-y-3">
            {recentBills.map((bill) => (
              <BillCard key={bill.id} bill={bill} showDescription={false} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
