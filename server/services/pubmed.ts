import { XMLParser } from "fast-xml-parser";
import type { InsertPublication } from "@shared/schema";
import { PUBMED_SEARCH_TERMS, MAX_RESULTS_PER_TERM } from "../config/search-terms";

interface PubMedArticle {
  MedlineCitation: {
    PMID: { "#text": string };
    Article: {
      ArticleTitle: string;
      Abstract?: { AbstractText: string | string[] };
      AuthorList?: {
        Author: Array<{
          LastName?: string;
          ForeName?: string;
          Initials?: string;
        }> | {
          LastName?: string;
          ForeName?: string;
          Initials?: string;
        };
      };
      Journal: {
        Title: string;
        JournalIssue: {
          PubDate: {
            Year?: string;
            Month?: string;
            Day?: string;
            MedlineDate?: string;
          };
        };
      };
      ELocationID?: Array<{ "@_EIdType": string; "#text": string }> | { "@_EIdType": string; "#text": string };
    };
  };
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
  });

  // Use configurable search terms from config file
  private readonly cardiovascularTerms = PUBMED_SEARCH_TERMS;

  async searchPubMed(searchTerm: string, maxResults: number = 100): Promise<string[]> {
    const query = encodeURIComponent(searchTerm);
    // Use PubMed Central (pmc) database for full-text search
    const url = `${this.baseUrl}/esearch.fcgi?db=pmc&term=${query}&retmax=${maxResults}&retmode=xml`;

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

  async fetchArticleDetails(pmids: string[]): Promise<InsertPublication[]> {
    if (pmids.length === 0) return [];

    // Batch requests to respect PubMed's recommended limit of 200 IDs per request
    const BATCH_SIZE = 200;
    const allPublications: InsertPublication[] = [];

    for (let i = 0; i < pmids.length; i += BATCH_SIZE) {
      const batch = pmids.slice(i, i + BATCH_SIZE);
      const ids = batch.join(",");
      // Use PubMed Central (pmc) database
      const url = `${this.baseUrl}/efetch.fcgi?db=pmc&id=${ids}&retmode=xml`;

      try {
        const response = await fetch(url);
        const xmlText = await response.text();
        const result = this.parser.parse(xmlText);

        // Handle both single and multiple articles
        const articles = result.PubmedArticleSet?.PubmedArticle;
        if (articles) {
          const articleArray = Array.isArray(articles) ? articles : [articles];
          const publications = articleArray
            .map((article: PubMedArticle) => this.parseArticle(article))
            .filter(Boolean) as InsertPublication[];
          allPublications.push(...publications);
        }

        // Add delay between batch requests to respect rate limits (350ms)
        if (i + BATCH_SIZE < pmids.length) {
          await new Promise(resolve => setTimeout(resolve, 350));
        }
      } catch (error) {
        console.error(`Error fetching PubMed batch ${i}-${i + batch.length}:`, error);
      }
    }

    return allPublications;
  }

  private parseArticle(article: PubMedArticle): InsertPublication | null {
    try {
      const medlineCitation = article.MedlineCitation;
      const articleData = medlineCitation.Article;
      const pmid = medlineCitation.PMID["#text"];

      // Parse authors
      const authors = this.parseAuthors(articleData.AuthorList);

      // Parse abstract
      const abstract = this.parseAbstract(articleData.Abstract);

      // Parse publication date
      const publicationDate = this.parsePublicationDate(articleData.Journal.JournalIssue.PubDate);

      // Parse DOI
      const doi = this.parseDoi(articleData.ELocationID);

      // Determine categories based on title/abstract
      const categoriesFromText = this.categorizeToCONNEQTAreas(articleData.ArticleTitle, abstract);

      // Extract keywords from title and abstract
      const keywords = this.extractKeywords(articleData.ArticleTitle, abstract);

      return {
        pmid,
        title: articleData.ArticleTitle,
        authors,
        journal: articleData.Journal.Title,
        publicationDate,
        abstract,
        doi,
        categories: categoriesFromText,
        keywords,
        citationCount: 0,
        isFeatured: 0,
        pubmedUrl: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        journalImpactFactor: null,
        status: "approved", // Auto-approve all imported articles
      };
    } catch (error) {
      console.error("Error parsing article:", error);
      return null;
    }
  }

  private parseAuthors(authorList?: any): string {
    if (!authorList?.Author) return "Unknown";

    const authors = Array.isArray(authorList.Author) ? authorList.Author : [authorList.Author];

    return authors
      .map((author: any) => {
        if (author.LastName && author.ForeName) {
          return `${author.LastName} ${author.Initials || author.ForeName}`;
        }
        return author.LastName || "Unknown";
      })
      .filter(Boolean)
      .join(", ");
  }

  private parseAbstract(abstractData?: any): string | null {
    if (!abstractData?.AbstractText) return null;

    if (typeof abstractData.AbstractText === "string") {
      return abstractData.AbstractText;
    }

    if (Array.isArray(abstractData.AbstractText)) {
      return abstractData.AbstractText
        .map((text: any) => (typeof text === "string" ? text : text["#text"] || ""))
        .join(" ");
    }

    return abstractData.AbstractText["#text"] || null;
  }

  private parsePublicationDate(pubDate: any): Date {
    if (pubDate.Year) {
      const year = parseInt(pubDate.Year);
      const month = pubDate.Month ? this.parseMonth(pubDate.Month) : 0;
      const day = pubDate.Day ? parseInt(pubDate.Day) : 1;
      return new Date(year, month, day);
    }

    if (pubDate.MedlineDate) {
      // Parse dates like "2023 Jan-Feb" or "2023"
      const yearMatch = pubDate.MedlineDate.match(/(\d{4})/);
      if (yearMatch) {
        return new Date(parseInt(yearMatch[1]), 0, 1);
      }
    }

    return new Date();
  }

  private parseMonth(month: string): number {
    const months: Record<string, number> = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
      Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
    };
    return months[month] ?? 0;
  }

  private parseDoi(eLocationID?: any): string | null {
    if (!eLocationID) return null;

    const locations = Array.isArray(eLocationID) ? eLocationID : [eLocationID];
    const doiLocation = locations.find((loc: any) => loc["@_EIdType"] === "doi");

    return doiLocation?.["#text"] || null;
  }

  private categorizeToCONNEQTAreas(title: string, abstract: string | null): string[] {
    const text = `${title} ${abstract || ""}`.toLowerCase();
    const categories: string[] = [];

    // Map content to CONNEQT Health's 11 fixed research areas
    if (text.includes("chronic kidney disease") || text.includes("renal") || text.includes("kidney")) {
      categories.push("ckd"); // Chronic Kidney Disease (CKD)
    }
    if (text.includes("copd") || text.includes("chronic obstructive pulmonary") || text.includes("respiratory")) {
      categories.push("copd"); // Chronic Obstructive Pulmonary Disease (COPD)
    }
    if (text.includes("vascular aging") || text.includes("arterial aging") || text.includes("early vascular")) {
      categories.push("eva"); // Early Vascular Aging (EVA)
    }
    if (text.includes("heart failure") || text.includes("cardiac failure")) {
      categories.push("heart-failure");
    }
    if (text.includes("hypertension") || text.includes("blood pressure") || text.includes("hypertensive")) {
      categories.push("hypertension");
    }
    if (text.includes("longevity") || text.includes("aging") || text.includes("lifespan")) {
      categories.push("longevity");
    }
    if (text.includes("pregnancy") || text.includes("maternal") || text.includes("obstetric") || text.includes("prenatal")) {
      categories.push("maternal-health");
    }
    if (text.includes("men's health") || text.includes("male") || text.includes("prostate") || text.includes("testosterone")) {
      categories.push("mens-health");
    }
    if (text.includes("metabolic") || text.includes("diabetes") || text.includes("obesity") || text.includes("insulin")) {
      categories.push("metabolic-health");
    }
    if (text.includes("neuro") || text.includes("brain") || text.includes("cognitive") || text.includes("stroke")) {
      categories.push("neuroscience");
    }
    if (text.includes("women's health") || text.includes("female") || text.includes("menopause") || text.includes("ovarian")) {
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
    console.log("Starting PubMed sync for SphygmoCor research...");
    const allPublications: InsertPublication[] = [];

    for (const term of this.cardiovascularTerms) {
      console.log(`Searching PubMed for: ${term}`);
      const pmids = await this.searchPubMed(term, maxPerTerm);
      console.log(`Found ${pmids.length} articles for "${term}"`);

      if (pmids.length > 0) {
        const publications = await this.fetchArticleDetails(pmids);
        allPublications.push(...publications);
      }

      // Add delay to respect PubMed rate limits (3 requests per second)
      await new Promise((resolve) => setTimeout(resolve, 350));
    }

    // Remove duplicates based on PMID
    const uniquePublications = this.removeDuplicates(allPublications);
    console.log(`Sync complete. Found ${uniquePublications.length} unique publications`);

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
