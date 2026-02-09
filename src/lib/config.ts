// Shared configuration for NM Legislation Tracker

export const LLM_CONFIG = {
  // The model identifier used for chat
  model: "anthropic/claude-3.5-haiku",
  
  // Human-readable model name for display
  displayName: "Claude 3.5 Haiku",
  
  // Provider name
  provider: "Anthropic (via OpenRouter)",
} as const;

// AI Assistant branding
export const AI_ASSISTANT = {
  name: "Bill",
  tagline: "Ask Bill",
  description: "Your AI assistant for understanding legislation",
} as const;

// LegiScan API configuration
export const LEGISCAN_CONFIG = {
  // Base API URL
  baseUrl: "https://api.legiscan.com/",
  
  // Default state for queries
  defaultState: "NM",
  
  // NM session ID for 2026 Regular Session
  nmSessionId: 2251,
  
  // Monthly query limit (free tier)
  monthlyQueryLimit: 30000,
  
  // Warning threshold (warn when approaching limit)
  queryWarningThreshold: 25000,
  
  // Hard stop threshold (stop making queries)
  queryHardStopThreshold: 29000,
  
  // Minimum interval between getMasterListRaw calls (ms) - once per hour
  masterListMinInterval: 60 * 60 * 1000,
  
  // Minimum interval between getDatasetList calls (ms) - once per day
  datasetListMinInterval: 24 * 60 * 60 * 1000,
} as const;
