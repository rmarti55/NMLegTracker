#!/usr/bin/env npx tsx
/**
 * Fetch Bill Text Script
 * 
 * Fetches HTML bill text from nmlegis.gov and stores in the database.
 * This enables LLM analysis of full bill content.
 * 
 * Usage: npx tsx scripts/fetch-bill-text.ts [--force] [--bill HB123]
 * 
 * Options:
 *   --force    Re-fetch text even if already present
 *   --bill     Fetch only a specific bill (e.g., HB1, SB45)
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

// Initialize Prisma client
function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

const prisma = createPrismaClient();

// Rate limiting - be nice to nmlegis.gov
const DELAY_MS = 1000;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Build the nmlegis.gov URL for a bill's HTML text
 * 
 * Different bill types use different URL patterns:
 * - Bills (B): /bills/house/HB0001.HTML (4-digit padding, uppercase extension)
 * - Memorials (M, JM): /memorials/house/HM008.html (3-digit padding, lowercase extension)
 * - Resolutions (R, JR, CR): /resolutions/house/HJR01.html (2-digit padding, lowercase extension)
 */
function buildBillUrl(billNumber: string, body: string, session: { yearStart: number }): string {
  // billNumber is like "HB1", "SB45", "HJR3", "HM8", "SJM1"
  const match = billNumber.match(/^([HS])([A-Z]*)(\d+)$/i);
  if (!match) {
    throw new Error(`Invalid bill number format: ${billNumber}`);
  }
  
  const [, chamber, type, num] = match;
  const upperType = type.toUpperCase();
  const upperChamber = chamber.toUpperCase();
  
  // Map bill type to directory and file naming conventions
  let directory: string;
  let paddingDigits: number;
  let extension: string;
  
  if (upperType === 'B' || upperType === '') {
    // Bills: /bills/house/HB0001.HTML
    directory = 'bills';
    paddingDigits = 4;
    extension = '.HTML';
  } else if (upperType === 'M' || upperType === 'JM') {
    // Memorials: /memorials/house/HM008.html or HJM001.html
    directory = 'memorials';
    paddingDigits = 3;
    extension = '.html';
  } else if (upperType === 'R' || upperType === 'JR' || upperType === 'CR') {
    // Resolutions: /resolutions/house/HJR01.html
    directory = 'resolutions';
    paddingDigits = 2;
    extension = '.html';
  } else {
    // Unknown type, try bills pattern
    directory = 'bills';
    paddingDigits = 4;
    extension = '.HTML';
  }
  
  const paddedNum = num.padStart(paddingDigits, '0');
  const fullBillNumber = `${upperChamber}${upperType}${paddedNum}`;
  
  // Determine chamber directory
  const chamberDir = body === 'H' ? 'house' : 'senate';
  
  // Build URL - using www prefix as nmlegis.gov redirects there
  const year = session.yearStart;
  const yearStr = year.toString().slice(-2); // "26" from 2026
  
  return `https://www.nmlegis.gov/Sessions/${yearStr}%20Regular/${directory}/${chamberDir}/${fullBillNumber}${extension}`;
}

/**
 * Fetch bill HTML from nmlegis.gov
 */
async function fetchBillHtml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'NM-Legislature-Tracker/1.0 (educational purposes)',
      },
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log(`    Bill not found (404): ${url}`);
        return null;
      }
      console.error(`    HTTP ${response.status} for ${url}`);
      return null;
    }
    
    const html = await response.text();
    
    // Extract just the body content for cleaner storage
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (bodyMatch) {
      return bodyMatch[1].trim();
    }
    
    return html;
  } catch (error) {
    console.error(`    Error fetching ${url}:`, error);
    return null;
  }
}

/**
 * Extract plain text from HTML for a preview
 */
function extractPreview(html: string, maxLength: number = 200): string {
  // Strip HTML tags
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

async function main() {
  const args = process.argv.slice(2);
  const forceRefetch = args.includes('--force');
  const billIndex = args.indexOf('--bill');
  const specificBill = billIndex !== -1 ? args[billIndex + 1]?.toUpperCase() : null;

  console.log('🏛️  NM Legislature Bill Text Fetcher');
  console.log('=====================================\n');

  if (forceRefetch) {
    console.log('⚠️  Force mode: will re-fetch all bill text\n');
  }
  if (specificBill) {
    console.log(`📄 Fetching only: ${specificBill}\n`);
  }

  // Get all bills from database
  const whereClause: { billNumber?: string; fullText?: null } = {};
  if (specificBill) {
    whereClause.billNumber = specificBill;
  }
  if (!forceRefetch && !specificBill) {
    whereClause.fullText = null;
  }

  const bills = await prisma.legiBill.findMany({
    where: forceRefetch ? (specificBill ? { billNumber: specificBill } : {}) : whereClause,
    include: {
      session: true,
    },
    orderBy: [
      { body: 'asc' },
      { billNumber: 'asc' },
    ],
  });

  console.log(`📋 Found ${bills.length} bills to process\n`);

  if (bills.length === 0) {
    console.log('✅ All bills already have text fetched. Use --force to re-fetch.');
    await prisma.$disconnect();
    return;
  }

  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < bills.length; i++) {
    const bill = bills[i];
    const progress = `[${i + 1}/${bills.length}]`;
    
    // Skip if already has text (unless forcing)
    if (bill.fullText && !forceRefetch) {
      console.log(`${progress} ⏭️  ${bill.billNumber} - already has text`);
      skippedCount++;
      continue;
    }

    try {
      const url = buildBillUrl(bill.billNumber, bill.body, bill.session);
      console.log(`${progress} 📥 ${bill.billNumber} - fetching from nmlegis.gov...`);
      
      const html = await fetchBillHtml(url);
      
      if (html) {
        await prisma.legiBill.update({
          where: { id: bill.id },
          data: {
            fullText: html,
            fullTextUrl: url,
            textFetchedAt: new Date(),
          },
        });
        
        const preview = extractPreview(html, 80);
        console.log(`    ✅ Saved (${html.length.toLocaleString()} chars): "${preview}"`);
        successCount++;
      } else {
        console.log(`    ⚠️  No content available`);
        errorCount++;
      }
      
      // Rate limiting
      if (i < bills.length - 1) {
        await sleep(DELAY_MS);
      }
    } catch (error) {
      console.error(`${progress} ❌ ${bill.billNumber} - Error:`, error);
      errorCount++;
    }
  }

  console.log('\n=====================================');
  console.log('📊 Summary:');
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ⚠️  Errors: ${errorCount}`);
  console.log(`   ⏭️  Skipped: ${skippedCount}`);
  console.log('=====================================\n');

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('Fatal error:', error);
  await prisma.$disconnect();
  process.exit(1);
});
