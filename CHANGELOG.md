# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Added Space Grotesk font for improved typography
- Made homepage publicly accessible (removed auth redirect)
- Enhanced cron sync script with better logging and error handling
- Updated TypeScript configuration

### Added
- `update-sync-time.ts` script for updating session sync timestamps

## [0.1.0] - 2026-02-11

### Added
- Initial release of NM Legislation Tracker
- Bill browsing and search functionality
  - Search by bill number (HB9, SB123) or keyword
  - Smart matching for bill numbers
- Legislator profiles with voting records
- AI-powered bill chat using Claude 3.5 Haiku via OpenRouter
- Bill status and history tracking
- Floor and committee vote visualization
- Data sync from nmlegis.gov via Perl scripts
- NextAuth.js authentication with Google OAuth
- PostgreSQL database with Prisma ORM
- Responsive UI with Tailwind CSS v4

### Data Sources
- nmlegis.gov scraping via Perl scripts (primary)
- LegiScan API integration (optional)
- Bill text fetching from nmlegis.gov

### Database Models
- Users and authentication (NextAuth.js)
- Legislative sessions
- Bills with full text and history
- Legislators with party/district info
- Bill sponsors and co-sponsors
- Roll call votes and individual vote records
- AI chat message history
- Search history tracking

### Scripts
- `import-nmlegis-json.ts` - Import nmlegis JSON data
- `fetch-bill-text.ts` - Fetch bill HTML text
- `cron-update-bills.sh` - Automated hourly sync
- `export-data.ts` / `import-data.ts` - Data migration utilities
