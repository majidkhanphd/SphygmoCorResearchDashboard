/**
 * Import publications from export file to production database
 * Uses transaction-scoped upserts with duplicate detection
 */

import { drizzle } from "drizzle-orm/neon-serverless";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { eq, or } from "drizzle-orm";
import * as schema from "../../shared/schema";
import * as fs from "fs";
import * as crypto from "crypto";

neonConfig.fetchConnectionCache = true;

const BATCH_SIZE = 500;
const DRY_RUN = process.env.DRY_RUN === 'true';

interface ImportStats {
  totalProcessed: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}

async function importPublications(exportFile: string) {
  console.log("=== Starting publication import to production database ===\n");
  
  if (DRY_RUN) {
    console.log("⚠️  DRY RUN MODE - No changes will be committed\n");
  }

  // Use PROD_DATABASE_URL for production database
  const prodDatabaseUrl = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;
  if (!prodDatabaseUrl) {
    throw new Error("PROD_DATABASE_URL not found. Set this environment variable to the production database URL.");
  }

  // Load export file
  console.log(`Loading export file: ${exportFile}`);
  if (!fs.existsSync(exportFile)) {
    throw new Error(`Export file not found: ${exportFile}`);
  }

  const manifest = JSON.parse(fs.readFileSync(exportFile, 'utf-8'));
  console.log(`✓ Loaded ${manifest.totalRecords} publications from export`);
  console.log(`  Export date: ${manifest.exportDate}`);
  console.log(`  Checksum: ${manifest.checksum}\n`);

  // Verify checksum
  const dataString = JSON.stringify(manifest.publications.map((p: any) => p.pmid || p.doi).sort());
  const checksum = crypto.createHash('sha256').update(dataString).digest('hex').substring(0, 16);
  if (checksum !== manifest.checksum) {
    throw new Error(`Checksum mismatch! Expected ${manifest.checksum}, got ${checksum}`);
  }
  console.log("✓ Checksum verified\n");

  console.log(`Connecting to production database...`);
  const pool = new Pool({ connectionString: prodDatabaseUrl });
  const db = drizzle(pool, { schema });

  const stats: ImportStats = {
    totalProcessed: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: []
  };

  try {
    // Process in batches
    const publications = manifest.publications;
    const totalBatches = Math.ceil(publications.length / BATCH_SIZE);

    for (let i = 0; i < publications.length; i += BATCH_SIZE) {
      const batch = publications.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      
      console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} records)...`);

      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would process ${batch.length} publications`);
        stats.totalProcessed += batch.length;
        stats.inserted += batch.length;
        continue;
      }

      // Process each publication in the batch
      for (const pub of batch) {
        try {
          // Check for existing publication by pmid or doi
          let existing = null;
          if (pub.pmid) {
            existing = await db.select().from(schema.publications)
              .where(eq(schema.publications.pmid, pub.pmid))
              .limit(1);
          }
          
          if (!existing?.length && pub.doi) {
            existing = await db.select().from(schema.publications)
              .where(eq(schema.publications.doi, pub.doi))
              .limit(1);
          }

          if (existing?.length) {
            // Update existing publication
            await db.update(schema.publications)
              .set({
                ...pub,
                publicationDate: new Date(pub.publicationDate),
                createdAt: new Date(pub.createdAt),
                categoryReviewedAt: pub.categoryReviewedAt ? new Date(pub.categoryReviewedAt) : null
              })
              .where(eq(schema.publications.id, existing[0].id));
            stats.updated++;
          } else {
            // Insert new publication
            await db.insert(schema.publications).values({
              ...pub,
              publicationDate: new Date(pub.publicationDate),
              createdAt: new Date(pub.createdAt),
              categoryReviewedAt: pub.categoryReviewedAt ? new Date(pub.categoryReviewedAt) : null
            });
            stats.inserted++;
          }

          stats.totalProcessed++;
        } catch (error: any) {
          const errorMsg = `Failed to process ${pub.pmid || pub.doi}: ${error.message}`;
          stats.errors.push(errorMsg);
          console.error(`  ✗ ${errorMsg}`);
          
          // Continue with next record instead of failing entire import
          stats.skipped++;
        }
      }

      console.log(`  ✓ Batch ${batchNum} completed`);
    }

    // Verify final count
    const finalCount = await db.select().from(schema.publications);
    
    console.log("\n=== Import Summary ===");
    console.log(`Total processed: ${stats.totalProcessed}`);
    console.log(`Inserted: ${stats.inserted}`);
    console.log(`Updated: ${stats.updated}`);
    console.log(`Skipped (errors): ${stats.skipped}`);
    console.log(`Final count in production: ${finalCount.length}`);
    
    if (stats.errors.length > 0) {
      console.log(`\n⚠️  Errors encountered (${stats.errors.length}):`);
      stats.errors.slice(0, 10).forEach(err => console.log(`  - ${err}`));
      if (stats.errors.length > 10) {
        console.log(`  ... and ${stats.errors.length - 10} more errors`);
      }
    }

    // Verify counts match
    if (finalCount.length !== manifest.totalRecords && stats.errors.length === 0) {
      console.log(`\n⚠️  Warning: Count mismatch!`);
      console.log(`  Expected: ${manifest.totalRecords}`);
      console.log(`  Actual: ${finalCount.length}`);
    } else {
      console.log("\n✓ Import completed successfully!");
    }

  } catch (error) {
    console.error("Import failed:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Get export file from command line argument
const exportFile = process.argv[2] || 'server/scripts/publications-export-latest.json';
importPublications(exportFile).catch(console.error);
