import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPublicationSchema, searchPublicationsSchema, type InsertPublication } from "@shared/schema";
import { z } from "zod";
import { XMLParser } from "fast-xml-parser";
import { pubmedService } from "./services/pubmed";
import { syncTracker } from "./sync-tracker";

// Helper to normalize XML text from fast-xml-parser
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
    if (value['#text']) {
      return normalizeXmlText(value['#text']);
    }
    // Ignore attributes starting with @_ and collect other values
    const textValues = Object.keys(value)
      .filter(key => !key.startsWith('@_'))
      .map(key => normalizeXmlText(value[key]))
      .filter(text => text.trim().length > 0);
    return textValues.join(' ');
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

async function fetchFromPubMed(endpoint: string, params: Record<string, string>) {
  const url = new URL(`${PUBMED_BASE_URL}/${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`PubMed API error: ${response.status}`);
  }

  return response.text();
}

function parseXmlToJson(xmlString: string) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_"
  });
  return parser.parse(xmlString);
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

      // Step 3: Parse XML and extract publication data
      const publications = [];
      const doc = parseXmlToJson(detailsResponse);
      const articleSet = doc?.PubmedArticleSet?.PubmedArticle || [];
      const articles = Array.isArray(articleSet) ? articleSet : [articleSet];

      for (const article of articles) {
        try {
          const pmid = article?.MedlineCitation?.PMID?.['#text'] || article?.MedlineCitation?.PMID || "";
          
          // Check if we already have this publication
          const existing = await storage.getPublicationByPmid(String(pmid));
          if (existing) continue;

          const title = normalizeXmlText(article?.MedlineCitation?.Article?.ArticleTitle) || "";
          const abstract = formatAbstract(article?.MedlineCitation?.Article?.Abstract?.AbstractText) || "";
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
      const { maxPerTerm = 50 } = req.body;
      
      // Check if sync is already running
      if (syncTracker.isRunning()) {
        return res.status(409).json({
          success: false,
          message: "Sync is already running. Please wait for it to complete.",
        });
      }
      
      // Start tracking
      syncTracker.start("full");
      console.log("Starting PubMed full sync (progressive mode - saves in batches)...");
      
      // Respond immediately
      res.json({
        success: true,
        message: "Full sync started. Poll /api/admin/sync-status for progress.",
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
              
              for (const pub of batch) {
                try {
                  // Check if publication already exists
                  const existing = await storage.getPublicationByPmid(pub.pmid || "");
                  if (existing) {
                    skipped++;
                    continue;
                  }
                  
                  await storage.createPublication(pub);
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
          
          console.log(`\nSync complete: ${imported} imported (${approved} approved, ${pending} pending for review), ${skipped} skipped out of ${result.totalUnique} unique fetched`);
          
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

  // Admin endpoint to incrementally sync new publications from PubMed (since last sync)
  app.post("/api/admin/sync-pubmed-incremental", async (req, res) => {
    try {
      const { maxPerTerm = 50 } = req.body;
      
      // Check if sync is already running
      if (syncTracker.isRunning()) {
        return res.status(409).json({
          success: false,
          message: "Sync is already running. Please wait for it to complete.",
        });
      }
      
      console.log("Starting incremental PubMed sync...");
      
      // Get the most recent publication date from the database
      const mostRecentDate = await storage.getMostRecentPublicationDate();
      
      if (!mostRecentDate) {
        return res.status(400).json({
          success: false,
          message: "No existing publications found. Please run a full sync first."
        });
      }
      
      // Start tracking
      syncTracker.start("incremental");
      syncTracker.updatePhase(`Syncing from ${mostRecentDate.toLocaleDateString()}...`);
      
      console.log(`Most recent publication date: ${mostRecentDate.toLocaleDateString()}`);
      
      // Respond immediately
      res.json({
        success: true,
        message: `Incremental sync started. Poll /api/admin/sync-status for progress.`,
        fromDate: mostRecentDate.toISOString()
      });
      
      // Run sync in background
      (async () => {
        let imported = 0;
        let skipped = 0;
        let approved = 0;
        let pending = 0;
        
        try {
          const publications = await pubmedService.syncIncrementalResearch(mostRecentDate, maxPerTerm);
          
          console.log(`Fetched ${publications.length} publications since ${mostRecentDate.toLocaleDateString()}, starting import...`);
          syncTracker.updatePhase("Importing publications...");
          syncTracker.updateProgress(0, publications.length);
          
          for (let i = 0; i < publications.length; i++) {
            const pub = publications[i];
            
            try {
              // Check if publication already exists
              const existing = await storage.getPublicationByPmid(pub.pmid || "");
              if (existing) {
                skipped++;
              } else {
                await storage.createPublication(pub);
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
                console.log(`Import progress: ${i + 1}/${publications.length} processed (${imported} imported, ${skipped} skipped)...`);
              }
            } catch (error) {
              console.error(`Error importing publication ${pub.pmid}:`, error);
            }
          }
          
          console.log(`Incremental sync complete: ${imported} imported (${approved} approved, ${pending} pending), ${skipped} skipped out of ${publications.length} total`);
          
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
      
      // Direct database query for pending publications (bypass approved filter)
      const { db } = await import("./db");
      const { publications } = await import("@shared/schema");
      const { eq, desc, sql } = await import("drizzle-orm");
      
      const pendingPubs = await db
        .select()
        .from(publications)
        .where(eq(publications.status, "pending"))
        .orderBy(desc(publications.publicationDate))
        .limit(limit)
        .offset(offset);
      
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(publications)
        .where(eq(publications.status, "pending"));
      
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

  // Admin endpoint to get publications by status (pending, approved, rejected)
  app.get("/api/admin/publications/:status", async (req, res) => {
    try {
      const { status } = req.params;
      const limit = parseInt(String(req.query.limit)) || 25;
      const offset = parseInt(String(req.query.offset)) || 0;
      
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
      const { eq, desc, sql } = await import("drizzle-orm");
      
      const pubs = await db
        .select()
        .from(publications)
        .where(eq(publications.status, status))
        .orderBy(desc(publications.publicationDate))
        .limit(limit)
        .offset(offset);
      
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(publications)
        .where(eq(publications.status, status));
      
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
      
      // Direct database query for featured publications
      const { db } = await import("./db");
      const { publications } = await import("@shared/schema");
      const { eq, desc, sql, and } = await import("drizzle-orm");
      
      const featuredPubs = await db
        .select()
        .from(publications)
        .where(and(
          eq(publications.isFeatured, 1),
          eq(publications.status, "approved")
        ))
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

      // Store suggestions in database
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

  // Get publications needing category review
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

  const httpServer = createServer(app);
  return httpServer;
}
