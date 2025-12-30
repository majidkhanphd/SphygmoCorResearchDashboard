import { XMLParser } from "fast-xml-parser";
import type { InsertPublication } from "@shared/schema";
import { PUBMED_SEARCH_TERMS, MAX_RESULTS_PER_TERM } from "../config/search-terms";
import { sanitizeText } from "@shared/sanitize";

// PMC Article structure (PubMed Central XML format)
interface PMCArticle {
  front: {
    "journal-meta"?: {
      "journal-title-group"?: {
        "journal-title": string | { "#text": string };
      };
      "journal-title"?: string | { "#text": string };
      "journal-id"?: Array<{ "@_journal-id-type": string; "#text": string }> | { "@_journal-id-type": string; "#text": string };
    };
    "article-meta": {
      "article-id": Array<{ "@_pub-id-type": string; "#text": string }> | { "@_pub-id-type": string; "#text": string };
      "title-group": {
        "article-title": string | { "#text": string } | Array<any>;
      };
      abstract?: {
        p?: string | string[] | Array<{ "#text": string }> | { "#text": string };
        sec?: Array<{
          title?: string;
          p?: string | string[] | Array<{ "#text": string }> | { "#text": string };
        }> | {
          title?: string;
          p?: string | string[] | Array<{ "#text": string }> | { "#text": string };
        };
        "#text"?: string;
      } | string;
      "contrib-group"?: {
        contrib: Array<{
          "@_contrib-type"?: string;
          name?: {
            surname?: string;
            "given-names"?: string;
          };
          "string-name"?: string | { "#text": string };
          collab?: string | { "#text": string };
        }> | {
          "@_contrib-type"?: string;
          name?: {
            surname?: string;
            "given-names"?: string;
          };
          "string-name"?: string | { "#text": string };
          collab?: string | { "#text": string };
        };
      } | Array<{
        contrib: any;
      }>;
      "pub-date"?: Array<{
        "@_pub-type"?: string;
        "@_date-type"?: string;
        year?: string | { "#text": string };
        month?: string | { "#text": string };
        day?: string | { "#text": string };
      }> | {
        "@_pub-type"?: string;
        "@_date-type"?: string;
        year?: string | { "#text": string };
        month?: string | { "#text": string };
        day?: string | { "#text": string };
      };
    };
  };
  "@_id"?: string; // PMC ID might be as an attribute
}

interface PubMedSearchResult {
  eSearchResult: {
    IdList: {
      Id: string[] | string;
    };
    Count: string;
  };
}

export class PubMedService {
  private baseUrl = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
  private parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    parseAttributeValue: false,
    trimValues: true,
  });

  // Use configurable search terms from config file
  private readonly cardiovascularTerms = PUBMED_SEARCH_TERMS;

  async searchPubMed(
    searchTerm: string, 
    maxResults: number = 100, 
    minDate?: string, 
    maxDate?: string
  ): Promise<string[]> {
    const query = encodeURIComponent(searchTerm);
    
    // Build URL with optional date filters
    let url = `${this.baseUrl}/esearch.fcgi?db=pmc&term=${query}&retmax=${maxResults}&retmode=xml`;
    
    if (minDate && maxDate) {
      // Use pdat (publication date) instead of default entrez date
      url += `&datetype=pdat&mindate=${minDate}&maxdate=${maxDate}`;
    }

    try {
      const response = await fetch(url);
      const xmlText = await response.text();
      const result = this.parser.parse(xmlText) as PubMedSearchResult;

      if (!result.eSearchResult?.IdList?.Id) {
        return [];
      }

      // Handle both single ID (string) and multiple IDs (array)
      const ids = Array.isArray(result.eSearchResult.IdList.Id)
        ? result.eSearchResult.IdList.Id
        : [result.eSearchResult.IdList.Id];

      return ids;
    } catch (error) {
      console.error(`Error searching PubMed for "${searchTerm}":`, error);
      return [];
    }
  }

  async fetchArticleDetails(pmcids: string[]): Promise<InsertPublication[]> {
    if (pmcids.length === 0) return [];

    // Batch requests to respect PubMed's recommended limit of 200 IDs per request
    const BATCH_SIZE = 200;
    const allPublications: InsertPublication[] = [];

    for (let i = 0; i < pmcids.length; i += BATCH_SIZE) {
      const batch = pmcids.slice(i, i + BATCH_SIZE);
      const ids = batch.join(",");
      // Use PubMed Central (pmc) database
      const url = `${this.baseUrl}/efetch.fcgi?db=pmc&id=${ids}&retmode=xml`;

      try {
        const response = await fetch(url);
        const xmlText = await response.text();
        const result = this.parser.parse(xmlText);

        // PMC returns articles in a <pmc-articleset> root element
        const articles = result["pmc-articleset"]?.article || result.article;
        if (articles) {
          const articleArray = Array.isArray(articles) ? articles : [articles];
          const publications = articleArray
            .map((article: PMCArticle) => this.parseArticle(article))
            .filter(Boolean) as InsertPublication[];
          allPublications.push(...publications);
        }

        // Add delay between batch requests to respect rate limits (350ms)
        if (i + BATCH_SIZE < pmcids.length) {
          await new Promise(resolve => setTimeout(resolve, 350));
        }
      } catch (error) {
        console.error(`Error fetching PMC batch ${i}-${i + batch.length}:`, error);
      }
    }

    return allPublications;
  }

  private parseArticle(article: PMCArticle): InsertPublication | null {
    try {
      // Check if article has the expected structure
      if (!article.front?.["article-meta"]) {
        console.error("Article missing required front/article-meta structure");
        return null;
      }

      const articleMeta = article.front["article-meta"];
      const journalMeta = article.front["journal-meta"];

      // Parse PMC ID (the PMC accession number like "1234567")
      const pmcIdNumeric = this.parsePmcId(articleMeta["article-id"], article["@_id"]);
      
      // Parse actual PMID (PubMed ID like "12345678")
      const actualPmid = this.parseActualPmid(articleMeta["article-id"]);
      
      // Parse DOI
      const doi = this.parseDoi(articleMeta["article-id"]);
      
      // Require at least PMC ID or DOI
      if (!pmcIdNumeric && !doi) {
        console.error("Article has neither PMC ID nor DOI - skipping");
        return null;
      }

      // Parse title (use placeholder if missing)
      const rawTitle = this.parseTitle(articleMeta["title-group"]) || "Untitled Publication";
      const title = sanitizeText(rawTitle);

      // Parse authors (use placeholder if missing)
      const rawAuthors = this.parseAuthors(articleMeta["contrib-group"]);
      const authors = sanitizeText(rawAuthors);

      // Parse journal (use placeholder if missing)
      const rawJournal = this.parseJournal(journalMeta);
      const journal = sanitizeText(rawJournal);

      // Parse abstract (can be null)
      const rawAbstract = this.parseAbstract(articleMeta.abstract);
      const abstract = rawAbstract ? sanitizeText(rawAbstract) : null;

      // Parse publication date
      const publicationDate = this.parsePublicationDate(articleMeta["pub-date"]);

      // Determine categories based on title/abstract
      const categoriesFromText = this.categorizeToCONNEQTAreas(title, abstract);

      // Extract keywords from title and abstract
      const keywords = this.extractKeywords(title, abstract);

      // Determine if article is complete for auto-approval
      // Mark as pending if missing title OR authors (user needs to review)
      const isComplete = title !== "Untitled Publication" && authors !== "Unknown";
      const status = isComplete ? "approved" : "pending";

      if (!isComplete) {
        console.log(`Article PMC${pmcIdNumeric || ''} / PMID:${actualPmid || 'none'} marked as pending (missing: ${title === "Untitled Publication" ? "title" : ""} ${authors === "Unknown" ? "authors" : ""})`);
      }

      // Use actual PMID if available, otherwise use PMC ID or DOI as fallback
      const pmidForStorage = actualPmid || pmcIdNumeric || doi!;

      return {
        pmid: pmidForStorage,
        pmcId: pmcIdNumeric ? `PMC${pmcIdNumeric}` : null, // Store full PMC ID with prefix
        title,
        authors,
        journal,
        publicationDate,
        abstract,
        doi,
        categories: categoriesFromText,
        keywords,
        citationCount: 0,
        isFeatured: 0,
        pubmedUrl: actualPmid 
          ? `https://pubmed.ncbi.nlm.nih.gov/${actualPmid}/`
          : pmcIdNumeric 
            ? `https://www.ncbi.nlm.nih.gov/pmc/articles/PMC${pmcIdNumeric}/` 
            : `https://doi.org/${doi}`,
        journalImpactFactor: null,
        status,
      };
    } catch (error) {
      console.error("Error parsing PMC article:", error);
      return null;
    }
  }

  // Parse the actual PubMed ID from article-id elements
  private parseActualPmid(articleIds: any): string | null {
    if (!articleIds) return null;

    const idArray = Array.isArray(articleIds) ? articleIds : [articleIds];
    
    // Look for actual PMID specifically (pub-id-type="pmid")
    const pmidObj = idArray.find((id: any) => id["@_pub-id-type"] === "pmid");

    if (pmidObj) {
      const idText = pmidObj["#text"] || pmidObj;
      return String(idText);
    }

    return null;
  }

  private parsePmcId(articleIds: any, attributeId?: string): string | null {
    // First try to get from article attribute
    if (attributeId) {
      // Remove "PMC" prefix if present
      return attributeId.replace(/^PMC/i, "");
    }

    // Then try to get from article-id elements
    if (!articleIds) return null;

    const idArray = Array.isArray(articleIds) ? articleIds : [articleIds];
    
    // Look for PMC ID specifically
    const pmcIdObj = idArray.find((id: any) => 
      id["@_pub-id-type"] === "pmc" || 
      id["@_pub-id-type"] === "pmcid"
    );

    if (pmcIdObj) {
      const idText = pmcIdObj["#text"] || pmcIdObj;
      // Remove "PMC" prefix if present
      return String(idText).replace(/^PMC/i, "");
    }

    // Fallback: use any available ID
    const firstId = idArray[0];
    if (firstId) {
      const idText = firstId["#text"] || firstId;
      return String(idText).replace(/^PMC/i, "");
    }

    return null;
  }

  private parseTitle(titleGroup: any): string | null {
    if (!titleGroup?.["article-title"]) return null;

    const articleTitle = titleGroup["article-title"];
    
    // Handle string
    if (typeof articleTitle === "string") {
      return articleTitle;
    }

    // Handle object with #text
    if (articleTitle["#text"]) {
      return articleTitle["#text"];
    }

    // Handle array (complex title with formatting)
    if (Array.isArray(articleTitle)) {
      return articleTitle
        .map((part: any) => (typeof part === "string" ? part : part["#text"] || ""))
        .join("")
        .trim();
    }

    return String(articleTitle);
  }

  private parseAuthors(contribGroup?: any): string {
    if (!contribGroup) return "Unknown";

    // Handle array of contrib-group elements
    let contribs;
    if (Array.isArray(contribGroup)) {
      // Flatten all contrib elements from multiple contrib-groups
      contribs = contribGroup.flatMap(group => group.contrib || []);
    } else {
      contribs = contribGroup.contrib;
    }

    if (!contribs) return "Unknown";

    const authors = Array.isArray(contribs) ? contribs : [contribs];

    // Filter for authors only (not editors, etc.)
    const authorNames = authors
      .filter((contrib: any) => !contrib["@_contrib-type"] || contrib["@_contrib-type"] === "author")
      .map((author: any) => {
        // Check for name element (structured name)
        if (author.name) {
          const surname = this.extractText(author.name.surname) || "";
          const givenNames = this.extractText(author.name["given-names"]) || "";
          if (surname) {
            // Extract first initial from given names
            const firstInitial = givenNames.trim().charAt(0);
            return firstInitial ? `${surname} ${firstInitial}` : surname;
          }
        }
        
        // Check for string-name (unstructured name)
        if (author["string-name"]) {
          const stringName = author["string-name"];
          return typeof stringName === "string" ? stringName : stringName["#text"] || "";
        }
        
        // Check for collab (collaboration/group author)
        if (author.collab) {
          const collab = author.collab;
          return typeof collab === "string" ? collab : collab["#text"] || "";
        }
        
        return "";
      })
      .filter(Boolean);

    if (authorNames.length === 0) return "Unknown";
    
    // Return full comma-separated author list
    return authorNames.join(', ');
  }

  private parseJournal(journalMeta?: any): string {
    if (!journalMeta) return "Unknown Journal";

    // Try journal-title-group first
    if (journalMeta["journal-title-group"]) {
      const titleGroup = journalMeta["journal-title-group"];
      if (titleGroup["journal-title"]) {
        const title = titleGroup["journal-title"];
        return typeof title === "string" ? title : title["#text"] || "Unknown Journal";
      }
    }

    // Try direct journal-title
    if (journalMeta["journal-title"]) {
      const title = journalMeta["journal-title"];
      return typeof title === "string" ? title : title["#text"] || "Unknown Journal";
    }

    // Try journal-id as fallback
    if (journalMeta["journal-id"]) {
      const journalIds = Array.isArray(journalMeta["journal-id"]) 
        ? journalMeta["journal-id"] 
        : [journalMeta["journal-id"]];
      
      const journalId = journalIds.find((id: any) => 
        id["@_journal-id-type"] === "nlm-ta" || 
        id["@_journal-id-type"] === "iso-abbrev"
      ) || journalIds[0];
      
      if (journalId) {
        return journalId["#text"] || "Unknown Journal";
      }
    }

    return "Unknown Journal";
  }

  private parseAbstract(abstractData?: any): string | null {
    if (!abstractData) return null;

    // Handle array of abstract elements (multiple <abstract> tags in XML)
    // This happens when article has both regular abstract and graphical abstract
    if (Array.isArray(abstractData)) {
      // Prefer non-graphical abstract (regular text abstract)
      const regularAbstract = abstractData.find((abs: any) => 
        !abs["@_abstract-type"] || abs["@_abstract-type"] === "summary"
      );
      // Fall back to first abstract if no regular one found
      const abstractToUse = regularAbstract || abstractData[0];
      return this.parseSingleAbstract(abstractToUse);
    }

    return this.parseSingleAbstract(abstractData);
  }

  private parseSingleAbstract(abstractData: any): string | null {
    if (!abstractData) return null;

    // Skip graphical abstracts - they typically don't have useful text
    if (abstractData["@_abstract-type"] === "graphical") {
      return null;
    }

    // Handle string abstract
    if (typeof abstractData === "string") {
      return abstractData;
    }

    // Handle abstract with #text
    if (abstractData["#text"]) {
      return abstractData["#text"];
    }

    // Handle abstract with paragraphs
    if (abstractData.p) {
      const paragraphs = Array.isArray(abstractData.p) ? abstractData.p : [abstractData.p];
      const text = paragraphs
        .map((p: any) => this.extractParagraphText(p))
        .filter(Boolean)
        .join(" ");
      if (text.trim()) return text;
    }

    // Handle abstract with sections (structured abstracts: Background, Methods, Results, etc.)
    if (abstractData.sec) {
      const sections = Array.isArray(abstractData.sec) ? abstractData.sec : [abstractData.sec];
      const text = sections
        .map((sec: any) => {
          const title = sec.title ? `${this.extractText(sec.title) || sec.title}: ` : "";
          let content = "";
          
          if (sec.p) {
            const paragraphs = Array.isArray(sec.p) ? sec.p : [sec.p];
            content = paragraphs
              .map((p: any) => this.extractParagraphText(p))
              .join(" ");
          }
          
          return title + content;
        })
        .filter(Boolean)
        .join(" ");
      if (text.trim()) return text;
    }

    // Handle abstract with title element containing text
    if (abstractData.title) {
      const titleText = this.extractText(abstractData.title);
      if (titleText && titleText.length > 50) {
        return titleText;
      }
    }

    return null;
  }

  private extractParagraphText(p: any): string {
    if (typeof p === "string") return p;
    if (p["#text"]) return p["#text"];
    
    // Handle complex paragraph with mixed content (text + inline elements)
    // The parser may create an object with multiple keys for inline formatting
    const textParts: string[] = [];
    
    // Check for direct text content
    if (typeof p === "object") {
      // Collect all text-like values from the paragraph object
      for (const key of Object.keys(p)) {
        if (key === "#text") {
          textParts.push(p[key]);
        } else if (!key.startsWith("@_")) {
          // Handle inline elements like <italic>, <bold>, <xref>, etc.
          const value = p[key];
          if (typeof value === "string") {
            textParts.push(value);
          } else if (value && typeof value === "object") {
            if (value["#text"]) {
              textParts.push(value["#text"]);
            } else if (Array.isArray(value)) {
              value.forEach((v: any) => {
                if (typeof v === "string") textParts.push(v);
                else if (v["#text"]) textParts.push(v["#text"]);
              });
            }
          }
        }
      }
    }
    
    return textParts.join(" ").trim();
  }

  private parsePublicationDate(pubDates?: any): Date {
    if (!pubDates) return new Date();

    const dates = Array.isArray(pubDates) ? pubDates : [pubDates];
    
    // Prefer epub or ppub date types
    const preferredDate = dates.find((date: any) => 
      date["@_pub-type"] === "epub" || 
      date["@_pub-type"] === "ppub" ||
      date["@_date-type"] === "pub"
    ) || dates[0];

    if (preferredDate) {
      const year = this.extractText(preferredDate.year);
      const month = this.extractText(preferredDate.month);
      const day = this.extractText(preferredDate.day);

      if (year) {
        const yearNum = parseInt(year);
        const monthNum = month ? this.parseMonth(month) : 0;
        const dayNum = day ? parseInt(day) : 1;
        return new Date(yearNum, monthNum, dayNum);
      }
    }

    return new Date();
  }

  private extractText(value: any): string | null {
    if (!value) return null;
    if (typeof value === "string") return value;
    if (value["#text"]) return value["#text"];
    return String(value);
  }

  private parseMonth(month: string): number {
    // Handle numeric months
    const monthNum = parseInt(month);
    if (!isNaN(monthNum)) {
      return monthNum - 1; // Convert to 0-based
    }

    // Handle text months
    const months: Record<string, number> = {
      Jan: 0, January: 0,
      Feb: 1, February: 1,
      Mar: 2, March: 2,
      Apr: 3, April: 3,
      May: 4,
      Jun: 5, June: 5,
      Jul: 6, July: 6,
      Aug: 7, August: 7,
      Sep: 8, September: 8,
      Oct: 9, October: 9,
      Nov: 10, November: 10,
      Dec: 11, December: 11,
    };
    
    return months[month] ?? 0;
  }

  private parseDoi(articleIds?: any): string | null {
    if (!articleIds) return null;

    const idArray = Array.isArray(articleIds) ? articleIds : [articleIds];
    const doiObj = idArray.find((id: any) => id["@_pub-id-type"] === "doi");
    
    if (doiObj) {
      return doiObj["#text"] || doiObj;
    }
    
    return null;
  }

  private categorizeToCONNEQTAreas(title: string, abstract: string | null): string[] {
    const text = `${title} ${abstract || ""}`.toLowerCase();
    const categories: string[] = [];

    // Map content to CONNEQT Health's 11 fixed research areas
    
    // Chronic Kidney Disease (CKD)
    if (text.includes("chronic kidney disease") || text.includes("renal") || text.includes("kidney")) {
      categories.push("ckd");
    }
    
    // Chronic Obstructive Pulmonary Disease (COPD)
    if (text.includes("copd") || text.includes("chronic obstructive pulmonary") || text.includes("respiratory") || text.includes("pulmonary")) {
      categories.push("copd");
    }
    
    // Early Vascular Aging (EVA)
    if (text.includes("vascular aging") || text.includes("arterial aging") || text.includes("early vascular") || 
        text.includes("arterial stiffness") || text.includes("pulse wave") || text.includes("vascular health")) {
      categories.push("eva");
    }
    
    // Heart Failure
    if (text.includes("heart failure") || text.includes("cardiac failure") || text.includes("hfpef") || text.includes("hfref")) {
      categories.push("heart-failure");
    }
    
    // Hypertension - includes cardiovascular and arterial stiffness terms
    if (text.includes("hypertension") || text.includes("blood pressure") || text.includes("hypertensive") || 
        text.includes("arterial stiffness") || text.includes("pulse wave") || text.includes("cardiovascular") ||
        text.includes("vascular function") || text.includes("arterial compliance") || text.includes("hemodynamic")) {
      categories.push("hypertension");
    }
    
    // Longevity - more flexible matching with "age", "aged", "aging"
    if (text.includes("longevity") || text.includes("aging") || text.includes("lifespan") || 
        text.match(/\bage\b/) || text.match(/\baged\b/) || text.includes("biological age")) {
      categories.push("longevity");
    }
    
    // Maternal Health
    if (text.includes("pregnancy") || text.includes("maternal") || text.includes("obstetric") || 
        text.includes("prenatal") || text.includes("gestational")) {
      categories.push("maternal-health");
    }
    
    // Men's Health
    if (text.includes("men's health") || text.match(/\bmen\b/) || text.includes("male") || 
        text.includes("prostate") || text.includes("testosterone")) {
      categories.push("mens-health");
    }
    
    // Metabolic Health - includes statins and lipid management
    if (text.includes("metabolic") || text.includes("diabetes") || text.includes("obesity") || 
        text.includes("insulin") || text.includes("statin") || text.includes("cholesterol") || 
        text.includes("lipid") || text.includes("glucose") || text.includes("glycemic")) {
      categories.push("metabolic-health");
    }
    
    // Neuroscience
    if (text.includes("neuro") || text.includes("brain") || text.includes("cognitive") || 
        text.includes("stroke") || text.includes("dementia") || text.includes("alzheimer")) {
      categories.push("neuroscience");
    }
    
    // Women's Health - more flexible matching with "women", "woman"
    if (text.includes("women's health") || text.match(/\bwomen\b/) || text.match(/\bwoman\b/) || 
        text.includes("female") || text.includes("menopause") || text.includes("ovarian")) {
      categories.push("womens-health");
    }

    // Return empty array if no categories matched (will need manual categorization)
    return categories;
  }

  private extractKeywords(title: string, abstract: string | null): string[] {
    const text = `${title} ${abstract || ""}`.toLowerCase();
    const keywords: string[] = [];

    const keywordTerms = [
      "arterial stiffness",
      "pulse wave velocity",
      "pulse wave analysis",
      "central blood pressure",
      "augmentation index",
      "sphygmocor",
      "hypertension",
      "cardiovascular",
      "vascular aging",
      "hemodynamic",
      "aortic pressure",
      "arterial compliance"
    ];

    keywordTerms.forEach((term) => {
      if (text.includes(term)) {
        keywords.push(term);
      }
    });

    return Array.from(new Set(keywords)); // Remove duplicates
  }

  async syncCardiovascularResearch(maxPerTerm: number = MAX_RESULTS_PER_TERM): Promise<InsertPublication[]> {
    console.log("Starting PMC sync for SphygmoCor research...");
    const allPublications: InsertPublication[] = [];

    // Search in 5-year chunks from 2000 to present to capture all historical publications
    const currentYear = new Date().getFullYear();
    const yearRanges: Array<{ start: number; end: number }> = [];
    
    for (let year = 2000; year <= currentYear; year += 5) {
      yearRanges.push({
        start: year,
        end: Math.min(year + 4, currentYear)
      });
    }

    for (const term of this.cardiovascularTerms) {
      console.log(`\nSearching PMC for: ${term}`);
      
      // Search each year range
      for (const range of yearRanges) {
        const minDate = `${range.start}/01/01`;
        const maxDate = `${range.end}/12/31`;
        
        console.log(`  Searching ${range.start}-${range.end}...`);
        const pmcIds = await this.searchPubMed(term, maxPerTerm, minDate, maxDate);
        console.log(`  Found ${pmcIds.length} articles for ${range.start}-${range.end}`);

        if (pmcIds.length > 0) {
          const publications = await this.fetchArticleDetails(pmcIds);
          allPublications.push(...publications);
        }

        // Add delay to respect PubMed rate limits (3 requests per second)
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    }

    // Remove duplicates based on PMC ID (stored in pmid field)
    const uniquePublications = this.removeDuplicates(allPublications);
    console.log(`\nSync complete. Found ${uniquePublications.length} unique publications`);

    return uniquePublications;
  }

  // Progressive sync that saves articles in batches as they're fetched
  async syncCardiovascularResearchProgressive(
    maxPerTerm: number = MAX_RESULTS_PER_TERM,
    onBatchFetched?: (batch: InsertPublication[], phase: string, batchIndex: number, totalBatches: number) => Promise<void>
  ): Promise<{ totalFetched: number; totalUnique: number }> {
    console.log("Starting PMC sync for SphygmoCor research (progressive mode)...");
    const seenIds = new Set<string>();
    let totalFetched = 0;

    // Search in 5-year chunks from 2000 to present to capture all historical publications
    const currentYear = new Date().getFullYear();
    const yearRanges: Array<{ start: number; end: number }> = [];
    
    for (let year = 2000; year <= currentYear; year += 5) {
      yearRanges.push({
        start: year,
        end: Math.min(year + 4, currentYear)
      });
    }

    const totalBatches = yearRanges.length * this.cardiovascularTerms.length;
    let batchIndex = 0;

    for (const term of this.cardiovascularTerms) {
      console.log(`\nSearching PMC for: ${term}`);
      
      // Search each year range
      for (const range of yearRanges) {
        batchIndex++;
        const minDate = `${range.start}/01/01`;
        const maxDate = `${range.end}/12/31`;
        const phase = `Syncing ${range.start}-${range.end}`;
        
        console.log(`  Searching ${range.start}-${range.end}...`);
        const pmcIds = await this.searchPubMed(term, maxPerTerm, minDate, maxDate);
        console.log(`  Found ${pmcIds.length} articles for ${range.start}-${range.end}`);

        if (pmcIds.length > 0) {
          const publications = await this.fetchArticleDetails(pmcIds);
          
          // Remove duplicates within this batch
          const uniqueBatch: InsertPublication[] = [];
          for (const pub of publications) {
            if (pub.pmid && !seenIds.has(pub.pmid)) {
              seenIds.add(pub.pmid);
              uniqueBatch.push(pub);
            }
          }
          
          totalFetched += uniqueBatch.length;
          
          // Call the batch callback to save immediately if provided
          if (onBatchFetched) {
            await onBatchFetched(uniqueBatch, phase, batchIndex, totalBatches);
          }
        } else if (onBatchFetched) {
          // Call callback even with empty batch to update progress
          await onBatchFetched([], phase, batchIndex, totalBatches);
        }

        // Add delay to respect PubMed rate limits (3 requests per second)
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    }

    console.log(`\nProgressive sync complete. Fetched ${seenIds.size} unique publications`);

    return {
      totalFetched,
      totalUnique: seenIds.size
    };
  }

  async syncIncrementalResearch(fromDate: Date, maxPerTerm: number = MAX_RESULTS_PER_TERM): Promise<InsertPublication[]> {
    console.log(`Starting incremental PMC sync from ${fromDate.toLocaleDateString()}...`);
    const allPublications: InsertPublication[] = [];

    // Format dates for PubMed API (YYYY/MM/DD)
    const minDate = `${fromDate.getFullYear()}/${String(fromDate.getMonth() + 1).padStart(2, '0')}/${String(fromDate.getDate()).padStart(2, '0')}`;
    const today = new Date();
    const maxDate = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;

    console.log(`Date range: ${minDate} to ${maxDate}`);

    for (const term of this.cardiovascularTerms) {
      console.log(`\nSearching PMC for: ${term}`);
      
      const pmcIds = await this.searchPubMed(term, maxPerTerm, minDate, maxDate);
      console.log(`  Found ${pmcIds.length} articles`);

      if (pmcIds.length > 0) {
        const publications = await this.fetchArticleDetails(pmcIds);
        allPublications.push(...publications);
      }

      // Add delay to respect PubMed rate limits
      await new Promise((resolve) => setTimeout(resolve, 350));
    }

    // Remove duplicates based on PMC ID
    const uniquePublications = this.removeDuplicates(allPublications);
    console.log(`\nIncremental sync complete. Found ${uniquePublications.length} unique new publications`);

    return uniquePublications;
  }

  private removeDuplicates(publications: InsertPublication[]): InsertPublication[] {
    const seen = new Set<string>();
    const unique: InsertPublication[] = [];

    for (const pub of publications) {
      if (pub.pmid && !seen.has(pub.pmid)) {
        seen.add(pub.pmid);
        unique.push(pub);
      }
    }

    return unique;
  }

  // Get ALL PMC IDs from PMC using pagination (for comparison with database)
  async getAllPmcIdsFromPmc(searchTerms?: string[]): Promise<{ ids: string[]; totalCount: number }> {
    const terms = searchTerms || this.cardiovascularTerms;
    const allIds = new Set<string>();
    let totalCount = 0;

    for (const term of terms) {
      console.log(`Querying PMC for total count: ${term}`);
      
      // First, get the total count
      const countUrl = `${this.baseUrl}/esearch.fcgi?db=pmc&term=${encodeURIComponent(term)}&retmax=0&retmode=xml`;
      try {
        const countResponse = await fetch(countUrl);
        const countXml = await countResponse.text();
        const countResult = this.parser.parse(countXml) as PubMedSearchResult;
        const termCount = parseInt(countResult.eSearchResult?.Count || '0', 10);
        totalCount = Math.max(totalCount, termCount);
        
        console.log(`  Total available in PMC: ${termCount}`);
        
        // Fetch all IDs with pagination
        const batchSize = 1000;
        for (let retstart = 0; retstart < termCount; retstart += batchSize) {
          const url = `${this.baseUrl}/esearch.fcgi?db=pmc&term=${encodeURIComponent(term)}&retmax=${batchSize}&retstart=${retstart}&retmode=xml`;
          const response = await fetch(url);
          const xmlText = await response.text();
          const result = this.parser.parse(xmlText) as PubMedSearchResult;
          
          if (result.eSearchResult?.IdList?.Id) {
            const ids = Array.isArray(result.eSearchResult.IdList.Id)
              ? result.eSearchResult.IdList.Id
              : [result.eSearchResult.IdList.Id];
            ids.forEach(id => allIds.add(id));
          }
          
          // Rate limit
          await new Promise(resolve => setTimeout(resolve, 350));
        }
      } catch (error) {
        console.error(`Error getting PMC count for "${term}":`, error);
      }
    }

    return { ids: Array.from(allIds), totalCount };
  }

  // Get ALL PMIDs from PubMed (not PMC) for accurate comparison with database
  async getAllPmidsFromPubMed(searchTerms?: string[]): Promise<{ ids: string[]; totalCount: number }> {
    const terms = searchTerms || ['sphygmocor'];
    const allIds = new Set<string>();
    let totalCount = 0;

    for (const term of terms) {
      console.log(`Querying PubMed for total count: ${term}`);
      
      // First, get the total count - using db=pubmed (not pmc)
      const countUrl = `${this.baseUrl}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(term)}&retmax=0&retmode=xml`;
      try {
        const countResponse = await fetch(countUrl);
        const countXml = await countResponse.text();
        const countResult = this.parser.parse(countXml) as PubMedSearchResult;
        const termCount = parseInt(countResult.eSearchResult?.Count || '0', 10);
        totalCount = Math.max(totalCount, termCount);
        
        console.log(`  Total available in PubMed: ${termCount}`);
        
        // Fetch all IDs with pagination
        const batchSize = 1000;
        for (let retstart = 0; retstart < termCount; retstart += batchSize) {
          const url = `${this.baseUrl}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(term)}&retmax=${batchSize}&retstart=${retstart}&retmode=xml`;
          const response = await fetch(url);
          const xmlText = await response.text();
          const result = this.parser.parse(xmlText) as PubMedSearchResult;
          
          if (result.eSearchResult?.IdList?.Id) {
            const ids = Array.isArray(result.eSearchResult.IdList.Id)
              ? result.eSearchResult.IdList.Id
              : [result.eSearchResult.IdList.Id];
            ids.forEach(id => allIds.add(String(id)));
          }
          
          // Rate limit
          await new Promise(resolve => setTimeout(resolve, 350));
        }
      } catch (error) {
        console.error(`Error getting PubMed count for "${term}":`, error);
      }
    }

    return { ids: Array.from(allIds), totalCount };
  }

  // Compare PMIDs with database and find missing ones (uses PubMed, not PMC)
  async findMissingPublications(databasePmids: Set<string>): Promise<{
    missingIds: string[];
    pmcTotal: number;
    dbTotal: number;
    matchCount: number;
  }> {
    // Use PubMed (PMIDs) for accurate comparison with database
    const { ids: pubmedIds, totalCount } = await this.getAllPmidsFromPubMed();
    
    // Find IDs in PubMed but not in database
    const missingIds = pubmedIds.filter(id => !databasePmids.has(String(id)));
    
    return {
      missingIds,
      pmcTotal: pubmedIds.length, // Keep field name for API compatibility
      dbTotal: databasePmids.size,
      matchCount: pubmedIds.length - missingIds.length
    };
  }

  // Fetch publication details from PubMed by PMID
  async fetchPublicationsByPmid(pmids: string[]): Promise<InsertPublication[]> {
    console.log(`Fetching ${pmids.length} publications from PubMed by PMID...`);
    const publications: InsertPublication[] = [];
    const batchSize = 100;

    for (let i = 0; i < pmids.length; i += batchSize) {
      const batch = pmids.slice(i, i + batchSize);
      const idsParam = batch.join(',');
      
      try {
        const url = `${this.baseUrl}/efetch.fcgi?db=pubmed&id=${idsParam}&retmode=xml`;
        const response = await fetch(url);
        const xmlText = await response.text();
        
        // Parse PubMed XML (different structure from PMC)
        const result = this.parser.parse(xmlText);
        const articles = result?.PubmedArticleSet?.PubmedArticle;
        
        if (articles) {
          const articleList = Array.isArray(articles) ? articles : [articles];
          
          for (const article of articleList) {
            try {
              const medlineCitation = article?.MedlineCitation;
              const articleData = medlineCitation?.Article;
              
              if (!articleData) continue;
              
              const pmid = String(medlineCitation?.PMID?.['#text'] || medlineCitation?.PMID || '');
              const title = sanitizeText(articleData?.ArticleTitle?.['#text'] || articleData?.ArticleTitle || '');
              
              // Extract abstract
              let abstract = '';
              const abstractData = articleData?.Abstract?.AbstractText;
              if (abstractData) {
                if (Array.isArray(abstractData)) {
                  abstract = abstractData.map((t: any) => sanitizeText(t?.['#text'] || t || '')).join(' ');
                } else {
                  abstract = sanitizeText(abstractData?.['#text'] || abstractData || '');
                }
              }
              
              // Extract authors (as comma-separated string per schema)
              const authorList = articleData?.AuthorList?.Author;
              const authorNames: string[] = [];
              if (authorList) {
                const authorArray = Array.isArray(authorList) ? authorList : [authorList];
                for (const author of authorArray) {
                  const lastName = author?.LastName || '';
                  const foreName = author?.ForeName || author?.Initials || '';
                  if (lastName) {
                    authorNames.push(`${lastName} ${foreName}`.trim());
                  }
                }
              }
              const authors = authorNames.join(', ');
              
              // Extract journal
              const journal = articleData?.Journal?.Title || articleData?.Journal?.ISOAbbreviation || '';
              
              // Extract publication date
              const pubDate = articleData?.Journal?.JournalIssue?.PubDate;
              let publicationDate: Date = new Date();
              if (pubDate) {
                const year = pubDate?.Year || new Date().getFullYear().toString();
                const month = pubDate?.Month || '01';
                const day = pubDate?.Day || '01';
                const monthNum = this.monthToNumber(month);
                const dayStr = String(day).padStart(2, '0');
                publicationDate = new Date(`${year}-${monthNum}-${dayStr}`);
              }
              
              // Extract DOI
              const articleIdList = article?.PubmedData?.ArticleIdList?.ArticleId;
              let doi = '';
              if (articleIdList) {
                const idArray = Array.isArray(articleIdList) ? articleIdList : [articleIdList];
                for (const id of idArray) {
                  if (id?.['@_IdType'] === 'doi') {
                    doi = id?.['#text'] || id || '';
                    break;
                  }
                }
              }
              
              if (pmid && title) {
                publications.push({
                  pmid,
                  title,
                  authors,
                  journal,
                  abstract,
                  doi,
                  publicationDate,
                  keywords: this.extractKeywords(title, abstract),
                  citationCount: 0,
                  status: 'pending',
                  isFeatured: 0,
                  categories: [],
                  suggestedCategories: [],
                  categoryReviewStatus: 'pending',
                  pubmedUrl: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
                });
              }
            } catch (parseError) {
              console.error(`Error parsing PubMed article:`, parseError);
            }
          }
        }
        
        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 350));
      } catch (error) {
        console.error(`Error fetching PubMed batch:`, error);
      }
    }

    return publications;
  }

  private monthToNumber(month: string): string {
    const months: { [key: string]: string } = {
      'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
      'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
      'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
    };
    return months[month] || String(month).padStart(2, '0');
  }

  // Fetch and return publications for specific PMC IDs (for syncing missing ones)
  async fetchMissingPublications(pmcIds: string[]): Promise<InsertPublication[]> {
    console.log(`Fetching ${pmcIds.length} missing publications from PMC...`);
    return this.fetchArticleDetails(pmcIds);
  }

  // Get all PMCIDs from PMC search with full pagination
  private async getAllPmcIdsFromSearch(term: string, searchName: string): Promise<{ ids: Set<string>; total: number }> {
    const allIds = new Set<string>();
    
    console.log(`Querying PMC with ${searchName}: ${term}`);
    
    // First get the total count
    const countUrl = `${this.baseUrl}/esearch.fcgi?db=pmc&term=${encodeURIComponent(term)}&retmax=0&retmode=xml`;
    let totalCount = 0;
    
    try {
      const countResponse = await fetch(countUrl);
      const countXml = await countResponse.text();
      const countResult = this.parser.parse(countXml) as PubMedSearchResult;
      totalCount = parseInt(countResult.eSearchResult?.Count || '0', 10);
      console.log(`  ${searchName} total: ${totalCount}`);
    } catch (error) {
      console.error(`Error getting ${searchName} count:`, error);
      return { ids: allIds, total: 0 };
    }
    
    // Paginate through all results
    const batchSize = 500; // Smaller batch for reliability
    let batchNum = 0;
    
    for (let retstart = 0; retstart < totalCount; retstart += batchSize) {
      batchNum++;
      try {
        const url = `${this.baseUrl}/esearch.fcgi?db=pmc&term=${encodeURIComponent(term)}&retmax=${batchSize}&retstart=${retstart}&retmode=xml`;
        const response = await fetch(url);
        
        if (!response.ok) {
          console.error(`  Batch ${batchNum}: HTTP ${response.status}`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Longer wait on error
          continue;
        }
        
        const xmlText = await response.text();
        const result = this.parser.parse(xmlText) as PubMedSearchResult;
        
        if (result.eSearchResult?.IdList?.Id) {
          const ids = Array.isArray(result.eSearchResult.IdList.Id)
            ? result.eSearchResult.IdList.Id
            : [result.eSearchResult.IdList.Id];
          ids.forEach(id => allIds.add(String(id)));
        }
        
        // Log progress every 5 batches
        if (batchNum % 5 === 0) {
          console.log(`  ${searchName}: fetched ${allIds.size}/${totalCount} (batch ${batchNum})`);
        }
        
        // Rate limit - 350ms between requests
        await new Promise(resolve => setTimeout(resolve, 350));
      } catch (error) {
        console.error(`  ${searchName} batch ${batchNum} error:`, error);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Longer wait on error
      }
    }
    
    console.log(`  ${searchName}: completed with ${allIds.size} PMCIDs`);
    return { ids: allIds, total: totalCount };
  }

  // Get all PMCIDs from PMC using body search (matches website "sphygmocor"[body])
  async getAllPmcIdsFromBodySearch(): Promise<Set<string>> {
    const result = await this.getAllPmcIdsFromSearch('"sphygmocor"[body]', 'body search');
    return result.ids;
  }

  // Get all PMCIDs from PMC using all-fields search (includes embargoed + metadata-only)
  async getAllPmcIdsFromAllFieldsSearch(): Promise<Set<string>> {
    const result = await this.getAllPmcIdsFromSearch('sphygmocor', 'all-fields search');
    return result.ids;
  }

  // Convert PMCIDs to PMIDs using the ID converter API
  async convertPmcIdsToPmids(pmcIds: string[]): Promise<Map<string, string>> {
    const pmcidToPmid = new Map<string, string>();
    const batchSize = 100; // API accepts up to 200, use 100 for safety
    
    console.log(`Converting ${pmcIds.length} PMCIDs to PMIDs...`);
    
    for (let i = 0; i < pmcIds.length; i += batchSize) {
      const batch = pmcIds.slice(i, i + batchSize);
      const idsParam = batch.map(id => `PMC${id}`).join(',');
      
      try {
        const url = `https://pmc.ncbi.nlm.nih.gov/tools/idconv/api/v1/articles/?ids=${idsParam}&format=json`;
        const response = await fetch(url);
        const data = await response.json() as any;
        
        if (data.status === 'ok' && data.records) {
          for (const record of data.records) {
            if (record.pmcid && record.pmid) {
              // Extract numeric PMCID (remove "PMC" prefix)
              const pmcidNumeric = String(record.pmcid).replace(/^PMC/, '');
              pmcidToPmid.set(pmcidNumeric, String(record.pmid));
            }
          }
        }
        
        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 350));
        
        if ((i + batchSize) % 500 === 0) {
          console.log(`  Converted ${Math.min(i + batchSize, pmcIds.length)}/${pmcIds.length} PMCIDs...`);
        }
      } catch (error) {
        console.error(`Error converting PMCIDs batch:`, error);
      }
    }
    
    console.log(`  Successfully converted ${pmcidToPmid.size} PMCIDs to PMIDs`);
    return pmcidToPmid;
  }

  // Find missing publications using PMC with classification (body vs metadata-only)
  async findMissingPublicationsFromPmc(databasePmids: Set<string>): Promise<{
    missingBodyPmids: string[];      // Articles in body search, not in DB (includes embargoed)
    missingMetadataOnlyPmids: string[]; // Articles only in all-fields, not in body (need review)
    pmcBodyTotal: number;
    pmcAllFieldsTotal: number;
    dbTotal: number;
    matchCount: number;
    pmcidToPmidMap: Map<string, string>;
  }> {
    console.log('Starting PMC comparison with dual-search classification...');
    
    // Step 1: Get both search results SEQUENTIALLY to avoid rate limiting
    console.log('Step 1: Fetching body search results...');
    const bodyPmcIds = await this.getAllPmcIdsFromBodySearch();
    
    console.log('Step 2: Fetching all-fields search results...');
    const allFieldsPmcIds = await this.getAllPmcIdsFromAllFieldsSearch();
    
    console.log(`  Body search: ${bodyPmcIds.size} PMCIDs`);
    console.log(`  All-fields search: ${allFieldsPmcIds.size} PMCIDs`);
    
    // Step 2: Identify metadata-only PMCIDs (in all-fields but not in body)
    const metadataOnlyPmcIds = new Set<string>();
    allFieldsPmcIds.forEach(id => {
      if (!bodyPmcIds.has(id)) {
        metadataOnlyPmcIds.add(id);
      }
    });
    console.log(`  Metadata-only articles: ${metadataOnlyPmcIds.size}`);
    
    // Step 3: Convert ALL PMCIDs to PMIDs
    const allPmcIds = Array.from(allFieldsPmcIds);
    const pmcidToPmid = await this.convertPmcIdsToPmids(allPmcIds);
    
    // Step 4: Find missing publications by comparing PMIDs with database
    const missingBodyPmids: string[] = [];
    const missingMetadataOnlyPmids: string[] = [];
    let matchCount = 0;
    
    const entries = Array.from(pmcidToPmid.entries());
    for (const entry of entries) {
      const pmcid = entry[0];
      const pmid = entry[1];
      if (databasePmids.has(pmid)) {
        matchCount++;
      } else {
        // Classify as body or metadata-only
        if (bodyPmcIds.has(pmcid)) {
          missingBodyPmids.push(pmid);
        } else {
          missingMetadataOnlyPmids.push(pmid);
        }
      }
    }
    
    console.log(`  Match count: ${matchCount}`);
    console.log(`  Missing (body): ${missingBodyPmids.length}`);
    console.log(`  Missing (metadata-only): ${missingMetadataOnlyPmids.length}`);
    
    return {
      missingBodyPmids,
      missingMetadataOnlyPmids,
      pmcBodyTotal: bodyPmcIds.size,
      pmcAllFieldsTotal: allFieldsPmcIds.size,
      dbTotal: databasePmids.size,
      matchCount,
      pmcidToPmidMap: pmcidToPmid
    };
  }

  // Fetch publications with heuristic classification
  async fetchPublicationsWithHeuristic(pmids: string[], isMetadataOnly: boolean): Promise<InsertPublication[]> {
    const publications = await this.fetchPublicationsByPmid(pmids);
    
    // Apply heuristic for metadata-only articles
    if (isMetadataOnly) {
      return publications.map(pub => {
        const titleLower = (pub.title || '').toLowerCase();
        const abstractLower = (pub.abstract || '').toLowerCase();
        const hasKeywordInContent = titleLower.includes('sphygmocor') || abstractLower.includes('sphygmocor');
        
        // If sphygmocor in title/abstract, it's likely embargoed - auto-approve
        // If not, it's likely a reference mention - flag for review
        return {
          ...pub,
          status: hasKeywordInContent ? 'pending' : 'pending-metadata-review'
        };
      });
    }
    
    return publications;
  }
}

export const pubmedService = new PubMedService();