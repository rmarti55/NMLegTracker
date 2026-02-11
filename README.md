# NM Legislation Tracker

A Next.js application for tracking New Mexico legislation, bills, and legislators.

## Features

- Browse and search bills from the NM Legislature
- View legislator profiles and voting records
- AI-powered bill chat to understand legislation in plain language
- Track bill status and history
- Floor and committee vote tracking
- Real-time data sync from nmlegis.gov

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js with Google OAuth
- **AI**: OpenRouter (Claude 3.5 Haiku)
- **Styling**: Tailwind CSS v4
- **Language**: TypeScript

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

Required environment variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (pooled) |
| `DATABASE_URL_UNPOOLED` | PostgreSQL connection string (direct) |
| `NEXTAUTH_SECRET` | Random secret for NextAuth.js sessions |
| `NEXTAUTH_URL` | Base URL of your app (e.g., `http://localhost:3000`) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `OPENROUTER_API_KEY` | OpenRouter API key for AI chat |
| `LEGISCAN_API_KEY` | LegiScan API key (optional) |

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

The app uses data from nmlegis.gov via Perl scraping scripts. To import data:

```bash
# Import from nmlegis JSON files
npm run import:nmlegis

# Fetch bill text from nmlegis.gov
npm run fetch:text

# Sync from LegiScan API (optional)
npm run sync:bills
```

## NPM Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run import:nmlegis` | Import data from nmlegis JSON files |
| `npm run sync:bills` | Sync bills from LegiScan API |
| `npm run fetch:text` | Fetch bill text HTML from nmlegis.gov |

## Project Structure

```
├── prisma/
│   └── schema.prisma          # Database schema
├── scripts/
│   ├── cron-update-bills.sh   # Cron job for hourly data sync
│   ├── import-nmlegis-json.ts # Import nmlegis JSON to database
│   ├── fetch-bill-text.ts     # Fetch bill text from nmlegis.gov
│   ├── update-sync-time.ts    # Update session sync timestamp
│   ├── export-data.ts         # Export database to JSON
│   └── import-data.ts         # Import JSON to database
├── src/
│   ├── app/                   # Next.js App Router pages
│   │   ├── api/               # API routes
│   │   │   ├── auth/          # NextAuth.js routes
│   │   │   └── legislation/   # Bills, legislators, stats APIs
│   │   ├── bills/             # Bill list and detail pages
│   │   └── legislators/       # Legislator list and detail pages
│   ├── components/            # React components
│   │   ├── BillCard.tsx       # Bill card display
│   │   ├── BillChatPanel.tsx  # AI chat interface
│   │   ├── BillHistory.tsx    # Bill history timeline
│   │   ├── BillSearchSection.tsx # Search interface
│   │   ├── BillStatusBadge.tsx # Status badge
│   │   ├── LegislatorCard.tsx # Legislator card display
│   │   ├── MainLayout.tsx     # Main layout wrapper
│   │   ├── VoteChart.tsx      # Vote visualization
│   │   └── ...                # Other components
│   └── lib/                   # Utilities and configuration
│       ├── auth.ts            # NextAuth.js configuration
│       ├── config.ts          # App configuration
│       ├── legiscan-api.ts    # LegiScan API client
│       ├── legislative-codes.ts # NM committee/action codes
│       ├── llm.ts             # AI chat functions
│       ├── nmlegis-parser.ts  # nmlegis.gov action parser
│       └── prisma.ts          # Prisma client singleton
├── nmlegis-scripts/           # Perl scripts for scraping nmlegis.gov
└── data-export/               # JSON data exports
```

## Data Sync

The application syncs data from nmlegis.gov using Ed Santiago's battle-tested Perl scripts. The sync process:

1. **Perl scripts** scrape nmlegis.gov for legislators, bills, and votes
2. **Import script** loads JSON data into PostgreSQL via Prisma
3. **Text fetcher** downloads bill HTML for AI analysis

### Setting Up Cron Job

For automatic hourly updates, add to your crontab:

```bash
# Edit crontab
crontab -e

# Add this line for hourly sync
0 * * * * /path/to/NMLegTracker/scripts/cron-update-bills.sh >> /path/to/NMLegTracker/logs/sync.log 2>&1
```

The cron script will:
- Run nmlegis Perl scripts to fetch latest data
- Import JSON to the database
- Fetch any missing bill text
- Update the sync timestamp

## Database Schema

Key models in the Prisma schema:

- **User** - Authentication (NextAuth.js)
- **LegiSession** - Legislative sessions
- **LegiBill** - Bills with full text, history, status
- **LegiPerson** - Legislators
- **LegiBillSponsor** - Bill-sponsor relationships
- **LegiRollCall** - Roll call votes
- **LegiVoteRecord** - Individual vote records
- **LegiBillChatMessage** - AI chat messages per bill
- **BillSearchHistory** - User search history

## Deployment

### Vercel Deployment

1. Push your code to GitHub
2. Import the repository in Vercel
3. Configure environment variables in Vercel dashboard
4. Deploy

### Environment Variables for Production

Set these in your Vercel project settings:

- `DATABASE_URL` - Use a connection pooler (e.g., Neon, Supabase)
- `DATABASE_URL_UNPOOLED` - Direct connection for migrations
- `NEXTAUTH_SECRET` - Generate with `openssl rand -base64 32`
- `NEXTAUTH_URL` - Your production URL
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - Google OAuth credentials
- `OPENROUTER_API_KEY` - Your OpenRouter API key

### Database Setup

This app works well with:
- **Neon** - Serverless PostgreSQL with connection pooling
- **Supabase** - PostgreSQL with built-in auth (we use NextAuth instead)
- **Railway** - Simple PostgreSQL hosting

## Troubleshooting

### Common Issues

**Prisma client not generated**
```bash
npx prisma generate
```

**Database connection errors**
- Check your `DATABASE_URL` is correct
- Ensure PostgreSQL is running
- For Neon/Supabase, use the pooled connection string

**Import script fails**
- Ensure nmlegis-scripts has been run first
- Check that JSON files exist in `~/.local/share/nmlegis/`

**AI chat not working**
- Verify `OPENROUTER_API_KEY` is set
- Check OpenRouter account has credits

**Google OAuth not working**
- Ensure redirect URIs are configured in Google Console
- Add `http://localhost:3000/api/auth/callback/google` for development
- Add your production URL for deployment

### Logs

- Sync logs: `logs/sync.log`
- Last sync time: `.last-sync`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT
