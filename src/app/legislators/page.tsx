"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import MainLayout from "@/components/MainLayout";
import LegislatorCard from "@/components/LegislatorCard";

interface Legislator {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  party: string;
  role: string;
  district: string;
  imageUrl: string | null;
  _count: {
    sponsorships: number;
    voteRecords: number;
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function LegislatorsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [legislators, setLegislators] = useState<Legislator[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [party, setParty] = useState(searchParams.get("party") || "");
  const [role, setRole] = useState(searchParams.get("role") || "");
  const [page, setPage] = useState(parseInt(searchParams.get("page") || "1"));

  const fetchLegislators = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (party) params.set("party", party);
      if (role) params.set("role", role);
      params.set("page", page.toString());
      params.set("limit", "50");

      const res = await fetch(`/api/legislation/legislators?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLegislators(data.legislators);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Error fetching legislators:", error);
    } finally {
      setLoading(false);
    }
  }, [search, party, role, page]);

  useEffect(() => {
    fetchLegislators();
  }, [fetchLegislators]);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (party) params.set("party", party);
    if (role) params.set("role", role);
    if (page > 1) params.set("page", page.toString());
    
    const newUrl = params.toString() ? `?${params}` : "/legislators";
    router.replace(newUrl, { scroll: false });
  }, [search, party, role, page, router]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLegislators();
  };

  const clearFilters = () => {
    setSearch("");
    setParty("");
    setRole("");
    setPage(1);
  };

  // Group by chamber
  const representatives = legislators.filter((l) => l.role === "Rep");
  const senators = legislators.filter((l) => l.role === "Sen");

  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Legislators</h1>
        <p className="text-gray-600">
          Browse New Mexico legislators and their voting records
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
              placeholder="Search by name or district..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          
          <div className="w-36">
            <label htmlFor="party" className="block text-sm font-medium text-gray-700 mb-1">
              Party
            </label>
            <select
              id="party"
              value={party}
              onChange={(e) => { setParty(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">All</option>
              <option value="D">Democrat</option>
              <option value="R">Republican</option>
            </select>
          </div>
          
          <div className="w-36">
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
              Chamber
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => { setRole(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">All</option>
              <option value="Rep">House</option>
              <option value="Sen">Senate</option>
            </select>
          </div>
          
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Search
            </button>
            {(search || party || role) && (
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
      </div>

      {/* Results count */}
      {pagination && (
        <p className="text-sm text-gray-600 mb-4">
          Showing {legislators.length} of {pagination.total} legislators
          {(search || party || role) && " (filtered)"}
        </p>
      )}

      {/* Legislators list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        </div>
      ) : legislators.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No legislators found matching your criteria
        </div>
      ) : (
        <div className="space-y-8">
          {/* Representatives */}
          {representatives.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-sm">House</span>
                Representatives ({representatives.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {representatives.map((legislator) => (
                  <LegislatorCard key={legislator.id} legislator={legislator} />
                ))}
              </div>
            </div>
          )}

          {/* Senators */}
          {senators.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-sm">Senate</span>
                Senators ({senators.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {senators.map((legislator) => (
                  <LegislatorCard key={legislator.id} legislator={legislator} />
                ))}
              </div>
            </div>
          )}
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Legislators</h1>
        <p className="text-gray-600">
          Browse New Mexico legislators and their voting records
        </p>
      </div>
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    </>
  );
}

export default function LegislatorsPage() {
  return (
    <MainLayout>
      <Suspense fallback={<LoadingFallback />}>
        <LegislatorsContent />
      </Suspense>
    </MainLayout>
  );
}
