import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPublicationSchema, searchPublicationsSchema, type InsertPublication } from "@shared/schema";
import { z } from "zod";
import { XMLParser } from "fast-xml-parser";
import { pubmedService } from "./services/pubmed";
import { syncTracker } from "./sync-tracker";
import { startBatchCategorization } from "./services/batchCategorization";
import { batchCategorizationTracker } from "./batch-categorization-tracker";
import { citationService } from "./services/citations";
import { citationTracker } from "./citation-tracker";

// Helper to escape SQL LIKE special characters
function escapeLikePattern(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&');
}

// Helper to normalize XML text from fast-xml-parser
// Handles mixed content (text + inline elements like <i>, <b>, <sup>, etc.)
function normalizeXmlText(value: any): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(normalizeXmlText).join(' ');
  }
  if (typeof value === 'object' && value !== null) {
    // Collect ALL text content including #text AND child elements
    // This handles mixed content like: "Some text <b>bold</b> more text"
    const textParts: string[] = [];
    
    for (const key of Object.keys(value)) {
      // Skip XML attributes (start with @_)
      if (key.startsWith('@_')) continue;
      
      const childText = normalizeXmlText(value[key]);
      if (childText.trim().length > 0) {
        textParts.push(childText);
      }
    }
    
    return textParts.join(' ');
  }
  return '';
}

// Helper to format abstract sections
function formatAbstract(abstractData: any): string {
  if (!abstractData) return '';
  
  if (typeof abstractData === 'string') {
    return abstractData;
  }
  
  if (Array.isArray(abstractData)) {
    return abstractData.map(section => {
      const label = section['@_Label'] || section['@_NlmCategory'] || '';
      const text = normalizeXmlText(section);
      return label ? `${label}: ${text}` : text;
    }).join('\n\n');
  }
  
  return normalizeXmlText(abstractData);
}

// Helper to parse PubMed dates
function parsePubMedDate(pubDate: any): Date {
  const year = parseInt(normalizeXmlText(pubDate?.Year) || new Date().getFullYear().toString());
  const monthStr = normalizeXmlText(pubDate?.Month) || '1';
  const day = parseInt(normalizeXmlText(pubDate?.Day) || '1');
  
  // Map PubMed month strings to numbers
  const monthMap: Record<string, number> = {
    'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
    'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
  };
  
  let month = monthMap[monthStr] || parseInt(monthStr) || 1;
  if (month < 1 || month > 12) month = 1;
  
  return new Date(Date.UTC(year, month - 1, day));
}

// PubMed API configuration
const PUBMED_BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

// Retry configuration for PubMed API calls
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

async function fetchFromPubMed(endpoint: string, params: Record<string, string>) {
  const url = new URL(`${PUBMED_BASE_URL}/${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  const context = `PubMed ${endpoint}`;
  let lastError: Error | null = null;
  let delay = RETRY_CONFIG.initialDelayMs;

  for (let attempt = 1; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const response = await fetch(url.toString());
      
      // Check for rate limiting (429 Too Many Requests)
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : delay;
        console.warn(`[${context}] Rate limited (429). Waiting ${waitTime}ms before retry ${attempt}/${RETRY_CONFIG.maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        delay = Math.min(delay * RETRY_CONFIG.backoffMultiplier, RETRY_CONFIG.maxDelayMs);
        continue;
      }
      
      // Check for server errors (5xx) - these are transient
      if (response.status >= 500 && response.status < 600) {
        console.warn(`[${context}] Server error (${response.status}). Waiting ${delay}ms before retry ${attempt}/${RETRY_CONFIG.maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * RETRY_CONFIG.backoffMultiplier, RETRY_CONFIG.maxDelayMs);
        continue;
      }
      
      if (!response.ok) {
        throw new Error(`PubMed API error: ${response.status}`);
      }

      return response.text();
    } catch (error) {
      lastError = error as Error;
      console.warn(`[${context}] Error on attempt ${attempt}/${RETRY_CONFIG.maxRetries}: ${lastError.message}`);
      
      if (attempt < RETRY_CONFIG.maxRetries) {
        console.log(`[${context}] Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * RETRY_CONFIG.backoffMultiplier, RETRY_CONFIG.maxDelayMs);
      }
    }
  }
  
  throw lastError || new Error(`Failed to fetch from ${context} after ${RETRY_CONFIG.maxRetries} retries`);
}

function parseXmlToJson(xmlString: string) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    trimValues: true,
    parseTagValue: false,
    isArray: (name) => {
      return name === "AbstractText" || name === "Author" || name === "Keyword";
    }
  });
  return parser.parse(xmlString);
}

// Extract abstract text directly from raw XML to preserve order of mixed content
// Strip XML/HTML tags while preserving text content order
// This function handles special cases like ext-link elements that contain URLs
function stripXmlTagsRoutes(text: string): string {
  let result = text;
  
  // Extract content from ext-link elements (preserve URL if text is missing)
  result = result.replace(/<ext-link[^>]*xlink:href="([^"]*)"[^>]*>([^<]*)<\/ext-link>/gi, (match, url, innerText) => {
    const trimmedText = innerText.trim();
    return trimmedText || url || '';
  });
  
  // Handle self-closing ext-link tags
  result = result.replace(/<ext-link[^>]*xlink:href="([^"]*)"[^>]*\/>/gi, '$1');
  
  // Handle uri, xref, email elements
  result = result.replace(/<uri[^>]*>([\s\S]*?)<\/uri>/gi, '$1');
  result = result.replace(/<xref[^>]*>([\s\S]*?)<\/xref>/gi, '$1');
  result = result.replace(/<email[^>]*>([\s\S]*?)<\/email>/gi, '$1');
  
  // Handle inline formatting (preserve content)
  result = result.replace(/<(italic|bold|sup|sub|i|b|u|em|strong)[^>]*>([\s\S]*?)<\/\1>/gi, '$2');
  
  // Strip remaining tags
  result = result.replace(/<[^>]+>/g, ' ');
  
  // Decode common HTML entities
  result = result
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#160;/g, ' ')
    .replace(/&#8201;/g, ' ')
    .replace(/&nbsp;/g, ' ');
  
  // Normalize whitespace
  result = result.replace(/\s+/g, ' ').trim();
  
  return result;
}

// Extract abstract text directly from raw XML to preserve order of mixed content
function extractAbstractFromXml(xmlString: string): string {
  const abstractMatch = xmlString.match(/<Abstract>([\s\S]*?)<\/Abstract>/i);
  if (!abstractMatch) return '';
  
  const abstractXml = abstractMatch[1];
  
  // Find all AbstractText elements
  const sections: string[] = [];
  const sectionRegex = /<AbstractText([^>]*)>([\s\S]*?)<\/AbstractText>/gi;
  let match;
  
  while ((match = sectionRegex.exec(abstractXml)) !== null) {
    const attrs = match[1];
    const content = match[2];
    
    // Extract label from attributes if present
    const labelMatch = attrs.match(/Label="([^"]+)"/i) || attrs.match(/NlmCategory="([^"]+)"/i);
    const label = labelMatch ? labelMatch[1] : '';
    
    // Use improved tag stripping that preserves URLs and inline content
    const text = stripXmlTagsRoutes(content);
    
    if (text) {
      sections.push(label ? `${label}: ${text}` : text);
    }
  }
  
  // Also check for trial registration info that might be outside AbstractText elements
  const trialRegMatch = abstractXml.match(/Trial\s+registration[:\s]+([\s\S]*?)(?=<\/|$)/i);
  if (trialRegMatch) {
    const trialText = stripXmlTagsRoutes(trialRegMatch[0]);
    if (trialText && !sections.some(s => s.includes('Trial registration'))) {
      sections.push(trialText);
    }
  }
  
  return sections.join('\n\n');
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Get all categories
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  // Search publications
  app.get("/api/publications/search", async (req, res) => {
    try {
      const params = searchPublicationsSchema.parse({
        query: req.query.query,
        categories: req.query.categories ? String(req.query.categories).split(",") : undefined,
        researchArea: req.query.researchArea ? String(req.query.researchArea) : undefined,
        venue: req.query.venue ? String(req.query.venue) : undefined,
        year: req.query.year ? parseInt(String(req.query.year)) : undefined,
        sortBy: req.query.sortBy || "newest",
        limit: req.query.limit ? parseInt(String(req.query.limit)) : 20,
        offset: req.query.offset ? parseInt(String(req.query.offset)) : 0,
      });

      const result = await storage.searchPublications(params);
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid search parameters", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to search publications" });
      }
    }
  });

  // Get featured publications
  app.get("/api/publications/featured", async (req, res) => {
    try {
      const featured = await storage.getFeaturedPublications();
      res.json(featured);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch featured publications" });
    }
  });

  // Get publication statistics
  app.get("/api/publications/stats", async (req, res) => {
    try {
      const stats = await storage.getPublicationStats();
      res.json({ success: true, stats });
    } catch (error) {
      res.status(500).json({ success: false, message: "Failed to fetch publication statistics" });
    }
  });

  // Get single publication
  app.get("/api/publications/:id", async (req, res) => {
    try {
      const publication = await storage.getPublication(req.params.id);
      if (!publication) {
        return res.status(404).json({ message: "Publication not found" });
      }
      res.json(publication);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch publication" });
    }
  });

  // Toggle featured status
  app.patch("/api/publications/:id/featured", async (req, res) => {
    try {
      const publication = await storage.toggleFeatured(req.params.id);
      if (!publication) {
        return res.status(404).json({ message: "Publication not found" });
      }
      res.json(publication);
    } catch (error) {
      res.status(500).json({ message: "Failed to toggle featured status" });
    }
  });

  // Create publication manually
  app.post("/api/publications", async (req, res) => {
    try {
      const publicationData = insertPublicationSchema.parse(req.body);
      const publication = await storage.createPublication(publicationData);
      res.status(201).json(publication);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid publication data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create publication" });
      }
    }
  });

  // PubMed integration - search and import publications
  app.post("/api/pubmed/search", async (req, res) => {
    try {
      const { query, maxResults = 20 } = req.body;
      
      if (!query) {
        return res.status(400).json({ message: "Search query is required" });
      }

      // Step 1: Search PubMed for articles
      const searchResponse = await fetchFromPubMed("esearch.fcgi", {
        db: "pubmed",
        term: `${query} AND SphygmoCor`,
        retmax: String(maxResults),
        retmode: "json"
      });

      const searchData = JSON.parse(searchResponse);
      const pmids = searchData.esearchresult.idlist;

      if (!pmids || pmids.length === 0) {
        return res.json({ imported: 0, publications: [] });
      }

      // Step 2: Fetch detailed information for each PMID
      const detailsResponse = await fetchFromPubMed("efetch.fcgi", {
        db: "pubmed",
        id: pmids.join(","),
        retmode: "xml"
      });

      // Extract individual article XML segments for proper abstract parsing
      const articleXmlSegments: string[] = [];
      const articleRegex = /<PubmedArticle[^>]*>([\s\S]*?)<\/PubmedArticle>/gi;
      let xmlMatch;
      while ((xmlMatch = articleRegex.exec(detailsResponse)) !== null) {
        articleXmlSegments.push(xmlMatch[0]);
      }

      // Step 3: Parse XML and extract publication data
      const publications = [];
      const doc = parseXmlToJson(detailsResponse);
      const articleSet = doc?.PubmedArticleSet?.PubmedArticle || [];
      const articles = Array.isArray(articleSet) ? articleSet : [articleSet];

      for (let i = 0; i < articles.length; i++) {
        const article = articles[i];
        const rawArticleXml = articleXmlSegments[i] || '';
        
        try {
          const pmid = article?.MedlineCitation?.PMID?.['#text'] || article?.MedlineCitation?.PMID || "";
          
          // Check if we already have this publication
          const existing = await storage.getPublicationByPmid(String(pmid));
          if (existing) continue;

          const title = normalizeXmlText(article?.MedlineCitation?.Article?.ArticleTitle) || "";
          
          // Prefer raw XML extraction for abstracts to preserve text order in mixed content
          let abstract = extractAbstractFromXml(rawArticleXml);
          if (!abstract) {
            abstract = formatAbstract(article?.MedlineCitation?.Article?.Abstract?.AbstractText) || "";
          }
          
          const journal = normalizeXmlText(article?.MedlineCitation?.Article?.Journal?.Title) || "";
          
          // Extract authors
          const authorList = article?.MedlineCitation?.Article?.AuthorList?.Author || [];
          const authorsArray = Array.isArray(authorList) ? authorList : [authorList];
          const authors = authorsArray.map((author: any) => {
            const lastName = normalizeXmlText(author?.LastName) || "";
            const foreName = normalizeXmlText(author?.ForeName) || "";
            return `${foreName} ${lastName}`.trim();
          }).filter(name => name).join(", ");

          // Extract publication date
          const pubDate = article?.MedlineCitation?.Article?.Journal?.JournalIssue?.PubDate;
          const publicationDate = parsePubMedDate(pubDate);

          // Extract DOI
          const eLocationIDs = article?.PubmedData?.ArticleIdList?.ArticleId || [];
          const eLocationArray = Array.isArray(eLocationIDs) ? eLocationIDs : [eLocationIDs];
          const doiObj = eLocationArray.find((id: any) => id?.['@_IdType'] === 'doi');
          const doi = normalizeXmlText(doiObj?.['#text'] || doiObj) || "";

          // Auto-categorize based on keywords and abstract
          const categories = await autoCategorizePublication(title, abstract);
          
          // Auto-assign research area based on content
          const researchArea = autoAssignResearchArea(title, abstract);

          const publicationData = {
            pmid,
            title,
            authors,
            journal,
            publicationDate,
            abstract,
            doi,
            categories,
            keywords: [],
            researchArea,
            pubmedUrl: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
            citationCount: 0,
            isFeatured: 0,
            journalImpactFactor: null
          };

          const newPublication = await storage.createPublication(publicationData);
          publications.push(newPublication);
        } catch (error) {
          console.error("Error processing article:", error);
          continue;
        }
      }

      res.json({ 
        imported: publications.length, 
        publications,
        message: `Successfully imported ${publications.length} publications from PubMed`
      });

    } catch (error: any) {
      console.error("PubMed search error:", error);
      res.status(500).json({ message: "Failed to search PubMed", error: error.message });
    }
  });

  // Auto-categorization helper function
  async function autoCategorizePublication(title: string, abstract: string): Promise<string[]> {
    const categories = await storage.getCategories();
    const text = `${title} ${abstract}`.toLowerCase();
    const matchedCategories: string[] = [];

    // Simple keyword matching for auto-categorization
    const categoryKeywords = {
      "Chronic Kidney Disease (CKD)": ["kidney", "renal", "ckd", "nephro"],
      "Chronic Obstructive Pulmonary Disease (COPD)": ["copd", "pulmonary", "lung", "respiratory"],
      "Early Vascular Aging (EVA)": ["vascular aging", "eva", "arterial stiffness", "pulse wave"],
      "Heart Failure": ["heart failure", "cardiac", "hfpef", "hfref"],
      "Hypertension": ["hypertension", "blood pressure", "hypertensive"],
      "Longevity": ["aging", "longevity", "elderly", "lifespan"],
      "Maternal Health": ["pregnancy", "maternal", "pregnant", "prenatal"],
      "Men's Health": ["men", "male", "testosterone"],
      "Metabolic Health": ["diabetes", "metabolic", "glucose", "insulin"],
      "Neuroscience": ["brain", "cognitive", "neurological", "dementia"],
      "Women's Health": ["women", "female", "estrogen", "menopause"]
    };

    for (const [categoryName, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        matchedCategories.push(categoryName);
      }
    }

    return matchedCategories;
  }

  // Auto-assign research area helper function
  function autoAssignResearchArea(title: string, abstract: string): string {
    const text = `${title} ${abstract}`.toLowerCase();

    // Research area keyword mapping using slug identifiers that match the frontend grid
    const researchAreaKeywords = {
      "biomedical-engineering": [
        "sphygmocor", "device", "measurement", "sensor", "monitoring", "pulse wave", 
        "arterial stiffness", "cardiac output", "hemodynamic", "medical device", "instrumentation"
      ],
      "computer-vision": [
        "imaging", "image analysis", "medical imaging", "ultrasound", "echocardiography", 
        "radiological", "visual", "scan", "ct", "mri", "x-ray"
      ],
      "data-analysis": [
        "statistical", "analysis", "regression", "correlation", "predictive", "model", 
        "data mining", "epidemiological", "cohort", "longitudinal", "cross-sectional", 
        "meta-analysis", "systematic review"
      ],
      "methods-algorithms": [
        "algorithm", "method", "methodology", "technique", "approach", "framework", 
        "protocol", "procedure", "validation", "comparison", "novel", "new method"
      ],
      "nlp": [
        "text analysis", "natural language", "nlp", "text mining", "literature review", 
        "semantic", "linguistic", "information extraction"
      ]
    };

    // Check for specific research area keywords (order matters - more specific first)
    for (const [areaSlug, keywords] of Object.entries(researchAreaKeywords)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return areaSlug;
      }
    }

    // Default to health-medical slug for general medical content
    return "health-medical";
  }

  // Admin endpoint to sync publications from PubMed automatically
  app.post("/api/admin/sync-pubmed", async (req, res) => {
    try {
      const { maxPerTerm = 50, dryRun = false } = req.body;
      
      // Check if sync is already running
      if (syncTracker.isRunning()) {
        return res.status(409).json({
          success: false,
          message: "Sync is already running. Please wait for it to complete.",
        });
      }
      
      // Start tracking
      syncTracker.start("full", dryRun);
      const modeLabel = dryRun ? "(DRY RUN - no changes will be saved)" : "(progressive mode - saves in batches)";
      console.log(`Starting PubMed full sync ${modeLabel}...`);
      
      // Respond immediately
      res.json({
        success: true,
        message: dryRun 
          ? "Dry run started. Poll /api/admin/sync-status for progress. No changes will be saved."
          : "Full sync started. Poll /api/admin/sync-status for progress.",
        dryRun,
      });
      
      // Run sync in background
      (async () => {
        let imported = 0;
        let skipped = 0;
        let approved = 0;
        let pending = 0;
        
        try {
          // Progressive sync: save articles to database as each batch is fetched
          const result = await pubmedService.syncCardiovascularResearchProgressive(
            maxPerTerm,
            async (batch: InsertPublication[], phase: string, batchIndex: number, totalBatches: number) => {
              // Update phase and progress
              syncTracker.updatePhase(phase);
              syncTracker.updateProgress(batchIndex, totalBatches);
              
              // This callback is called after each batch (year range) is fetched
              console.log(`  Processing batch ${batchIndex}/${totalBatches}: ${batch.length} articles...`);
              
              // Batch-level pre-flight estimate
              const batchPmids = batch.map(p => p.pmid).filter(Boolean) as string[];
              const batchPmcIds = batch.map(p => p.pmcId).filter(Boolean) as string[];
              const batchDois = batch.map(p => p.doi).filter(Boolean) as string[];
              const batchEstimate = await storage.countExistingByIdentifiers(batchPmids, batchPmcIds, batchDois);
              console.log(`    Pre-flight: ~${batchEstimate.byPmid} by PMID, ~${batchEstimate.byPmcId} by PMC, ~${batchEstimate.byDoi} by DOI already exist`);
              
              for (const pub of batch) {
                // Check for cancellation request
                if (syncTracker.isCancelRequested()) {
                  console.log(`[SYNC] Cancellation detected during batch processing`);
                  syncTracker.cancelled();
                  return;
                }
                
                try {
                  // Check if publication already exists by pmid, pmc_id, OR DOI (triple check)
                  let existing = await storage.getPublicationByPmid(pub.pmid || "");
                  let matchedBy = existing ? "pmid" : null;
                  
                  if (!existing && pub.pmcId) {
                    existing = await storage.getPublicationByPmcId(pub.pmcId);
                    if (existing) matchedBy = "pmc_id";
                  }
                  
                  if (!existing && pub.doi) {
                    existing = await storage.getPublicationByDoi(pub.doi);
                    if (existing) matchedBy = "doi";
                  }
                  
                  if (existing) {
                    // Log which check caught this duplicate
                    console.log(`    [DUPLICATE] Matched by ${matchedBy}: "${pub.title?.substring(0, 50)}..." (pmid=${pub.pmid}, pmc=${pub.pmcId}, doi=${pub.doi})`);
                    
                    if (!dryRun) {
                      // Update abstract and other key fields for existing publications
                      // This ensures parsing improvements get applied
                      await storage.updatePublication(existing.id, {
                        abstract: pub.abstract,
                        title: pub.title,
                        authors: pub.authors,
                        doi: pub.doi,
                        pmcId: pub.pmcId, // Ensure pmc_id is updated
                      });
                    }
                    skipped++; // Still counted as "skipped" (not new) but abstract is updated
                    continue;
                  }
                  
                  if (!dryRun) {
                    await storage.createPublication(pub);
                  }
                  console.log(`    [${dryRun ? 'WOULD IMPORT' : 'NEW'}] Imported: "${pub.title?.substring(0, 50)}..." (pmid=${pub.pmid}, pmc=${pub.pmcId})`);
                  imported++;
                  
                  // Track status breakdown
                  if (pub.status === "approved") {
                    approved++;
                  } else {
                    pending++;
                  }
                } catch (error) {
                  console.error(`Error importing publication ${pub.pmid}:`, error);
                }
              }
              
              // Update tracker stats
              syncTracker.updateStats(imported, skipped, approved, pending);
              
              console.log(`  Batch complete: ${imported} total imported (${approved} approved, ${pending} pending), ${skipped} skipped`);
            }
          );
          
          // Check if sync was cancelled during progressive import
          if (syncTracker.getStatus().status === "cancelled") {
            console.log(`\nSync cancelled: ${imported} imported before cancellation, ${skipped} skipped`);
            return;
          }
          
          if (dryRun) {
            console.log(`\n=== DRY RUN COMPLETE ===`);
            console.log(`Would import: ${imported} new publications`);
            console.log(`Would skip/update: ${skipped} existing publications`);
            console.log(`Total fetched: ${result.totalUnique}`);
            console.log(`No changes were made to the database.`);
            console.log(`========================\n`);
          } else {
            console.log(`\nSync complete: ${imported} imported (${approved} approved, ${pending} pending for review), ${skipped} skipped out of ${result.totalUnique} unique fetched`);
            
            // Clean up any duplicates that slipped through
            const duplicatesRemoved = await storage.cleanupDuplicatesByTitle();
            if (duplicatesRemoved > 0) {
              console.log(`Post-sync cleanup: removed ${duplicatesRemoved} duplicates`);
            }
          }
          
          // Mark as complete
          syncTracker.complete();
        } catch (error: any) {
          console.error("PubMed sync error:", error);
          syncTracker.error(error.message || "Unknown error");
        }
      })().catch((error) => {
        console.error("Fatal sync error:", error);
        syncTracker.error(error.message || "Unknown error");
      });
    } catch (error: any) {
      console.error("PubMed sync error:", error);
      syncTracker.error(error.message || "Unknown error");
      res.status(500).json({ 
        success: false,
        message: "Failed to start full sync from PubMed", 
        error: error.message 
      });
    }
  });

  // Admin endpoint to incrementally sync publications from the past year
  app.post("/api/admin/sync-pubmed-incremental", async (req, res) => {
    try {
      const { maxPerTerm = 50, dryRun = false } = req.body;
      
      // Check if sync is already running
      if (syncTracker.isRunning()) {
        return res.status(409).json({
          success: false,
          message: "Sync is already running. Please wait for it to complete.",
        });
      }
      
      const modeLabel = dryRun ? "(DRY RUN - no changes will be saved)" : "(past year)";
      console.log(`Starting incremental PubMed sync ${modeLabel}...`);
      
      // Sync from 1 year ago to catch any missed publications
      // Duplicate detection (by pmid, pmc_id, and title) handles any overlap
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const syncFromDate = oneYearAgo;
      
      // Start tracking
      syncTracker.start("incremental", dryRun);
      syncTracker.updatePhase(`Syncing publications from past year (since ${syncFromDate.toLocaleDateString()})...`);
      
      console.log(`Syncing from date: ${syncFromDate.toLocaleDateString()}`);
      
      // Respond immediately
      res.json({
        success: true,
        message: dryRun 
          ? `Dry run started (past year). Poll /api/admin/sync-status for progress. No changes will be saved.`
          : `Incremental sync started (past year). Poll /api/admin/sync-status for progress.`,
        fromDate: syncFromDate.toISOString(),
        dryRun,
      });
      
      // Run sync in background
      (async () => {
        let imported = 0;
        let skipped = 0;
        let approved = 0;
        let pending = 0;
        
        try {
          const publications = await pubmedService.syncIncrementalResearch(syncFromDate, maxPerTerm);
          
          console.log(`Fetched ${publications.length} publications since ${syncFromDate.toLocaleDateString()}`);
          
          // Pre-flight duplicate estimate
          const pmids = publications.map(p => p.pmid).filter(Boolean) as string[];
          const pmcIds = publications.map(p => p.pmcId).filter(Boolean) as string[];
          const dois = publications.map(p => p.doi).filter(Boolean) as string[];
          
          const estimate = await storage.countExistingByIdentifiers(pmids, pmcIds, dois);
          console.log(`\n=== PRE-FLIGHT DUPLICATE ESTIMATE ===`);
          console.log(`  Fetched ${publications.length} publications`);
          console.log(`  Estimated duplicates by PMID: ${estimate.byPmid}`);
          console.log(`  Estimated duplicates by PMC ID: ${estimate.byPmcId}`);
          console.log(`  Estimated duplicates by DOI: ${estimate.byDoi}`);
          console.log(`  Expected new imports: ~${Math.max(0, publications.length - Math.max(estimate.byPmid, estimate.byPmcId, estimate.byDoi))}`);
          console.log(`=====================================\n`);
          
          syncTracker.updatePhase("Importing publications...");
          syncTracker.updateProgress(0, publications.length);
          
          for (let i = 0; i < publications.length; i++) {
            const pub = publications[i];
            
            // Check for cancellation request
            if (syncTracker.isCancelRequested()) {
              console.log(`[SYNC] Cancellation detected at publication ${i + 1}/${publications.length}`);
              syncTracker.cancelled();
              console.log(`Incremental sync cancelled: ${imported} imported, ${skipped} updated before cancellation`);
              return;
            }
            
            try {
              // Check if publication already exists by pmid, pmc_id, OR DOI (triple check)
              let existing = await storage.getPublicationByPmid(pub.pmid || "");
              let matchedBy = existing ? "pmid" : null;
              
              if (!existing && pub.pmcId) {
                existing = await storage.getPublicationByPmcId(pub.pmcId);
                if (existing) matchedBy = "pmc_id";
              }
              
              if (!existing && pub.doi) {
                existing = await storage.getPublicationByDoi(pub.doi);
                if (existing) matchedBy = "doi";
              }
              
              if (existing) {
                // Log which check caught this duplicate
                console.log(`  [DUPLICATE] Matched by ${matchedBy}: "${pub.title?.substring(0, 50)}..." (pmid=${pub.pmid}, pmc=${pub.pmcId}, doi=${pub.doi})`);
                
                if (!dryRun) {
                  // Update abstract and other key fields for existing publications
                  // This ensures parsing improvements get applied
                  await storage.updatePublication(existing.id, {
                    abstract: pub.abstract,
                    title: pub.title,
                    authors: pub.authors,
                    doi: pub.doi,
                    pmcId: pub.pmcId, // Ensure pmc_id is updated
                  });
                }
                skipped++; // Still counted as "skipped" (not new) but abstract is updated
              } else {
                if (!dryRun) {
                  await storage.createPublication(pub);
                }
                console.log(`  [${dryRun ? 'WOULD IMPORT' : 'NEW'}] Imported: "${pub.title?.substring(0, 50)}..." (pmid=${pub.pmid}, pmc=${pub.pmcId})`);
                imported++;
                
                // Track status breakdown
                if (pub.status === "approved") {
                  approved++;
                } else {
                  pending++;
                }
              }
              
              // Update progress EVERY iteration (not just on import)
              syncTracker.updateProgress(i + 1, publications.length);
              syncTracker.updateStats(imported, skipped, approved, pending);
              
              // Log progress every 50 articles
              if ((i + 1) % 50 === 0) {
                console.log(`Import progress: ${i + 1}/${publications.length} processed (${imported} ${dryRun ? 'would be imported' : 'imported'}, ${skipped} ${dryRun ? 'duplicates' : 'updated'})...`);
              }
            } catch (error) {
              console.error(`Error importing publication ${pub.pmid}:`, error);
            }
          }
          
          if (dryRun) {
            console.log(`\n=== DRY RUN COMPLETE ===`);
            console.log(`Would import: ${imported} new publications`);
            console.log(`Would skip/update: ${skipped} existing publications`);
            console.log(`Total fetched: ${publications.length}`);
            console.log(`No changes were made to the database.`);
            console.log(`========================\n`);
          } else {
            console.log(`Incremental sync complete: ${imported} imported (${approved} approved, ${pending} pending), ${skipped} skipped out of ${publications.length} total`);
            
            // Clean up any duplicates that slipped through
            const duplicatesRemoved = await storage.cleanupDuplicatesByTitle();
            if (duplicatesRemoved > 0) {
              console.log(`Post-sync cleanup: removed ${duplicatesRemoved} duplicates`);
            }
          }
          
          // Mark as complete
          syncTracker.complete();
        } catch (error: any) {
          console.error("Incremental sync error:", error);
          syncTracker.error(error.message || "Unknown error");
        }
      })().catch((error) => {
        console.error("Fatal incremental sync error:", error);
        syncTracker.error(error.message || "Unknown error");
      });
    } catch (error: any) {
      console.error("Incremental sync error:", error);
      syncTracker.error(error.message || "Unknown error");
      res.status(500).json({ 
        success: false,
        message: "Failed to start incremental sync from PubMed", 
        error: error.message 
      });
    }
  });

  // Admin endpoint to get sync status
  app.get("/api/admin/sync-status", async (req, res) => {
    try {
      const status = syncTracker.getStatus();
      res.json({
        success: true,
        ...status,
      });
    } catch (error: any) {
      console.error("Error getting sync status:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to get sync status", 
        error: error.message 
      });
    }
  });

  // Admin endpoint to get sync history
  app.get("/api/admin/sync-history", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const history = syncTracker.getHistory(limit);
      res.json({
        success: true,
        history,
        count: history.length,
      });
    } catch (error: any) {
      console.error("Error getting sync history:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to get sync history", 
        error: error.message 
      });
    }
  });

  // Admin endpoint to cancel/stop a running sync
  app.post("/api/admin/sync-cancel", async (req, res) => {
    try {
      if (!syncTracker.isRunning()) {
        return res.status(400).json({
          success: false,
          message: "No sync is currently running.",
        });
      }

      const cancelled = syncTracker.requestCancel();
      if (cancelled) {
        res.json({
          success: true,
          message: "Cancel request sent. Sync will stop after current operation completes.",
        });
      } else {
        res.status(400).json({
          success: false,
          message: "Could not cancel sync.",
        });
      }
    } catch (error: any) {
      console.error("Error cancelling sync:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to cancel sync", 
        error: error.message 
      });
    }
  });

  // Admin endpoint to re-fetch abstracts for publications missing them
  app.post("/api/admin/refetch-abstracts", async (req, res) => {
    try {
      // Check if sync is already running
      if (syncTracker.isRunning()) {
        return res.status(409).json({
          success: false,
          message: "A sync is already running. Please wait for it to complete.",
        });
      }

      // Get publications without abstracts
      const { db } = await import("./db");
      const { publications } = await import("@shared/schema");
      const { isNull } = await import("drizzle-orm");
      
      const pubsWithoutAbstract = await db
        .select({ id: publications.id, pmid: publications.pmid, title: publications.title })
        .from(publications)
        .where(isNull(publications.abstract));
      
      if (pubsWithoutAbstract.length === 0) {
        return res.json({
          success: true,
          message: "All publications already have abstracts.",
          updated: 0,
          total: 0
        });
      }

      console.log(`Found ${pubsWithoutAbstract.length} publications without abstracts. Starting re-fetch...`);
      
      // Start tracking (use "incremental" type since abstract-refetch is not a defined type)
      syncTracker.start("incremental");
      syncTracker.updatePhase("Re-fetching missing abstracts from PubMed...");
      
      // Respond immediately
      res.json({
        success: true,
        message: `Re-fetching abstracts for ${pubsWithoutAbstract.length} publications. Poll /api/admin/sync-status for progress.`,
        total: pubsWithoutAbstract.length
      });

      // Run in background
      (async () => {
        let updated = 0;
        let failed = 0;
        const BATCH_SIZE = 50;
        const pmids = pubsWithoutAbstract.map(p => p.pmid).filter(Boolean) as string[];
        
        try {
          for (let i = 0; i < pmids.length; i += BATCH_SIZE) {
            const batch = pmids.slice(i, i + BATCH_SIZE);
            syncTracker.updateProgress(i, pmids.length);
            syncTracker.updatePhase(`Fetching batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(pmids.length / BATCH_SIZE)}...`);
            
            try {
              // Fetch article details from PubMed Central
              const fetchedArticles = await pubmedService.fetchArticleDetails(batch);
              
              // Update each publication that now has an abstract
              for (const article of fetchedArticles) {
                if (article.abstract) {
                  const pub = pubsWithoutAbstract.find(p => p.pmid === article.pmid);
                  if (pub) {
                    await storage.updatePublication(pub.id, { abstract: article.abstract });
                    updated++;
                    console.log(`  Updated abstract for: ${pub.title?.substring(0, 50)}...`);
                  }
                }
              }
            } catch (batchError: any) {
              console.error(`Error processing batch ${i}-${i + BATCH_SIZE}:`, batchError.message);
              failed += batch.length;
            }
            
            // Rate limit: wait 400ms between batches
            if (i + BATCH_SIZE < pmids.length) {
              await new Promise(resolve => setTimeout(resolve, 400));
            }
          }
          
          console.log(`Abstract re-fetch complete. Updated: ${updated}, Failed: ${failed}`);
          syncTracker.updateStats(updated, failed, 0, 0);
          syncTracker.complete();
        } catch (error: any) {
          console.error("Abstract re-fetch error:", error);
          syncTracker.error(error.message || "Unknown error");
        }
      })();
      
    } catch (error: any) {
      console.error("Error starting abstract re-fetch:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to start abstract re-fetch", 
        error: error.message 
      });
    }
  });

  // Admin endpoint to re-process all abstracts with improved parsing
  // Handles both PMC articles (via PMC API) and PubMed articles (via PubMed API)
  app.post("/api/admin/reprocess-all-abstracts", async (req, res) => {
    try {
      // Check if sync is already running
      if (syncTracker.getStatus().status !== "idle" && syncTracker.getStatus().status !== "completed") {
        return res.status(409).json({ 
          success: false, 
          message: "Another operation is in progress" 
        });
      }
      
      // Get all publications - paginate to get all
      const PAGE_SIZE = 1000;
      let allPubs: any[] = [];
      let offset = 0;
      let hasMore = true;
      
      while (hasMore) {
        const page = await storage.searchPublications({ sortBy: "newest", limit: PAGE_SIZE, offset });
        allPubs.push(...page.publications);
        offset += PAGE_SIZE;
        hasMore = page.publications.length === PAGE_SIZE;
      }
      
      // Separate PMC and PubMed articles based on URL
      const pmcPubs = allPubs.filter(p => p.pmid && p.pubmedUrl && p.pubmedUrl.includes('/pmc/'));
      const pubmedPubs = allPubs.filter(p => p.pmid && p.pubmedUrl && !p.pubmedUrl.includes('/pmc/') && /^\d+$/.test(p.pmid));
      
      const totalCount = pmcPubs.length + pubmedPubs.length;
      
      res.json({
        success: true,
        message: `Started re-processing abstracts for ${totalCount} publications (${pmcPubs.length} PMC, ${pubmedPubs.length} PubMed)...`,
        total: totalCount,
        pmcCount: pmcPubs.length,
        pubmedCount: pubmedPubs.length
      });
      
      // Run async re-processing
      (async () => {
        syncTracker.start("full");
        syncTracker.updatePhase("Starting abstract reprocessing...");
        
        let updated = 0;
        let failed = 0;
        const BATCH_SIZE = 50;
        
        try {
          // Process PMC articles first
          const pmcIds = pmcPubs.map(p => p.pmid).filter(Boolean) as string[];
          
          for (let i = 0; i < pmcIds.length; i += BATCH_SIZE) {
            const batch = pmcIds.slice(i, i + BATCH_SIZE);
            syncTracker.updateProgress(i, totalCount);
            syncTracker.updatePhase(`Re-fetching PMC batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(pmcIds.length / BATCH_SIZE)}...`);
            
            try {
              const fetchedArticles = await pubmedService.fetchArticleDetails(batch);
              
              for (const article of fetchedArticles) {
                const pub = pmcPubs.find(p => p.pmid === article.pmid);
                if (pub && article.abstract) {
                  await storage.updatePublication(pub.id, { abstract: article.abstract });
                  updated++;
                }
              }
            } catch (batchError: any) {
              console.error(`Error processing PMC batch ${i}-${i + BATCH_SIZE}:`, batchError.message);
              failed += batch.length;
            }
            
            if (i + BATCH_SIZE < pmcIds.length) {
              await new Promise(resolve => setTimeout(resolve, 400));
            }
          }
          
          // Process PubMed articles
          const pubmedIds = pubmedPubs.map(p => p.pmid).filter(Boolean) as string[];
          
          for (let i = 0; i < pubmedIds.length; i += BATCH_SIZE) {
            const batch = pubmedIds.slice(i, i + BATCH_SIZE);
            const progressOffset = pmcIds.length + i;
            syncTracker.updateProgress(progressOffset, totalCount);
            syncTracker.updatePhase(`Re-fetching PubMed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(pubmedIds.length / BATCH_SIZE)}...`);
            
            try {
              const abstractMap = await pubmedService.fetchPubMedAbstracts(batch);
              
              for (const [pmid, abstract] of Array.from(abstractMap.entries())) {
                const pub = pubmedPubs.find(p => p.pmid === pmid);
                if (pub && abstract) {
                  await storage.updatePublication(pub.id, { abstract: abstract });
                  updated++;
                }
              }
            } catch (batchError: any) {
              console.error(`Error processing PubMed batch ${i}-${i + BATCH_SIZE}:`, batchError.message);
              failed += batch.length;
            }
            
            if (i + BATCH_SIZE < pubmedIds.length) {
              await new Promise(resolve => setTimeout(resolve, 400));
            }
          }
          
          console.log(`Abstract reprocessing complete. Updated: ${updated}, Failed: ${failed}`);
          syncTracker.updateStats(updated, failed, 0, 0);
          syncTracker.complete();
        } catch (error: any) {
          console.error("Abstract reprocessing error:", error);
          syncTracker.error(error.message || "Unknown error");
        }
      })();
      
    } catch (error: any) {
      console.error("Error starting abstract reprocessing:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to start abstract reprocessing", 
        error: error.message 
      });
    }
  });

  // Admin endpoint to test fetching a single article (for debugging abstract parsing)
  app.get("/api/admin/test-fetch/:pmcid", async (req, res) => {
    try {
      const { pmcid } = req.params;
      const { update } = req.query; // Add ?update=true to update the database
      console.log(`Testing fetch for PMC${pmcid}...`);
      
      const articles = await pubmedService.fetchArticleDetails([pmcid]);
      
      if (articles.length === 0) {
        return res.json({
          success: false,
          message: "No article returned from PubMed",
          pmcid
        });
      }
      
      const article = articles[0];
      
      // Optionally update the publication in database
      let updated = false;
      if (update === 'true' && article.abstract) {
        // Check by pmc_id first, then by pmid (for legacy entries)
        let existing = await storage.getPublicationByPmcId(`PMC${pmcid}`);
        if (!existing) {
          existing = await storage.getPublicationByPmid(pmcid);
        }
        if (!existing && article.pmid) {
          existing = await storage.getPublicationByPmid(article.pmid);
        }
        if (existing) {
          await storage.updatePublication(existing.id, { 
            abstract: article.abstract,
            pmcId: `PMC${pmcid}`,
          });
          updated = true;
          console.log(`Updated publication PMC${pmcid} with new abstract`);
        }
      }
      
      res.json({
        success: true,
        pmcid,
        title: article.title,
        hasAbstract: !!article.abstract,
        abstractLength: article.abstract?.length || 0,
        abstract: article.abstract,
        authors: article.authors,
        journal: article.journal,
        databaseUpdated: updated
      });
    } catch (error: any) {
      console.error("Test fetch error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch article",
        error: error.message
      });
    }
  });

  // Admin endpoint to approve a publication
  app.post("/api/admin/publications/:id/approve", async (req, res) => {
    try {
      const { id } = req.params;
      const publication = await storage.updatePublication(id, { status: "approved" });
      
      if (!publication) {
        return res.status(404).json({ message: "Publication not found" });
      }
      
      res.json({ 
        success: true,
        publication,
        message: "Publication approved successfully"
      });
    } catch (error: any) {
      console.error("Error approving publication:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to approve publication", 
        error: error.message 
      });
    }
  });

  // Admin endpoint to reject a publication
  app.post("/api/admin/publications/:id/reject", async (req, res) => {
    try {
      const { id } = req.params;
      const publication = await storage.updatePublication(id, { status: "rejected" });
      
      if (!publication) {
        return res.status(404).json({ message: "Publication not found" });
      }
      
      res.json({ 
        success: true,
        publication,
        message: "Publication rejected successfully"
      });
    } catch (error: any) {
      console.error("Error rejecting publication:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to reject publication", 
        error: error.message 
      });
    }
  });

  // Admin endpoint to get all pending publications for review
  app.get("/api/admin/publications/pending", async (req, res) => {
    try {
      const limit = parseInt(String(req.query.limit)) || 25;
      const offset = parseInt(String(req.query.offset)) || 0;
      const searchQuery = req.query.search ? String(req.query.search) : null;
      
      // Direct database query for pending publications (bypass approved filter)
      const { db } = await import("./db");
      const { publications } = await import("@shared/schema");
      const { eq, desc, sql, and, or } = await import("drizzle-orm");
      
      // Build where conditions
      const conditions = [eq(publications.status, "pending")];
      
      // Add search filter if provided
      if (searchQuery) {
        const escapedSearch = escapeLikePattern(searchQuery.toLowerCase());
        const search = `%${escapedSearch}%`;
        const searchCondition = or(
          sql`LOWER(${publications.title}) LIKE ${search} ESCAPE '\\'`,
          sql`LOWER(${publications.authors}) LIKE ${search} ESCAPE '\\'`,
          sql`LOWER(${publications.journal}) LIKE ${search} ESCAPE '\\'`
        );
        if (searchCondition) {
          conditions.push(searchCondition);
        }
      }
      
      const pendingPubs = await db
        .select()
        .from(publications)
        .where(and(...conditions))
        .orderBy(desc(publications.publicationDate))
        .limit(limit)
        .offset(offset);
      
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(publications)
        .where(and(...conditions));
      
      const total = countResult?.count || 0;
      const totalPages = Math.ceil(total / limit);
      const currentPage = Math.floor(offset / limit) + 1;
      
      res.json({
        success: true,
        publications: pendingPubs,
        total,
        totalPages,
        currentPage
      });
    } catch (error: any) {
      console.error("Error fetching pending publications:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to fetch pending publications", 
        error: error.message 
      });
    }
  });

  // Get publications needing category review (MUST be before :status route)
  app.get("/api/admin/publications/needing-review", async (req, res) => {
    try {
      // Parse query params with safe defaults
      const limitParam = req.query.limit ? parseInt(String(req.query.limit)) : 25;
      const offsetParam = req.query.offset ? parseInt(String(req.query.offset)) : 0;
      
      const limit = isNaN(limitParam) ? 25 : Math.min(Math.max(limitParam, 1), 100);
      const offset = isNaN(offsetParam) ? 0 : Math.max(offsetParam, 0);
      
      const { publications: pubs, total } = await storage.getPublicationsNeedingReview(limit, offset);
      const totalPages = Math.ceil(total / limit);
      const currentPage = Math.floor(offset / limit) + 1;
      
      res.json({
        success: true,
        publications: pubs,
        total,
        totalPages,
        currentPage
      });
    } catch (error: any) {
      console.error("Error fetching publications needing review:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to fetch publications needing review", 
        error: error.message 
      });
    }
  });

  // Admin endpoint to get publications by status (pending, approved, rejected)
  app.get("/api/admin/publications/:status", async (req, res) => {
    try {
      const { status } = req.params;
      const limit = parseInt(String(req.query.limit)) || 25;
      const offset = parseInt(String(req.query.offset)) || 0;
      const searchQuery = req.query.search ? String(req.query.search) : null;
      
      // Validate status
      if (!["pending", "approved", "rejected"].includes(status)) {
        return res.status(400).json({ 
          success: false,
          message: "Invalid status. Must be pending, approved, or rejected" 
        });
      }
      
      // Direct database query for publications by status (bypass approved filter)
      const { db } = await import("./db");
      const { publications } = await import("@shared/schema");
      const { eq, desc, sql, and, or } = await import("drizzle-orm");
      
      // Build where conditions
      const conditions = [eq(publications.status, status)];
      
      // Add search filter if provided
      if (searchQuery) {
        const escapedSearch = escapeLikePattern(searchQuery.toLowerCase());
        const search = `%${escapedSearch}%`;
        const searchCondition = or(
          sql`LOWER(${publications.title}) LIKE ${search} ESCAPE '\\'`,
          sql`LOWER(${publications.authors}) LIKE ${search} ESCAPE '\\'`,
          sql`LOWER(${publications.journal}) LIKE ${search} ESCAPE '\\'`
        );
        if (searchCondition) {
          conditions.push(searchCondition);
        }
      }
      
      const pubs = await db
        .select()
        .from(publications)
        .where(and(...conditions))
        .orderBy(desc(publications.publicationDate))
        .limit(limit)
        .offset(offset);
      
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(publications)
        .where(and(...conditions));
      
      const total = countResult?.count || 0;
      const totalPages = Math.ceil(total / limit);
      const currentPage = Math.floor(offset / limit) + 1;
      
      res.json({
        success: true,
        publications: pubs,
        total,
        totalPages,
        currentPage
      });
    } catch (error: any) {
      console.error("Error fetching publications by status:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to fetch publications", 
        error: error.message 
      });
    }
  });

  // Admin endpoint to get featured publications
  app.get("/api/admin/publications-list/featured", async (req, res) => {
    try {
      const limit = parseInt(String(req.query.limit)) || 25;
      const offset = parseInt(String(req.query.offset)) || 0;
      const searchQuery = req.query.search ? String(req.query.search) : null;
      
      // Direct database query for featured publications
      const { db } = await import("./db");
      const { publications } = await import("@shared/schema");
      const { eq, desc, sql, and, or } = await import("drizzle-orm");
      
      // Build where conditions
      const conditions = [
        eq(publications.isFeatured, 1),
        eq(publications.status, "approved")
      ];
      
      // Add search filter if provided
      if (searchQuery) {
        const escapedSearch = escapeLikePattern(searchQuery.toLowerCase());
        const search = `%${escapedSearch}%`;
        const searchCondition = or(
          sql`LOWER(${publications.title}) LIKE ${search} ESCAPE '\\'`,
          sql`LOWER(${publications.authors}) LIKE ${search} ESCAPE '\\'`,
          sql`LOWER(${publications.journal}) LIKE ${search} ESCAPE '\\'`
        );
        if (searchCondition) {
          conditions.push(searchCondition);
        }
      }
      
      const featuredPubs = await db
        .select()
        .from(publications)
        .where(and(...conditions))
        .orderBy(desc(publications.publicationDate))
        .limit(limit)
        .offset(offset);
      
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(publications)
        .where(and(
          eq(publications.isFeatured, 1),
          eq(publications.status, "approved")
        ));
      
      const total = countResult?.count || 0;
      const totalPages = Math.ceil(total / limit);
      const currentPage = Math.floor(offset / limit) + 1;
      
      res.json({
        success: true,
        publications: featuredPubs,
        total,
        totalPages,
        currentPage
      });
    } catch (error: any) {
      console.error("Error fetching featured publications:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to fetch featured publications", 
        error: error.message 
      });
    }
  });

  // Admin endpoint to update publication categories and research area
  app.patch("/api/admin/publications/:id/categories", async (req, res) => {
    try {
      const { id } = req.params;
      const { researchArea, categories } = req.body;
      
      // Validate input
      if (!researchArea && !categories) {
        return res.status(400).json({ 
          success: false,
          message: "At least one of researchArea or categories is required" 
        });
      }
      
      // Validate categories is an array if provided
      if (categories !== undefined && !Array.isArray(categories)) {
        return res.status(400).json({ 
          success: false,
          message: "Categories must be an array" 
        });
      }
      
      // Build update object
      const updates: any = {};
      if (researchArea !== undefined) updates.researchArea = researchArea;
      if (categories !== undefined) updates.categories = categories;
      
      const publication = await storage.updatePublication(id, updates);
      
      if (!publication) {
        return res.status(404).json({ 
          success: false,
          message: "Publication not found" 
        });
      }
      
      res.json({ 
        success: true,
        publication,
        message: "Publication updated successfully"
      });
    } catch (error: any) {
      console.error("Error updating publication categories:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to update publication", 
        error: error.message 
      });
    }
  });

  // Admin endpoint to update publication status
  app.patch("/api/admin/publications/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      // Validate status
      if (!status || !["pending", "approved", "rejected"].includes(status)) {
        return res.status(400).json({ 
          success: false,
          message: "Invalid status. Must be pending, approved, or rejected" 
        });
      }
      
      const publication = await storage.updatePublication(id, { status });
      
      if (!publication) {
        return res.status(404).json({ 
          success: false,
          message: "Publication not found" 
        });
      }
      
      res.json({ 
        success: true,
        publication,
        message: `Publication status updated to ${status}`
      });
    } catch (error: any) {
      console.error("Error updating publication status:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to update publication status", 
        error: error.message 
      });
    }
  });

  // ===== Category Suggestion Endpoints =====
  
  // Generate ML-based category suggestions for a publication
  app.post("/api/admin/publications/:id/generate-suggestions", async (req, res) => {
    try {
      const { id } = req.params;
      const { useML = true } = req.body;
      
      const publication = await storage.getPublication(id);
      if (!publication) {
        return res.status(404).json({ 
          success: false,
          message: "Publication not found" 
        });
      }

      // Generate suggestions using the category service
      const { generateSuggestionsForPublication } = await import("./services/categorySuggestions");
      const suggestions = await generateSuggestionsForPublication(
        publication.title,
        publication.abstract,
        useML
      );

      // Store suggestions in database (always use pending_review to ensure items appear in review tab)
      await storage.updateSuggestedCategories(id, suggestions, 'pending_review');

      res.json({ 
        success: true,
        suggestions,
        message: "Category suggestions generated successfully"
      });
    } catch (error: any) {
      console.error("Error generating category suggestions:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to generate category suggestions", 
        error: error.message 
      });
    }
  });

  // Batch generate category suggestions
  app.post("/api/admin/publications/batch-generate-suggestions", async (req, res) => {
    try {
      const { publicationIds, useML = true } = req.body;
      
      if (!Array.isArray(publicationIds)) {
        return res.status(400).json({ 
          success: false,
          message: "publicationIds must be an array" 
        });
      }

      const { generateSuggestionsForPublication } = await import("./services/categorySuggestions");
      const results = [];
      const errors = [];

      for (const id of publicationIds) {
        try {
          const publication = await storage.getPublication(id);
          if (!publication) {
            errors.push({ id, error: "Publication not found" });
            continue;
          }

          const suggestions = await generateSuggestionsForPublication(
            publication.title,
            publication.abstract,
            useML
          );

          // Always use pending_review status to ensure items appear in review tab
          await storage.updateSuggestedCategories(id, suggestions, 'pending_review');
          results.push({ id, suggestions });

          // Rate limit: 100ms delay between OpenAI calls
          if (useML) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error: any) {
          errors.push({ id, error: error.message });
        }
      }

      res.json({ 
        success: true,
        processed: results.length,
        failed: errors.length,
        results,
        errors
      });
    } catch (error: any) {
      console.error("Error in batch generate suggestions:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to batch generate suggestions", 
        error: error.message 
      });
    }
  });

  // Approve category suggestions
  app.post("/api/admin/publications/:id/approve-categories", async (req, res) => {
    try {
      const { id } = req.params;
      const { categories, reviewerName = 'admin' } = req.body;
      
      if (!Array.isArray(categories)) {
        return res.status(400).json({ 
          success: false,
          message: "categories must be an array" 
        });
      }

      const publication = await storage.approveCategories(id, categories, reviewerName);
      
      if (!publication) {
        return res.status(404).json({ 
          success: false,
          message: "Publication not found" 
        });
      }

      res.json({ 
        success: true,
        publication,
        message: "Categories approved successfully"
      });
    } catch (error: any) {
      console.error("Error approving categories:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to approve categories", 
        error: error.message 
      });
    }
  });

  // Reject category suggestions
  app.post("/api/admin/publications/:id/reject-suggestions", async (req, res) => {
    try {
      const { id } = req.params;
      const { reviewerName = 'admin' } = req.body;

      const publication = await storage.rejectSuggestions(id, reviewerName);
      
      if (!publication) {
        return res.status(404).json({ 
          success: false,
          message: "Publication not found" 
        });
      }

      res.json({ 
        success: true,
        publication,
        message: "Suggestions rejected successfully"
      });
    } catch (error: any) {
      console.error("Error rejecting suggestions:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to reject suggestions", 
        error: error.message 
      });
    }
  });

  // Batch categorization endpoints
  app.post("/api/admin/batch-categorization/start", async (req, res) => {
    try {
      const { filter } = req.body;
      
      if (!filter || !["all", "uncategorized", "pending", "approved"].includes(filter)) {
        return res.status(400).json({
          success: false,
          message: "Invalid filter. Must be one of: all, uncategorized, pending, approved"
        });
      }

      const result = await startBatchCategorization(filter);
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error("Error starting batch categorization:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to start batch categorization"
      });
    }
  });

  app.get("/api/admin/batch-categorization/status", async (req, res) => {
    try {
      const status = batchCategorizationTracker.getStatus();
      res.json({ success: true, ...status });
    } catch (error: any) {
      console.error("Error fetching batch categorization status:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch batch categorization status"
      });
    }
  });

  // Get citation update status
  app.get("/api/admin/citation-status", async (req, res) => {
    res.json(citationTracker.getStatus());
  });

  // Admin endpoint to update citation counts from OpenAlex (async background job)
  app.post("/api/admin/update-citations", async (req, res) => {
    if (citationTracker.isRunning()) {
      return res.status(409).json({
        success: false,
        message: "Citation update is already in progress",
        status: citationTracker.getStatus()
      });
    }

    try {
      const { db } = await import("./db");
      const { publications } = await import("@shared/schema");
      const { sql } = await import("drizzle-orm");
      
      const allPubs = await db
        .select({ id: publications.id, doi: publications.doi })
        .from(publications)
        .where(sql`${publications.doi} IS NOT NULL AND ${publications.doi} != ''`);

      if (allPubs.length === 0) {
        return res.json({
          success: true,
          message: "No publications with DOIs found",
          updated: 0
        });
      }

      citationTracker.start(allPubs.length);
      
      res.json({
        success: true,
        message: `Started updating citation counts for ${allPubs.length} publications`,
        status: citationTracker.getStatus()
      });

      (async () => {
        try {
          const dois = allPubs.map(p => p.doi!);
          console.log(`Fetching citation counts for ${dois.length} publications...`);

          citationTracker.updatePhase("Fetching citation counts from OpenAlex...");
          const citationCounts = await citationService.getCitationCountBatch(dois);
          
          citationTracker.updatePhase("Updating database...");
          let updated = 0;
          let processed = 0;
          
          for (const pub of allPubs) {
            const normalizedDoi = pub.doi!.replace(/^https?:\/\/doi\.org\//i, "").toLowerCase();
            const count = citationCounts.get(normalizedDoi);
            
            if (count !== undefined) {
              await storage.updatePublication(pub.id, { citationCount: count });
              updated++;
            }
            processed++;
            
            if (processed % 100 === 0) {
              citationTracker.updateProgress(processed, updated);
            }
          }

          citationTracker.updateProgress(processed, updated);
          console.log(`Updated citation counts for ${updated} publications`);
          citationTracker.complete();
        } catch (error: any) {
          console.error("Error updating citation counts:", error);
          citationTracker.error(error.message);
        }
      })();

    } catch (error: any) {
      console.error("Error starting citation update:", error);
      citationTracker.error(error.message);
      res.status(500).json({
        success: false,
        message: "Failed to start citation update",
        error: error.message
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
