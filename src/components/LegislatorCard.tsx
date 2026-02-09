"use client";

import Link from "next/link";

interface LegislatorCardProps {
  legislator: {
    id: string;
    name: string;
    firstName: string;
    lastName: string;
    party: string;
    role: string;
    district: string;
    imageUrl?: string | null;
    _count?: {
      sponsorships: number;
      voteRecords: number;
    };
  };
}

export default function LegislatorCard({ legislator }: LegislatorCardProps) {
  const partyColor = legislator.party === "D" 
    ? "bg-blue-100 text-blue-700 border-blue-200" 
    : legislator.party === "R"
    ? "bg-red-100 text-red-700 border-red-200"
    : "bg-gray-100 text-gray-700 border-gray-200";

  const roleLabel = legislator.role === "Rep" ? "Representative" : "Senator";
  const chamberLabel = legislator.role === "Rep" ? "House" : "Senate";

  return (
    <Link
      href={`/legislators/${legislator.id}`}
      className="block bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md hover:border-gray-300 transition-all"
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {legislator.imageUrl ? (
            <img
              src={legislator.imageUrl}
              alt={legislator.name}
              className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xl font-bold">
              {legislator.firstName[0]}{legislator.lastName[0]}
            </div>
          )}
        </div>
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900 truncate">
              {legislator.name}
            </h3>
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${partyColor}`}>
              {legislator.party}
            </span>
          </div>
          
          <p className="text-sm text-gray-600 mb-2">
            {roleLabel} - {legislator.district}
          </p>
          
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {legislator._count?.sponsorships || 0} bills
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              {legislator._count?.voteRecords || 0} votes
            </span>
          </div>
        </div>
        
        {/* Chamber badge */}
        <div className="flex-shrink-0">
          <span className={`text-xs font-medium px-2 py-1 rounded ${
            chamberLabel === "House" ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
          }`}>
            {chamberLabel}
          </span>
        </div>
      </div>
    </Link>
  );
}
