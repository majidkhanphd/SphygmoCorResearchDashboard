import { XMLParser } from "fast-xml-parser";
import type { InsertPublication } from "@shared/schema";
import { PUBMED_SEARCH_TERMS, MAX_RESULTS_PER_TERM } from "../config/search-terms";

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

      // Parse PMC ID
      const pmcId = this.parsePmcId(articleMeta["article-id"], article["@_id"]);
      
      // Parse DOI
      const doi = this.parseDoi(articleMeta["article-id"]);
      
      // Require at least PMID or DOI
      if (!pmcId && !doi) {
        console.error("Article has neither PMC ID nor DOI - skipping");
        return null;
      }

      // Parse title (use placeholder if missing)
      const title = this.parseTitle(articleMeta["title-group"]) || "Untitled Publication";

      // Parse authors (use placeholder if missing)
      const authors = this.parseAuthors(articleMeta["contrib-group"]);

      // Parse journal (use placeholder if missing)
      const journal = this.parseJournal(journalMeta);

      // Parse abstract (can be null)
      const abstract = this.parseAbstract(articleMeta.abstract);

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
        console.log(`Article ${pmcId || doi} marked as pending (missing: ${title === "Untitled Publication" ? "title" : ""} ${authors === "Unknown" ? "authors" : ""})`);
      }

      return {
        pmid: pmcId || doi!, // Store PMC ID or DOI in the pmid field
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
        pubmedUrl: pmcId ? `https://www.ncbi.nlm.nih.gov/pmc/articles/PMC${pmcId}/` : `https://doi.org/${doi}`,
        journalImpactFactor: null,
        status,
      };
    } catch (error) {
      console.error("Error parsing PMC article:", error);
      return null;
    }
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
      return paragraphs
        .map((p: any) => {
          if (typeof p === "string") return p;
          if (p["#text"]) return p["#text"];
          return "";
        })
        .filter(Boolean)
        .join(" ");
    }

    // Handle abstract with sections
    if (abstractData.sec) {
      const sections = Array.isArray(abstractData.sec) ? abstractData.sec : [abstractData.sec];
      return sections
        .map((sec: any) => {
          const title = sec.title ? `${sec.title}: ` : "";
          let content = "";
          
          if (sec.p) {
            const paragraphs = Array.isArray(sec.p) ? sec.p : [sec.p];
            content = paragraphs
              .map((p: any) => (typeof p === "string" ? p : p["#text"] || ""))
              .join(" ");
          }
          
          return title + content;
        })
        .filter(Boolean)
        .join(" ");
    }

    return null;
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
}

export const pubmedService = new PubMedService();