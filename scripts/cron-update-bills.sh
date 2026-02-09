#!/bin/bash
#
# NM Legislature Sync Script
#
# This script uses Ed Santiago's battle-tested nmlegis Perl scripts
# (from gitlab.com/edsantiago/nmlegis) to scrape nmlegis.gov, then
# imports the JSON output to our PostgreSQL database.
#
# Data flow:
# 1. nmlegis Perl scripts -> JSON files (legislators, bills, votes)
# 2. Import JSON -> PostgreSQL (Prisma)
# 3. Fetch bill text HTML for LLM analysis
#
# Suggested crontab entries:
#   # Every 15 minutes during business hours (8am-6pm weekdays)
#   */15 8-18 * * 1-5 /path/to/cron-update-bills.sh >> /var/log/nmlegis-sync.log 2>&1
#
#   # Every hour overnight
#   0 * * * * /path/to/cron-update-bills.sh >> /var/log/nmlegis-sync.log 2>&1
#
# No API limits - scrapes nmlegis.gov directly.

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
NMLEGIS_DIR="$PROJECT_DIR/nmlegis-scripts"
LOG_PREFIX="[$(date '+%Y-%m-%d %H:%M:%S')]"

# Load environment variables from .env file
if [ -f "$PROJECT_DIR/.env" ]; then
    set -a
    source "$PROJECT_DIR/.env"
    set +a
fi

echo "$LOG_PREFIX Starting NM Legislature bill sync..."

# Step 1: Run nmlegis Perl scripts to fetch latest data
if [ -d "$NMLEGIS_DIR" ]; then
    echo "$LOG_PREFIX Running nmlegis Perl scripts..."
    cd "$NMLEGIS_DIR"
    
    # Set Perl lib path for local modules
    export PERL5LIB="lib:$HOME/perl5/lib/perl5"
    
    # Fetch legislators (names, districts, parties)
    echo "$LOG_PREFIX   Fetching legislators..."
    ./bin/nmlegis-get-legislators 2>&1 | grep -v "no username found" || true
    
    # Fetch bills (titles, actions, sponsors)
    echo "$LOG_PREFIX   Fetching bills..."
    ./bin/nmlegis-get-bills 2>&1 | grep -v "no username found" | grep -v "Can't exec" || true
    
    # Mirror bill documents for vote parsing
    echo "$LOG_PREFIX   Mirroring bill documents..."
    ./bin/nmlegis-mirror-bills 2>&1 | tail -5 || true
    
    # Parse floor votes from PDFs
    echo "$LOG_PREFIX   Parsing floor votes..."
    ./bin/nmlegis-parse-floor-votes 2>&1 | grep -E "(votes|error|warning)" || true
    
    # Parse committee reports from HTML
    echo "$LOG_PREFIX   Parsing committee reports..."
    ./bin/nmlegis-parse-committee-reports 2>&1 | grep -E "(reports|error|warning)" || true
    
    cd "$PROJECT_DIR"
else
    echo "$LOG_PREFIX WARNING: nmlegis-scripts not found, skipping Perl scripts"
fi

# Step 2: Import nmlegis JSON to database
echo "$LOG_PREFIX Importing nmlegis JSON to database..."
cd "$PROJECT_DIR"
npx tsx scripts/import-nmlegis-json.ts 2>&1 | grep -E "(legislators|bills|votes|New|Updated|Error|Summary|Floor|Committee)" || true

# Step 3: Fetch any new bill text that's missing
echo "$LOG_PREFIX Fetching missing bill text from nmlegis.gov..."
npx tsx scripts/fetch-bill-text.ts 2>&1 | grep -E "(Found|Success|Error|Summary)" || true

# Record last sync time
echo "$(date -Iseconds)" > "$PROJECT_DIR/.last-sync"

echo "$LOG_PREFIX Bill sync completed."
