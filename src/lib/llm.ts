/**
 * LLM (Large Language Model) Integration
 *
 * This module provides AI chat functionality using OpenRouter's API
 * with Claude 3.5 Haiku for bill analysis and explanation.
 *
 * @module lib/llm
 */

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText } from "ai";
import { LLM_CONFIG } from "./config";

/** The model identifier used for AI chat (from config) */
export const OPENROUTER_MODEL = LLM_CONFIG.model;

/**
 * OpenRouter provider instance configured with OpenAI-compatible interface.
 * Uses the OPENROUTER_API_KEY environment variable for authentication.
 */
const openrouter = createOpenAICompatible({
  name: "openrouter",
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

/**
 * System prompt for the bill chat assistant.
 * Defines the AI's persona, capabilities, and response format.
 */
const BILL_CHAT_SYSTEM_PROMPT = `You are Bill, an AI assistant who knows legislation inside and out. You explain bills in plain, accessible language.

Your role:
- Make legislative jargon understandable to regular people
- Explain what bills actually do and who they affect
- Be neutral and factual about bill contents
- Explain the legislative process when relevant
- Highlight key sponsors, votes, and status changes

Status meanings you should use:
- Introduced: Just filed, waiting for committee review
- Engrossed: Passed one chamber (House OR Senate), now heading to the other
- Enrolled: Passed BOTH chambers, waiting for Governor's signature
- Passed: Signed into law by the Governor
- Vetoed: Rejected by the Governor
- Failed: Did not pass (voted down or died in committee)

When answering:
- Be concise and direct
- Use bullet points for lists
- Cite specific data (vote counts, dates, sponsor names) when relevant
- Explain implications in everyday terms

When FULL BILL TEXT is provided:
- You have access to the complete legislative text
- Explain specific sections when asked
- Identify what existing laws are being changed (look for strikethrough/underline references)
- Summarize key provisions in plain language
- Note NMSA (New Mexico Statutes Annotated) references
- Explain fiscal implications if mentioned

Follow-up Suggestions:
End EVERY response with exactly this format:
[SUGGESTIONS]
- Question here (5-8 words max)
- Another question (5-8 words max)
[/SUGGESTIONS]

Generate 2-3 contextual follow-ups that help the user understand the bill better.`;

/**
 * Chat with AI about a specific bill.
 *
 * Streams a response from Claude 3.5 Haiku explaining the bill
 * in plain language based on the provided context.
 *
 * @param billContext - Formatted string containing bill metadata, history,
 *                      sponsors, votes, and optionally full bill text
 * @param userMessage - The user's question about the bill
 * @param chatHistory - Previous messages in the conversation for context
 * @returns A streaming text response from the AI model
 *
 * @example
 * ```typescript
 * const result = await billChat(
 *   "Bill: HB9 - Education Funding...",
 *   "What does this bill do?",
 *   []
 * );
 * // Use result.toUIMessageStreamResponse() for streaming to client
 * ```
 */
export async function billChat(
  billContext: string,
  userMessage: string,
  chatHistory: { role: "user" | "assistant"; content: string }[]
) {
  const systemPrompt = `${BILL_CHAT_SYSTEM_PROMPT}

<bill>
${billContext}
</bill>

IMPORTANT: Keep your response to 2-3 short paragraphs maximum. Lead with the direct answer.`;

  const messages = [
    ...chatHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: userMessage },
  ];

  return streamText({
    model: openrouter.chatModel(OPENROUTER_MODEL),
    system: systemPrompt,
    messages,
    maxOutputTokens: 400,
  });
}
