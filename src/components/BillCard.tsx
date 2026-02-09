"use client";

import Link from "next/link";
import BillStatusBadge from "./BillStatusBadge";

interface Sponsor {
  person: {
    id: string;
    name: string;
    party: string;
    district: string;
  };
  sponsorType: number;
}

interface BillCardProps {
  bill: {
    id: string;
    billNumber: string;
    title: string;
    description?: string | null;
    status: number;
    statusDate?: string | null;
    body: string;
    url?: string | null;
    sponsors?: Sponsor[];
    _count?: {
      votes: number;
    };
  };
  showDescription?: boolean;
}

export default function BillCard({ bill, showDescription = true }: BillCardProps) {
  const primarySponsor = bill.sponsors?.find((s) => s.sponsorType === 1);
  const coSponsors = bill.sponsors?.filter((s) => s.sponsorType !== 1) || [];
  
  const bodyLabel = bill.body === "H" ? "House" : "Senate";
  const bodyColor = bill.body === "H" ? "text-blue-600" : "text-purple-600";

  return (
    <Link
      href={`/bills/${bill.id}`}
      className="block bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md hover:border-gray-300 transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`font-mono font-bold text-lg ${bodyColor}`}>
              {bill.billNumber}
            </span>
            <span className="text-xs text-gray-500">{bodyLabel}</span>
            <BillStatusBadge status={bill.status} size="sm" />
          </div>
          
          <h3 className="font-medium text-gray-900 line-clamp-2 mb-1">
            {bill.title}
          </h3>
          
          {showDescription && bill.description && bill.description !== bill.title && (
            <p className="text-sm text-gray-600 line-clamp-2 mb-2">
              {bill.description}
            </p>
          )}
          
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {primarySponsor && (
              <span className="text-gray-600">
                <span className="text-gray-400">Sponsor:</span>{" "}
                <span className="font-medium">
                  {primarySponsor.person.name}
                </span>
                <span className={`ml-1 ${primarySponsor.person.party === "D" ? "text-blue-600" : "text-red-600"}`}>
                  ({primarySponsor.person.party})
                </span>
              </span>
            )}
            
            {coSponsors.length > 0 && (
              <span className="text-gray-500">
                +{coSponsors.length} co-sponsor{coSponsors.length !== 1 ? "s" : ""}
              </span>
            )}
            
            {bill._count && bill._count.votes > 0 && (
              <span className="text-gray-500">
                {bill._count.votes} vote{bill._count.votes !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        
        {bill.statusDate && (
          <div className="text-right text-sm text-gray-500 whitespace-nowrap">
            {new Date(bill.statusDate).toLocaleDateString()}
          </div>
        )}
      </div>
    </Link>
  );
}
