import { type Publication, type InsertPublication, type Category, type InsertCategory, type SearchPublicationsParams, type FilterCounts, type SearchPublicationsResponse } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Publication methods
  getPublication(id: string): Promise<Publication | undefined>;
  getPublicationByPmid(pmid: string): Promise<Publication | undefined>;
  createPublication(publication: InsertPublication): Promise<Publication>;
  updatePublication(id: string, publication: Partial<InsertPublication>): Promise<Publication | undefined>;
  deletePublication(id: string): Promise<boolean>;
  searchPublications(params: SearchPublicationsParams): Promise<SearchPublicationsResponse>;
  getFilterCounts(params: SearchPublicationsParams): Promise<FilterCounts>;
  getFeaturedPublications(): Promise<Publication[]>;
  getPublicationStats(): Promise<{totalPublications: number, totalCitations: number, countriesCount: number, institutionsCount: number}>;

  // Category methods
  getCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  getCategoryByName(name: string): Promise<Category | undefined>;
}

export class MemStorage implements IStorage {
  private publications: Map<string, Publication>;
  private categories: Map<string, Category>;

  constructor() {
    this.publications = new Map();
    this.categories = new Map();
    
    // Initialize default categories
    this.initializeDefaultCategories();
  }

  private async initializeDefaultCategories() {
    const defaultCategories = [
      { name: "Chronic Kidney Disease (CKD)", description: "Research on kidney disease and cardiovascular complications", color: "blue" },
      { name: "Chronic Obstructive Pulmonary Disease (COPD)", description: "Studies on pulmonary disease and vascular health", color: "green" },
      { name: "Early Vascular Aging (EVA)", description: "Research on premature vascular aging and arterial stiffness", color: "red" },
      { name: "Heart Failure", description: "Studies on heart failure and cardiac function", color: "indigo" },
      { name: "Hypertension", description: "Research on high blood pressure and vascular health", color: "purple" },
      { name: "Longevity", description: "Studies on aging and lifespan extension", color: "pink" },
      { name: "Maternal Health", description: "Research on pregnancy and maternal cardiovascular health", color: "orange" },
      { name: "Men's Health", description: "Male-specific cardiovascular health research", color: "teal" },
      { name: "Metabolic Health", description: "Studies on metabolism and cardiovascular disease", color: "yellow" },
      { name: "Neuroscience", description: "Research on brain health and vascular function", color: "gray" },
      { name: "Women's Health", description: "Female-specific cardiovascular health research", color: "pink" }
    ];

    for (const cat of defaultCategories) {
      const category: Category = {
        id: randomUUID(),
        name: cat.name,
        description: cat.description || null,
        color: cat.color
      };
      this.categories.set(category.id, category);
    }
  }

  // Publication methods
  async getPublication(id: string): Promise<Publication | undefined> {
    return this.publications.get(id);
  }

  async getPublicationByPmid(pmid: string): Promise<Publication | undefined> {
    return Array.from(this.publications.values()).find(pub => pub.pmid === pmid);
  }

  async createPublication(insertPublication: InsertPublication): Promise<Publication> {
    const id = randomUUID();
    const publication: Publication = {
      ...insertPublication,
      id,
      pmid: insertPublication.pmid ?? null,
      abstract: insertPublication.abstract ?? null,
      doi: insertPublication.doi ?? null,
      researchArea: insertPublication.researchArea ?? null,
      citationCount: insertPublication.citationCount ?? 0,
      isFeatured: insertPublication.isFeatured ?? 0,
      journalImpactFactor: insertPublication.journalImpactFactor ?? null,
      pubmedUrl: insertPublication.pubmedUrl ?? null,
      categories: (insertPublication.categories ?? []) as string[],
      keywords: (insertPublication.keywords ?? []) as string[],
      createdAt: new Date()
    };
    this.publications.set(id, publication);
    return publication;
  }

  async updatePublication(id: string, updates: Partial<InsertPublication>): Promise<Publication | undefined> {
    const existing = this.publications.get(id);
    if (!existing) return undefined;

    const updated: Publication = { 
      ...existing, 
      ...updates,
      categories: (updates.categories ?? existing.categories ?? []) as string[],
      keywords: (updates.keywords ?? existing.keywords ?? []) as string[]
    };
    this.publications.set(id, updated);
    return updated;
  }

  async deletePublication(id: string): Promise<boolean> {
    return this.publications.delete(id);
  }

  async searchPublications(params: SearchPublicationsParams): Promise<SearchPublicationsResponse> {
    let filtered = Array.from(this.publications.values());

    // Filter by search query
    if (params.query) {
      const query = params.query.toLowerCase();
      filtered = filtered.filter(pub => 
        pub.title.toLowerCase().includes(query) ||
        pub.authors.toLowerCase().includes(query) ||
        pub.abstract?.toLowerCase().includes(query) ||
        pub.keywords?.some(keyword => keyword.toLowerCase().includes(query))
      );
    }

    // Filter by categories
    if (params.categories && params.categories.length > 0) {
      filtered = filtered.filter(pub => 
        pub.categories?.some(cat => params.categories!.includes(cat))
      );
    }

    // Filter by research area
    if (params.researchArea) {
      filtered = filtered.filter(pub => 
        pub.researchArea === params.researchArea
      );
    }

    // Filter by venue (journal)
    if (params.venue) {
      filtered = filtered.filter(pub => 
        pub.journal === params.venue
      );
    }

    // Filter by year
    if (params.year) {
      filtered = filtered.filter(pub => 
        pub.publicationDate.getFullYear() === params.year
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (params.sortBy) {
        case "newest":
          return b.publicationDate.getTime() - a.publicationDate.getTime();
        case "oldest":
          return a.publicationDate.getTime() - b.publicationDate.getTime();
        case "citations":
          return (b.citationCount || 0) - (a.citationCount || 0);
        case "impact":
          return (b.journalImpactFactor || 0) - (a.journalImpactFactor || 0);
        default:
          return 0;
      }
    });

    const total = filtered.length;
    const publications = filtered.slice(params.offset, params.offset + params.limit);
    const filterCounts = await this.getFilterCounts(params);

    return { publications, total, filterCounts };
  }

  async getFilterCounts(params: SearchPublicationsParams): Promise<FilterCounts> {
    // Helper function to apply filters excluding a specific dimension
    const applyFiltersExcept = (publications: Publication[], excludeDimension: string): Publication[] => {
      let filtered = publications;

      // Always apply search query if present
      if (params.query) {
        const query = params.query.toLowerCase();
        filtered = filtered.filter(pub => 
          pub.title.toLowerCase().includes(query) ||
          pub.authors.toLowerCase().includes(query) ||
          pub.abstract?.toLowerCase().includes(query) ||
          pub.keywords?.some(keyword => keyword.toLowerCase().includes(query))
        );
      }

      // Apply research area filter (unless we're counting research areas)
      if (excludeDimension !== 'researchArea' && params.researchArea) {
        filtered = filtered.filter(pub => pub.researchArea === params.researchArea);
      }

      // Apply venue filter (unless we're counting venues)
      if (excludeDimension !== 'venue' && params.venue) {
        filtered = filtered.filter(pub => pub.journal === params.venue);
      }

      // Apply year filter (unless we're counting years)
      if (excludeDimension !== 'year' && params.year) {
        filtered = filtered.filter(pub => pub.publicationDate.getFullYear() === params.year);
      }

      // Apply categories filter (unless we're counting categories)
      if (excludeDimension !== 'categories' && params.categories && params.categories.length > 0) {
        filtered = filtered.filter(pub => 
          pub.categories?.some(cat => params.categories!.includes(cat))
        );
      }

      return filtered;
    };

    const allPublications = Array.from(this.publications.values());

    // Count research areas (filtered by venue, year, categories - but NOT research area)
    const researchAreas: Record<string, number> = {};
    const publicationsForResearchAreas = applyFiltersExcept(allPublications, 'researchArea');
    publicationsForResearchAreas.forEach((pub) => {
      if (pub.researchArea) {
        researchAreas[pub.researchArea] = (researchAreas[pub.researchArea] || 0) + 1;
      }
    });

    // Count venues (filtered by research area, year, categories - but NOT venue)
    const venues: Record<string, number> = {};
    const publicationsForVenues = applyFiltersExcept(allPublications, 'venue');
    publicationsForVenues.forEach((pub) => {
      if (pub.journal) {
        venues[pub.journal] = (venues[pub.journal] || 0) + 1;
      }
    });

    // Count years (filtered by research area, venue, categories - but NOT year)
    const years: Record<number, number> = {};
    const publicationsForYears = applyFiltersExcept(allPublications, 'year');
    publicationsForYears.forEach((pub) => {
      const year = pub.publicationDate.getFullYear();
      years[year] = (years[year] || 0) + 1;
    });

    // Count categories (filtered by research area, venue, year - but NOT categories)
    const categories: Record<string, number> = {};
    const publicationsForCategories = applyFiltersExcept(allPublications, 'categories');
    publicationsForCategories.forEach((pub) => {
      if (pub.categories) {
        pub.categories.forEach((category) => {
          categories[category] = (categories[category] || 0) + 1;
        });
      }
    });

    return {
      researchAreas,
      venues,
      years,
      categories
    };
  }

  async getFeaturedPublications(): Promise<Publication[]> {
    return Array.from(this.publications.values())
      .filter(pub => pub.isFeatured === 1)
      .sort((a, b) => b.publicationDate.getTime() - a.publicationDate.getTime())
      .slice(0, 5);
  }

  async getPublicationStats(): Promise<{totalPublications: number, totalCitations: number, countriesCount: number, institutionsCount: number}> {
    const pubs = Array.from(this.publications.values());
    const totalPublications = pubs.length;
    const totalCitations = pubs.reduce((sum, pub) => sum + (pub.citationCount || 0), 0);
    
    // Mock data for countries and institutions since we don't track these in the schema
    const countriesCount = 150;
    const institutionsCount = 500;

    return {
      totalPublications,
      totalCitations,
      countriesCount,
      institutionsCount
    };
  }

  // Category methods
  async getCategories(): Promise<Category[]> {
    return Array.from(this.categories.values());
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const id = randomUUID();
    const category: Category = { 
      ...insertCategory, 
      id,
      description: insertCategory.description ?? null
    };
    this.categories.set(id, category);
    return category;
  }

  async getCategoryByName(name: string): Promise<Category | undefined> {
    return Array.from(this.categories.values()).find(cat => cat.name === name);
  }
}

export const storage = new MemStorage();
