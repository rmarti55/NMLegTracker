# nmlegis-scripts

Perl scripts for scraping and parsing data from the New Mexico Legislature website (nmlegis.gov).

Originally developed by Ed Santiago (gitlab.com/edsantiago/nmlegis), these scripts provide reliable data extraction from nmlegis.gov for use in the NM Legislation Tracker application.

## Prerequisites

- Perl 5.x
- Mojolicious framework
- Additional Perl modules (see `cpanfile` if available)

### Installing Perl Dependencies

```bash
# Using cpanm (recommended)
cpanm Mojolicious
cpanm JSON
cpanm LWP::UserAgent

# Or using local::lib
cpanm --local-lib=~/perl5 Mojolicious
export PERL5LIB="$HOME/perl5/lib/perl5"
```

## Directory Structure

```
nmlegis-scripts/
├── bin/                    # Executable scripts
├── lib/                    # Perl modules
│   └── NMLegis/           # Main module namespace
│       ├── Agendas.pm     # Agenda parsing
│       ├── Bills.pm       # Bill data handling
│       ├── Committees.pm  # Committee data
│       ├── Legislators.pm # Legislator data
│       ├── Scrape.pm      # Web scraping utilities
│       ├── Votes.pm       # Vote parsing
│       └── UI/            # Web UI components (Mojolicious)
├── Changelog              # Change history
├── PROBLEMS.md            # Known issues and workarounds
├── README.esm-2024        # Session-specific notes (2024)
├── README.esm-2025        # Session-specific notes (2025)
├── README.links           # Reference links to data sources
└── TODO                   # Feature requests and bugs
```

## Key Scripts

### Data Fetching

| Script | Description |
|--------|-------------|
| `nmlegis-get-legislators` | Fetch legislator data (names, districts, parties) |
| `nmlegis-get-bills` | Fetch bill data (titles, actions, sponsors) |
| `nmlegis-get-committees` | Fetch committee information |
| `nmlegis-get-calendars` | Fetch committee calendars and schedules |
| `nmlegis-get-accdb` | Download Access database from nmlegis.gov |

### Document Processing

| Script | Description |
|--------|-------------|
| `nmlegis-mirror-bills` | Mirror bill documents (PDFs, HTML) |
| `nmlegis-parse-floor-votes` | Parse floor votes from PDF documents |
| `nmlegis-parse-committee-reports` | Parse committee reports from HTML |
| `nmlegis-parse-bills` | Parse bill content and metadata |

### Display/Utility

| Script | Description |
|--------|-------------|
| `nmlegis-show-legislators` | Display legislator information |
| `nmlegis-show-committees` | Display committee information |
| `nmlegis-show-calendars` | Display calendar/schedule information |
| `nmlegis-show-all-bills` | Display all bills |
| `nmlegis-view-agenda` | View committee agendas |
| `nmlegis-diff` | Show differences between data snapshots |

### Web UI

| Script | Description |
|--------|-------------|
| `nmlegis_ui` | Mojolicious web application |
| `tracker-tool` | Bill tracker management |

## Data Output

Scripts output JSON files to `~/.local/share/nmlegis/`:

```
~/.local/share/nmlegis/
├── legislators-YYYY.json    # Legislator data for year
├── bills-YYYY.json          # Bill data for year
├── floor-votes-YYYY.json    # Floor vote data
├── committee-reports-YYYY.json # Committee report data
└── ...
```

## Integration with NM Legislation Tracker

The main application uses these scripts via the cron job (`scripts/cron-update-bills.sh`):

1. **Fetch data**: Run `nmlegis-get-legislators` and `nmlegis-get-bills`
2. **Mirror documents**: Run `nmlegis-mirror-bills`
3. **Parse votes**: Run `nmlegis-parse-floor-votes` and `nmlegis-parse-committee-reports`
4. **Import to database**: The TypeScript import script reads the JSON output

### Manual Usage

```bash
cd nmlegis-scripts

# Set Perl library path
export PERL5LIB="lib:$HOME/perl5/lib/perl5"

# Fetch legislators
./bin/nmlegis-get-legislators

# Fetch bills
./bin/nmlegis-get-bills

# Mirror bill documents
./bin/nmlegis-mirror-bills

# Parse floor votes
./bin/nmlegis-parse-floor-votes

# Parse committee reports
./bin/nmlegis-parse-committee-reports
```

## Data Sources

The scripts pull from multiple nmlegis.gov sources:

- **Web pages**: Legislator profiles, bill pages, committee pages
- **PDF documents**: Floor vote sheets, committee agendas
- **Access database**: `LegInfo.zip` containing structured data
- **XLS files**: Legislator spreadsheets

See `README.links` for specific URLs.

## Known Issues

See `PROBLEMS.md` for documented issues with nmlegis.gov data sources, including:

- PDF parsing challenges (garbled text, inconsistent formatting)
- Data inconsistencies between web, Access DB, and XLS sources
- Calendar/schedule synchronization issues

## Session-Specific Notes

- `README.esm-2024` - Notes from 2024 legislative session
- `README.esm-2025` - Notes from 2025 legislative session

These files document session-specific issues and workarounds discovered during each legislative session.

## Contributing

When modifying these scripts:

1. Test against current nmlegis.gov site (formats change)
2. Document any new data source issues in `PROBLEMS.md`
3. Update the `Changelog` with your changes
4. Add session-specific notes to the appropriate `README.esm-YYYY` file
