# NM Legislation Tracker

A Next.js application for tracking New Mexico legislation, bills, and legislators.

## Features

- Browse and search bills from the NM Legislature
- View legislator profiles and voting records
- AI-powered bill chat to understand legislation in plain language
- Track bill status and history

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js with Google OAuth
- **AI**: OpenRouter (Claude 3.5 Haiku)
- **Styling**: Tailwind CSS

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Google OAuth credentials
- OpenRouter API key
- LegiScan API key (optional, for syncing data)

### Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

### Installation

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Start development server
npm run dev
```

### Data Import

The app uses data from LegiScan and nmlegis.gov. To import data:

```bash
# Import from nmlegis JSON files
npm run import:nmlegis

# Fetch bill text from nmlegis.gov
npm run fetch:text
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/legislation/    # API routes for bills, legislators
│   ├── bills/              # Bill list and detail pages
│   └── legislators/        # Legislator list and detail pages
├── components/             # React components
├── lib/                    # Utilities and configuration
│   ├── config.ts           # App configuration
│   ├── legiscan-api.ts     # LegiScan API client
│   ├── legislative-codes.ts # NM committee/action codes
│   ├── llm.ts              # AI chat functions
│   └── nmlegis-parser.ts   # nmlegis.gov action parser
└── scripts/                # Data import scripts
```

## License

MIT
