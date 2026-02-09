"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useChat, UIMessage } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { MessageSquare, Send, StopCircle, HelpCircle, FileText } from "lucide-react";
import MessageContent from "./MessageContent";
import LoginModal from "./LoginModal";
import PaywallModal from "./PaywallModal";
import { LLM_CONFIG, AI_ASSISTANT } from "@/lib/config";

// Color scheme configuration
type ColorScheme = "blue" | "purple" | "green";

const colorConfig = {
  blue: {
    gradient: "from-blue-500 to-purple-600",
    accent: "bg-blue-100",
    accentIcon: "text-blue-600",
    userBubble: "bg-blue-600",
    button: "bg-blue-600 hover:bg-blue-700",
    focusRing: "focus:ring-blue-500 focus:border-blue-500",
    suggestion: "text-blue-600 bg-blue-50 hover:bg-blue-100",
    suggestionChip: "text-blue-700 bg-blue-50 hover:bg-blue-100 border-blue-200",
  },
  purple: {
    gradient: "from-purple-500 to-indigo-600",
    accent: "bg-purple-100",
    accentIcon: "text-purple-600",
    userBubble: "bg-purple-600",
    button: "bg-purple-600 hover:bg-purple-700",
    focusRing: "focus:ring-purple-500 focus:border-purple-500",
    suggestion: "text-purple-600 bg-purple-50 hover:bg-purple-100",
    suggestionChip: "text-purple-700 bg-purple-50 hover:bg-purple-100 border-purple-200",
  },
  green: {
    gradient: "from-emerald-500 to-teal-600",
    accent: "bg-emerald-100",
    accentIcon: "text-emerald-600",
    userBubble: "bg-emerald-600",
    button: "bg-emerald-600 hover:bg-emerald-700",
    focusRing: "focus:ring-emerald-500 focus:border-emerald-500",
    suggestion: "text-emerald-600 bg-emerald-50 hover:bg-emerald-100",
    suggestionChip: "text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200",
  },
};

export interface BaseChatPanelProps {
  // Identity
  resourceId: string;
  resourceTitle: string;
  resourceType: "document" | "project" | "bill";

  // API
  chatEndpoint: string;
  messagesEndpoint: string;

  // Theme
  colorScheme: ColorScheme;
  headerTitle: string;
  headerSubtitle: string;

  // Initial state
  initialSuggestions: string[];
  inputPlaceholder: string;

  // Callbacks
  onGoToPage?: (page: number) => void;

  // Project-specific (optional)
  documentCount?: number;
}

// Loading component shown while fetching chat history
export function ChatPanelLoading({ colorScheme }: { colorScheme: ColorScheme }) {
  const colors = colorConfig[colorScheme];
  
  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className={`w-10 h-10 bg-gradient-to-br ${colors.gradient} rounded-full flex items-center justify-center`}>
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">
              {AI_ASSISTANT.tagline}
            </h2>
            <p className="text-xs text-gray-500">
              {colorScheme === "blue" ? "Ask questions about this document" : "Chat across all documents"}
            </p>
          </div>
        </div>
      </div>

      {/* Loading indicator */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col">
        <div className="mt-auto">
          <div className="flex justify-center py-8">
            <div className="flex space-x-2">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div
                className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                style={{ animationDelay: "0.1s" }}
              ></div>
              <div
                className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                style={{ animationDelay: "0.2s" }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Disabled input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex space-x-2 items-end">
          <textarea
            placeholder="Loading chat history..."
            rows={1}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-2xl text-sm text-gray-900 opacity-50 resize-none overflow-hidden"
            disabled
            style={{ minHeight: "40px", maxHeight: "120px" }}
          />
          <button
            disabled
            className={`px-4 py-2 ${colors.button} text-white rounded-full opacity-50 cursor-not-allowed`}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Inner component that contains useChat - only renders after messages are loaded
function BaseChatPanelContent({
  resourceId,
  resourceTitle,
  resourceType,
  chatEndpoint,
  colorScheme,
  headerTitle,
  headerSubtitle,
  initialSuggestions,
  inputPlaceholder,
  onGoToPage,
  documentCount,
  initialMessages,
}: BaseChatPanelProps & { initialMessages: UIMessage[] }) {
  const { status: authStatus } = useSession();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [hasApiKey, setHasApiKey] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [tokensUsed, setTokensUsed] = useState(0);
  const [anonymousQuestionCount, setAnonymousQuestionCount] = useState(0);

  // Track response duration per message
  const [messageDurations, setMessageDurations] = useState<Record<string, number>>({});
  const responseStartTimeRef = useRef<number | null>(null);

  // Mobile detection for disabling auto-scroll during generation
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-resize textarea as content changes
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputValue]);

  const colors = colorConfig[colorScheme];
  const isProject = resourceType === "project";
  const isBill = resourceType === "bill";
  const idField = isProject ? "projectId" : isBill ? "billId" : "documentId";
  
  // Anonymous users can ask 2 free questions on shared documents
  const ANONYMOUS_FREE_QUESTIONS = 2;

  // Load anonymous question count from localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && resourceType === "document") {
      const stored = localStorage.getItem(`anon_questions_${resourceId}`);
      if (stored) {
        setAnonymousQuestionCount(parseInt(stored, 10) || 0);
      }
    }
  }, [resourceId, resourceType]);

  // Helper to check auth before any chat interaction
  const requireAuth = (callback: () => void) => {
    if (authStatus !== "authenticated") {
      setShowLoginModal(true);
      return;
    }
    callback();
  };

  // Track anonymous question count ref for use in callbacks
  const anonymousCountRef = useRef(anonymousQuestionCount);
  useEffect(() => {
    anonymousCountRef.current = anonymousQuestionCount;
  }, [anonymousQuestionCount]);

  // useChat for chat
  const { messages, sendMessage, status, error, stop } = useChat({
    id: isProject ? `project-${resourceId}` : resourceId,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: chatEndpoint,
      prepareSendMessagesRequest: ({ messages }) => {
        const lastMessage = messages[messages.length - 1];
        const messageText =
          lastMessage?.parts
            .filter((p): p is { type: "text"; text: string } => p.type === "text")
            .map((p) => p.text)
            .join("") || "";

        return {
          body: {
            [idField]: resourceId,
            message: messageText,
            history: messages.slice(0, -1).map((m) => ({
              role: m.role,
              content: m.parts
                .filter((p): p is { type: "text"; text: string } => p.type === "text")
                .map((p) => p.text)
                .join(""),
            })),
            // Include anonymous question count for shared docs
            anonymousQuestionCount: anonymousCountRef.current,
          },
        };
      },
    }),
    onError: (error) => {
      if (error.message?.includes("API key")) {
        setHasApiKey(false);
      }
      // Handle anonymous limit - show login modal
      if (error.message?.includes("anonymous_limit") || 
          (error.message?.includes("Unauthorized") && authStatus !== "authenticated")) {
        setShowLoginModal(true);
        return;
      }
      if (error.message?.includes("Unauthorized")) {
        setShowLoginModal(true);
      }
      // Handle token limit (402 Payment Required)
      if (error.message?.includes("token_limit")) {
        // Try to extract tokens used from error message
        try {
          const match = error.message.match(/"tokensUsed"\s*:\s*(\d+)/);
          if (match) {
            setTokensUsed(parseInt(match[1], 10));
          }
        } catch {
          // Ignore parse errors
        }
        setShowPaywallModal(true);
      }
    },
  });

  const scrollToBottom = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    // Skip auto-scroll on mobile so users can read from the top while content generates
    if (!isMobile) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom, isMobile]);

  // Track response duration and anonymous question count
  useEffect(() => {
    if (status === "submitted") {
      responseStartTimeRef.current = Date.now();
    } else if (status === "ready" && responseStartTimeRef.current !== null) {
      const duration = (Date.now() - responseStartTimeRef.current) / 1000;
      const lastAssistantMessage = messages.filter((m) => m.role === "assistant").pop();
      if (lastAssistantMessage) {
        setMessageDurations((prev) => ({
          ...prev,
          [lastAssistantMessage.id]: duration,
        }));
        
        // Increment anonymous question count after successful response
        if (authStatus !== "authenticated" && resourceType === "document") {
          const newCount = anonymousQuestionCount + 1;
          setAnonymousQuestionCount(newCount);
          localStorage.setItem(`anon_questions_${resourceId}`, String(newCount));
        }
      }
      responseStartTimeRef.current = null;
    }
  }, [status, messages, authStatus, resourceType, resourceId, anonymousQuestionCount]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = (e?: React.FormEvent, directMessage?: string) => {
    e?.preventDefault();
    const messageToSend = directMessage || inputValue.trim();
    if (!messageToSend || status !== "ready" || !hasApiKey) return;

    // For documents: allow anonymous users to ask limited questions
    // For projects/bills: require auth
    if (resourceType === "document" && authStatus !== "authenticated") {
      // Check if they've used their free questions
      if (anonymousQuestionCount >= ANONYMOUS_FREE_QUESTIONS) {
        setShowLoginModal(true);
        return;
      }
      // Allow the question - increment count after response
      sendMessage({ text: messageToSend });
      setInputValue("");
      return;
    }

    // For projects/bills or authenticated users
    requireAuth(() => {
      sendMessage({ text: messageToSend });
      setInputValue("");
    });
  };

  // Helper to extract text from message parts
  const getMessageText = (message: UIMessage): string => {
    return message.parts
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join("");
  };

  // Parse LLM-generated suggestions from response
  const parseSuggestions = (content: string): { text: string; suggestions: string[] } => {
    const match = content.match(/\[SUGGESTIONS\]([\s\S]*?)\[\/SUGGESTIONS\]/);
    if (!match) return { text: content, suggestions: [] };

    const suggestions = match[1]
      .split("\n")
      .map((s) => s.replace(/^-\s*/, "").trim())
      .filter((s) => s.length > 0)
      .slice(0, 3); // Max 3

    return {
      text: content.replace(/\[SUGGESTIONS\][\s\S]*?\[\/SUGGESTIONS\]/, "").trim(),
      suggestions,
    };
  };

  const isLoading = status === "submitted" || status === "streaming";
  const isDisabled = isLoading || !hasApiKey || (isProject && documentCount === 0);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className={`w-10 h-10 bg-gradient-to-br ${colors.gradient} rounded-full flex items-center justify-center`}>
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">{headerTitle}</h2>
            <p className="text-xs text-gray-500">{headerSubtitle}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto p-4 pb-20 flex flex-col">
        <div className="mt-auto space-y-4">
          {!hasApiKey && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
              <strong>Note:</strong> LLM API key not configured. Please set up your API key in the
              environment variables to enable chat.
            </div>
          )}

          {/* Project-specific: No documents state */}
          {isProject && documentCount === 0 && (
            <div className="text-center py-8">
              <div className={`w-16 h-16 ${colors.accent} rounded-full flex items-center justify-center mx-auto mb-4`}>
                <FileText className="w-8 h-8 text-purple-400" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Add Documents to Chat</h3>
              <p className="text-sm text-gray-500">
                Add documents to this project to start chatting across them.
              </p>
            </div>
          )}

          {/* Empty state with suggestions */}
          {messages.length === 0 && hasApiKey && (!isProject || documentCount! > 0) && (
            <div className="text-center py-8">
              <div className={`w-16 h-16 ${colors.accent} rounded-full flex items-center justify-center mx-auto mb-4`}>
                <HelpCircle className={`w-8 h-8 ${colors.accentIcon}`} />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Ask {AI_ASSISTANT.name} about &ldquo;{resourceTitle}&rdquo;
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                {isProject
                  ? `${AI_ASSISTANT.name} can help you understand all ${documentCount} documents. Try asking:`
                  : `${AI_ASSISTANT.name} can help you understand this document. Try asking:`}
              </p>
              <div className="space-y-2">
                {initialSuggestions.map((question, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSubmit(undefined, question)}
                    className={`block w-full text-left px-4 py-2 text-sm ${colors.suggestion} rounded-lg transition-colors`}
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message list */}
          {messages.map((message, idx) => {
            const rawContent = getMessageText(message);
            const { text: cleanedContent, suggestions } =
              message.role === "assistant"
                ? parseSuggestions(rawContent)
                : { text: rawContent, suggestions: [] };
            const isLastMessage = idx === messages.length - 1;
            const showSuggestions =
              isLastMessage && message.role === "assistant" && status === "ready" && suggestions.length > 0;

            return (
              <div key={message.id}>
                <div className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] ${message.role === "user" ? "" : "space-y-1"}`}
                    style={{ maxWidth: "min(80%, 550px)" }}
                  >
                    <div
                      className={`rounded-2xl px-4 py-2 ${
                        message.role === "user" ? `${colors.userBubble} text-white` : "bg-gray-100 text-gray-900"
                      }`}
                    >
                      {message.role === "user" ? (
                        <p className="text-sm whitespace-pre-wrap">{cleanedContent}</p>
                      ) : (
                        <MessageContent content={cleanedContent} onGoToPage={onGoToPage} />
                      )}
                    </div>
                    {/* Model attribution and duration for assistant messages */}
                    {message.role === "assistant" && (
                      <p className="text-[10px] text-gray-400 px-2">
                        {LLM_CONFIG.displayName}
                        {messageDurations[message.id] && (
                          <span> · {messageDurations[message.id].toFixed(1)}s</span>
                        )}
                      </p>
                    )}
                  </div>
                </div>

                {/* Contextual suggestion chips */}
                {showSuggestions && (
                  <div className="flex flex-wrap gap-2 mt-3 pl-1">
                    {suggestions.map((suggestion, sIdx) => (
                      <button
                        key={sIdx}
                        onClick={() => handleSubmit(undefined, suggestion)}
                        className={`px-3 py-1.5 text-xs ${colors.suggestionChip} border rounded-full transition-colors`}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Loading indicator */}
          {status === "submitted" && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl px-4 py-3">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                </div>
              </div>
            </div>
          )}

          {/* Stop button */}
          {status === "streaming" && (
            <div className="flex justify-center">
              <button
                onClick={() => stop()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
              >
                <StopCircle className="w-4 h-4" />
                Stop generating
              </button>
            </div>
          )}

          {/* Error display */}
          {error && !error.message?.includes("Unauthorized") && !error.message?.includes("token_limit") && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              Error: {error.message}
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 bg-white pb-safe">
        <form onSubmit={handleSubmit} className="flex space-x-2 items-end">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              // Only show login for projects/bills, allow anonymous on documents
              if (authStatus !== "authenticated" && resourceType !== "document") {
                setShowLoginModal(true);
              }
              // Show login for documents if they've used their free questions
              if (authStatus !== "authenticated" && resourceType === "document" && anonymousQuestionCount >= ANONYMOUS_FREE_QUESTIONS) {
                setShowLoginModal(true);
              }
            }}
            placeholder={inputPlaceholder}
            rows={1}
            className={`flex-1 px-4 py-2 border border-gray-300 rounded-2xl ${colors.focusRing} focus:ring-2 text-sm text-gray-900 resize-none overflow-hidden`}
            disabled={isDisabled}
            style={{ minHeight: "40px", maxHeight: "120px" }}
          />
          <button
            type="submit"
            disabled={isDisabled || !inputValue.trim()}
            className={`px-4 py-2 ${colors.button} text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>

      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        documentTitle={resourceTitle}
      />

      {/* Paywall Modal */}
      <PaywallModal
        isOpen={showPaywallModal}
        onClose={() => setShowPaywallModal(false)}
        tokensUsed={tokensUsed}
      />
    </div>
  );
}

// Main component - loads messages first, then renders BaseChatPanelContent
export default function BaseChatPanel(props: BaseChatPanelProps) {
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(null);

  // Load existing messages BEFORE rendering the chat component
  useEffect(() => {
    async function loadMessages() {
      try {
        const response = await fetch(props.messagesEndpoint, {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          const loaded: UIMessage[] = data.messages.map(
            (m: { id: string; role: string; content: string }) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              parts: [{ type: "text" as const, text: m.content }],
              createdAt: new Date(),
            })
          );
          setInitialMessages(loaded);
        } else {
          setInitialMessages([]);
        }
      } catch (err) {
        console.error("Failed to load chat history:", err);
        setInitialMessages([]);
      }
    }
    loadMessages();
  }, [props.messagesEndpoint]);

  // Show loading state until messages are loaded
  if (initialMessages === null) {
    return <ChatPanelLoading colorScheme={props.colorScheme} />;
  }

  // Once messages are loaded, render the actual chat component
  return <BaseChatPanelContent {...props} initialMessages={initialMessages} />;
}
