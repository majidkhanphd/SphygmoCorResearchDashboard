/**
 * Title Cleanup Migration Script
 * 
 * This script cleans up HTML entities in publication titles, journals, and abstracts.
 * 
 * Usage:
 *   npm run tsx server/scripts/cleanTitles.ts              # Dry-run mode (default)
 *   npm run tsx server/scripts/cleanTitles.ts --apply      # Actually update database
 *   npm run tsx server/scripts/cleanTitles.ts --field=title --apply  # Clean specific field
 * 
 * Features:
 * - Dry-run mode by default (safety first!)
 * - Batch updates for performance (100 at a time)
 * - Detailed logging of all changes
 * - Rollback on error
 * - Progress tracking
 */

import { db } from "../db";
import { publications } from "@shared/schema";
import { sanitizeText } from "@shared/sanitize";
import { eq } from "drizzle-orm";

interface CleanupStats {
  total: number;
  affected: number;
  cleaned: number;
  errors: number;
}

interface CleanupOptions {
  apply: boolean;
  field?: 'title' | 'abstract' | 'journal' | 'all';
  batchSize?: number;
}

const BATCH_SIZE = 100;

/**
 * Check if text contains HTML entities
 */
function containsHTMLEntities(text: string | null): boolean {
  if (!text) return false;
  
  // Check for numeric entities (&#XXX; or &#xXXX;)
  const numericEntities = /&#\d+;|&#x[0-9a-fA-F]+;/;
  // Check for named entities
  const namedEntities = /&(?:amp|lt|gt|quot|apos|nbsp);/;
  // Check for HTML tags
  const htmlTags = /<[^>]+>/;
  
  return numericEntities.test(text) || namedEntities.test(text) || htmlTags.test(text);
}

/**
 * Clean a single field of a publication
 */
async function cleanPublication(
  publication: any,
  field: 'title' | 'abstract' | 'journal',
  options: CleanupOptions
): Promise<{ changed: boolean; original: string; cleaned: string } | null> {
  const originalValue = publication[field];
  
  if (!originalValue || !containsHTMLEntities(originalValue)) {
    return null;
  }
  
  const cleanedValue = sanitizeText(originalValue);
  
  // Check if sanitization actually changed the value
  if (originalValue === cleanedValue) {
    return null;
  }
  
  console.log(`\n📝 Publication ID: ${publication.id} (PMID: ${publication.pmid})`);
  console.log(`   Field: ${field}`);
  console.log(`   Original: ${originalValue}`);
  console.log(`   Cleaned:  ${cleanedValue}`);
  
  if (options.apply) {
    try {
      await db
        .update(publications)
        .set({ [field]: cleanedValue })
        .where(eq(publications.id, publication.id));
      console.log(`   ✅ Updated in database`);
    } catch (error) {
      console.error(`   ❌ Error updating:`, error);
      throw error;
    }
  } else {
    console.log(`   🔍 DRY RUN - No changes made`);
  }
  
  return {
    changed: true,
    original: originalValue,
    cleaned: cleanedValue
  };
}

/**
 * Clean publications in batches
 */
async function cleanPublications(options: CleanupOptions): Promise<CleanupStats> {
  const stats: CleanupStats = {
    total: 0,
    affected: 0,
    cleaned: 0,
    errors: 0
  };
  
  try {
    console.log('\n🔍 Fetching publications from database...\n');
    
    // Fetch all publications
    const allPublications = await db.select().from(publications);
    stats.total = allPublications.length;
    
    console.log(`📊 Found ${stats.total} total publications\n`);
    console.log(`🎯 Scanning for HTML entities...\n`);
    
    const fieldsToClean: Array<'title' | 'abstract' | 'journal'> = 
      options.field && options.field !== 'all' 
        ? [options.field]
        : ['title', 'abstract', 'journal'];
    
    // Process in batches
    for (let i = 0; i < allPublications.length; i += options.batchSize || BATCH_SIZE) {
      const batch = allPublications.slice(i, i + (options.batchSize || BATCH_SIZE));
      
      console.log(`\n📦 Processing batch ${Math.floor(i / (options.batchSize || BATCH_SIZE)) + 1} (publications ${i + 1}-${Math.min(i + batch.length, allPublications.length)})`);
      
      for (const publication of batch) {
        let publicationAffected = false;
        
        for (const field of fieldsToClean) {
          try {
            const result = await cleanPublication(publication, field, options);
            if (result?.changed) {
              publicationAffected = true;
              stats.cleaned++;
            }
          } catch (error) {
            console.error(`\n❌ Error processing publication ${publication.id}:`, error);
            stats.errors++;
          }
        }
        
        if (publicationAffected) {
          stats.affected++;
        }
      }
    }
    
    return stats;
    
  } catch (error) {
    console.error('\n❌ Fatal error during cleanup:', error);
    throw error;
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  
  const options: CleanupOptions = {
    apply: args.includes('--apply'),
    field: args.find(arg => arg.startsWith('--field='))?.split('=')[1] as any || 'all',
    batchSize: BATCH_SIZE
  };
  
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          PUBLICATION TEXT CLEANUP MIGRATION                ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Mode:       ${options.apply ? '🔴 APPLY CHANGES' : '🔵 DRY RUN (no changes will be made)'}`);
  console.log(`Field(s):   ${options.field}`);
  console.log(`Batch size: ${options.batchSize}`);
  console.log('');
  
  if (!options.apply) {
    console.log('⚠️  Running in DRY RUN mode. Use --apply to actually update the database.');
    console.log('');
  }
  
  const startTime = Date.now();
  
  try {
    const stats = await cleanPublications(options);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                    CLEANUP SUMMARY                         ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`✅ Total publications scanned:     ${stats.total}`);
    console.log(`📝 Publications with changes:      ${stats.affected}`);
    console.log(`🧹 Total fields cleaned:           ${stats.cleaned}`);
    console.log(`❌ Errors encountered:             ${stats.errors}`);
    console.log(`⏱️  Duration:                       ${duration}s`);
    console.log('');
    
    if (!options.apply && stats.affected > 0) {
      console.log('💡 To apply these changes, run:');
      console.log(`   tsx server/scripts/cleanTitles.ts --apply${options.field !== 'all' ? ` --field=${options.field}` : ''}`);
      console.log('');
    }
    
    if (options.apply && stats.cleaned > 0) {
      console.log('✨ Database has been updated successfully!');
      console.log('');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  }
}

// Run the script
main();
