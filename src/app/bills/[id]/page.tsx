import MainLayout from "@/components/MainLayout";
import BillDetailClient from "./BillDetailClient";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

async function getBill(id: string) {
  // Try by cuid first
  let bill = await prisma.legiBill.findUnique({
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
        include: {
          votes: {
            include: {
              person: true,
            },
          },
        },
        orderBy: {
          date: "desc",
        },
      },
    },
  });

  // If not found, try by billId
  if (!bill) {
    const billId = parseInt(id);
    if (!isNaN(billId)) {
      bill = await prisma.legiBill.findUnique({
        where: { billId },
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
            include: {
              votes: {
                include: {
                  person: true,
                },
              },
            },
            orderBy: {
              date: "desc",
            },
          },
        },
      });
    }
  }

  return bill;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function BillDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getAuthSession();
  
  if (!session) {
    redirect("/api/auth/signin");
  }

  const bill = await getBill(id);

  if (!bill) {
    notFound();
  }

  // Serialize the bill data for the client component
  const serializedBill = {
    ...bill,
    statusDate: bill.statusDate,
    history: bill.history as Array<{ date: string; action: string; chamber: string; chamber_id: number; importance: number }> | null,
    texts: bill.texts as Array<{ doc_id: number; date: string; type: string; url: string; state_link: string }> | null,
    supplements: bill.supplements as Array<{ supplement_id: number; date: string; type: string; title: string; url: string; state_link: string }> | null,
    fullText: bill.fullText,
    fullTextUrl: bill.fullTextUrl,
    votes: bill.votes.map(vote => ({
      ...vote,
      date: vote.date,
    })),
  };

  return (
    <MainLayout>
      <BillDetailClient bill={serializedBill} />
    </MainLayout>
  );
}
