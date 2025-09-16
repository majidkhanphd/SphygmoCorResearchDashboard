import { type Publication, type InsertPublication, type Category, type InsertCategory, type SearchPublicationsParams } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Publication methods
  getPublication(id: string): Promise<Publication | undefined>;
  getPublicationByPmid(pmid: string): Promise<Publication | undefined>;
  createPublication(publication: InsertPublication): Promise<Publication>;
  updatePublication(id: string, publication: Partial<InsertPublication>): Promise<Publication | undefined>;
  deletePublication(id: string): Promise<boolean>;
  searchPublications(params: SearchPublicationsParams): Promise<{publications: Publication[], total: number}>;
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
      categories: insertPublication.categories || [],
      keywords: insertPublication.keywords || [],
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
      categories: updates.categories || existing.categories || [],
      keywords: updates.keywords || existing.keywords || []
    };
    this.publications.set(id, updated);
    return updated;
  }

  async deletePublication(id: string): Promise<boolean> {
    return this.publications.delete(id);
  }

  async searchPublications(params: SearchPublicationsParams): Promise<{publications: Publication[], total: number}> {
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

    return { publications, total };
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
