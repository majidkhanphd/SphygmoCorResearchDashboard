import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPublicationSchema, searchPublicationsSchema } from "@shared/schema";
import { z } from "zod";
import { XMLParser } from "fast-xml-parser";
import { pubmedService } from "./services/pubmed";

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
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch publication statistics" });
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
      
      console.log("Starting PubMed sync...");
      const publications = await pubmedService.syncCardiovascularResearch(maxPerTerm);
      
      let imported = 0;
      let skipped = 0;
      
      for (const pub of publications) {
        try {
          // Check if publication already exists
          const existing = await storage.getPublicationByPmid(pub.pmid || "");
          if (existing) {
            skipped++;
            continue;
          }
          
          await storage.createPublication(pub);
          imported++;
        } catch (error) {
          console.error(`Error importing publication ${pub.pmid}:`, error);
        }
      }
      
      console.log(`Sync complete: ${imported} imported, ${skipped} skipped`);
      
      res.json({
        success: true,
        imported,
        skipped,
        total: publications.length,
        message: `Successfully synced ${imported} new publications from PubMed (status: pending)`
      });
    } catch (error: any) {
      console.error("PubMed sync error:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to sync publications from PubMed", 
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
      // Direct database query for pending publications (bypass approved filter)
      const { db } = await import("./db");
      const { publications } = await import("@shared/schema");
      const { eq, desc } = await import("drizzle-orm");
      
      const pendingPubs = await db
        .select()
        .from(publications)
        .where(eq(publications.status, "pending"))
        .orderBy(desc(publications.publicationDate))
        .limit(1000);
      
      res.json({
        success: true,
        publications: pendingPubs,
        total: pendingPubs.length
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

  const httpServer = createServer(app);
  return httpServer;
}
