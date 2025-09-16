import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPublicationSchema, searchPublicationsSchema } from "@shared/schema";
import { z } from "zod";
import { XMLParser } from "fast-xml-parser";

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

          const title = article?.MedlineCitation?.Article?.ArticleTitle || "";
          const abstract = article?.MedlineCitation?.Article?.Abstract?.AbstractText || "";
          const journal = article?.MedlineCitation?.Article?.Journal?.Title || "";
          
          // Extract authors
          const authorList = article?.MedlineCitation?.Article?.AuthorList?.Author || [];
          const authorsArray = Array.isArray(authorList) ? authorList : [authorList];
          const authors = authorsArray.map((author: any) => {
            const lastName = author?.LastName || "";
            const foreName = author?.ForeName || "";
            return `${foreName} ${lastName}`.trim();
          }).filter(name => name).join(", ");

          // Extract publication date
          const pubDate = article?.MedlineCitation?.Article?.Journal?.JournalIssue?.PubDate;
          const year = pubDate?.Year || new Date().getFullYear().toString();
          const month = pubDate?.Month || "1";
          const day = pubDate?.Day || "1";
          
          const publicationDate = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);

          // Extract DOI
          const eLocationIDs = article?.PubmedData?.ArticleIdList?.ArticleId || [];
          const eLocationArray = Array.isArray(eLocationIDs) ? eLocationIDs : [eLocationIDs];
          const doiObj = eLocationArray.find((id: any) => id?.['@_IdType'] === 'doi');
          const doi = doiObj?.['#text'] || doiObj || "";

          // Auto-categorize based on keywords and abstract
          const categories = await autoCategorizePublication(title, abstract);

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

  const httpServer = createServer(app);
  return httpServer;
}
