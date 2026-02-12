import { XMLParser } from "fast-xml-parser";
import type { InsertPublication } from "@shared/schema";
import { PUBMED_SEARCH_TERMS, MAX_RESULTS_PER_TERM } from "../config/search-terms";
import { sanitizeText } from "@shared/sanitize";

// Retry configuration for PubMed API calls
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

// Rate limit aware fetch with exponential backoff
async function fetchWithRetry(
  url: string, 
  options: { retries?: number; context?: string } = {}
): Promise<Response> {
  const { retries = RETRY_CONFIG.maxRetries, context = "PubMed API" } = options;
  let lastError: Error | null = null;
  let delay = RETRY_CONFIG.initialDelayMs;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
      
      // Check for rate limiting (429 Too Many Requests)
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : delay;
        console.warn(`[${context}] Rate limited (429). Waiting ${waitTime}ms before retry ${attempt}/${retries}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        delay = Math.min(delay * RETRY_CONFIG.backoffMultiplier, RETRY_CONFIG.maxDelayMs);
        continue;
      }
      
      // Check for server errors (5xx) - these are transient
      if (response.status >= 500 && response.status < 600) {
        console.warn(`[${context}] Server error (${response.status}). Waiting ${delay}ms before retry ${attempt}/${retries}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * RETRY_CONFIG.backoffMultiplier, RETRY_CONFIG.maxDelayMs);
        continue;
      }
      
      // Success or client error (4xx except 429) - don't retry
      return response;
    } catch (error) {
      lastError = error as Error;
      console.warn(`[${context}] Network error on attempt ${attempt}/${retries}: ${lastError.message}`);
      
      if (attempt < retries) {
        console.log(`[${context}] Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * RETRY_CONFIG.backoffMultiplier, RETRY_CONFIG.maxDelayMs);
      }
    }
  }
  
  throw lastError || new Error(`Failed to fetch from ${context} after ${retries} retries`);
}

// Extract abstract text directly from raw XML to preserve order of mixed content
// This bypasses JSON parsing issues where Object.keys doesn't preserve element order
function extractAbstractFromRawXml(xmlString: string): string | null {
  // Find all abstract elements (there may be multiple - regular, graphical, etc.)
  // Prefer non-graphical abstract
  const abstractRegex = /<abstract(?:\s[^>]*)?>[\s\S]*?<\/abstract>/gi;
  const allAbstractMatches: string[] = [];
  let abstractMatch;
  while ((abstractMatch = abstractRegex.exec(xmlString)) !== null) {
    allAbstractMatches.push(abstractMatch[0]);
  }
  
  if (allAbstractMatches.length === 0) return null;
  
  // Find the best abstract (skip graphical abstracts)
  let abstractXml = '';
  for (const fullMatch of allAbstractMatches) {
    if (!fullMatch.includes('abstract-type="graphical"') && !fullMatch.includes('abstract-type="toc"')) {
      // Extract content between tags
      const contentMatch = fullMatch.match(/<abstract(?:\s[^>]*)?>([\s\S]*?)<\/abstract>/i);
      if (contentMatch) {
        abstractXml = contentMatch[1];
        break;
      }
    }
  }
  
  if (!abstractXml && allAbstractMatches.length > 0) {
    // Fallback to first abstract if none found
    const contentMatch = allAbstractMatches[0].match(/<abstract(?:\s[^>]*)?>([\s\S]*?)<\/abstract>/i);
    if (contentMatch) abstractXml = contentMatch[1];
  }
  
  if (!abstractXml) return null;
  
  // Check for structured abstract with sections
  const sections: string[] = [];
  
  // Handle structured abstracts with <sec> elements (common in PMC)
  const secRegex = /<sec[^>]*>([\s\S]*?)<\/sec>/gi;
  let hasStructuredSections = false;
  let match;
  
  while ((match = secRegex.exec(abstractXml)) !== null) {
    hasStructuredSections = true;
    const secContent = match[1];
    
    // Extract section title if present
    const titleMatch = secContent.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? stripXmlTags(titleMatch[1]).trim() : '';
    
    // Extract paragraph content - get all text including outside <p> tags
    let content = secContent;
    // Remove title tag to get remaining content
    if (titleMatch) {
      content = content.replace(titleMatch[0], '');
    }
    const text = stripXmlTags(content).trim();
    
    if (text) {
      sections.push(title ? `${title}: ${text}` : text);
    }
  }
  
  if (hasStructuredSections && sections.length > 0) {
    // Also check for trial registration info outside sections
    const trialReg = extractTrialRegistration(abstractXml);
    const mainText = sections.join(' ');
    return trialReg ? `${mainText} ${trialReg}` : mainText;
  }
  
  // Handle simple abstracts with <p> elements
  const paragraphs = extractParagraphsFromXml(abstractXml);
  if (paragraphs.length > 0) {
    const mainText = paragraphs.join(' ');
    const trialReg = extractTrialRegistration(abstractXml);
    return trialReg ? `${mainText} ${trialReg}` : mainText;
  }
  
  // Handle PubMed-style AbstractText elements (from PubMed, not PMC)
  // More robust regex that captures Label from any position in attributes
  const abstractTextRegex = /<AbstractText([^>]*)>([\s\S]*?)<\/AbstractText>/gi;
  while ((match = abstractTextRegex.exec(abstractXml)) !== null) {
    const attrs = match[1];
    const contentXml = match[2];
    
    // Extract label from attributes
    const labelMatch = attrs.match(/Label="([^"]+)"/i) || attrs.match(/NlmCategory="([^"]+)"/i);
    const label = labelMatch ? labelMatch[1] : '';
    
    const content = stripXmlTags(contentXml).trim();
    if (content) {
      sections.push(label ? `${label}: ${content}` : content);
    }
  }
  
  if (sections.length > 0) {
    const mainText = sections.join('\n\n');
    const trialReg = extractTrialRegistration(abstractXml);
    return trialReg ? `${mainText}\n\n${trialReg}` : mainText;
  }
  
  // Fallback: strip all tags and return content
  const plainText = stripXmlTags(abstractXml).trim();
  return plainText || null;
}

// Extract trial registration information from abstract XML
function extractTrialRegistration(xml: string): string | null {
  // Look for trial registration patterns that might be outside structured sections
  const patterns = [
    // "Trial registration: ClinicalTrials.gov NCT12345678"
    /Trial\s+registration[:\s]+([\s\S]*?)(?=<\/|$)/i,
    // "Registered at ClinicalTrials.gov (NCT12345678)"
    /Registered\s+(?:at|with|on)\s+([\s\S]*?)(?=<\/|$)/i,
    // "ClinicalTrials.gov identifier: NCT12345678"
    /ClinicalTrials\.gov\s+identifier[:\s]+([\s\S]*?)(?=<\/|$)/i,
  ];
  
  for (const pattern of patterns) {
    const match = xml.match(pattern);
    if (match) {
      const text = stripXmlTags(match[0]).trim();
      if (text && text.length > 10) {
        return text;
      }
    }
  }
  
  return null;
}

// Extract paragraphs from XML content
function extractParagraphsFromXml(xml: string): string[] {
  const paragraphs: string[] = [];
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let match;
  
  while ((match = pRegex.exec(xml)) !== null) {
    const text = stripXmlTags(match[1]).trim();
    if (text) {
      paragraphs.push(text);
    }
  }
  
  return paragraphs;
}

// Strip XML/HTML tags while preserving text content order
// This function handles special cases like ext-link elements that contain URLs
function stripXmlTags(text: string): string {
  let result = text;
  
  // Extract content from ext-link elements (preserve URL if text is missing)
  // Pattern: <ext-link xlink:href="URL">text</ext-link> or <ext-link ext-link-type="uri" xlink:href="URL"/>
  result = result.replace(/<ext-link[^>]*xlink:href="([^"]*)"[^>]*>([^<]*)<\/ext-link>/gi, (match, url, innerText) => {
    // If there's inner text, use it; otherwise use the URL
    const text = innerText.trim();
    return text || url || '';
  });
  
  // Handle self-closing ext-link tags - extract URL from href
  result = result.replace(/<ext-link[^>]*xlink:href="([^"]*)"[^>]*\/>/gi, '$1');
  
  // Handle uri elements (sometimes used for URLs)
  result = result.replace(/<uri[^>]*>([\s\S]*?)<\/uri>/gi, '$1');
  
  // Handle xref elements - extract text content
  result = result.replace(/<xref[^>]*>([\s\S]*?)<\/xref>/gi, '$1');
  
  // Handle email elements
  result = result.replace(/<email[^>]*>([\s\S]*?)<\/email>/gi, '$1');
  
  // Handle styled-content/named-content elements
  result = result.replace(/<styled-content[^>]*>([\s\S]*?)<\/styled-content>/gi, '$1');
  result = result.replace(/<named-content[^>]*>([\s\S]*?)<\/named-content>/gi, '$1');
  
  // Handle common inline formatting (preserve content)
  result = result.replace(/<(italic|bold|sup|sub|underline|sc|monospace|roman|sans-serif|i|b|u|em|strong)[^>]*>([\s\S]*?)<\/\1>/gi, '$2');
  
  // Now strip remaining tags
  result = result.replace(/<[^>]+>/g, ' ');
  
  // Decode common HTML entities
  result = result
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#160;/g, ' ')
    .replace(/&#8201;/g, ' ')
    .replace(/&#177;/g, '±')
    .replace(/&#956;/g, 'μ')
    .replace(/&nbsp;/g, ' ');
  
  // Normalize whitespace
  result = result.replace(/\s+/g, ' ').trim();
  
  return result;
}

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
    parseTagValue: false,
    trimValues: true,
    isArray: (name) => {
      return name === "AbstractText" || name === "Author" || name === "Keyword" || name === "sec" || name === "p";
    }
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
      const response = await fetchWithRetry(url, { context: `PMC search: ${searchTerm}` });
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
        const response = await fetchWithRetry(url, { context: `PMC fetch batch ${i}-${i + batch.length}` });
        const xmlText = await response.text();
        
        // Extract raw article XML segments for proper abstract parsing
        const articleXmlSegments = this.extractArticleXmlSegments(xmlText);
        
        const result = this.parser.parse(xmlText);

        // PMC returns articles in a <pmc-articleset> root element
        const articles = result["pmc-articleset"]?.article || result.article;
        if (articles) {
          const articleArray = Array.isArray(articles) ? articles : [articles];
          const publications = articleArray
            .map((article: PMCArticle, index: number) => {
              // Get corresponding raw XML for this article
              const rawXml = articleXmlSegments[index] || '';
              return this.parseArticle(article, rawXml);
            })
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

  // Extract individual article XML segments from the response
  private extractArticleXmlSegments(xmlText: string): string[] {
    const segments: string[] = [];
    const articleRegex = /<article[^>]*>([\s\S]*?)<\/article>/gi;
    let match;
    
    while ((match = articleRegex.exec(xmlText)) !== null) {
      segments.push(match[0]);
    }
    
    return segments;
  }

  private parseArticle(article: PMCArticle, rawXml: string = ''): InsertPublication | null {
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
      
      // Parse actual PubMed ID (different from PMC ID)
      const pubmedId = this.parsePubmedId(articleMeta["article-id"]);
      
      // Parse DOI
      const doi = this.parseDoi(articleMeta["article-id"]);
      
      // Require at least PMC ID or DOI
      if (!pmcId && !doi) {
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

      // Parse abstract - prefer raw XML extraction to preserve text order in mixed content
      let rawAbstract: string | null = null;
      if (rawXml) {
        rawAbstract = extractAbstractFromRawXml(rawXml);
      }
      // Fallback to JSON-based parsing if raw XML extraction failed
      if (!rawAbstract) {
        rawAbstract = this.parseAbstract(articleMeta.abstract);
      }
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
        console.log(`Article ${pmcId || doi} marked as pending (missing: ${title === "Untitled Publication" ? "title" : ""} ${authors === "Unknown" ? "authors" : ""})`);
      }

      return {
        // Use actual PubMed ID if available, otherwise use PMC-prefixed ID to avoid collision
        pmid: pubmedId || (pmcId ? `PMC${pmcId}` : doi!),
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
        pmcId: pmcId ? `PMC${pmcId}` : null,
      };
    } catch (error) {
      console.error("Error parsing PMC article:", error);
      return null;
    }
  }

  private parsePmcId(articleIds: any, attributeId?: string): string | null {
    // Helper to validate PMC ID is numeric (valid PMC IDs are purely numeric)
    const isValidPmcId = (id: string): boolean => {
      const cleaned = id.replace(/^PMC/i, "");
      return /^\d+$/.test(cleaned);
    };

    // First try to get from article attribute
    if (attributeId) {
      const cleaned = attributeId.replace(/^PMC/i, "");
      // Only accept numeric PMC IDs, skip publisher-specific IDs like "phy270717"
      if (isValidPmcId(cleaned)) {
        return cleaned;
      }
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
      const cleaned = String(idText).replace(/^PMC/i, "");
      // Only accept numeric PMC IDs
      if (isValidPmcId(cleaned)) {
        return cleaned;
      }
    }

    return null;
  }

  // Extract actual PubMed ID from PMC article metadata
  private parsePubmedId(articleIds: any): string | null {
    if (!articleIds) return null;

    const idArray = Array.isArray(articleIds) ? articleIds : [articleIds];
    
    // Look for PubMed ID specifically
    const pmidObj = idArray.find((id: any) => 
      id["@_pub-id-type"] === "pmid" || 
      id["@_pub-id-type"] === "pubmed"
    );

    if (pmidObj) {
      const idText = pmidObj["#text"] || pmidObj;
      return String(idText);
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

    // Search in 5-year chunks from 1990 to present to capture all historical publications
    const currentYear = new Date().getFullYear();
    const yearRanges: Array<{ start: number; end: number }> = [];
    
    for (let year = 1990; year <= currentYear; year += 5) {
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

      // Catch-all: undated search to find any articles missed by date filtering
      console.log(`  Running catch-all undated search...`);
      const catchAllIds = await this.searchPubMed(term, maxPerTerm);
      console.log(`  Found ${catchAllIds.length} articles in catch-all search`);

      if (catchAllIds.length > 0) {
        const publications = await this.fetchArticleDetails(catchAllIds);
        allPublications.push(...publications);
      }

      await new Promise((resolve) => setTimeout(resolve, 350));
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

    // Search in 5-year chunks from 1990 to present to capture all historical publications
    const currentYear = new Date().getFullYear();
    const yearRanges: Array<{ start: number; end: number }> = [];
    
    for (let year = 1990; year <= currentYear; year += 5) {
      yearRanges.push({
        start: year,
        end: Math.min(year + 4, currentYear)
      });
    }

    // +1 batch per term for the catch-all undated search
    const totalBatches = (yearRanges.length + 1) * this.cardiovascularTerms.length;
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

      // Catch-all: undated search to find any articles missed by date filtering
      batchIndex++;
      const catchAllPhase = `Catch-all undated search`;
      console.log(`  Running catch-all undated search...`);
      const catchAllIds = await this.searchPubMed(term, maxPerTerm);
      console.log(`  Found ${catchAllIds.length} articles in catch-all search`);

      if (catchAllIds.length > 0) {
        const publications = await this.fetchArticleDetails(catchAllIds);
        const uniqueBatch: InsertPublication[] = [];
        for (const pub of publications) {
          if (pub.pmid && !seenIds.has(pub.pmid)) {
            seenIds.add(pub.pmid);
            uniqueBatch.push(pub);
          }
        }
        totalFetched += uniqueBatch.length;
        if (onBatchFetched) {
          await onBatchFetched(uniqueBatch, catchAllPhase, batchIndex, totalBatches);
        }
      } else if (onBatchFetched) {
        await onBatchFetched([], catchAllPhase, batchIndex, totalBatches);
      }

      await new Promise((resolve) => setTimeout(resolve, 350));
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

  // Fetch abstracts from PubMed (not PMC) - for articles that only have PubMed IDs
  async fetchPubMedAbstracts(pmids: string[]): Promise<Map<string, string>> {
    const abstractMap = new Map<string, string>();
    if (pmids.length === 0) return abstractMap;

    const BATCH_SIZE = 100;

    for (let i = 0; i < pmids.length; i += BATCH_SIZE) {
      const batch = pmids.slice(i, i + BATCH_SIZE);
      const ids = batch.join(",");
      const url = `${this.baseUrl}/efetch.fcgi?db=pubmed&id=${ids}&retmode=xml`;

      try {
        const response = await fetchWithRetry(url, { context: `PubMed abstract batch ${i}-${i + batch.length}` });
        const xmlText = await response.text();

        // Extract abstracts from PubMed XML
        const articleRegex = /<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/gi;
        let match;

        while ((match = articleRegex.exec(xmlText)) !== null) {
          const articleXml = match[1];
          
          // Extract PMID
          const pmidMatch = articleXml.match(/<PMID[^>]*>(\d+)<\/PMID>/);
          if (!pmidMatch) continue;
          const pmid = pmidMatch[1];

          // Extract abstract
          const abstractMatch = articleXml.match(/<Abstract>([\s\S]*?)<\/Abstract>/);
          if (abstractMatch) {
            const abstractXml = abstractMatch[1];
            
            // Handle structured abstracts with AbstractText elements
            const sections: string[] = [];
            const abstractTextRegex = /<AbstractText([^>]*)>([\s\S]*?)<\/AbstractText>/gi;
            let atMatch;

            while ((atMatch = abstractTextRegex.exec(abstractXml)) !== null) {
              const attrs = atMatch[1];
              const content = atMatch[2];
              
              // Extract label
              const labelMatch = attrs.match(/Label="([^"]+)"/i);
              const label = labelMatch ? labelMatch[1] : '';
              
              // Strip XML tags but preserve text
              const text = stripXmlTags(content).trim();
              if (text) {
                sections.push(label ? `${label}: ${text}` : text);
              }
            }

            if (sections.length > 0) {
              abstractMap.set(pmid, sections.join(' '));
            } else {
              // Simple abstract without structure
              const plainText = stripXmlTags(abstractXml).trim();
              if (plainText) {
                abstractMap.set(pmid, plainText);
              }
            }
          }
        }

        // Rate limit
        if (i + BATCH_SIZE < pmids.length) {
          await new Promise(resolve => setTimeout(resolve, 350));
        }
      } catch (error) {
        console.error(`Error fetching PubMed batch ${i}-${i + batch.length}:`, error);
      }
    }

    return abstractMap;
  }
}

export const pubmedService = new PubMedService();