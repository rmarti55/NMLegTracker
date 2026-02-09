/**
 * NMLegis Action Code Parser
 * 
 * Parses the action strings from nmlegis.gov to extract bill status and history.
 * Action strings look like: "[1]HPREF-HAFC-HJC-DP-PASSED/H (54-2)"
 */

export interface BillHistory {
  day: number;
  action: string;
  committee?: string;
  details?: string;
}

export interface ParsedActions {
  actions: string;
  history: BillHistory[];
  currentCommittee?: string;
  referrals?: string[];
  passed?: Array<{ day: number; where: string; details: string }>;
  failed?: { day: number; where: string; details: string };
  signed?: { date?: string; chapter?: string; veto?: string };
  tabled?: boolean;
  withdrawn?: boolean;
  status: 'prefiled' | 'in_committee' | 'passed_one_chamber' | 'passed_both' | 'signed' | 'vetoed' | 'failed' | 'tabled' | 'withdrawn' | 'unknown';
  statusCode: number; // 1=Intro, 2=Engrossed, 3=Enrolled, 4=Passed, 5=Vetoed, 6=Failed
}

const CHAMBER_NAMES: Record<string, string> = {
  H: 'House',
  S: 'Senate',
};

/**
 * Parse nmlegis action string into structured data
 */
export function parseActions(actionsStr: string): ParsedActions {
  const result: ParsedActions = {
    actions: actionsStr,
    history: [],
    status: 'unknown',
    statusCode: 1, // Default to Introduced
  };

  if (!actionsStr) {
    return result;
  }

  let actions = actionsStr.trim();
  // Remove spurious backticks (seen in nmlegis data)
  actions = actions.replace(/`/g, '');
  
  let day = 0;

  while (actions) {
    // Day marker: [1], [2], etc.
    const dayMatch = actions.match(/^\[(\d+)\]\s*(-\s*)?/);
    if (dayMatch) {
      day = parseInt(dayMatch[1], 10);
      actions = actions.slice(dayMatch[0].length);
      continue;
    }

    // Prefiled: HPREF or SPREF
    const prefileMatch = actions.match(/^(H|S)PREF\s*/);
    if (prefileMatch) {
      result.history.push({ day, action: 'prefiled', committee: prefileMatch[1] });
      result.status = 'prefiled';
      result.statusCode = 1;
      actions = actions.slice(prefileMatch[0].length);
      continue;
    }

    // Do Pass with referral: DP-HAFC or DP/a-SJC
    const dpMatch = actions.match(/^((DNP-CS\/)?DP(\/a)?)(-([A-Z]+))?([\.\s\-]+|$)/);
    if (dpMatch) {
      const [fullMatch, how, , , , nextCommittee] = dpMatch;
      const friendly = how.includes('DNP-CS') 
        ? 'Committee Substitution' 
        : how.includes('/a') 
          ? 'Do Pass as amended' 
          : 'Do Pass';
      
      if (result.currentCommittee) {
        result.passed = result.passed || [];
        result.passed.push({ day, where: result.currentCommittee, details: friendly });
        result.history.push({ day, action: 'passed', committee: result.currentCommittee, details: friendly });
      }
      
      if (nextCommittee) {
        result.currentCommittee = nextCommittee;
        result.history.push({ day, action: 'sent', committee: nextCommittee });
      }
      
      actions = actions.slice(fullMatch.length);
      continue;
    }

    // Without recommendation
    const woRecMatch = actions.match(/^(w\/o\s+rec(\/a)?)(-([A-Z]+))?([\s\-]+|$)/);
    if (woRecMatch) {
      if (result.currentCommittee) {
        result.passed = result.passed || [];
        result.passed.push({ day, where: result.currentCommittee, details: 'without recommendation' });
        result.history.push({ day, action: 'passed', committee: result.currentCommittee, details: 'without recommendation' });
      }
      if (woRecMatch[4]) {
        result.currentCommittee = woRecMatch[4];
      }
      actions = actions.slice(woRecMatch[0].length);
      continue;
    }

    // Passed chamber: PASSED/H (54-2) or PASSED/S (39-0)
    const passedMatch = actions.match(/^PASSED\/(H|S)\s+\((\d+-\d+)\)([\.\s\-]+|$)/);
    if (passedMatch) {
      const chamber = CHAMBER_NAMES[passedMatch[1]] || passedMatch[1];
      result.passed = result.passed || [];
      result.passed.push({ day, where: chamber, details: passedMatch[2] });
      result.history.push({ day, action: 'passed', committee: chamber, details: passedMatch[2] });
      result.currentCommittee = undefined;
      result.referrals = undefined;
      
      // Check if passed both chambers
      const housePassed = result.passed.some(p => p.where === 'House');
      const senatePassed = result.passed.some(p => p.where === 'Senate');
      if (housePassed && senatePassed) {
        result.status = 'passed_both';
        result.statusCode = 3; // Enrolled
      } else {
        result.status = 'passed_one_chamber';
        result.statusCode = 2; // Engrossed
      }
      
      actions = actions.slice(passedMatch[0].length);
      continue;
    }

    // Failed chamber: FAILED/H (20-30)
    const failedMatch = actions.match(/^FAILED\/(H|S)\s+\((\d+-\d+)\)([\.\s\-]+|$)/);
    if (failedMatch) {
      const chamber = CHAMBER_NAMES[failedMatch[1]] || failedMatch[1];
      result.failed = { day, where: chamber, details: failedMatch[2] };
      result.history.push({ day, action: 'failed', committee: chamber, details: failedMatch[2] });
      result.status = 'failed';
      result.statusCode = 6;
      actions = actions.slice(failedMatch[0].length);
      continue;
    }

    // Signed: SGND (Mar. 5) Ch. 10
    const signedMatch = actions.match(/^(SGND.*)$/);
    if (signedMatch) {
      result.signed = {};
      const signedText = signedMatch[1];
      
      const dateMatch = signedText.match(/\((\w+[\.\s]+\d+)\)/);
      if (dateMatch) {
        result.signed.date = dateMatch[1];
      }
      
      const chapterMatch = signedText.match(/Ch[\.\s]+(\d+)/);
      if (chapterMatch) {
        result.signed.chapter = chapterMatch[1];
      }
      
      const vetoMatch = signedText.match(/((partial\s+)?veto)/i);
      if (vetoMatch) {
        result.signed.veto = vetoMatch[1];
      }
      
      result.history.push({ day, action: 'signed', details: signedText });
      result.status = 'signed';
      result.statusCode = 4; // Passed
      actions = '';
      continue;
    }

    // Veto
    const vetoMatch = actions.match(/^((POCKET\s+)?VETO)([\.\s-]*VETO)?[\.\s\-]*$/);
    if (vetoMatch) {
      result.history.push({ day, action: 'vetoed', details: vetoMatch[1] });
      result.status = 'vetoed';
      result.statusCode = 5;
      actions = '';
      continue;
    }

    // Committee referral with current: ref HAFC/HJC-HAFC or HAFC/HJC-HAFC
    const refMatch = actions.match(/^(ref[\s-]+)?([HS][A-Z\/]+)-([A-Z]+)(-germane-([A-Z]+))?(-?\s+|$)/);
    if (refMatch) {
      const [fullMatch, , referrals, current, , germaneNext] = refMatch;
      result.referrals = referrals.split('/');
      result.currentCommittee = current;
      result.history.push({ day, action: 'referred', details: referrals });
      result.history.push({ day, action: 'sent', committee: current });
      result.status = 'in_committee';
      result.statusCode = 1;
      
      if (germaneNext) {
        result.passed = result.passed || [];
        result.passed.push({ day, where: current, details: 'Germane' });
        result.history.push({ day, action: 'germane', committee: germaneNext });
        result.currentCommittee = germaneNext;
      }
      
      actions = actions.slice(fullMatch.length);
      continue;
    }

    // Simple committee reference: HAFC or SJC
    const simpleRefMatch = actions.match(/^(ref[\s\-]+)?((H|S)[A-Z]{2,5})([\s\-]+|$)/);
    if (simpleRefMatch) {
      result.currentCommittee = simpleRefMatch[2];
      result.referrals = [simpleRefMatch[2]];
      result.history.push({ day, action: 'referred', committee: simpleRefMatch[2] });
      result.status = 'in_committee';
      result.statusCode = 1;
      actions = actions.slice(simpleRefMatch[0].length);
      continue;
    }

    // Tabled
    const tabledMatch = actions.match(/^(tbld(\/([HS]))?)([\s-]+|$)/i);
    if (tabledMatch) {
      result.tabled = true;
      result.history.push({ day, action: 'tabled' });
      result.status = 'tabled';
      result.statusCode = 6;
      actions = actions.slice(tabledMatch[0].length);
      continue;
    }

    // Tabled indefinitely
    const tabledIndefMatch = actions.match(/^TBLD\s+INDEF([\s\.\-]+|$)/i);
    if (tabledIndefMatch) {
      result.tabled = true;
      result.history.push({ day, action: 'tabled indefinitely' });
      result.status = 'tabled';
      result.statusCode = 6;
      actions = actions.slice(tabledIndefMatch[0].length);
      continue;
    }

    // Withdrawn
    const withdrawnMatch = actions.match(/^w\/drn([\s-]+|$)/);
    if (withdrawnMatch) {
      result.withdrawn = true;
      result.history.push({ day, action: 'withdrawn' });
      result.status = 'withdrawn';
      result.statusCode = 6;
      actions = actions.slice(withdrawnMatch[0].length);
      continue;
    }

    // Action Postponed Indefinitely
    const apiMatch = actions.match(/^(((H|S)[A-Z]{2,5})\s+)?API([\s\.\-]+|$)/);
    if (apiMatch) {
      const where = apiMatch[2] || result.currentCommittee || '';
      result.failed = { day, where, details: 'API' };
      result.history.push({ day, action: 'API', committee: where });
      result.status = 'failed';
      result.statusCode = 6;
      actions = actions.slice(apiMatch[0].length);
      continue;
    }

    // Floor amendment
    const floorAmendMatch = actions.match(/^(fl\/a+)([\.\s\-]+|$)/);
    if (floorAmendMatch) {
      result.history.push({ day, action: 'floor amendment', details: floorAmendMatch[1] });
      actions = actions.slice(floorAmendMatch[0].length);
      continue;
    }

    // Concurrence
    const concurMatch = actions.match(/^((h|s)\/cncrd)([\.\s\-]+|$)/);
    if (concurMatch) {
      const chamber = CHAMBER_NAMES[concurMatch[2].toUpperCase()] || concurMatch[2];
      result.history.push({ day, action: `${chamber} concur`, details: concurMatch[1] });
      actions = actions.slice(concurMatch[0].length);
      continue;
    }

    // Conference Committee
    const ccMatch = actions.match(/^CC([\s\-]+|$)/);
    if (ccMatch) {
      result.history.push({ day, action: 'Conference Committee' });
      actions = actions.slice(ccMatch[0].length);
      continue;
    }

    // Speaker's Table
    if (actions === 'T') {
      result.currentCommittee = "Speaker's Table";
      result.history.push({ day, action: "on Speaker's Table" });
      actions = '';
      continue;
    }

    // DNP (Do Not Pass)
    const dnpMatch = actions.match(/^(DNP\.)\s*/);
    if (dnpMatch) {
      if (result.currentCommittee) {
        result.failed = { day, where: result.currentCommittee, details: 'DNP' };
        result.history.push({ day, action: 'failed', committee: result.currentCommittee, details: 'DNP' });
      }
      result.status = 'failed';
      result.statusCode = 6;
      actions = actions.slice(dnpMatch[0].length);
      continue;
    }

    // Printed
    const printedMatch = actions.match(/^prntd([\s\.\-]+|$)/);
    if (printedMatch) {
      result.history.push({ day, action: 'printed' });
      actions = actions.slice(printedMatch[0].length);
      // Handle "prntd-ref"
      actions = actions.replace(/^ref([\s\.\-]+|$)/, '');
      continue;
    }

    // Not printed
    const notPrintedMatch = actions.match(/^(no?t (prntd|ref com))([\s\.\-]+|$)/);
    if (notPrintedMatch) {
      result.history.push({ day, action: notPrintedMatch[1] });
      actions = actions.slice(notPrintedMatch[0].length);
      continue;
    }

    // Skip unknown action and move on
    const skipMatch = actions.match(/^([^\s\[\]-]+)([\s\-]+|$)/);
    if (skipMatch) {
      // Log unknown action for debugging
      console.warn(`[NMLegis Parser] Unknown action: "${skipMatch[1]}" in "${actionsStr}"`);
      actions = actions.slice(skipMatch[0].length);
      continue;
    }

    // Nothing matched, skip a character to avoid infinite loop
    actions = actions.slice(1);
  }

  return result;
}

/**
 * Parse a bill name like "HB1" or "SJR5" into components
 */
export function parseBillName(name: string): { chamber: string; type: string; number: number } | null {
  // CS = Committee Substitution; * = emergency
  const match = name.match(/^(CS[\s\/]*)?\*?(H|S)(B|M|R|CR|JM|JR)\s*(\d+)$/i);
  if (!match) {
    return null;
  }
  
  return {
    chamber: match[2].toUpperCase(),
    type: match[3].toUpperCase(),
    number: parseInt(match[4], 10),
  };
}

/**
 * Convert parsed bill info to a normalized bill number string
 */
export function normalizeBillNumber(chamber: string, type: string, number: number): string {
  return `${chamber}${type}${number}`;
}

/**
 * Map bill type code to full name
 */
export function getBillTypeName(type: string): string {
  const typeMap: Record<string, string> = {
    B: 'Bill',
    M: 'Memorial',
    JM: 'Joint Memorial',
    R: 'Resolution',
    JR: 'Joint Resolution',
    CR: 'Concurrent Resolution',
  };
  return typeMap[type] || type;
}

/**
 * Determine the body (chamber of origin) from bill number
 */
export function getBody(chamber: string): string {
  return chamber === 'H' ? 'H' : 'S';
}
