/**
 * LegiScan API Client
 * 
 * A TypeScript client for the LegiScan Pull API with:
 * - Query tracking against 30k/month limit
 * - Hash-based change detection
 * - Rate limiting
 * - Response caching
 * 
 * Based on LegiScan API crash course guidelines to avoid getting banned.
 */

import { LEGISCAN_CONFIG } from "./config";
import * as fs from "fs";
import * as path from "path";

// ============================================================================
// Types
// ============================================================================

export interface LegiScanResponse<T> {
  status: "OK" | "ERROR";
  alert?: {
    message: string;
  };
  [key: string]: T | string | { message: string } | undefined;
}

export interface DatasetListItem {
  state_id: number;
  state: string;
  session_id: number;
  year_start: number;
  year_end: number;
  special: number;
  session_title: string;
  session_name: string;
  dataset_hash: string;
  dataset_date: string;
  dataset_size: number;
  access_key: string;
}

export interface DatasetListResponse {
  status: "OK" | "ERROR";
  datasetlist: DatasetListItem[];
}

export interface DatasetResponse {
  status: "OK" | "ERROR";
  dataset: {
    state_id: number;
    state: string;
    session_id: number;
    session_name: string;
    dataset_hash: string;
    dataset_date: string;
    dataset_size: number;
    mime: string;
    zip: string; // Base64 encoded ZIP file
  };
}

export interface MasterListBill {
  bill_id: number;
  number: string;
  change_hash: string;
  url: string;
  status_date: string;
  status: number;
  last_action_date: string;
  last_action: string;
  title: string;
  description: string;
}

export interface MasterListRawResponse {
  status: "OK" | "ERROR";
  masterlist: {
    session: {
      session_id: number;
      state_id: number;
      year_start: number;
      year_end: number;
      special: number;
      session_name: string;
    };
    [key: string]: MasterListBill | { session_id: number; state_id: number; year_start: number; year_end: number; special: number; session_name: string };
  };
}

export interface SessionListItem {
  session_id: number;
  state_id: number;
  year_start: number;
  year_end: number;
  special: number;
  session_name: string;
  name: string;
  session_hash?: string;
}

export interface SessionListResponse {
  status: "OK" | "ERROR";
  sessions: SessionListItem[];
}

export interface QueryUsage {
  month: string; // "2026-01"
  count: number;
  lastReset: string;
  lastQuery: string;
  lastMasterList?: string;
  lastDatasetList?: string;
}

// ============================================================================
// Query Tracker
// ============================================================================

const QUERY_TRACKER_PATH = path.join(process.cwd(), ".legiscan-queries.json");

function getQueryUsage(): QueryUsage {
  const currentMonth = new Date().toISOString().slice(0, 7);
  
  try {
    if (fs.existsSync(QUERY_TRACKER_PATH)) {
      const data = JSON.parse(fs.readFileSync(QUERY_TRACKER_PATH, "utf-8")) as QueryUsage;
      
      // Reset if new month
      if (data.month !== currentMonth) {
        return {
          month: currentMonth,
          count: 0,
          lastReset: new Date().toISOString(),
          lastQuery: "",
        };
      }
      
      return data;
    }
  } catch {
    // If file is corrupted, start fresh
  }
  
  return {
    month: currentMonth,
    count: 0,
    lastReset: new Date().toISOString(),
    lastQuery: "",
  };
}

function saveQueryUsage(usage: QueryUsage): void {
  fs.writeFileSync(QUERY_TRACKER_PATH, JSON.stringify(usage, null, 2));
}

function incrementQueryCount(operation: string): QueryUsage {
  const usage = getQueryUsage();
  usage.count++;
  usage.lastQuery = new Date().toISOString();
  
  if (operation === "getMasterListRaw") {
    usage.lastMasterList = usage.lastQuery;
  } else if (operation === "getDatasetList") {
    usage.lastDatasetList = usage.lastQuery;
  }
  
  saveQueryUsage(usage);
  
  // Log warnings
  if (usage.count >= LEGISCAN_CONFIG.queryHardStopThreshold) {
    console.error(`[LegiScan] HARD STOP: ${usage.count}/${LEGISCAN_CONFIG.monthlyQueryLimit} queries used this month!`);
  } else if (usage.count >= LEGISCAN_CONFIG.queryWarningThreshold) {
    console.warn(`[LegiScan] WARNING: ${usage.count}/${LEGISCAN_CONFIG.monthlyQueryLimit} queries used this month`);
  }
  
  return usage;
}

// ============================================================================
// Rate Limiting
// ============================================================================

function canCallMasterList(): { allowed: boolean; waitMs?: number } {
  const usage = getQueryUsage();
  
  if (!usage.lastMasterList) {
    return { allowed: true };
  }
  
  const lastCall = new Date(usage.lastMasterList).getTime();
  const now = Date.now();
  const elapsed = now - lastCall;
  
  if (elapsed < LEGISCAN_CONFIG.masterListMinInterval) {
    return {
      allowed: false,
      waitMs: LEGISCAN_CONFIG.masterListMinInterval - elapsed,
    };
  }
  
  return { allowed: true };
}

function canCallDatasetList(): { allowed: boolean; waitMs?: number } {
  const usage = getQueryUsage();
  
  if (!usage.lastDatasetList) {
    return { allowed: true };
  }
  
  const lastCall = new Date(usage.lastDatasetList).getTime();
  const now = Date.now();
  const elapsed = now - lastCall;
  
  if (elapsed < LEGISCAN_CONFIG.datasetListMinInterval) {
    return {
      allowed: false,
      waitMs: LEGISCAN_CONFIG.datasetListMinInterval - elapsed,
    };
  }
  
  return { allowed: true };
}

// ============================================================================
// API Client
// ============================================================================

export class LegiScanClient {
  private apiKey: string;
  private datasetAccessKey: string;

  constructor() {
    const apiKey = process.env.LEGISCAN_API_KEY;
    const datasetAccessKey = process.env.LEGISCAN_DATASET_ACCESS_KEY;

    if (!apiKey) {
      throw new Error("LEGISCAN_API_KEY environment variable is required");
    }

    this.apiKey = apiKey;
    this.datasetAccessKey = datasetAccessKey || "";
  }

  /**
   * Get current query usage stats
   */
  getUsage(): QueryUsage {
    return getQueryUsage();
  }

  /**
   * Check if we can make more queries this month
   */
  canQuery(): boolean {
    const usage = getQueryUsage();
    return usage.count < LEGISCAN_CONFIG.queryHardStopThreshold;
  }

  /**
   * Make an API request
   */
  private async request<T>(
    operation: string,
    params: Record<string, string | number> = {},
    options: { skipRateLimit?: boolean; skipQueryCount?: boolean } = {}
  ): Promise<T> {
    // Check query limit
    if (!options.skipQueryCount && !this.canQuery()) {
      throw new Error(
        `LegiScan query limit reached (${LEGISCAN_CONFIG.queryHardStopThreshold}). ` +
        `Wait until next month or upgrade your plan.`
      );
    }

    // Build URL
    const url = new URL(LEGISCAN_CONFIG.baseUrl);
    url.searchParams.set("key", this.apiKey);
    url.searchParams.set("op", operation);
    
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }

    // Make request
    console.log(`[LegiScan] Calling ${operation}...`);
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`LegiScan API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as LegiScanResponse<T>;

    // Check for API errors
    if (data.status === "ERROR") {
      throw new Error(`LegiScan API error: ${data.alert?.message || "Unknown error"}`);
    }

    // Track query usage
    if (!options.skipQueryCount) {
      const usage = incrementQueryCount(operation);
      console.log(`[LegiScan] Query ${usage.count}/${LEGISCAN_CONFIG.monthlyQueryLimit} this month`);
    }

    return data as T;
  }

  // ==========================================================================
  // Dataset Operations (for bulk/initial loads)
  // ==========================================================================

  /**
   * Get list of available datasets with their hashes
   * Use to check if new data is available before downloading
   */
  async getDatasetList(state: string = LEGISCAN_CONFIG.defaultState): Promise<DatasetListResponse> {
    // Rate limit check
    const rateCheck = canCallDatasetList();
    if (!rateCheck.allowed) {
      const waitMinutes = Math.ceil((rateCheck.waitMs || 0) / 60000);
      throw new Error(
        `Rate limit: getDatasetList can only be called once per day. ` +
        `Wait ${waitMinutes} minutes or use --force flag.`
      );
    }

    return this.request<DatasetListResponse>("getDatasetList", { state });
  }

  /**
   * Download a full dataset ZIP file
   * Returns Base64 encoded ZIP containing all bills/votes/people for a session
   */
  async getDataset(sessionId: number, accessKey?: string): Promise<DatasetResponse> {
    const key = accessKey || this.datasetAccessKey;
    
    if (!key) {
      throw new Error(
        "Dataset access key required. Set LEGISCAN_DATASET_ACCESS_KEY or pass accessKey parameter."
      );
    }

    return this.request<DatasetResponse>("getDataset", {
      id: sessionId,
      access_key: key,
    });
  }

  // ==========================================================================
  // Real-time Operations (for checking changes during active session)
  // ==========================================================================

  /**
   * Get master list of all bills with their change_hash values
   * Use to detect which bills have changed since last sync
   */
  async getMasterListRaw(sessionId: number = LEGISCAN_CONFIG.nmSessionId): Promise<MasterListRawResponse> {
    // Rate limit check
    const rateCheck = canCallMasterList();
    if (!rateCheck.allowed) {
      const waitMinutes = Math.ceil((rateCheck.waitMs || 0) / 60000);
      throw new Error(
        `Rate limit: getMasterListRaw can only be called once per hour. ` +
        `Wait ${waitMinutes} minutes.`
      );
    }

    return this.request<MasterListRawResponse>("getMasterListRaw", { id: sessionId });
  }

  /**
   * Get full bill details
   * Only call when change_hash differs from stored value
   */
  async getBill(billId: number): Promise<LegiScanResponse<unknown>> {
    return this.request<LegiScanResponse<unknown>>("getBill", { id: billId });
  }

  /**
   * Get roll call vote details
   */
  async getRollCall(rollCallId: number): Promise<LegiScanResponse<unknown>> {
    return this.request<LegiScanResponse<unknown>>("getRollCall", { id: rollCallId });
  }

  /**
   * Get person/legislator details
   */
  async getPerson(personId: number): Promise<LegiScanResponse<unknown>> {
    return this.request<LegiScanResponse<unknown>>("getPerson", { id: personId });
  }

  // ==========================================================================
  // Session Operations
  // ==========================================================================

  /**
   * Get list of legislative sessions for a state
   */
  async getSessionList(state: string = LEGISCAN_CONFIG.defaultState): Promise<SessionListResponse> {
    return this.request<SessionListResponse>("getSessionList", { state });
  }

  /**
   * Get all legislators for a session
   */
  async getSessionPeople(sessionId: number = LEGISCAN_CONFIG.nmSessionId): Promise<LegiScanResponse<unknown>> {
    return this.request<LegiScanResponse<unknown>>("getSessionPeople", { id: sessionId });
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Compare a dataset hash with the stored value
   * Returns true if data has changed and needs to be downloaded
   */
  datasetNeedsUpdate(currentHash: string | null, newHash: string): boolean {
    if (!currentHash) return true;
    return currentHash !== newHash;
  }

  /**
   * Compare a bill's change_hash with the stored value
   * Returns true if bill data has changed and needs to be fetched
   */
  billNeedsUpdate(currentHash: string | null, newHash: string): boolean {
    if (!currentHash) return true;
    return currentHash !== newHash;
  }

  /**
   * Extract bills from getMasterListRaw response
   */
  extractBillsFromMasterList(response: MasterListRawResponse): MasterListBill[] {
    const bills: MasterListBill[] = [];
    
    for (const [key, value] of Object.entries(response.masterlist)) {
      if (key === "session") continue;
      if (typeof value === "object" && "bill_id" in value) {
        bills.push(value as MasterListBill);
      }
    }
    
    return bills;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let clientInstance: LegiScanClient | null = null;

export function getLegiScanClient(): LegiScanClient {
  if (!clientInstance) {
    clientInstance = new LegiScanClient();
  }
  return clientInstance;
}

// ============================================================================
// CLI Helper
// ============================================================================

export function printUsageStats(): void {
  const usage = getQueryUsage();
  console.log("\n=== LegiScan API Usage ===");
  console.log(`Month: ${usage.month}`);
  console.log(`Queries used: ${usage.count}/${LEGISCAN_CONFIG.monthlyQueryLimit}`);
  console.log(`Remaining: ${LEGISCAN_CONFIG.monthlyQueryLimit - usage.count}`);
  console.log(`Last query: ${usage.lastQuery || "Never"}`);
  console.log(`Last getMasterListRaw: ${usage.lastMasterList || "Never"}`);
  console.log(`Last getDatasetList: ${usage.lastDatasetList || "Never"}`);
  
  if (usage.count >= LEGISCAN_CONFIG.queryHardStopThreshold) {
    console.log("\n⚠️  HARD STOP THRESHOLD REACHED - No more queries allowed this month!");
  } else if (usage.count >= LEGISCAN_CONFIG.queryWarningThreshold) {
    console.log("\n⚠️  Warning: Approaching monthly query limit");
  }
  console.log("");
}
