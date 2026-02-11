#!/bin/bash
#
# NM Legislature Sync Script
#
# This script uses Ed Santiago's battle-tested nmlegis Perl scripts
# (from gitlab.com/edsantiago/nmlegis) to scrape nmlegis.gov, then
# imports the JSON output to our PostgreSQL database.
#
# Data flow:
# 1. Check if nmlegis.gov has new data (skip sync if unchanged)
# 2. nmlegis Perl scripts -> JSON files (legislators, bills, votes)
# 3. Import JSON -> PostgreSQL (Prisma)
# 4. Fetch bill text HTML for LLM analysis
#
# Crontab entry (hourly):
#   0 * * * * /Users/admin/NMLegTracker/scripts/cron-update-bills.sh >> /Users/admin/NMLegTracker/logs/sync.log 2>&1
#
# No API limits - scrapes nmlegis.gov directly.

# Don't exit on error - we want to log failures
set +e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
NMLEGIS_DIR="$PROJECT_DIR/nmlegis-scripts"
NMLEGIS_DATA_DIR="$HOME/.local/share/nmlegis"
CURRENT_YEAR=$(date +%Y)
LOG_PREFIX="[$(date '+%Y-%m-%d %H:%M:%S')]"
SYNC_STATUS="success"
SYNC_ERRORS=""

# Ensure log directory exists
mkdir -p "$PROJECT_DIR/logs"

# Load environment variables from .env file
if [ -f "$PROJECT_DIR/.env" ]; then
    set -a
    source "$PROJECT_DIR/.env"
    set +a
fi

log_error() {
    echo "$LOG_PREFIX ERROR: $1"
    SYNC_STATUS="failed"
    SYNC_ERRORS="$SYNC_ERRORS\n$1"
}

echo ""
echo "========================================"
echo "$LOG_PREFIX Starting NM Legislature bill sync..."
echo "========================================"

# Step 0: Check if nmlegis.gov has new data
echo "$LOG_PREFIX Checking nmlegis.gov for updates..."
cd "$PROJECT_DIR"

# Run the check script - exit code 0 means new data, 1 means no change, 2 means error
npx tsx scripts/check-nmlegis-update.ts 2>&1
CHECK_RESULT=$?

if [ $CHECK_RESULT -eq 1 ]; then
    echo "$LOG_PREFIX No new data on nmlegis.gov - skipping sync"
    echo "$LOG_PREFIX Sync skipped (no changes)"
    echo "========================================"
    exit 0
elif [ $CHECK_RESULT -eq 2 ]; then
    echo "$LOG_PREFIX WARNING: Could not check nmlegis.gov - proceeding with sync anyway"
fi

# Step 1: Run nmlegis Perl scripts to fetch latest data
if [ -d "$NMLEGIS_DIR" ]; then
    echo "$LOG_PREFIX Running nmlegis Perl scripts..."
    cd "$NMLEGIS_DIR"
    
    # Set Perl lib path for local modules
    export PERL5LIB="lib:$HOME/perl5/lib/perl5"
    
    # Fetch legislators (names, districts, parties)
    echo "$LOG_PREFIX   Fetching legislators..."
    if ! ./bin/nmlegis-get-legislators 2>&1 | grep -v "no username found"; then
        log_error "nmlegis-get-legislators failed"
    fi
    
    # Fetch bills (titles, actions, sponsors)
    echo "$LOG_PREFIX   Fetching bills..."
    if ! ./bin/nmlegis-get-bills 2>&1 | grep -v "no username found" | grep -v "Can't exec"; then
        log_error "nmlegis-get-bills failed"
    fi
    
    # Fix: If bills JSON is incomplete but tmp files exist, use the latest tmp
    BILLS_JSON="$NMLEGIS_DATA_DIR/bills-${CURRENT_YEAR}.json"
    LATEST_TMP=$(ls -t "$NMLEGIS_DATA_DIR/bills-${CURRENT_YEAR}.json.tmp."* 2>/dev/null | head -1)
    if [ -n "$LATEST_TMP" ]; then
        TMP_SIZE=$(stat -f%z "$LATEST_TMP" 2>/dev/null || stat -c%s "$LATEST_TMP" 2>/dev/null)
        MAIN_SIZE=$(stat -f%z "$BILLS_JSON" 2>/dev/null || stat -c%s "$BILLS_JSON" 2>/dev/null || echo "0")
        if [ "$TMP_SIZE" -gt "$MAIN_SIZE" ]; then
            echo "$LOG_PREFIX   Fixing incomplete bills JSON (tmp: ${TMP_SIZE}b > main: ${MAIN_SIZE}b)..."
            chmod u+w "$BILLS_JSON" 2>/dev/null || true
            if cp "$LATEST_TMP" "$BILLS_JSON"; then
                echo "$LOG_PREFIX   Fixed: copied latest tmp file to main"
            else
                log_error "Failed to copy tmp file to main bills JSON"
            fi
        fi
    fi
    
    # Verify bills JSON is valid
    if [ -f "$BILLS_JSON" ]; then
        BILLS_SIZE=$(stat -f%z "$BILLS_JSON" 2>/dev/null || stat -c%s "$BILLS_JSON" 2>/dev/null)
        if [ "$BILLS_SIZE" -lt 1000 ]; then
            log_error "Bills JSON is suspiciously small (${BILLS_SIZE} bytes)"
        else
            echo "$LOG_PREFIX   Bills JSON size: ${BILLS_SIZE} bytes"
        fi
    else
        log_error "Bills JSON file does not exist: $BILLS_JSON"
    fi
    
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
    log_error "nmlegis-scripts directory not found: $NMLEGIS_DIR"
fi

# Step 2: Import nmlegis JSON to database
echo "$LOG_PREFIX Importing nmlegis JSON to database..."
cd "$PROJECT_DIR"
IMPORT_OUTPUT=$(npx tsx scripts/import-nmlegis-json.ts 2>&1)
IMPORT_RESULT=$?

echo "$IMPORT_OUTPUT" | grep -E "(legislators|bills|votes|New|Updated|Error|Summary|Floor|Committee)" || true

if [ $IMPORT_RESULT -ne 0 ]; then
    log_error "import-nmlegis-json.ts failed with exit code $IMPORT_RESULT"
fi

# Extract counts from import output for logging
NEW_BILLS=$(echo "$IMPORT_OUTPUT" | grep -o "New bills: [0-9]*" | grep -o "[0-9]*" || echo "0")
UPDATED_BILLS=$(echo "$IMPORT_OUTPUT" | grep -o "Updated bills: [0-9]*" | grep -o "[0-9]*" || echo "0")

# Step 3: Fetch any new bill text that's missing (limit to 10 per run to avoid long syncs)
echo "$LOG_PREFIX Fetching missing bill text from nmlegis.gov..."
npx tsx scripts/fetch-bill-text.ts 2>&1 | head -50 | grep -E "(Found|Success|Error|Summary|\[.*\])" || true

# Step 4: Update session timestamp in database
echo "$LOG_PREFIX Updating sync timestamp..."
if ! npx tsx scripts/update-sync-time.ts 2>&1; then
    log_error "update-sync-time.ts failed"
fi

# Step 5: Run scraping health check
echo "$LOG_PREFIX Running scraping health check..."
HEALTH_OUTPUT=$(npx tsx scripts/check-scraping-health.ts 2>&1)
HEALTH_RESULT=$?

echo "$HEALTH_OUTPUT" | grep -E "(Status|Legislators|Bills|checks)" || true

if [ $HEALTH_RESULT -eq 1 ]; then
    log_error "Scraping health check CRITICAL - parsing may be broken"
    SCRAPING_HEALTH="critical"
elif [ $HEALTH_RESULT -eq 2 ]; then
    echo "$LOG_PREFIX WARNING: Scraping health check degraded"
    SCRAPING_HEALTH="degraded"
else
    SCRAPING_HEALTH="healthy"
fi

# Record last sync time and status
echo "$(date -Iseconds)" > "$PROJECT_DIR/.last-sync"
echo "$SYNC_STATUS" > "$PROJECT_DIR/.last-sync-status"
echo "$SCRAPING_HEALTH" > "$PROJECT_DIR/.last-scraping-health"

# Summary
echo ""
echo "========================================"
echo "$LOG_PREFIX Sync completed with status: $SYNC_STATUS"
echo "$LOG_PREFIX   New bills: $NEW_BILLS"
echo "$LOG_PREFIX   Updated bills: $UPDATED_BILLS"
echo "$LOG_PREFIX   Scraping health: $SCRAPING_HEALTH"
if [ "$SYNC_STATUS" = "failed" ]; then
    echo "$LOG_PREFIX   Errors: $SYNC_ERRORS"
fi
echo "========================================"
echo ""

# Send alert if scraping health is critical
if [ "$SCRAPING_HEALTH" = "critical" ]; then
    echo "$LOG_PREFIX ⚠️  ALERT: Scraping health is CRITICAL - check nmlegis.gov for HTML changes"
    npx tsx scripts/send-alert.ts \
        --type critical \
        --title "NMLegTracker Scraping CRITICAL" \
        --message "Scraping health check failed. nmlegis.gov HTML structure may have changed. Check logs at $PROJECT_DIR/logs/sync.log" \
        2>&1 || true
fi

# Exit with appropriate code
# Critical scraping health is worse than sync failure
if [ "$SCRAPING_HEALTH" = "critical" ]; then
    exit 1
elif [ "$SYNC_STATUS" = "failed" ]; then
    exit 1
else
    exit 0
fi
