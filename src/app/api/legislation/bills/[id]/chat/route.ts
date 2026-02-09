import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { billChat } from "@/lib/llm";
import { getAuthSession } from "@/lib/auth-helpers";
import { TOKEN_LIMITS } from "@/lib/config";
import { isAdmin } from "@/lib/permissions";

// Status code to plain English mapping
const STATUS_DESCRIPTIONS: Record<number, string> = {
  1: "Introduced (Just filed, waiting for committee review)",
  2: "Engrossed (Passed one chamber, heading to the other)",
  3: "Enrolled (Passed both chambers, waiting for Governor)",
  4: "Passed (Signed into law)",
  5: "Vetoed (Rejected by the Governor)",
  6: "Failed (Did not pass)",
};

function buildBillContext(bill: {
  billNumber: string;
  title: string;
  description: string | null;
  status: number;
  statusDate: Date | null;
  body: string;
  session: { sessionName: string };
  sponsors: Array<{
    sponsorType: number;
    person: {
      name: string;
      party: string;
      role: string;
      district: string;
    };
  }>;
  votes: Array<{
    date: Date;
    description: string;
    chamber: string;
    yea: number;
    nay: number;
    absent: number;
    passed: boolean;
  }>;
  history: unknown;
  supplements: unknown;
  fullText: string | null;
  fullTextUrl: string | null;
}): string {
  const lines: string[] = [];

  // Basic info
  lines.push(`Bill: ${bill.billNumber} - ${bill.title}`);
  if (bill.description && bill.description !== bill.title) {
    lines.push(`Description: ${bill.description}`);
  }
  lines.push(`Status: ${STATUS_DESCRIPTIONS[bill.status] || `Status ${bill.status}`}`);
  if (bill.statusDate) {
    lines.push(`Last Action Date: ${bill.statusDate.toLocaleDateString()}`);
  }
  lines.push(`Session: ${bill.session.sessionName}`);
  lines.push(`Chamber of Origin: ${bill.body === "H" ? "House" : "Senate"}`);
  lines.push("");

  // Sponsors
  const primarySponsors = bill.sponsors.filter((s) => s.sponsorType === 1);
  const coSponsors = bill.sponsors.filter((s) => s.sponsorType !== 1);

  if (primarySponsors.length > 0) {
    lines.push("Primary Sponsors:");
    for (const s of primarySponsors) {
      lines.push(`- ${s.person.name} (${s.person.party}) - ${s.person.role}, ${s.person.district}`);
    }
    lines.push("");
  }

  if (coSponsors.length > 0) {
    const coSponsorNames = coSponsors.map((s) => `${s.person.name} (${s.person.party})`).join(", ");
    lines.push(`Co-Sponsors (${coSponsors.length}): ${coSponsorNames}`);
    lines.push("");
  }

  // History
  const history = bill.history as Array<{
    date: string;
    action: string;
    chamber: string;
  }> | null;
  
  if (history && history.length > 0) {
    lines.push("Bill History:");
    // Sort by date descending and take last 15 actions
    const sortedHistory = [...history]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 15);
    
    for (const h of sortedHistory.reverse()) {
      const chamber = h.chamber === "H" ? "House" : "Senate";
      lines.push(`- ${h.date} (${chamber}): ${h.action}`);
    }
    lines.push("");
  }

  // Votes
  if (bill.votes.length > 0) {
    lines.push("Roll Call Votes:");
    for (const v of bill.votes) {
      const chamber = v.chamber === "H" ? "House" : "Senate";
      const result = v.passed ? "PASSED" : "FAILED";
      lines.push(
        `- ${v.description} (${chamber}, ${v.date.toLocaleDateString()}): ${v.yea} Yea, ${v.nay} Nay, ${v.absent} Absent - ${result}`
      );
    }
    lines.push("");
  }

  // Fiscal notes/supplements
  const supplements = bill.supplements as Array<{
    type: string;
    title: string;
    description?: string;
  }> | null;
  
  if (supplements && supplements.length > 0) {
    const fiscalNotes = supplements.filter((s) => s.type === "Fiscal Note");
    if (fiscalNotes.length > 0) {
      lines.push("Fiscal Notes Available: Yes");
    }
    
    const otherDocs = supplements.filter((s) => s.type !== "Fiscal Note");
    if (otherDocs.length > 0) {
      lines.push(`Other Documents: ${otherDocs.map((s) => s.title || s.type).join(", ")}`);
    }
    lines.push("");
  }

  // Full bill text from nmlegis.gov
  if (bill.fullText) {
    lines.push("===== FULL BILL TEXT =====");
    lines.push("");
    // Strip most HTML but keep some structure
    const cleanText = bill.fullText
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove style tags
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove script tags
      .replace(/<br\s*\/?>/gi, '\n') // Convert br to newlines
      .replace(/<\/p>/gi, '\n\n') // Paragraph breaks
      .replace(/<\/div>/gi, '\n') // Div breaks
      .replace(/<[^>]+>/g, ' ') // Remove other tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&#160;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\n\s+\n/g, '\n\n') // Clean up extra newlines
      .trim();
    
    // Truncate if too long (keep first 50k chars to stay within context limits)
    const maxLength = 50000;
    if (cleanText.length > maxLength) {
      lines.push(cleanText.slice(0, maxLength));
      lines.push("\n[... Bill text truncated for length. Full text available at nmlegis.gov ...]");
    } else {
      lines.push(cleanText);
    }
    lines.push("");
    lines.push("===== END FULL BILL TEXT =====");
    
    if (bill.fullTextUrl) {
      lines.push(`Source: ${bill.fullTextUrl}`);
    }
  }

  return lines.join("\n");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Require authentication
    const session = await getAuthSession(request);
    if (!session) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Fetch user for token tracking
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tokensUsed: true },
    });

    if (!user) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check token limit BEFORE processing (skip for admins)
    if (!isAdmin(session.user.email) && user.tokensUsed >= TOKEN_LIMITS.free) {
      return new Response(
        JSON.stringify({ 
          error: "token_limit", 
          tokensUsed: user.tokensUsed,
          limit: TOKEN_LIMITS.free 
        }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      );
    }

    const { message, history } = await request.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Fetch bill with all related data
    const bill = await prisma.legiBill.findUnique({
      where: { id },
      include: {
        session: true,
        sponsors: {
          include: {
            person: true,
          },
          orderBy: {
            sponsorOrder: "asc",
          },
        },
        votes: {
          orderBy: {
            date: "desc",
          },
        },
      },
    });

    if (!bill) {
      return new Response(
        JSON.stringify({ error: "Bill not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Save the user message to database
    await prisma.legiBillChatMessage.create({
      data: {
        billId: id,
        userId: session.user.id,
        role: "user",
        content: message,
      },
    });

    // Build bill context
    const billContext = buildBillContext(bill);
    console.log("[Bill Chat] Context length:", billContext.length, "chars");

    // Sanitize chat history
    const chatHistory = (history || [])
      .filter((m: { role: string; content: string }) => m.content && m.content.trim())
      .map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: String(m.content).trim(),
      }));

    const result = await billChat(billContext, message, chatHistory);

    // Consume stream to ensure onFinish fires
    result.consumeStream();

    // Return the stream response with onFinish callback to save assistant message and track tokens
    return result.toUIMessageStreamResponse({
      onFinish: async ({ responseMessage }) => {
        const text = responseMessage?.parts
          ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
          .map((p) => p.text)
          .join("") || "";

        // Estimate tokens: ~4 characters per token (rough approximation)
        const estimatedTokens = Math.ceil((message.length + text.length) / 4);

        try {
          // Save assistant message and update token count in a transaction
          await prisma.$transaction([
            prisma.legiBillChatMessage.create({
              data: {
                billId: id,
                userId: session.user.id,
                role: "assistant",
                content: text.trim() || "[empty response]",
              },
            }),
            prisma.user.update({
              where: { id: session.user.id },
              data: { tokensUsed: { increment: estimatedTokens } },
            }),
          ]);
          console.log(`[Bill Chat] Tracked ~${estimatedTokens} tokens for user ${session.user.id}`);
        } catch (error) {
          console.error("Error saving assistant message or tracking tokens:", error);
        }
      },
    });
  } catch (error) {
    console.error("Error in bill chat:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process chat request" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
