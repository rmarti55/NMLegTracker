import MainLayout from "@/components/MainLayout";
import BillCard from "@/components/BillCard";
import VoteChart from "@/components/VoteChart";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

async function getLegislator(id: string) {
  // Try by cuid first
  let legislator = await prisma.legiPerson.findUnique({
    where: { id },
    include: {
      sponsorships: {
        include: {
          bill: {
            include: {
              session: true,
              _count: {
                select: {
                  votes: true,
                },
              },
            },
          },
        },
        orderBy: {
          bill: {
            statusDate: "desc",
          },
        },
      },
      voteRecords: {
        include: {
          rollCall: {
            include: {
              bill: true,
            },
          },
        },
        orderBy: {
          rollCall: {
            date: "desc",
          },
        },
        take: 20,
      },
    },
  });

  // If not found, try by peopleId
  if (!legislator) {
    const peopleId = parseInt(id);
    if (!isNaN(peopleId)) {
      legislator = await prisma.legiPerson.findUnique({
        where: { peopleId },
        include: {
          sponsorships: {
            include: {
              bill: {
                include: {
                  session: true,
                  _count: {
                    select: {
                      votes: true,
                    },
                  },
                },
              },
            },
            orderBy: {
              bill: {
                statusDate: "desc",
              },
            },
          },
          voteRecords: {
            include: {
              rollCall: {
                include: {
                  bill: true,
                },
              },
            },
            orderBy: {
              rollCall: {
                date: "desc",
              },
            },
            take: 20,
          },
        },
      });
    }
  }

  if (!legislator) return null;

  // Get vote statistics
  const allVotes = await prisma.legiVoteRecord.findMany({
    where: { personId: legislator.id },
  });

  const voteStats = {
    yea: 0,
    nay: 0,
    absent: 0,
    nv: 0,
    total: allVotes.length,
  };

  for (const vote of allVotes) {
    switch (vote.voteText.toLowerCase()) {
      case "yea":
        voteStats.yea++;
        break;
      case "nay":
        voteStats.nay++;
        break;
      case "absent":
        voteStats.absent++;
        break;
      case "nv":
        voteStats.nv++;
        break;
    }
  }

  return { ...legislator, voteStats };
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function LegislatorDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getAuthSession();
  
  if (!session) {
    redirect("/api/auth/signin");
  }

  const legislator = await getLegislator(id);

  if (!legislator) {
    notFound();
  }

  const bio = legislator.bio as {
    social?: {
      email?: string;
      capitol_phone?: string;
      district_phone?: string;
      ballotpedia?: string;
      votesmart?: string;
    };
    capitol_address?: {
      address1?: string;
      city?: string;
      state?: string;
      zip?: string;
    };
    links?: {
      official?: {
        website?: string;
        facebook?: string;
        twitter?: string;
      };
    };
  } | null;

  const primarySponsored = legislator.sponsorships.filter((s) => s.sponsorType === 1);
  const coSponsored = legislator.sponsorships.filter((s) => s.sponsorType !== 1);

  return (
    <MainLayout>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start gap-6">
          {/* Photo */}
          {legislator.imageUrl ? (
            <img
              src={legislator.imageUrl}
              alt={legislator.name}
              className="w-32 h-32 rounded-xl object-cover border-4 border-gray-200"
            />
          ) : (
            <div className={`w-32 h-32 rounded-xl flex items-center justify-center text-white text-4xl font-bold ${
              legislator.party === "D" ? "bg-blue-500" : "bg-red-500"
            }`}>
              {legislator.firstName[0]}{legislator.lastName[0]}
            </div>
          )}
          
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">{legislator.name}</h1>
              <span className={`px-3 py-1 rounded-full font-medium ${
                legislator.party === "D" 
                  ? "bg-blue-100 text-blue-700" 
                  : "bg-red-100 text-red-700"
              }`}>
                {legislator.party === "D" ? "Democrat" : "Republican"}
              </span>
            </div>
            
            <p className="text-xl text-gray-600 mb-2">
              {legislator.role === "Rep" ? "Representative" : "Senator"} - {legislator.district}
            </p>
            
            <div className="flex flex-wrap gap-4 text-sm">
              {legislator.email && (
                <a href={`mailto:${legislator.email}`} className="text-blue-600 hover:underline">
                  {legislator.email}
                </a>
              )}
              {bio?.social?.capitol_phone && (
                <span className="text-gray-600">
                  Capitol: {bio.social.capitol_phone}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Voting Summary */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Voting Record</h3>
            
            {legislator.voteStats.total > 0 ? (
              <>
                <VoteChart
                  yea={legislator.voteStats.yea}
                  nay={legislator.voteStats.nay}
                  nv={legislator.voteStats.nv}
                  absent={legislator.voteStats.absent}
                  total={legislator.voteStats.total}
                  passed={true}
                  size="lg"
                />
                
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-sm text-gray-600">
                    Total votes cast: <span className="font-medium">{legislator.voteStats.total}</span>
                  </p>
                  <p className="text-sm text-gray-600">
                    Attendance rate: <span className="font-medium">
                      {((1 - legislator.voteStats.absent / legislator.voteStats.total) * 100).toFixed(1)}%
                    </span>
                  </p>
                </div>
              </>
            ) : (
              <p className="text-gray-500">No voting record available</p>
            )}
          </div>

          {/* Recent Votes */}
          {legislator.voteRecords.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Votes</h3>
              <div className="space-y-3">
                {legislator.voteRecords.map((record) => (
                  <Link
                    key={record.id}
                    href={`/bills/${record.rollCall.bill.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-blue-600">
                          {record.rollCall.bill.billNumber}
                        </span>
                        <span className="text-sm text-gray-500">
                          {record.rollCall.description}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 truncate">
                        {record.rollCall.bill.title}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">
                        {new Date(record.rollCall.date).toLocaleDateString()}
                      </span>
                      <span className={`px-2 py-1 rounded text-sm font-medium ${
                        record.voteText === "Yea" 
                          ? "bg-green-100 text-green-700"
                          : record.voteText === "Nay"
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-600"
                      }`}>
                        {record.voteText}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Sponsored Bills */}
          {primarySponsored.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Primary Sponsored Bills ({primarySponsored.length})
              </h3>
              <div className="space-y-3">
                {primarySponsored.slice(0, 10).map((sponsorship) => (
                  <BillCard 
                    key={sponsorship.bill.id} 
                    bill={{
                      ...sponsorship.bill,
                      statusDate: sponsorship.bill.statusDate?.toISOString() ?? null,
                      sponsors: [],
                    }} 
                    showDescription={false}
                  />
                ))}
                {primarySponsored.length > 10 && (
                  <p className="text-sm text-gray-500 text-center pt-2">
                    + {primarySponsored.length - 10} more bills
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Co-sponsored Bills */}
          {coSponsored.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Co-Sponsored Bills ({coSponsored.length})
              </h3>
              <div className="space-y-3">
                {coSponsored.slice(0, 5).map((sponsorship) => (
                  <BillCard 
                    key={sponsorship.bill.id} 
                    bill={{
                      ...sponsorship.bill,
                      statusDate: sponsorship.bill.statusDate?.toISOString() ?? null,
                      sponsors: [],
                    }} 
                    showDescription={false}
                  />
                ))}
                {coSponsored.length > 5 && (
                  <p className="text-sm text-gray-500 text-center pt-2">
                    + {coSponsored.length - 5} more bills
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Contact Info */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact</h3>
            <dl className="space-y-3">
              {legislator.email && (
                <div>
                  <dt className="text-sm text-gray-500">Email</dt>
                  <dd>
                    <a href={`mailto:${legislator.email}`} className="text-blue-600 hover:underline text-sm">
                      {legislator.email}
                    </a>
                  </dd>
                </div>
              )}
              {bio?.social?.capitol_phone && (
                <div>
                  <dt className="text-sm text-gray-500">Capitol Phone</dt>
                  <dd className="font-medium text-gray-900">{bio.social.capitol_phone}</dd>
                </div>
              )}
              {bio?.social?.district_phone && (
                <div>
                  <dt className="text-sm text-gray-500">District Phone</dt>
                  <dd className="font-medium text-gray-900">{bio.social.district_phone}</dd>
                </div>
              )}
              {bio?.capitol_address && (
                <div>
                  <dt className="text-sm text-gray-500">Capitol Address</dt>
                  <dd className="text-sm text-gray-900">
                    {bio.capitol_address.address1}<br />
                    {bio.capitol_address.city}, {bio.capitol_address.state} {bio.capitol_address.zip}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* External Links */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Links</h3>
            <div className="space-y-2">
              {bio?.links?.official?.website && (
                <a
                  href={bio.links.official.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                  Official Website
                </a>
              )}
              {bio?.social?.ballotpedia && (
                <a
                  href={bio.social.ballotpedia}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  Ballotpedia
                </a>
              )}
              {bio?.social?.votesmart && (
                <a
                  href={bio.social.votesmart}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  VoteSmart
                </a>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Statistics</h3>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Bills Sponsored</dt>
                <dd className="font-medium text-gray-900">{primarySponsored.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Bills Co-Sponsored</dt>
                <dd className="font-medium text-gray-900">{coSponsored.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Votes Recorded</dt>
                <dd className="font-medium text-gray-900">{legislator.voteStats.total}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
