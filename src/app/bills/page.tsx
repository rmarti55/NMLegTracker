"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import MainLayout from "@/components/MainLayout";
import BillCard from "@/components/BillCard";
import RecentBillSearches, { saveRecentSearch } from "@/components/RecentBillSearches";

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

function BillsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [bills, setBills] = useState<Bill[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [body, setBody] = useState(searchParams.get("body") || "");
  const [page, setPage] = useState(parseInt(searchParams.get("page") || "1"));
  const [recentSearchKey, setRecentSearchKey] = useState(0);

  const fetchBills = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      if (body) params.set("body", body);
      params.set("page", page.toString());
      params.set("limit", "25");

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
  }, [search, status, body, page]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (body) params.set("body", body);
    if (page > 1) params.set("page", page.toString());
    
    const newUrl = params.toString() ? `?${params}` : "/bills";
    router.replace(newUrl, { scroll: false });
  }, [search, status, body, page, router]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    
    // Save search to history
    if (search) {
      const saved = await saveRecentSearch(search);
      if (saved) {
        setRecentSearchKey(k => k + 1);
      }
    }
    
    fetchBills();
  };

  const handleRecentSearchClick = (query: string) => {
    setSearch(query);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setBody("");
    setPage(1);
  };

  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Bills</h1>
        <p className="text-gray-600">
          Search and filter legislation bills
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              id="search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by bill number, title..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          
          <div className="w-40">
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
            <label htmlFor="body" className="block text-sm font-medium text-gray-700 mb-1">
              Chamber
            </label>
            <select
              id="body"
              value={body}
              onChange={(e) => { setBody(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">All</option>
              <option value="H">House</option>
              <option value="S">Senate</option>
            </select>
          </div>
          
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Search
            </button>
            {(search || status || body) && (
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

      {/* Results count */}
      {pagination && (
        <p className="text-sm text-gray-600 mb-4">
          Showing {bills.length} of {pagination.total} bills
          {(search || status || body) && " (filtered)"}
        </p>
      )}

      {/* Bills list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        </div>
      ) : bills.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No bills found matching your criteria
        </div>
      ) : (
        <div className="space-y-3">
          {bills.map((bill) => (
            <BillCard key={bill.id} bill={bill} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Previous
          </button>
          
          <span className="px-4 py-2 text-sm text-gray-600">
            Page {page} of {pagination.totalPages}
          </span>
          
          <button
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page === pagination.totalPages}
            className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}

function LoadingFallback() {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Bills</h1>
        <p className="text-gray-600">
          Search and filter legislation bills
        </p>
      </div>
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    </>
  );
}

export default function BillsPage() {
  return (
    <MainLayout>
      <Suspense fallback={<LoadingFallback />}>
        <BillsContent />
      </Suspense>
    </MainLayout>
  );
}
