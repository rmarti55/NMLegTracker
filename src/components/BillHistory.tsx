"use client";

import { useState, useMemo } from "react";
import { 
  expandActionText, 
  parseHistoryData,
  parseNMlegisActionString,
  ExpandedSegment,
  ParsedNMlegisAction,
  HistoryDisplayItem
} from "@/lib/legislative-codes";

// Vote data for inline display
interface VoteData {
  id: string;
  date: Date | string;
  description: string;
  chamber: string;
  yea: number;
  nay: number;
  passed: boolean;
  votes?: Array<{
    voteText: string;
    person: {
      lastName: string;
      party: string;
    };
  }>;
}

// Accept either format - the component will detect
interface BillHistoryProps {
  history: unknown; // Can be LegiScan array or NMLegis object
  sessionName?: string; // e.g., "2026 Regular Session"
  maxItems?: number;
  showRawCodes?: boolean;
  votes?: VoteData[]; // Optional vote data to show inline
}

// Code segment component - shows inline explanations
function CodeSegment({ segment }: { segment: ExpandedSegment }) {
  const getSegmentStyle = () => {
    switch (segment.type) {
      case 'committee':
        return 'text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded';
      case 'action':
        return 'text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded';
      case 'vote':
        return 'text-green-700 bg-green-50 px-1.5 py-0.5 rounded font-medium';
      case 'referral':
        return 'text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded';
      case 'day':
        return 'text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded text-xs font-medium';
      default:
        return '';
    }
  };
  
  // No tooltip - just show the expanded text
  if (!segment.tooltip || segment.type === 'text') {
    return <span>{segment.expanded}</span>;
  }
  
  // Show the expanded text with full explanation inline
  return (
    <span className={`inline-block ${getSegmentStyle()}`}>
      {segment.expanded}
      <span className="text-gray-500 font-normal ml-1">
        — {segment.tooltip}
      </span>
    </span>
  );
}

// Render expanded action with tooltips
function ExpandedAction({ action, isImportant }: { action: string; isImportant: boolean }) {
  const expanded = useMemo(() => expandActionText(action), [action]);
  
  return (
    <span className={`text-sm leading-relaxed ${isImportant ? "text-gray-900 font-medium" : "text-gray-600"}`}>
      {expanded.segments.map((segment, idx) => (
        <span key={idx}>
          <CodeSegment segment={segment} />
          {idx < expanded.segments.length - 1 && (
            <span className="text-gray-400 mx-1.5">→</span>
          )}
        </span>
      ))}
    </span>
  );
}

// Status indicator icon based on status type
function StatusIcon({ status }: { status: ParsedNMlegisAction['status'] }) {
  switch (status) {
    case 'signed':
      return (
        <div className="p-3 bg-green-100 rounded-full">
          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      );
    case 'vetoed':
      return (
        <div className="p-3 bg-red-100 rounded-full">
          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      );
    case 'failed':
    case 'tabled':
      return (
        <div className="p-3 bg-gray-100 rounded-full">
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
      );
    case 'passed_both':
      return (
        <div className="p-3 bg-purple-100 rounded-full">
          <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
        </div>
      );
    case 'passed_one':
      return (
        <div className="p-3 bg-yellow-100 rounded-full">
          <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
      );
    case 'in_committee':
      return (
        <div className="p-3 bg-blue-100 rounded-full">
          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
      );
    default:
      return (
        <div className="p-3 bg-gray-100 rounded-full">
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      );
  }
}

// NMLegis format display - shows prominent current status
function NMlegisHistoryDisplay({ 
  parsed, 
  rawActions, 
  showRaw,
  sessionName 
}: { 
  parsed: ParsedNMlegisAction; 
  rawActions: string;
  showRaw: boolean;
  sessionName?: string;
}) {
  // Dynamic status label - include committee name for "in_committee"
  const getStatusLabel = () => {
    switch (parsed.status) {
      case 'prefiled': return 'Pre-filed';
      case 'in_committee': 
        return parsed.currentCommitteeName 
          ? `In ${parsed.currentCommitteeName}` 
          : 'In Committee';
      case 'passed_one': return 'Passed One Chamber';
      case 'passed_both': return 'Passed Both Chambers';
      case 'signed': return 'Signed Into Law';
      case 'vetoed': return 'Vetoed';
      case 'failed': return 'Failed';
      case 'tabled': return 'Tabled';
      default: return 'Unknown';
    }
  };

  const statusColor = {
    prefiled: 'text-gray-700 bg-gray-100',
    in_committee: 'text-blue-700 bg-blue-100',
    passed_one: 'text-yellow-700 bg-yellow-100',
    passed_both: 'text-purple-700 bg-purple-100',
    signed: 'text-green-700 bg-green-100',
    vetoed: 'text-red-700 bg-red-100',
    failed: 'text-gray-700 bg-gray-200',
    tabled: 'text-gray-600 bg-gray-100',
  };

  if (showRaw) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-500 mb-1">Raw Action Code</p>
          <p className="font-mono text-sm text-gray-900">{rawActions}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Status Card */}
      <div className="bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start gap-4">
          <StatusIcon status={parsed.status} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusColor[parsed.status]}`}>
                {getStatusLabel()}
              </span>
              {parsed.legislativeDay && (
                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                  Day {parsed.legislativeDay}{sessionName ? ` of ${sessionName}` : ' of Session'}
                </span>
              )}
            </div>
            
            <p className="text-lg font-semibold text-gray-900 mt-2">
              {parsed.summary}
            </p>

            {/* Referrals */}
            {parsed.referrals.length > 1 && (
              <div className="mt-3">
                <span className="text-sm text-gray-500 mr-2">Committee referrals:</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {parsed.referrals.map((code, i) => (
                    <span 
                      key={code}
                      className={`inline-flex flex-col px-2.5 py-1.5 rounded-lg text-xs ${
                        code === parsed.currentCommittee 
                          ? 'bg-purple-100 text-purple-800 ring-2 ring-purple-300' 
                          : 'bg-gray-100 text-gray-700'
                      }`}
                      title={code}
                    >
                      <span className="font-medium">
                        {parsed.referralNames[i]}
                        {code === parsed.currentCommittee && ' ← current'}
                      </span>
                      <span className="text-[10px] opacity-60">{code}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Timeline */}
      {parsed.actions.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Action History</h4>
          <div className="space-y-2">
            {parsed.actions.map((action, idx) => {
              const isImportant = ['passed', 'signed', 'vetoed', 'failed'].includes(action.type);
              const typeColors = {
                prefiled: 'bg-gray-100 border-gray-300',
                referred: 'bg-purple-50 border-purple-200',
                committee_action: 'bg-blue-50 border-blue-200',
                floor_action: 'bg-yellow-50 border-yellow-200',
                passed: 'bg-green-50 border-green-200',
                failed: 'bg-red-50 border-red-200',
                signed: 'bg-green-100 border-green-300',
                vetoed: 'bg-red-100 border-red-300',
                tabled: 'bg-gray-100 border-gray-300',
                other: 'bg-gray-50 border-gray-200',
              };
              
              return (
                <div 
                  key={idx}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${typeColors[action.type]}`}
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-xs font-medium text-gray-500">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${isImportant ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                      {action.description}
                    </p>
                    {action.committee && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {action.committeeName || action.committee}
                      </p>
                    )}
                  </div>
                  <code className="text-xs text-gray-400 font-mono">{action.code}</code>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Raw code reference */}
      <div className="pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          Raw action code: <code className="bg-gray-100 px-1.5 py-0.5 rounded">{rawActions}</code>
        </p>
      </div>
    </div>
  );
}

// Helper to find matching vote for a history item
function findMatchingVote(item: HistoryDisplayItem, votes?: VoteData[]): VoteData | undefined {
  if (!votes || votes.length === 0) return undefined;
  
  // Match by date and check if action mentions committee or passage
  const actionLower = item.action.toLowerCase();
  const isVoteAction = actionLower.includes('committee voted') || 
                       actionLower.includes('do pass') ||
                       actionLower.includes('passed');
  
  if (!isVoteAction || !item.date) return undefined;
  
  const itemDate = new Date(item.date).toDateString();
  
  return votes.find(v => {
    const voteDate = new Date(v.date).toDateString();
    return voteDate === itemDate && v.chamber === item.chamber;
  });
}

// Format vote details in human-readable way
function formatVoteDetails(vote: VoteData): string {
  const result = vote.passed ? 'passed' : 'failed';
  let details = `Vote ${result} ${vote.yea}-${vote.nay}`;
  
  // Add who voted no if it passed, or who voted yes if it failed
  if (vote.votes && vote.votes.length > 0) {
    const nayVoters = vote.votes
      .filter(v => v.voteText === 'Nay')
      .map(v => v.person.lastName);
    
    if (vote.passed && nayVoters.length > 0 && nayVoters.length <= 5) {
      details += `. Voting no: ${nayVoters.join(', ')}`;
    }
  }
  
  return details;
}

// Action type detection from action string
type ActionType = 'prefiled' | 'referred' | 'committee_action' | 'floor_action' | 'passed' | 'failed' | 'signed' | 'vetoed' | 'tabled' | 'other';

function getActionTypeFromString(action: string): ActionType {
  const lower = action.toLowerCase();
  if (lower.includes('signed into law') || lower.includes('chaptered')) return 'signed';
  if (lower.includes('vetoed') || lower.includes('veto')) return 'vetoed';
  if (lower.includes('passed')) return 'passed';
  if (lower.includes('failed') || lower.includes('did not pass') || lower.includes('do not pass')) return 'failed';
  if (lower.includes('tabled')) return 'tabled';
  if (lower.includes('referred to') || lower.includes('sent to')) return 'referred';
  if (lower.includes('committee') || lower.includes('do pass')) return 'committee_action';
  if (lower.includes('floor') || lower.includes('amendment') || lower.includes('concur')) return 'floor_action';
  if (lower.includes('pre-filed') || lower.includes('introduced') || lower.includes('filed')) return 'prefiled';
  return 'other';
}

// Dot colors for timeline based on action type
const dotColors: Record<ActionType, { bg: string; icon: string }> = {
  prefiled: { bg: 'bg-gray-400', icon: 'text-white' },
  referred: { bg: 'bg-purple-500', icon: 'text-white' },
  committee_action: { bg: 'bg-blue-500', icon: 'text-white' },
  floor_action: { bg: 'bg-yellow-500', icon: 'text-white' },
  passed: { bg: 'bg-green-500', icon: 'text-white' },
  failed: { bg: 'bg-red-500', icon: 'text-white' },
  signed: { bg: 'bg-green-600', icon: 'text-white' },
  vetoed: { bg: 'bg-red-600', icon: 'text-white' },
  tabled: { bg: 'bg-gray-500', icon: 'text-white' },
  other: { bg: 'bg-gray-300', icon: 'text-gray-500' },
};

// Icons for different action types
function ActionIcon({ actionType }: { actionType: ActionType }) {
  switch (actionType) {
    case 'signed':
    case 'passed':
      return (
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      );
    case 'failed':
    case 'vetoed':
      return (
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      );
    case 'referred':
      return (
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      );
    case 'committee_action':
      return (
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
        </svg>
      );
    case 'floor_action':
      return (
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
      );
    case 'tabled':
      return (
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      );
    case 'prefiled':
      return (
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
      );
    default:
      return (
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <circle cx="10" cy="10" r="3" />
        </svg>
      );
  }
}

// LegiScan format display - timeline view
function LegiScanHistoryDisplay({ 
  items, 
  maxItems,
  showRaw,
  votes
}: { 
  items: HistoryDisplayItem[];
  maxItems?: number;
  showRaw: boolean;
  votes?: VoteData[];
}) {
  // First, sort chronologically ascending to assign proper step numbers
  // Step 1 = first action, Step N = most recent action
  const chronologicalOrder = [...items].sort((a, b) => {
    // Sort by date ascending (oldest first)
    if (a.date && b.date) {
      const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateCompare !== 0) return dateCompare;
    }
    // Within same date, sort by sequence ascending (lower = earlier)
    return (a.sequence ?? 0) - (b.sequence ?? 0);
  });
  
  // Create a map of item -> display step number (1-based, chronological)
  const stepMap = new Map<HistoryDisplayItem, number>();
  chronologicalOrder.forEach((item, idx) => {
    stepMap.set(item, idx + 1);
  });
  
  // Now sort for display: date descending (most recent first)
  const sortedHistory = [...items].sort((a, b) => {
    // First compare by date (descending - most recent first)
    if (a.date && b.date) {
      const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateCompare !== 0) return dateCompare;
    }
    // If same date, compare by sequence (descending - higher sequence = more recent)
    const seqA = a.sequence ?? 0;
    const seqB = b.sequence ?? 0;
    return seqB - seqA;
  });
  
  const displayHistory = maxItems ? sortedHistory.slice(0, maxItems) : sortedHistory;
  const totalSteps = items.length;

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {displayHistory.map((item, idx) => {
          const isLast = idx === displayHistory.length - 1;
          const chamberColor = item.chamber === "H" 
            ? "bg-blue-100 text-blue-700" 
            : "bg-purple-100 text-purple-700";
          
          // Find matching vote for this history item
          const matchingVote = findMatchingVote(item, votes);
          
          // Determine action type and colors for the timeline dot
          const actionType = getActionTypeFromString(item.action);
          const dotStyle = dotColors[actionType];
          
          // Get the chronological step number for display
          const displayStep = stepMap.get(item);

          return (
            <li key={idx}>
              <div className="relative pb-8">
                {!isLast && (
                  <span
                    className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200"
                    aria-hidden="true"
                  />
                )}
                <div className="relative flex space-x-3">
                  <div>
                    <span
                      className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${dotStyle.bg}`}
                    >
                      <span className={dotStyle.icon}>
                        <ActionIcon actionType={actionType} />
                      </span>
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                    <div className="flex-1 min-w-0">
                      {displayStep && (
                        <div className="mb-1">
                          <span className="inline-block px-1.5 py-0.5 bg-gray-100 text-gray-500 text-xs rounded font-medium">
                            Step {displayStep} of {totalSteps}
                          </span>
                        </div>
                      )}
                      <div>
                        {showRaw ? (
                          <p className={`text-sm font-mono ${item.isImportant ? "text-gray-900 font-medium" : "text-gray-600"}`}>
                            {item.action}
                          </p>
                        ) : (
                          <ExpandedAction action={item.action} isImportant={item.isImportant} />
                        )}
                      </div>
                      {/* Inline vote details */}
                      {matchingVote && !showRaw && (
                        <p className={`text-xs mt-1 ${matchingVote.passed ? 'text-green-600' : 'text-red-600'}`}>
                          {formatVoteDetails(matchingVote)}
                        </p>
                      )}
                    </div>
                    <div className="whitespace-nowrap text-right text-sm flex-shrink-0">
                      {item.chamber && (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${chamberColor}`}>
                          {item.chamber === "H" ? "House" : "Senate"}
                        </span>
                      )}
                      {item.date && (
                        <time className="block text-gray-500 mt-1">
                          {new Date(item.date).toLocaleDateString()}
                        </time>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      
      {maxItems && items.length > maxItems && (
        <p className="text-sm text-gray-500 mt-4 text-center">
          + {items.length - maxItems} more actions
        </p>
      )}
    </div>
  );
}

export default function BillHistory({ history, sessionName, maxItems, showRawCodes = false, votes }: BillHistoryProps) {
  const [showRaw, setShowRaw] = useState(showRawCodes);
  
  // Parse the history data to detect format
  const parsedHistory = useMemo(() => parseHistoryData(history), [history]);

  // No history data
  if (parsedHistory.format === 'unknown' || parsedHistory.items.length === 0) {
    // Check if we have raw NMLegis data we can still parse
    if (history && typeof history === 'object' && 'actions' in (history as Record<string, unknown>)) {
      const nmlegisHistory = history as { actions?: string };
      if (nmlegisHistory.actions) {
        const parsed = parseNMlegisActionString(nmlegisHistory.actions);
        return (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => setShowRaw(!showRaw)}
                className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                {showRaw ? "Show Interpreted" : "Show Raw Code"}
              </button>
            </div>
            <NMlegisHistoryDisplay 
              parsed={parsed} 
              rawActions={nmlegisHistory.actions} 
              showRaw={showRaw}
              sessionName={sessionName}
            />
          </div>
        );
      }
    }
    
    return (
      <div className="text-center py-8">
        <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p className="text-gray-500">No action history available yet</p>
        <p className="text-xs text-gray-400 mt-1">Check back as the legislative session progresses</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toggle for raw vs expanded view */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowRaw(!showRaw)}
          className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          {showRaw ? "Show Interpreted" : "Show Raw Codes"}
        </button>
      </div>

      {/* Render based on format */}
      {parsedHistory.format === 'nmlegis' && parsedHistory.nmlegisData ? (
        <NMlegisHistoryDisplay 
          parsed={parsedHistory.nmlegisData} 
          rawActions={parsedHistory.rawActions || ''} 
          showRaw={showRaw}
          sessionName={sessionName}
        />
      ) : (
        <LegiScanHistoryDisplay 
          items={parsedHistory.items} 
          maxItems={maxItems}
          showRaw={showRaw}
          votes={votes}
        />
      )}
    </div>
  );
}
