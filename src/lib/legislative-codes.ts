/**
 * New Mexico Legislature Abbreviation Codes
 * 
 * Reference: https://www.nmlegis.gov/Legislation/Key_To_Abbreviations
 * 
 * This file contains all action codes and committee abbreviations used
 * by the NM Legislature to track bill progress.
 */

// Action codes with short and full descriptions
export const ACTION_CODES: Record<string, { short: string; full: string }> = {
  // Symbols
  "*": { short: "Emergency clause", full: "Emergency clause. If a bill passes by less than the required two-thirds vote, this symbol is deleted." },
  
  // General Actions
  "API": { short: "Postponed Indefinitely", full: "Action postponed indefinitely" },
  "CA": { short: "Constitutional Amendment", full: "Constitutional Amendment" },
  "CC": { short: "Conference Committee", full: "Conference committee. This entry follows when the Senate and House fail to agree on amendments to a bill." },
  "CS": { short: "Committee Substitute", full: "Committee substitute. This entry, following a DNP report, indicates the committee's substitute bill. Succeeding entries will record the action on the committee substitute." },
  "DEAD": { short: "Dead", full: "Bill Has Died" },
  
  // Do Not Pass
  "DNP": { short: "Do Not Pass", full: "DO NOT PASS committee report adopted" },
  "DNP.": { short: "Do Not Pass", full: "DO NOT PASS committee report adopted" },
  "DNP nt adptd": { short: "DNP Not Adopted", full: "DO NOT PASS committee report NOT adopted" },
  
  // Do Pass
  "DP": { short: "Do Pass", full: "DO PASS committee report adopted" },
  "DP/a": { short: "Do Pass (amended)", full: "DO PASS, as amended, committee report adopted" },
  
  // E&E and procedural
  "E&E": { short: "Enrolled & Engrossed", full: "The final authoritative version of a bill passed by both houses of the legislature. The preparation is performed by the house of introduction and incorporates all amendments adopted and agreed to by both houses." },
  
  // Passed/Failed
  "PASSED": { short: "Passed", full: "Passed" },
  "PASS": { short: "Passed", full: "Passed" },
  "PASSED/H": { short: "Passed House", full: "Passed House (always followed by announced vote)" },
  "PASSED/S": { short: "Passed Senate", full: "Passed Senate (always followed by announced vote)" },
  "FAILED/H": { short: "Failed House", full: "Failed passage in House (sometimes followed by announced vote)" },
  "FAILED/S": { short: "Failed Senate", full: "Failed passage in Senate (sometimes followed by announced vote)" },
  
  // Floor actions
  "FL/": { short: "Floor Substitute", full: "Floor substitute. A bill or committee substitute may be substituted on final passage by any legislator. Succeeding entries will record the action on the floor substitute." },
  "fl/a": { short: "Floor Amendment", full: "Floor amendment adopted" },
  "fl/aa": { short: "Floor Amendments (2)", full: "Two floor amendments adopted" },
  "fl/aaa": { short: "Floor Amendments (3)", full: "Three floor amendments adopted" },
  
  // Concurrence
  "h/fld cncr": { short: "House Failed Concur", full: "House has failed to concur in Senate amendments on a House bill. The House then sends a message requesting the Senate to recede from its amendments." },
  "s/cncrd": { short: "Senate Concurred", full: "Senate has concurred in House amendments on a Senate bill" },
  "s/fld recede": { short: "Senate Failed Recede", full: "This procedure could follow if the Senate refuses to recede from its amendments" },
  
  // Germane
  "germane": { short: "Germane", full: "Bills which fall within the purview of a 30-day session" },
  
  // Motion to reconsider
  "m/rcnsr adptd": { short: "Reconsider Adopted", full: "Motion to reconsider previous action adopted" },
  
  // Recall
  "rcld frm/h": { short: "Recalled from House", full: "Bill recalled from the House for further consideration by the Senate" },
  "rcld frm/s": { short: "Recalled from Senate", full: "Bill recalled from the Senate for further consideration by the House" },
  
  // Signed/Vetoed
  "SGND": { short: "Signed", full: "Signed by one or both houses. For legislation not requiring Governor's signature." },
  "SGND.": { short: "Signed", full: "Signed by one or both houses. For legislation not requiring Governor's signature." },
  "PSGN": { short: "Signed", full: "Signed by the Governor" },
  "PVET": { short: "Vetoed", full: "Vetoed by the Governor" },
  "PKVT": { short: "Pocket Veto", full: "Pocket Veto" },
  "VETO": { short: "Vetoed", full: "Vetoed by the Governor" },
  
  // Certificates and Chapters
  "OCER": { short: "Certificate", full: "Certificate" },
  "PCH": { short: "Chaptered", full: "Chaptered into law" },
  "PCA": { short: "Constitutional Amendment", full: "Constitutional Amendment" },
  
  // Substitution
  "QSUB": { short: "Substituted", full: "Substituted" },
  
  // Tabling
  "T": { short: "Speaker's Table", full: "On the Speaker's table by rule (temporary calendar). This entry appears only on House action. By House Rule 11-20-1, legislation, except that on the Consent Calendar, is placed on the Speaker's table for 24 hours before being placed on the House Calendar for action by the House." },
  "tbld": { short: "Tabled", full: "Tabled temporarily by motion" },
  "TBLD INDEF": { short: "Tabled Indefinitely", full: "Tabled indefinitely" },
  "TBLD INDEF.": { short: "Tabled Indefinitely", full: "Tabled indefinitely" },
  
  // Withdrawn
  "w/drn": { short: "Withdrawn", full: "Withdrawn from committee or daily calendar for subsequent action" },
  "w/o rec": { short: "Without Recommendation", full: "WITHOUT RECOMMENDATION committee report adopted" },
  
  // Printing
  "prntd": { short: "Printed", full: "Bill has been printed" },
  "nt prntd": { short: "Not Printed", full: "Bill not printed" },
  "nt ref com": { short: "Not Referred", full: "Not referred to committee" },
};

// Committee abbreviations
export const COMMITTEE_CODES: Record<string, string> = {
  // House Committees
  "HAAWC": "House Agriculture, Acequias And Water Resources",
  "HAFC": "Appropriations & Finance",
  "HAGC": "House Agriculture & Water Resources Committee",
  "HAWC": "Agriculture, Water & Wildlife",
  "HBEC": "Business & Employment",
  "HBIC": "House Business & Industry Committee",
  "HCAL": "House Calendar",
  "HCAT": "House Temporary Calendar",
  "HCEDC": "Commerce & Economic Development Committee",
  "HCNR": "House Concurrence Calendar",
  "HCPAC": "House Consumer & Public Affairs Committee",
  "HCW": "Committee of the Whole",
  "HE&EC": "Enrolling & Engrossing",
  "HEC": "Education",
  "HEEC": "House Enrolling & Engrossing Committee",
  "HEENC": "Energy, Environment & Natural Resources (former)",
  "HENRC": "House Energy, Environment & Natural Resources",
  "HGEIC": "Government, Elections & Indian Affairs",
  "HGUAC": "House Government & Urban Affairs",
  "HHC": "Health",
  "HHGAC": "House Health & Government Affairs Committee",
  "HHGIC": "House Health, Government & Indian Affairs Committee",
  "HHHC": "House Health & Human Services",
  "HINT": "House Intro",
  "HJC": "Judiciary",
  "HLC": "House Labor & Human Resources Committee",
  "HLEDC": "House Labor & Economic Development",
  "HLELC": "House Local Government, Elections, Land Grants & Cultural Affairs",
  "HLLC": "Local Government, Land Grants & Cultural Affairs",
  "HLVMC": "Labor, Veterans' And Military Affairs Committee",
  "HPREF": "House Pre-file",
  "HPSC": "Printing & Supplies",
  "HRC": "Rules & Order of Business",
  "HRDLC": "House Rural Development, Land Grants And Cultural Affairs",
  "HRPAC": "Regulatory & Public Affairs",
  "HSCAC": "Safety & Civil Affairs",
  "HSEIC": "State Government, Elections & Indian Affairs Committee",
  "HSIVC": "House State Government, Indian & Veterans' Affairs",
  "HTBL": "House Table",
  "HTC": "House Transportation Committee",
  "HTPWC": "Transportation & Public Works",
  "HTRC": "House Taxation & Revenue Committee",
  "HVEC": "House Voters & Elections Committee",
  "HWMC": "Ways & Means",
  "HXPSC": "House Printing & Supplies Committee",
  "HXRC": "House Rules & Order of Business",
  "HZLM": "In Limbo (House)",
  
  // Senate Committees
  "SCAL": "Senate Calendar",
  "SCC": "Committees' Committee",
  "SCNR": "Senate Concurrence Calendar",
  "SCONC": "Conservation",
  "SCORC": "Corporations & Transportation",
  "SCW": "Committee of the Whole",
  "SEC": "Education",
  "SFC": "Finance",
  "SGC": "Senate Select Gaming Committee",
  "SHPAC": "Senate Health and Public Affairs",
  "SIAC": "Indian & Cultural Affairs",
  "SINT": "Senate Intro",
  "SIRC": "Senate Indian, Rural and Cultural Affairs",
  "SJC": "Judiciary",
  "SPAC": "Public Affairs",
  "SPREF": "Senate Pre-file",
  "SRC": "Rules",
  "STBL": "Senate Table",
  "STBTC": "Senate Tax, Business and Transportation",
  "SWMC": "Senate Ways & Means Committee",
  "SZLM": "In Limbo (Senate)",
};

// Status codes (from LegiScan) - Human-readable labels
export const STATUS_CODES: Record<number, { label: string; description: string }> = {
  1: { label: "In Committee", description: "Being reviewed by committee" },
  2: { label: "Passed One Chamber", description: "Heading to the other chamber" },
  3: { label: "Passed Both Chambers", description: "Waiting for Governor's signature" },
  4: { label: "Signed Into Law", description: "Signed by the Governor" },
  5: { label: "Vetoed", description: "Rejected by the Governor" },
  6: { label: "Did Not Pass", description: "Failed to advance" },
};

// Legislative day notation pattern: [30] means legislative day 30
export const LEGISLATIVE_DAY_PATTERN = /\[(\d+)\]/g;

/**
 * Get the meaning of an action code
 */
export function getActionMeaning(code: string): { short: string; full: string } | null {
  // Try exact match first
  if (ACTION_CODES[code]) {
    return ACTION_CODES[code];
  }
  
  // Try uppercase
  const upperCode = code.toUpperCase();
  if (ACTION_CODES[upperCode]) {
    return ACTION_CODES[upperCode];
  }
  
  // Try with trailing period
  if (ACTION_CODES[code + "."]) {
    return ACTION_CODES[code + "."];
  }
  
  return null;
}

/**
 * Get the meaning of a committee code
 */
export function getCommitteeMeaning(code: string): string | null {
  const upperCode = code.toUpperCase();
  return COMMITTEE_CODES[upperCode] || null;
}

/**
 * Check if a string is a known committee code
 */
export function isCommitteeCode(code: string): boolean {
  return code.toUpperCase() in COMMITTEE_CODES;
}

/**
 * Check if a string is a known action code
 */
export function isActionCode(code: string): boolean {
  const upperCode = code.toUpperCase();
  return upperCode in ACTION_CODES || (upperCode + ".") in ACTION_CODES;
}

export interface ExpandedSegment {
  original: string;
  expanded: string;
  type: 'action' | 'committee' | 'vote' | 'day' | 'text' | 'referral';
  tooltip?: string;
}

/**
 * Parsed NMLegis action result
 */
export interface ParsedNMlegisAction {
  raw: string;
  legislativeDay?: number;
  currentCommittee?: string;
  currentCommitteeName?: string;
  referrals: string[];
  referralNames: string[];
  actions: Array<{
    type: 'prefiled' | 'referred' | 'committee_action' | 'floor_action' | 'passed' | 'failed' | 'signed' | 'vetoed' | 'tabled' | 'other';
    code: string;
    description: string;
    committee?: string;
    committeeName?: string;
    vote?: string;
    date?: string;
    chapter?: string;
  }>;
  summary: string;
  status: 'prefiled' | 'in_committee' | 'passed_one' | 'passed_both' | 'signed' | 'vetoed' | 'failed' | 'tabled';
}

/**
 * Parse NMLegis action string into structured data with human-readable descriptions
 * 
 * Examples:
 * - "[5] SRC/SFC-SRC" → Day 5: In Rules Committee. Referrals: Rules, Finance
 * - "SPREF" → Pre-filed in Senate
 * - "[1] HPREF-HAFC/HJC-HAFC-DP-PASSED/H (54-2)" → Complex multi-step
 */
export function parseNMlegisActionString(actionStr: string): ParsedNMlegisAction {
  const result: ParsedNMlegisAction = {
    raw: actionStr,
    referrals: [],
    referralNames: [],
    actions: [],
    summary: '',
    status: 'prefiled',
  };

  if (!actionStr || !actionStr.trim()) {
    result.summary = 'No action recorded';
    return result;
  }

  let remaining = actionStr.trim();

  // Extract legislative day: [5]
  const dayMatch = remaining.match(/^\[(\d+)\]\s*/);
  if (dayMatch) {
    result.legislativeDay = parseInt(dayMatch[1], 10);
    remaining = remaining.slice(dayMatch[0].length);
  }

  // Split by hyphens but handle special cases
  const tokens = remaining.split('-').map(t => t.trim()).filter(Boolean);
  
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const upperToken = token.toUpperCase();
    
    // Pre-file: SPREF or HPREF
    if (upperToken === 'SPREF' || upperToken === 'HPREF') {
      const chamber = upperToken === 'SPREF' ? 'Senate' : 'House';
      result.actions.push({
        type: 'prefiled',
        code: token,
        description: `Pre-filed in ${chamber}`,
      });
      result.status = 'prefiled';
      continue;
    }

    // Referral pattern with slash: SRC/SFC (multiple committees)
    // This usually appears before the current committee
    if (token.includes('/') && !token.match(/^(PASSED|FAILED)\//i)) {
      const committees = token.split('/');
      const allAreCommittees = committees.every(c => isCommitteeCode(c));
      
      if (allAreCommittees) {
        result.referrals = committees;
        result.referralNames = committees.map(c => getCommitteeMeaning(c) || c);
        result.actions.push({
          type: 'referred',
          code: token,
          description: `Referred to: ${result.referralNames.join(', ')}`,
        });
        continue;
      }
    }

    // Passed with vote: PASSED/H (54-2) or PASSED/S (39-0)
    const passedMatch = token.match(/^PASSED\/(H|S)\s*\((\d+-\d+)\)?$/i);
    if (passedMatch) {
      const chamber = passedMatch[1].toUpperCase() === 'H' ? 'House' : 'Senate';
      const vote = passedMatch[2];
      result.actions.push({
        type: 'passed',
        code: token,
        description: `Passed ${chamber} (${vote})`,
        vote,
      });
      result.status = result.status === 'passed_one' ? 'passed_both' : 'passed_one';
      result.currentCommittee = undefined;
      continue;
    }

    // Failed with vote: FAILED/H (20-30)
    const failedMatch = token.match(/^FAILED\/(H|S)\s*\((\d+-\d+)\)?$/i);
    if (failedMatch) {
      const chamber = failedMatch[1].toUpperCase() === 'H' ? 'House' : 'Senate';
      const vote = failedMatch[2];
      result.actions.push({
        type: 'failed',
        code: token,
        description: `Failed in ${chamber} (${vote})`,
        vote,
      });
      result.status = 'failed';
      continue;
    }

    // Do Pass actions: DP, DP/a, DNP-CS/DP
    if (upperToken === 'DP') {
      result.actions.push({
        type: 'committee_action',
        code: token,
        description: 'Committee voted Do Pass',
        committee: result.currentCommittee,
        committeeName: result.currentCommitteeName,
      });
      continue;
    }

    if (upperToken === 'DP/A') {
      result.actions.push({
        type: 'committee_action',
        code: token,
        description: 'Committee voted Do Pass, as amended',
        committee: result.currentCommittee,
        committeeName: result.currentCommitteeName,
      });
      continue;
    }

    // Do Not Pass: DNP
    if (upperToken === 'DNP' || upperToken === 'DNP.') {
      result.actions.push({
        type: 'committee_action',
        code: token,
        description: 'Committee voted Do Not Pass',
        committee: result.currentCommittee,
        committeeName: result.currentCommitteeName,
      });
      result.status = 'failed';
      continue;
    }

    // Committee Substitute: CS or DNP-CS
    if (upperToken === 'CS' || upperToken.includes('CS')) {
      result.actions.push({
        type: 'committee_action',
        code: token,
        description: 'Committee substitute adopted',
        committee: result.currentCommittee,
      });
      continue;
    }

    // Floor amendment: fl/a, fl/aa, fl/aaa
    if (upperToken.match(/^FL\/A+$/)) {
      const count = (upperToken.match(/A/g) || []).length;
      result.actions.push({
        type: 'floor_action',
        code: token,
        description: `${count} floor amendment${count > 1 ? 's' : ''} adopted`,
      });
      continue;
    }

    // Tabled: tbld, TBLD INDEF
    if (upperToken === 'TBLD' || upperToken.startsWith('TBLD ')) {
      const isIndefinite = upperToken.includes('INDEF');
      result.actions.push({
        type: 'tabled',
        code: token,
        description: isIndefinite ? 'Tabled indefinitely' : 'Temporarily tabled',
      });
      result.status = 'tabled';
      continue;
    }

    // API: Action Postponed Indefinitely
    if (upperToken === 'API' || upperToken === 'API.') {
      result.actions.push({
        type: 'failed',
        code: token,
        description: 'Action postponed indefinitely',
        committee: result.currentCommittee,
      });
      result.status = 'failed';
      continue;
    }

    // Signed: SGND(Mar.4)Ch.9
    const signedMatch = token.match(/^SGND\.?\s*(?:\(([^)]+)\))?\s*(?:Ch\.?\s*(\d+))?\.?$/i);
    if (signedMatch || upperToken === 'SGND' || upperToken === 'SGND.') {
      const date = signedMatch?.[1];
      const chapter = signedMatch?.[2];
      let desc = 'Signed into law';
      if (date) desc += ` on ${date}`;
      if (chapter) desc += `, Chapter ${chapter}`;
      result.actions.push({
        type: 'signed',
        code: token,
        description: desc,
        date,
        chapter,
      });
      result.status = 'signed';
      continue;
    }

    // Vetoed: VETO, PVET, PKVT
    if (upperToken.includes('VETO') || upperToken === 'PVET' || upperToken === 'PKVT') {
      const isPocket = upperToken === 'PKVT' || upperToken.includes('POCKET');
      result.actions.push({
        type: 'vetoed',
        code: token,
        description: isPocket ? 'Pocket vetoed by Governor' : 'Vetoed by Governor',
      });
      result.status = 'vetoed';
      continue;
    }

    // Without recommendation: w/o rec
    if (upperToken === 'W/O REC') {
      result.actions.push({
        type: 'committee_action',
        code: token,
        description: 'Reported without recommendation',
        committee: result.currentCommittee,
      });
      continue;
    }

    // Concurrence: s/cncrd, h/cncrd
    if (upperToken === 'S/CNCRD' || upperToken === 'H/CNCRD') {
      const chamber = upperToken.startsWith('S') ? 'Senate' : 'House';
      result.actions.push({
        type: 'floor_action',
        code: token,
        description: `${chamber} concurred with amendments`,
      });
      continue;
    }

    // Speaker's Table: T
    if (upperToken === 'T') {
      result.actions.push({
        type: 'floor_action',
        code: token,
        description: "On Speaker's table (24-hour hold)",
      });
      result.currentCommittee = 'T';
      result.currentCommitteeName = "Speaker's Table";
      continue;
    }

    // Conference Committee: CC
    if (upperToken === 'CC') {
      result.actions.push({
        type: 'floor_action',
        code: token,
        description: 'Sent to conference committee',
      });
      continue;
    }

    // Check if it's a committee code (current committee assignment)
    if (isCommitteeCode(token)) {
      const committeeName = getCommitteeMeaning(token);
      result.currentCommittee = token;
      result.currentCommitteeName = committeeName || token;
      result.actions.push({
        type: 'referred',
        code: token,
        description: `Sent to ${committeeName || token}`,
        committee: token,
        committeeName: committeeName || undefined,
      });
      result.status = 'in_committee';
      continue;
    }

    // Check for other known action codes
    const actionMeaning = getActionMeaning(token);
    if (actionMeaning) {
      result.actions.push({
        type: 'other',
        code: token,
        description: actionMeaning.short,
      });
      continue;
    }

    // Unknown token - still record it
    if (token.trim()) {
      result.actions.push({
        type: 'other',
        code: token,
        description: token,
      });
    }
  }

  // Generate summary
  result.summary = generateActionSummary(result);

  return result;
}

/**
 * Generate a human-readable summary from parsed action
 */
function generateActionSummary(parsed: ParsedNMlegisAction): string {
  const parts: string[] = [];

  // Add day if present
  if (parsed.legislativeDay) {
    parts.push(`Day ${parsed.legislativeDay}`);
  }

  // Determine current status
  if (parsed.status === 'signed') {
    const signedAction = parsed.actions.find(a => a.type === 'signed');
    parts.push(signedAction?.description || 'Signed into law');
  } else if (parsed.status === 'vetoed') {
    parts.push('Vetoed by Governor');
  } else if (parsed.status === 'failed') {
    const failAction = parsed.actions.find(a => a.type === 'failed');
    parts.push(failAction?.description || 'Failed');
  } else if (parsed.status === 'tabled') {
    parts.push('Tabled');
  } else if (parsed.status === 'passed_both') {
    parts.push('Passed both chambers - awaiting Governor');
  } else if (parsed.status === 'passed_one') {
    const passedAction = parsed.actions.find(a => a.type === 'passed');
    parts.push(passedAction?.description || 'Passed one chamber');
  } else if (parsed.currentCommittee && parsed.currentCommitteeName) {
    parts.push(`In ${parsed.currentCommitteeName}`);
  } else if (parsed.actions.length > 0) {
    const lastAction = parsed.actions[parsed.actions.length - 1];
    parts.push(lastAction.description);
  }

  // Add referrals if multiple committees
  if (parsed.referrals.length > 1) {
    parts.push(`Referrals: ${parsed.referralNames.join(', ')}`);
  }

  return parts.join('. ');
}

/**
 * NMLegis history object format
 */
export interface NMlegisHistoryData {
  actions?: string;
  currentCommittee?: string;
  emergency?: boolean;
  parsed?: Array<{
    day: number;
    action: string;
    committee?: string;
    details?: string;
  }>;
}

/**
 * LegiScan history item format
 */
export interface LegiScanHistoryItem {
  date: string;
  action: string;
  chamber: string;
  chamber_id: number;
  importance: number;
  sequence?: number; // Order within the same day (1-based, lower = earlier)
}

/**
 * Unified history display item
 */
export interface HistoryDisplayItem {
  date?: string;
  day?: number;
  action: string;
  description: string;
  chamber?: string;
  isImportant: boolean;
  type: 'legiscan' | 'nmlegis';
  sequence?: number; // Order within the same day (1-based, lower = earlier)
}

/**
 * Parse history data from either LegiScan or NMLegis format
 */
export function parseHistoryData(history: unknown): {
  format: 'legiscan' | 'nmlegis' | 'unknown';
  items: HistoryDisplayItem[];
  nmlegisData?: ParsedNMlegisAction;
  rawActions?: string;
} {
  // Check for null/undefined
  if (!history) {
    return { format: 'unknown', items: [] };
  }

  // Check if it's an array (LegiScan format)
  if (Array.isArray(history)) {
    const items: HistoryDisplayItem[] = (history as LegiScanHistoryItem[]).map((item, index) => ({
      date: item.date,
      action: item.action,
      description: item.action, // LegiScan actions are usually readable
      chamber: item.chamber,
      isImportant: item.importance === 1,
      type: 'legiscan' as const,
      sequence: item.sequence ?? (index + 1), // Use stored sequence or fall back to array index
    }));
    return { format: 'legiscan', items };
  }

  // Check if it's an object with 'actions' (NMLegis format)
  if (typeof history === 'object' && history !== null) {
    const nmlegisHistory = history as NMlegisHistoryData;
    
    if (nmlegisHistory.actions) {
      const parsed = parseNMlegisActionString(nmlegisHistory.actions);
      
      // Convert parsed actions to display items
      const items: HistoryDisplayItem[] = parsed.actions.map((action, index) => ({
        day: parsed.legislativeDay,
        action: action.code,
        description: action.description,
        isImportant: action.type === 'passed' || action.type === 'signed' || action.type === 'vetoed' || action.type === 'failed',
        type: 'nmlegis' as const,
        sequence: index + 1, // Use 1-based index as sequence
      }));

      return {
        format: 'nmlegis',
        items,
        nmlegisData: parsed,
        rawActions: nmlegisHistory.actions,
      };
    }
  }

  return { format: 'unknown', items: [] };
}

/**
 * Parse and expand an action string into segments (legacy function for LegiScan)
 * Example: "HAFC-DP-PASSED/H (54-2)" becomes segments with expanded meanings
 */
export function expandActionText(action: string): {
  original: string;
  segments: ExpandedSegment[];
  expanded: string;
} {
  const segments: ExpandedSegment[] = [];
  
  // Check if this is already human-readable text (from converted history)
  // Human-readable descriptions contain phrases like "Referred to", "Sent to", etc.
  const humanReadablePatterns = [
    /^Referred to/i,
    /^Sent to/i,
    /^Committee voted/i,
    /^Pre-filed/i,
    /^Passed (House|Senate)/i,
    /^Failed in/i,
    /^Signed/i,
    /^Vetoed/i,
    /^Tabled/i,
    /floor amendment/i,
    /^Reported without/i,
    /^On Speaker/i,
    /concurred/i,
  ];
  
  if (humanReadablePatterns.some(pattern => pattern.test(action))) {
    // Already human-readable - return as-is
    return {
      original: action,
      segments: [{ original: action, expanded: action, type: 'text' }],
      expanded: action,
    };
  }
  
  // Handle legislative day markers like [2]
  let processedAction = action;
  const dayMatch = processedAction.match(/^\[(\d+)\]\s*/);
  if (dayMatch) {
    segments.push({
      original: dayMatch[0].trim(),
      expanded: `Day ${dayMatch[1]}`,
      type: 'day',
      tooltip: `Legislative Day ${dayMatch[1]}`
    });
    processedAction = processedAction.slice(dayMatch[0].length);
  }
  
  // Tokenize by hyphens, but preserve vote patterns like "(36-0)" and "(54-2)"
  // Handle patterns like: HAFC-DP-PASSED/H (54-2)
  const tokens: string[] = [];
  let currentToken = '';
  let parenDepth = 0;
  
  for (let i = 0; i < processedAction.length; i++) {
    const char = processedAction[i];
    
    if (char === '(') {
      parenDepth++;
      currentToken += char;
    } else if (char === ')') {
      parenDepth--;
      currentToken += char;
    } else if (char === '-' && parenDepth === 0) {
      // Only split on hyphen when outside parentheses
      if (currentToken.trim()) {
        tokens.push(currentToken.trim());
        currentToken = '';
      }
    } else {
      currentToken += char;
    }
  }
  if (currentToken.trim()) {
    tokens.push(currentToken.trim());
  }
  
  // Process each token
  for (const token of tokens) {
    // Check for referral pattern with slash: SRC/SFC
    if (token.includes('/') && !token.match(/^(PASSED|FAILED|DP|FL)\//i)) {
      const committees = token.split('/');
      const allAreCommittees = committees.every(c => isCommitteeCode(c));
      
      if (allAreCommittees) {
        const names = committees.map(c => getCommitteeMeaning(c) || c);
        segments.push({
          original: token,
          expanded: `Referrals: ${names.join(', ')}`,
          type: 'referral',
          tooltip: `Referred to committees: ${names.join(', ')}`
        });
        continue;
      }
    }

    // Check for vote pattern like "(54-2)" or "PASSED/H (54-2)"
    const voteMatch = token.match(/^(PASSED|FAILED)\/(H|S)\s*\((\d+-\d+)\)?$/i);
    if (voteMatch) {
      const actionType = voteMatch[1].toUpperCase();
      const chamber = voteMatch[2].toUpperCase() === 'H' ? 'House' : 'Senate';
      const vote = voteMatch[3];
      segments.push({
        original: token,
        expanded: `${actionType === 'PASSED' ? 'Passed' : 'Failed'} ${chamber} (${vote})`,
        type: 'vote',
        tooltip: `${actionType === 'PASSED' ? 'Passed' : 'Failed'} in the ${chamber} with vote ${vote}`
      });
      continue;
    }
    
    // Check for standalone vote like "(54-2)"
    const standaloneVoteMatch = token.match(/^\((\d+-\d+)\)$/);
    if (standaloneVoteMatch) {
      segments.push({
        original: token,
        expanded: token,
        type: 'vote',
        tooltip: `Vote: ${standaloneVoteMatch[1]}`
      });
      continue;
    }
    
    // Check for committee code
    const committeeMeaning = getCommitteeMeaning(token);
    if (committeeMeaning) {
      segments.push({
        original: token,
        expanded: committeeMeaning,
        type: 'committee',
        tooltip: `${token}: ${committeeMeaning}`
      });
      continue;
    }
    
    // Check for action code
    const actionMeaning = getActionMeaning(token);
    if (actionMeaning) {
      segments.push({
        original: token,
        expanded: actionMeaning.short,
        type: 'action',
        tooltip: `${token}: ${actionMeaning.full}`
      });
      continue;
    }
    
    // Check for committee substitute pattern like "CS/H 18"
    const csMatch = token.match(/^(S?CS)\/(H|S)\s*(\d+)$/i);
    if (csMatch) {
      const chamber = csMatch[2].toUpperCase() === 'H' ? 'House' : 'Senate';
      segments.push({
        original: token,
        expanded: `Committee Substitute for ${chamber} Bill ${csMatch[3]}`,
        type: 'action',
        tooltip: `Committee substitute for ${chamber} Bill ${csMatch[3]}`
      });
      continue;
    }
    
    // Check for signed with date/chapter like "SGND(Mar.4)Ch.9"
    const signedMatch = token.match(/^SGND\.?\s*\(([^)]+)\)\s*Ch\.?\s*(\d+)\.?$/i);
    if (signedMatch) {
      segments.push({
        original: token,
        expanded: `Signed ${signedMatch[1]}, Chapter ${signedMatch[2]}`,
        type: 'action',
        tooltip: `Signed by the Governor on ${signedMatch[1]}, became Chapter ${signedMatch[2]}`
      });
      continue;
    }
    
    // Check for veto with date like "VETO(Mar.7)"
    const vetoMatch = token.match(/^VETO\.?\s*\(([^)]+)\)\.?$/i);
    if (vetoMatch) {
      segments.push({
        original: token,
        expanded: `Vetoed ${vetoMatch[1]}`,
        type: 'action',
        tooltip: `Vetoed by the Governor on ${vetoMatch[1]}`
      });
      continue;
    }
    
    // Default: keep as-is
    segments.push({
      original: token,
      expanded: token,
      type: 'text'
    });
  }
  
  return {
    original: action,
    segments,
    expanded: segments.map(s => s.expanded).join(' → ')
  };
}

/**
 * Get all codes for reference display
 */
export function getAllCodes(): {
  actions: Array<{ code: string; short: string; full: string }>;
  committees: Array<{ code: string; name: string }>;
} {
  return {
    actions: Object.entries(ACTION_CODES).map(([code, info]) => ({
      code,
      short: info.short,
      full: info.full
    })),
    committees: Object.entries(COMMITTEE_CODES).map(([code, name]) => ({
      code,
      name
    }))
  };
}

/**
 * Convert NMLegis actions string to LegiScan-compatible history array.
 * 
 * This function parses the compact nmlegis action string format and converts
 * it into an array of history items suitable for the database and UI.
 * 
 * @param actionsString - The raw nmlegis actions string, e.g., "[1] HAFC-DP-PASSED/H (54-2)"
 * @param sessionStartDate - The session start date for calculating actual dates from legislative days
 * @param chamber - The originating chamber of the bill ('H' or 'S')
 * @returns Array of LegiScanHistoryItem objects
 */
export function convertActionsToHistoryArray(
  actionsString: string,
  sessionStartDate: Date,
  chamber: string
): LegiScanHistoryItem[] {
  if (!actionsString || !actionsString.trim()) {
    return [];
  }

  const historyItems: LegiScanHistoryItem[] = [];
  
  // Split the actions string by legislative day markers and process each segment
  // Example: "[1] HAFC-DP [2] PASSED/H (54-2) [3] SFC-DP"
  const daySegments = actionsString.split(/(?=\[\d+\])/);
  
  let currentDay = 1;
  let currentChamber = chamber;
  let globalSequence = 0; // Track overall sequence across all segments
  
  for (const segment of daySegments) {
    if (!segment.trim()) continue;
    
    // Extract day number if present
    const dayMatch = segment.match(/^\[(\d+)\]\s*/);
    if (dayMatch) {
      currentDay = parseInt(dayMatch[1], 10);
    }
    
    // Calculate date from legislative day
    const actionDate = calculateDateFromLegislativeDay(sessionStartDate, currentDay);
    const dateStr = actionDate.toISOString().split('T')[0];
    
    // Get the content after the day marker
    const content = dayMatch 
      ? segment.slice(dayMatch[0].length).trim()
      : segment.trim();
    
    if (!content) continue;
    
    // Parse the segment to get individual actions
    const parsed = parseNMlegisActionString(segment);
    
    for (const action of parsed.actions) {
      globalSequence++; // Increment for each action
      
      // Determine chamber from action
      if (action.type === 'passed' || action.type === 'failed') {
        const chamberMatch = action.code.match(/\/(H|S)/i);
        if (chamberMatch) {
          currentChamber = chamberMatch[1].toUpperCase();
        }
      } else if (action.committee) {
        // Committee codes start with H or S
        currentChamber = action.committee.startsWith('S') ? 'S' : 'H';
      }
      
      // Determine importance: passed, signed, vetoed, failed are important
      const importance = ['passed', 'signed', 'vetoed', 'failed'].includes(action.type) ? 1 : 0;
      
      historyItems.push({
        date: dateStr,
        action: action.description,
        chamber: currentChamber,
        chamber_id: currentChamber === 'H' ? 1 : 2,
        importance,
        sequence: globalSequence, // Add sequence number
      });
    }
  }
  
  // If no day markers were found, process the entire string as a single segment
  if (historyItems.length === 0 && actionsString.trim()) {
    const parsed = parseNMlegisActionString(actionsString);
    const dateStr = sessionStartDate.toISOString().split('T')[0];
    let sequence = 0;
    
    for (const action of parsed.actions) {
      sequence++;
      let actionChamber = chamber;
      if (action.type === 'passed' || action.type === 'failed') {
        const chamberMatch = action.code.match(/\/(H|S)/i);
        if (chamberMatch) {
          actionChamber = chamberMatch[1].toUpperCase();
        }
      } else if (action.committee) {
        actionChamber = action.committee.startsWith('S') ? 'S' : 'H';
      }
      
      const importance = ['passed', 'signed', 'vetoed', 'failed'].includes(action.type) ? 1 : 0;
      
      historyItems.push({
        date: dateStr,
        action: action.description,
        chamber: actionChamber,
        chamber_id: actionChamber === 'H' ? 1 : 2,
        importance,
        sequence, // Add sequence number
      });
    }
  }
  
  return historyItems;
}

/**
 * Calculate actual date from legislative day number.
 * Legislative days typically skip weekends and holidays.
 * 
 * @param sessionStart - The session start date
 * @param legislativeDay - The legislative day number (1-based)
 * @returns The calculated date
 */
function calculateDateFromLegislativeDay(sessionStart: Date, legislativeDay: number): Date {
  const date = new Date(sessionStart);
  let daysToAdd = 0;
  let currentLegDay = 1;
  
  // Legislative days skip weekends (approximate - actual calendar may vary)
  while (currentLegDay < legislativeDay) {
    daysToAdd++;
    const nextDate = new Date(sessionStart);
    nextDate.setDate(nextDate.getDate() + daysToAdd);
    const dayOfWeek = nextDate.getDay();
    
    // Skip Saturdays (6) and Sundays (0)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      currentLegDay++;
    }
  }
  
  date.setDate(date.getDate() + daysToAdd);
  return date;
}

/**
 * Get the most recent action from a history array
 */
export function getMostRecentAction(history: LegiScanHistoryItem[] | null | undefined): LegiScanHistoryItem | null {
  if (!history || !Array.isArray(history) || history.length === 0) {
    return null;
  }
  
  // Sort by date descending and return the first
  const sorted = [...history].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  
  return sorted[0] || null;
}

/**
 * Get the current committee from history (the last referred committee before any terminal action)
 */
export function getCurrentCommitteeFromHistory(history: LegiScanHistoryItem[] | null | undefined): string | null {
  if (!history || !Array.isArray(history) || history.length === 0) {
    return null;
  }
  
  // Sort by date ascending to process in order, then by sequence
  const sorted = [...history].sort((a, b) => {
    const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (dateCompare !== 0) return dateCompare;
    return (a.sequence ?? 0) - (b.sequence ?? 0);
  });
  
  let currentCommittee: string | null = null;
  
  for (const item of sorted) {
    const action = item.action.toLowerCase();
    
    // Check for committee assignment
    if (action.includes('sent to') || action.includes('referred to')) {
      // Extract committee name after "to"
      const match = item.action.match(/(?:sent to|referred to)\s+(.+)/i);
      if (match) {
        currentCommittee = match[1];
      }
    }
    
    // Clear committee on passage or terminal action
    if (action.includes('passed') || action.includes('signed') || action.includes('vetoed') || action.includes('failed')) {
      currentCommittee = null;
    }
  }
  
  return currentCommittee;
}

/**
 * Get the current location/status of a bill from its history
 * Returns human-readable description of where the bill is now
 */
export function getCurrentBillLocation(history: LegiScanHistoryItem[] | null | undefined, chamber: string): {
  location: string;
  status: 'in_committee' | 'passed_house' | 'passed_senate' | 'passed_both' | 'signed' | 'vetoed' | 'failed' | 'unknown';
  committee?: string;
  lastAction?: string;
  lastDate?: string;
} {
  if (!history || !Array.isArray(history) || history.length === 0) {
    return { 
      location: 'Waiting for first committee assignment',
      status: 'unknown'
    };
  }
  
  // Sort by date ascending then by sequence to process in order
  const sorted = [...history].sort((a, b) => {
    const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (dateCompare !== 0) return dateCompare;
    return (a.sequence ?? 0) - (b.sequence ?? 0);
  });
  
  let currentCommittee: string | null = null;
  let passedHouse = false;
  let passedSenate = false;
  let signed = false;
  let vetoed = false;
  let failed = false;
  let lastAction = sorted[sorted.length - 1]?.action;
  let lastDate = sorted[sorted.length - 1]?.date;
  
  for (const item of sorted) {
    const action = item.action.toLowerCase();
    
    // Check for committee assignment
    if (action.includes('sent to') || action.includes('referred to')) {
      const match = item.action.match(/(?:sent to|referred to)\s+(.+)/i);
      if (match) {
        currentCommittee = match[1];
      }
    }
    
    // Check for "Do Pass" - committee passed it, moving to next
    if (action.includes('committee voted') && (action.includes('do pass') || action.includes('to pass'))) {
      // Bill passed committee, will be sent to next committee or floor
      // Don't clear currentCommittee yet - wait for "sent to" action
    }
    
    // Check for chamber passage
    if (action.includes('passed house') || (action.includes('passed') && item.chamber === 'H')) {
      passedHouse = true;
      currentCommittee = null;
    }
    if (action.includes('passed senate') || (action.includes('passed') && item.chamber === 'S')) {
      passedSenate = true;
      currentCommittee = null;
    }
    
    // Check for final actions
    if (action.includes('signed')) {
      signed = true;
    }
    if (action.includes('vetoed') || action.includes('veto')) {
      vetoed = true;
    }
    if (action.includes('failed') || action.includes('did not pass') || action.includes('tabled indefinitely')) {
      failed = true;
    }
  }
  
  // Determine current status
  if (signed) {
    return {
      location: 'Signed into law by the Governor',
      status: 'signed',
      lastAction,
      lastDate
    };
  }
  
  if (vetoed) {
    return {
      location: 'Vetoed by the Governor',
      status: 'vetoed',
      lastAction,
      lastDate
    };
  }
  
  if (failed) {
    return {
      location: 'Did not pass',
      status: 'failed',
      lastAction,
      lastDate
    };
  }
  
  if (passedHouse && passedSenate) {
    return {
      location: 'Passed both chambers, waiting for Governor',
      status: 'passed_both',
      lastAction,
      lastDate
    };
  }
  
  if (passedHouse) {
    if (currentCommittee) {
      return {
        location: `Passed the House, now in ${currentCommittee}`,
        status: 'passed_house',
        committee: currentCommittee,
        lastAction,
        lastDate
      };
    }
    return {
      location: 'Passed the House, heading to Senate',
      status: 'passed_house',
      lastAction,
      lastDate
    };
  }
  
  if (passedSenate) {
    if (currentCommittee) {
      return {
        location: `Passed the Senate, now in ${currentCommittee}`,
        status: 'passed_senate',
        committee: currentCommittee,
        lastAction,
        lastDate
      };
    }
    return {
      location: 'Passed the Senate, heading to House',
      status: 'passed_senate',
      lastAction,
      lastDate
    };
  }
  
  if (currentCommittee) {
    return {
      location: `Currently in ${currentCommittee}`,
      status: 'in_committee',
      committee: currentCommittee,
      lastAction,
      lastDate
    };
  }
  
  return {
    location: 'Waiting for committee assignment',
    status: 'unknown',
    lastAction,
    lastDate
  };
}
