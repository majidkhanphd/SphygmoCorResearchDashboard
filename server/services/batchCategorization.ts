import { storage } from "../storage";
import { batchCategorizationTracker } from "../batch-categorization-tracker";
import { generateMLSuggestions, generateKeywordSuggestions, mergeSuggestions } from "./categorySuggestions";

const BATCH_SIZE = 50; // Process 50 publications per batch (5x increase)
const DELAY_BETWEEN_BATCHES = 200; // 200ms delay between batches (10x faster)

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function startBatchCategorization(
  filter: "all" | "uncategorized" | "pending" | "approved"
) {
  if (batchCategorizationTracker.isRunning()) {
    throw new Error("Batch categorization already running");
  }

  // Start processing in the background (don't await)
  processBatchCategorization(filter).catch((error) => {
    console.error("Batch categorization error:", error);
    batchCategorizationTracker.error(error.message);
  });

  return { message: "Batch categorization started", filter };
}

async function processBatchCategorization(
  filter: "all" | "uncategorized" | "pending" | "approved"
) {
  try {
    // Get publications based on filter
    batchCategorizationTracker.updatePhase("Fetching publications...");
    const publications = await getPublicationsForCategorization(filter);
    
    batchCategorizationTracker.start(filter, publications.length);
    batchCategorizationTracker.updatePhase(`Processing ${publications.length} publications...`);

    // Process in batches sequentially (to avoid rate limits)
    let globalProcessed = 0;
    for (let i = 0; i < publications.length; i += BATCH_SIZE) {
      const batch = publications.slice(i, Math.min(i + BATCH_SIZE, publications.length));
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(publications.length / BATCH_SIZE);
      
      batchCategorizationTracker.updatePhase(
        `Processing batch ${batchNum}/${totalBatches} (${i + 1}-${Math.min(i + BATCH_SIZE, publications.length)} of ${publications.length})`
      );

      // Accumulate results for this batch
      let batchSuccess = 0;
      let batchFailed = 0;
      let batchSkipped = 0;

      // Process all publications in this batch in parallel (50 concurrent)
      const results = await Promise.allSettled(
        batch.map(async (pub) => {
          // Check if publication already has pending suggestions
          if (pub.categoryReviewStatus === 'pending_review' && pub.suggestedCategories) {
            return { status: 'skipped' as const, title: pub.title || "Untitled" };
          }

          // Generate ML and keyword suggestions
          const mlSuggestions = await generateMLSuggestions(
            pub.title || "",
            pub.abstract
          );
          const keywordSuggestions = generateKeywordSuggestions(
            pub.title || "",
            pub.abstract
          );

          // Merge suggestions
          const mergedSuggestions = mergeSuggestions(mlSuggestions, keywordSuggestions);

          if (mergedSuggestions.length === 0) {
            return { status: 'skipped' as const, title: pub.title || "Untitled" };
          }

          // Determine status
          const hasHighConfidence = mergedSuggestions.some(s => s.confidence >= 0.8);
          const status = hasHighConfidence ? 'auto_approved' : 'pending_review';

          // Save suggestions
          await storage.updateSuggestedCategories(pub.id, mergedSuggestions, status);
          
          return { status: 'success' as const, title: pub.title || "Untitled" };
        })
      );

      // Tally results for this batch (thread-safe)
      let lastTitle: string | null = null;
      for (const result of results) {
        if (result.status === 'fulfilled') {
          lastTitle = result.value.title;
          if (result.value.status === 'success') {
            batchSuccess++;
          } else if (result.value.status === 'skipped') {
            batchSkipped++;
          }
        } else {
          console.error('Publication processing failed:', result.reason?.message);
          batchFailed++;
        }
      }

      // Update tracker AFTER batch completes with ACTUAL completions (not batch.length)
      const batchCompleted = batchSuccess + batchFailed + batchSkipped;
      globalProcessed += batchCompleted;
      batchCategorizationTracker.incrementBatch(batchSuccess, batchFailed, batchSkipped);
      batchCategorizationTracker.updateProgress(globalProcessed, lastTitle);

      // Add delay between batches (except for the last batch)
      if (i + BATCH_SIZE < publications.length) {
        await delay(DELAY_BETWEEN_BATCHES);
      }
    }

    batchCategorizationTracker.complete();
  } catch (error: any) {
    console.error("Batch categorization processing error:", error);
    batchCategorizationTracker.error(error.message);
  }
}

async function getPublicationsForCategorization(
  filter: "all" | "uncategorized" | "pending" | "approved"
): Promise<Array<{ id: string; title: string | null; abstract: string | null; categoryReviewStatus: string | null; suggestedCategories: any }>> {
  switch (filter) {
    case "all":
      // Get all approved publications (skip pending/rejected as they're not finalized)
      return storage.getPublicationsByApprovalStatus("approved");
    
    case "uncategorized":
      // Get approved publications with no categories
      return storage.getUncategorizedPublications();
    
    case "pending":
      // Get publications in pending approval status
      return storage.getPublicationsByApprovalStatus("pending");
    
    case "approved":
      // Get approved publications
      return storage.getPublicationsByApprovalStatus("approved");
    
    default:
      throw new Error(`Unknown filter: ${filter}`);
  }
}
