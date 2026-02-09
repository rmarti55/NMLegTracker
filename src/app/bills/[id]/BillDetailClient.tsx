"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import BillHistory from "@/components/BillHistory";
import VoteChart from "@/components/VoteChart";
import BillChatPanel from "@/components/BillChatPanel";
import Breadcrumbs from "@/components/Breadcrumbs";
import { getMostRecentAction, getCurrentBillLocation, LegiScanHistoryItem } from "@/lib/legislative-codes";

// Human-readable bill type names
function getBillTypeName(type: string): string {
  const typeNames: Record<string, string> = {
    'B': 'Bill',
    'M': 'Memorial',
    'JM': 'Joint Memorial',
    'R': 'Resolution',
    'JR': 'Joint Resolution',
    'CR': 'Concurrent Resolution',
    'CA': 'Constitutional Amendment',
  };
  return typeNames[type] || type;
}
import { MessageSquare, X, FileText } from "lucide-react";

interface Sponsor {
  person: {
    id: string;
    firstName: string;
    lastName: string;
    name: string;
    party: string;
    role: string;
    district: string;
    county?: string | null;
  };
  sponsorType: number;
}

interface Vote {
  id: string;
  date: Date;
  description: string;
  chamber: string;
  yea: number;
  nay: number;
  nv: number;
  absent: number;
  total: number;
  passed: boolean;
  votes: Array<{
    id: string;
    voteText: string;
    person: {
      lastName: string;
      party: string;
    };
  }>;
}

// History format from database - now always LegiScan-compatible array
interface HistoryItem {
  date: string;
  action: string;
  chamber: string;
  chamber_id: number;
  importance: number;
}

interface TextItem {
  doc_id: number;
  date: string;
  type: string;
  url: string;
  state_link: string;
}

interface SupplementItem {
  supplement_id: number;
  date: string;
  type: string;
  title: string;
  url: string;
  state_link: string;
}

interface BillDetailClientProps {
  bill: {
    id: string;
    billNumber: string;
    title: string;
    description: string | null;
    status: number;
    statusDate: Date | null;
    body: string;
    url: string | null;
    stateLink: string | null;
    billType: string;
    fullText: string | null;
    fullTextUrl: string | null;
    session: {
      sessionName: string;
    };
    sponsors: Sponsor[];
    votes: Vote[];
    history: HistoryItem[] | null;
    texts: TextItem[] | null;
    supplements: SupplementItem[] | null;
  };
}

export default function BillDetailClient({ bill }: BillDetailClientProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [textOpen, setTextOpen] = useState(false);

  const primarySponsors = bill.sponsors.filter((s) => s.sponsorType === 1);
  const coSponsors = bill.sponsors.filter((s) => s.sponsorType !== 1);
  const texts = bill.texts || [];
  const supplements = bill.supplements || [];
  
  // Check if we have any history data
  const hasHistory = bill.history && bill.history.length > 0;
  
  // Get the most recent action for display in sidebar
  const lastAction = useMemo(() => {
    if (bill.history && bill.history.length > 0) {
      return getMostRecentAction(bill.history as LegiScanHistoryItem[]);
    }
    return null;
  }, [bill.history]);

  // Get the current location of the bill
  const billLocation = useMemo(() => {
    return getCurrentBillLocation(bill.history as LegiScanHistoryItem[], bill.body);
  }, [bill.history, bill.body]);

  return (
    <div className="relative">
      {/* Header */}
      <div className="mb-8">
        <Breadcrumbs
          items={[
            { label: "Legislation", href: "/legislation" },
            { label: "Bills", href: "/legislation/bills" },
            { label: bill.billNumber },
          ]}
        />
        
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{bill.billNumber}</h1>
            <h2 className="text-xl text-gray-700 mb-2">{bill.title}</h2>
            {bill.description && bill.description.toLowerCase() !== bill.title.toLowerCase() && (
              <p className="text-gray-600 mb-3">{bill.description}</p>
            )}
            
            {/* Current Location - Prominent Display */}
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${
              billLocation.status === 'signed' ? 'bg-green-100 text-green-800' :
              billLocation.status === 'vetoed' ? 'bg-red-100 text-red-800' :
              billLocation.status === 'failed' ? 'bg-gray-100 text-gray-700' :
              billLocation.status === 'passed_both' ? 'bg-purple-100 text-purple-800' :
              billLocation.status === 'passed_house' || billLocation.status === 'passed_senate' ? 'bg-yellow-100 text-yellow-800' :
              'bg-blue-100 text-blue-800'
            }`}>
              {billLocation.status === 'in_committee' && (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
              {(billLocation.status === 'passed_house' || billLocation.status === 'passed_senate') && (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              )}
              {billLocation.status === 'passed_both' && (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              )}
              {billLocation.status === 'signed' && (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {billLocation.status === 'vetoed' && (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {billLocation.status === 'failed' && (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              )}
              <span className="font-medium">{billLocation.location}</span>
            </div>
          </div>
          
          <div className="flex gap-2 flex-wrap">
            {/* Chat toggle button */}
            <button
              onClick={() => setChatOpen(true)}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm flex items-center gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              Ask AI
            </button>
            {/* View Text button */}
            {bill.fullText && (
              <button
                onClick={() => setTextOpen(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                View Text
              </button>
            )}
            {bill.stateLink && (
              <a
                href={bill.stateLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                State Legislature →
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-8">
          {/* History - Most important widget, shown first */}
          {hasHistory && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Bill History & Status</h3>
              <BillHistory history={bill.history} sessionName={bill.session.sessionName} votes={bill.votes} />
            </div>
          )}
          
          {/* Show placeholder if no history yet */}
          {!hasHistory && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Bill History & Status</h3>
              <BillHistory history={null} sessionName={bill.session.sessionName} />
            </div>
          )}

          {/* Sponsors */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Sponsors</h3>
            
            {primarySponsors.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-500 mb-2">Primary Sponsor{primarySponsors.length > 1 ? "s" : ""}</h4>
                <div className="space-y-2">
                  {primarySponsors.map((s) => (
                    <Link
                      key={s.person.id}
                      href={`/legislation/legislators/${s.person.id}`}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50"
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${
                        s.person.party === "D" ? "bg-blue-500" : "bg-red-500"
                      }`}>
                        {s.person.firstName[0]}{s.person.lastName[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{s.person.name}</p>
                        <p className="text-sm text-gray-500">
                          {s.person.role === "Rep" ? "Representative" : "Senator"} - District {s.person.district.replace(/[HS]D-0*/, "")}
                          {s.person.county && `, ${s.person.county} County`}
                        </p>
                      </div>
                      <span className={`ml-auto px-2 py-0.5 rounded text-xs font-medium ${
                        s.person.party === "D" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"
                      }`}>
                        {s.person.party === "D" ? "Democrat" : "Republican"}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            
            {coSponsors.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">Co-Sponsors ({coSponsors.length})</h4>
                <div className="flex flex-wrap gap-2">
                  {coSponsors.map((s) => (
                    <Link
                      key={s.person.id}
                      href={`/legislation/legislators/${s.person.id}`}
                      className={`px-3 py-1.5 rounded-full text-sm border hover:shadow transition-all ${
                        s.person.party === "D" 
                          ? "border-blue-200 text-blue-700 hover:bg-blue-50" 
                          : "border-red-200 text-red-700 hover:bg-red-50"
                      }`}
                    >
                      {s.person.name} ({s.person.party === "D" ? "D" : "R"})
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {bill.votes.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Roll Call Votes</h3>
              <div className="space-y-6">
                {bill.votes.map((vote) => (
                  <div key={vote.id} className="border-b border-gray-100 pb-6 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium text-gray-900">{vote.description}</h4>
                        <p className="text-sm text-gray-500">
                          {vote.chamber === "H" ? "House" : "Senate"} • {new Date(vote.date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    <VoteChart
                      yea={vote.yea}
                      nay={vote.nay}
                      nv={vote.nv}
                      absent={vote.absent}
                      total={vote.total}
                      passed={vote.passed}
                    />
                    
                    {vote.votes.length > 0 && (
                      <details className="mt-4">
                        <summary className="text-sm text-blue-600 cursor-pointer hover:text-blue-700">
                          View individual votes ({vote.votes.length})
                        </summary>
                        <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                          {vote.votes.sort((a, b) => a.person.lastName.localeCompare(b.person.lastName)).map((v) => (
                            <div
                              key={v.id}
                              className={`px-2 py-1 rounded ${
                                v.voteText === "Yea" 
                                  ? "bg-green-50 text-green-700"
                                  : v.voteText === "Nay"
                                  ? "bg-red-50 text-red-700"
                                  : "bg-gray-50 text-gray-600"
                              }`}
                            >
                              <span className="font-medium">{v.person.lastName}</span>
                              <span className={`ml-1 ${
                                v.person.party === "D" ? "text-blue-600" : "text-red-600"
                              }`}>({v.person.party})</span>
                              <span className="ml-1">- {v.voteText}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Info card */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Details</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-gray-500">Session</dt>
                <dd className="font-medium text-gray-900">{bill.session.sessionName}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Chamber</dt>
                <dd className="font-medium text-gray-900">{bill.body === "H" ? "House" : "Senate"}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Bill Type</dt>
                <dd className="font-medium text-gray-900">{getBillTypeName(bill.billType)}</dd>
              </div>
              {(lastAction || bill.statusDate) && (
                <div>
                  <dt className="text-sm text-gray-500">Last Action</dt>
                  {lastAction ? (
                    <dd className="font-medium text-gray-900">
                      <span className="block">{lastAction.action}</span>
                      <span className="text-sm text-gray-500">
                        {new Date(lastAction.date).toLocaleDateString()}
                      </span>
                    </dd>
                  ) : bill.statusDate ? (
                    <dd className="font-medium text-gray-900">
                      {new Date(bill.statusDate).toLocaleDateString()}
                    </dd>
                  ) : null}
                </div>
              )}
            </dl>
          </div>

          {/* Documents */}
          {(texts.length > 0 || supplements.length > 0) && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Documents</h3>
              
              {texts.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Bill Text</h4>
                  <div className="space-y-2">
                    {texts.map((text) => (
                      <a
                        key={text.doc_id}
                        href={text.state_link || text.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 text-sm"
                      >
                        <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                        </svg>
                        <span className="flex-1 text-gray-700">{text.type}</span>
                        <span className="text-gray-400 text-xs">{text.date}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
              
              {supplements.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Other Documents</h4>
                  <div className="space-y-2">
                    {supplements.map((doc) => (
                      <a
                        key={doc.supplement_id}
                        href={doc.state_link || doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 text-sm"
                      >
                        <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                        </svg>
                        <span className="flex-1 text-gray-700">{doc.title || doc.type}</span>
                        <span className="text-gray-400 text-xs">{doc.date}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Chat Sidebar */}
      {chatOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setChatOpen(false)}
          />
          
          {/* Chat Panel */}
          <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col">
            {/* Close button */}
            <button
              onClick={() => setChatOpen(false)}
              className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg z-10"
            >
              <X className="w-5 h-5" />
            </button>
            
            {/* Chat content */}
            <BillChatPanel
              billId={bill.id}
              billTitle={`${bill.billNumber} - ${bill.title}`}
            />
          </div>
        </>
      )}

      {/* Bill Text Modal */}
      {textOpen && bill.fullText && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setTextOpen(false)}
          />
          
          {/* Text Panel */}
          <div className="fixed inset-4 md:inset-8 lg:inset-16 bg-white shadow-xl z-50 flex flex-col rounded-lg overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {bill.billNumber} - Bill Text
                </h3>
                {bill.fullTextUrl && (
                  <a
                    href={bill.fullTextUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    View original source →
                  </a>
                )}
              </div>
              <button
                onClick={() => setTextOpen(false)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
              <div 
                className="prose prose-sm max-w-none bill-text-content"
                dangerouslySetInnerHTML={{ __html: bill.fullText }}
              />
            </div>
          </div>
        </>
      )}

    </div>
  );
}
