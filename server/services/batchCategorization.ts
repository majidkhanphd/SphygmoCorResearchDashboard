import { storage } from "../storage";
import { batchCategorizationTracker } from "../batch-categorization-tracker";
import { generateMLSuggestions, generateKeywordSuggestions, mergeSuggestions } from "./categorySuggestions";

const BATCH_SIZE = 10; // Process 10 publications at a time
const DELAY_BETWEEN_BATCHES = 1000; // 1 second delay between batches to avoid rate limits

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

    // Process in batches
    for (let i = 0; i < publications.length; i += BATCH_SIZE) {
      const batch = publications.slice(i, Math.min(i + BATCH_SIZE, publications.length));
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(publications.length / BATCH_SIZE);
      
      batchCategorizationTracker.updatePhase(
        `Processing batch ${batchNum}/${totalBatches} (${i + 1}-${Math.min(i + BATCH_SIZE, publications.length)} of ${publications.length})`
      );

      // Process batch in parallel
      await Promise.all(
        batch.map(async (pub, idx) => {
          try {
            const globalIdx = i + idx;
            batchCategorizationTracker.updateProgress(
              globalIdx,
              pub.title || "Untitled"
            );

            // Check if publication already has pending suggestions
            if (pub.categoryReviewStatus === 'pending_review' && pub.suggestedCategories) {
              console.log(`Skipping publication ${pub.id}: already has pending suggestions`);
              batchCategorizationTracker.incrementSkipped();
              return;
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
              console.log(`No suggestions for publication ${pub.id}`);
              batchCategorizationTracker.incrementSkipped();
              return;
            }

            // Determine status
            const hasHighConfidence = mergedSuggestions.some(s => s.confidence >= 0.8);
            const status = hasHighConfidence ? 'auto_approved' : 'pending_review';

            // Save suggestions
            await storage.updateSuggestedCategories(pub.id, mergedSuggestions, status);
            
            batchCategorizationTracker.incrementSuccess();
          } catch (error: any) {
            console.error(`Error processing publication ${pub.id}:`, error);
            batchCategorizationTracker.incrementFailed();
          }
        })
      );

      // Add delay between batches to avoid rate limits (except for the last batch)
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
