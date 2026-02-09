"use client";

import BaseChatPanel from "./BaseChatPanel";
import { AI_ASSISTANT } from "@/lib/config";

interface BillChatPanelProps {
  billId: string;
  billTitle: string;
}

const initialSuggestions = [
  "What does this bill actually do in plain English?",
  "Who are the main sponsors and what party are they?",
  "What's the current status and what happens next?",
];

export default function BillChatPanel({
  billId,
  billTitle,
}: BillChatPanelProps) {
  return (
    <BaseChatPanel
      resourceId={billId}
      resourceTitle={billTitle}
      resourceType="bill"
      chatEndpoint={`/api/legislation/bills/${billId}/chat`}
      messagesEndpoint={`/api/legislation/bills/${billId}/messages`}
      colorScheme="green"
      headerTitle={AI_ASSISTANT.tagline}
      headerSubtitle="Ask questions about this legislation"
      initialSuggestions={initialSuggestions}
      inputPlaceholder="Ask about this bill..."
    />
  );
}
