import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText } from "ai";
import { LLM_CONFIG } from "./config";

export const OPENROUTER_MODEL = LLM_CONFIG.model;

// Create OpenRouter provider using OpenAI-compatible interface
const openrouter = createOpenAICompatible({
  name: "openrouter",
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

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
