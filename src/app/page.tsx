import BillSearchSection from "@/components/BillSearchSection";
import SyncStatusBadge from "@/components/SyncStatusBadge";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import MainLayout from "@/components/MainLayout";

export const dynamic = "force-dynamic";

async function getStats() {
  const [
    totalBills,
    totalLegislators,
    totalVotes,
    sessions,
    billsByStatus,
    recentBills,
  ] = await Promise.all([
    prisma.legiBill.count(),
    prisma.legiPerson.count(),
    prisma.legiRollCall.count(),
    prisma.legiSession.findMany({
      orderBy: { yearStart: "desc" },
    }),
    prisma.legiBill.groupBy({
      by: ["status"],
      _count: true,
    }),
    prisma.legiBill.findMany({
      take: 10,
      orderBy: { statusDate: "desc" },
      include: {
        sponsors: {
          include: {
            person: true,
          },
          orderBy: {
            sponsorOrder: "asc",
          },
        },
        _count: {
          select: {
            votes: true,
          },
        },
      },
    }),
  ]);

  const statusNames: Record<number, string> = {
    1: "Introduced",
    2: "Engrossed",
    3: "Enrolled",
    4: "Passed",
    5: "Vetoed",
    6: "Failed",
  };

  return {
    totals: {
      bills: totalBills,
      legislators: totalLegislators,
      votes: totalVotes,
    },
    sessions,
    billsByStatus: billsByStatus.map((s) => ({
      status: s.status,
      statusName: statusNames[s.status] || `Status ${s.status}`,
      count: s._count,
    })),
    recentBills,
  };
}

export default async function HomePage() {
  const stats = await getStats();

  return (
    <MainLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">NM Legislation Tracker</h1>
        <p className="text-gray-600 mb-2">
          Browse and track New Mexico legislation.
        </p>
        <SyncStatusBadge />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Link
          href="/bills"
          className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md hover:border-gray-300 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500">Bills</p>
              <p className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{stats.totals.bills}</p>
            </div>
          </div>
        </Link>

        <Link
          href="/legislators"
          className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md hover:border-gray-300 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500">Legislators</p>
              <p className="text-xl font-bold text-gray-900 group-hover:text-green-600 transition-colors">{stats.totals.legislators}</p>
            </div>
          </div>
        </Link>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500">Votes</p>
              <p className="text-xl font-bold text-gray-900">{stats.totals.votes}</p>
            </div>
          </div>
        </div>

        {/* Bills by Status - compact */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-2">By Status</p>
          <div className="flex flex-wrap gap-1">
            {stats.billsByStatus.slice(0, 4).map((item) => (
              <Link
                key={item.status}
                href={`/bills?status=${item.status}`}
                className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                title={item.statusName}
              >
                {item.statusName.slice(0, 3)}: {item.count}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Bill Search Section */}
      <BillSearchSection 
        recentBills={stats.recentBills.map((bill) => ({
          ...bill,
          statusDate: bill.statusDate?.toISOString() ?? null,
        }))}
      />
    </MainLayout>
  );
}
