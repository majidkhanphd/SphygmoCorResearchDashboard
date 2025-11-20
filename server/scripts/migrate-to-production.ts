import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import { publications } from "@shared/schema";
import type { Publication } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Database Migration Script: Development → Production
 * 
 * This script safely migrates all publications from the development database
 * to the production database with duplicate detection and verification.
 * 
 * Usage:
 *   DEV_DATABASE_URL="..." PROD_DATABASE_URL="..." npm run tsx server/scripts/migrate-to-production.ts
 */

const BATCH_SIZE = 100; // Process in batches to manage memory

interface MigrationStats {
  totalRecords: number;
  inserted: number;
  skipped: number;
  errors: number;
}

async function migratePublications() {
  console.log("🚀 Starting Database Migration: Development → Production\n");
  
  // Validate environment variables
  const devDbUrl = process.env.DEV_DATABASE_URL || process.env.DATABASE_URL;
  const prodDbUrl = process.env.PROD_DATABASE_URL;
  
  if (!devDbUrl) {
    throw new Error("❌ DEV_DATABASE_URL or DATABASE_URL is required");
  }
  
  if (!prodDbUrl) {
    throw new Error("❌ PROD_DATABASE_URL is required");
  }
  
  if (devDbUrl === prodDbUrl) {
    throw new Error("❌ DEV_DATABASE_URL and PROD_DATABASE_URL must be different!");
  }
  
  console.log("✅ Environment variables validated");
  console.log(`📊 Development DB: ${devDbUrl.substring(0, 30)}...`);
  console.log(`📊 Production DB: ${prodDbUrl.substring(0, 30)}...\n`);
  
  // Connect to both databases
  const devPool = new Pool({ connectionString: devDbUrl });
  const prodPool = new Pool({ connectionString: prodDbUrl });
  
  const devDb = drizzle(devPool);
  const prodDb = drizzle(prodPool);
  
  const stats: MigrationStats = {
    totalRecords: 0,
    inserted: 0,
    skipped: 0,
    errors: 0
  };
  
  try {
    // Step 1: Get all publications from development
    console.log("📥 Fetching publications from development database...");
    const allPublications = await devDb.select().from(publications);
    stats.totalRecords = allPublications.length;
    console.log(`✅ Found ${stats.totalRecords} publications to migrate\n`);
    
    if (stats.totalRecords === 0) {
      console.log("⚠️  No publications found in development database");
      return stats;
    }
    
    // Step 2: Get existing PMIDs from production to avoid duplicates
    console.log("🔍 Checking for existing publications in production...");
    const existingPublications = await prodDb.select({ pmid: publications.pmid }).from(publications);
    const existingPmids = new Set(existingPublications.map(p => p.pmid).filter(Boolean));
    console.log(`📌 Found ${existingPmids.size} existing publications in production\n`);
    
    // Step 3: Migrate in batches
    console.log(`🔄 Starting migration in batches of ${BATCH_SIZE}...\n`);
    
    for (let i = 0; i < allPublications.length; i += BATCH_SIZE) {
      const batch = allPublications.slice(i, Math.min(i + BATCH_SIZE, allPublications.length));
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(allPublications.length / BATCH_SIZE);
      
      console.log(`📦 Processing batch ${batchNum}/${totalBatches} (${i + 1}-${Math.min(i + BATCH_SIZE, allPublications.length)} of ${allPublications.length})`);
      
      for (const pub of batch) {
        try {
          // Check if publication already exists in production
          if (pub.pmid && existingPmids.has(pub.pmid)) {
            stats.skipped++;
            continue;
          }
          
          // Insert publication into production
          await prodDb.insert(publications).values({
            // Omit id to let production generate new UUIDs
            pmid: pub.pmid,
            title: pub.title,
            authors: pub.authors,
            journal: pub.journal,
            publicationDate: pub.publicationDate,
            abstract: pub.abstract,
            doi: pub.doi,
            keywords: pub.keywords,
            categories: pub.categories,
            citationCount: pub.citationCount,
            isFeatured: pub.isFeatured,
            pubmedUrl: pub.pubmedUrl,
            journalImpactFactor: pub.journalImpactFactor,
            status: pub.status,
            suggestedCategories: pub.suggestedCategories,
            categoryReviewStatus: pub.categoryReviewStatus,
            categoryReviewedBy: pub.categoryReviewedBy,
            categoryReviewedAt: pub.categoryReviewedAt,
            categoriesLastUpdatedBy: pub.categoriesLastUpdatedBy,
          });
          
          stats.inserted++;
          
          // Log progress every 50 records
          if (stats.inserted % 50 === 0) {
            console.log(`   ✓ Inserted ${stats.inserted} publications...`);
          }
        } catch (error: any) {
          stats.errors++;
          console.error(`   ❌ Error inserting publication ${pub.pmid || pub.title}:`, error.message);
        }
      }
      
      console.log(`   ✅ Batch ${batchNum} complete\n`);
    }
    
    // Step 4: Verification
    console.log("\n🔍 Verifying migration...");
    const prodCount = await prodDb.select({ count: publications.id }).from(publications);
    console.log(`✅ Production database now has ${prodCount.length} total publications\n`);
    
    // Final summary
    console.log("═══════════════════════════════════════");
    console.log("📊 MIGRATION SUMMARY");
    console.log("═══════════════════════════════════════");
    console.log(`Total records in dev:  ${stats.totalRecords}`);
    console.log(`Successfully inserted: ${stats.inserted}`);
    console.log(`Skipped (duplicates):  ${stats.skipped}`);
    console.log(`Errors:                ${stats.errors}`);
    console.log(`Production total:      ${prodCount.length}`);
    console.log("═══════════════════════════════════════\n");
    
    if (stats.errors === 0 && stats.inserted + stats.skipped === stats.totalRecords) {
      console.log("✅ Migration completed successfully!");
    } else if (stats.errors > 0) {
      console.log("⚠️  Migration completed with some errors. Please review the logs above.");
    }
    
  } catch (error: any) {
    console.error("\n❌ Migration failed:", error.message);
    throw error;
  } finally {
    // Close connections
    await devPool.end();
    await prodPool.end();
    console.log("\n🔌 Database connections closed");
  }
  
  return stats;
}

// Run migration
migratePublications()
  .then(stats => {
    if (stats.errors > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  })
  .catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
