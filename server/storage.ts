import { type Publication, type InsertPublication, type Category, type InsertCategory, type SearchPublicationsParams, type FilterCounts, type SearchPublicationsResponse } from "@shared/schema";
import { publications, categories } from "@shared/schema";
import { db } from "./db";
import { eq, and, or, like, sql, desc, asc } from "drizzle-orm";

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
  getPublicationStats(): Promise<{totalPublications: number, totalCitations: number, countriesCount: number, institutionsCount: number, totalByStatus?: Record<string, number>}>;
  getMostRecentPublicationDate(): Promise<Date | null>;

  // Category methods
  getCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  getCategoryByName(name: string): Promise<Category | undefined>;
}

export class DatabaseStorage implements IStorage {
  // Publication methods
  async getPublication(id: string): Promise<Publication | undefined> {
    const [publication] = await db.select().from(publications).where(eq(publications.id, id));
    return publication || undefined;
  }

  async getPublicationByPmid(pmid: string): Promise<Publication | undefined> {
    const [publication] = await db.select().from(publications).where(eq(publications.pmid, pmid));
    return publication || undefined;
  }

  async createPublication(insertPublication: InsertPublication): Promise<Publication> {
    const [publication] = await db
      .insert(publications)
      .values({
        ...insertPublication,
        categories: insertPublication.categories || [],
      } as any)
      .returning();
    return publication;
  }

  async updatePublication(id: string, updates: Partial<InsertPublication>): Promise<Publication | undefined> {
    const updateData: any = { ...updates };
    if (updates.keywords) updateData.keywords = updates.keywords;
    if (updates.categories) updateData.categories = updates.categories;
    
    const [updated] = await db
      .update(publications)
      .set(updateData)
      .where(eq(publications.id, id))
      .returning();
    return updated || undefined;
  }

  async deletePublication(id: string): Promise<boolean> {
    const result = await db.delete(publications).where(eq(publications.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async searchPublications(params: SearchPublicationsParams): Promise<SearchPublicationsResponse> {
    const conditions = [];

    // Always filter for approved publications only (for frontend display)
    conditions.push(eq(publications.status, "approved"));

    // Build search query conditions
    if (params.query) {
      const searchQuery = `%${params.query.toLowerCase()}%`;
      conditions.push(
        or(
          sql`LOWER(${publications.title}) LIKE ${searchQuery}`,
          sql`LOWER(${publications.authors}) LIKE ${searchQuery}`,
          sql`LOWER(${publications.abstract}) LIKE ${searchQuery}`
        )
      );
    }

    if (params.venue) {
      conditions.push(eq(publications.journal, params.venue));
    }

    if (params.year) {
      conditions.push(sql`EXTRACT(YEAR FROM ${publications.publicationDate}) = ${params.year}`);
    }

    if (params.featured !== undefined) {
      conditions.push(eq(publications.isFeatured, params.featured ? 1 : 0));
    }

    // Category filtering with JSON array
    if (params.categories && params.categories.length > 0) {
      const categoryConditions = params.categories.map(cat => 
        sql`${publications.categories}::jsonb @> ${JSON.stringify([cat])}::jsonb`
      );
      conditions.push(or(...categoryConditions));
    }

    // Build where clause
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Determine sort order
    let orderBy;
    switch (params.sortBy) {
      case "oldest":
        orderBy = asc(publications.publicationDate);
        break;
      case "newest":
      default:
        orderBy = desc(publications.publicationDate);
        break;
    }

    // Execute query with pagination
    const results = await db
      .select()
      .from(publications)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(params.limit)
      .offset(params.offset);

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(publications)
      .where(whereClause);

    const total = countResult?.count || 0;
    const filterCounts = await this.getFilterCounts(params);
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(total / params.limit);
    const currentPage = Math.floor(params.offset / params.limit) + 1;

    return { 
      publications: results, 
      total, 
      totalPages,
      currentPage,
      filterCounts 
    };
  }

  async getFilterCounts(params: SearchPublicationsParams): Promise<FilterCounts> {
    // Base condition from search query
    const baseConditions = [];
    
    // Always filter for approved publications only
    baseConditions.push(eq(publications.status, "approved"));
    
    if (params.query) {
      const searchQuery = `%${params.query.toLowerCase()}%`;
      baseConditions.push(
        or(
          sql`LOWER(${publications.title}) LIKE ${searchQuery}`,
          sql`LOWER(${publications.authors}) LIKE ${searchQuery}`,
          sql`LOWER(${publications.abstract}) LIKE ${searchQuery}`
        )
      );
    }

    // Category counts (exclude categories filter)
    const categoryConditions = [...baseConditions];
    if (params.venue) categoryConditions.push(eq(publications.journal, params.venue));
    if (params.year) categoryConditions.push(sql`EXTRACT(YEAR FROM ${publications.publicationDate}) = ${params.year}`);

    const categoryResults = await db
      .select({
        category: sql<string>`jsonb_array_elements_text(${publications.categories})`.as('category'),
        count: sql<number>`count(*)`.as('count')
      })
      .from(publications)
      .where(categoryConditions.length > 0 ? and(...categoryConditions) : undefined)
      .groupBy(sql`category`);

    const categoryCounts: Record<string, number> = {};
    categoryResults.forEach(row => {
      if (row.category) categoryCounts[row.category] = row.count;
    });

    // Venues count (exclude venue filter)
    const venueConditions = [...baseConditions];
    if (params.categories && params.categories.length > 0) {
      const catConditions = params.categories.map(cat => 
        sql`${publications.categories}::jsonb @> ${JSON.stringify([cat])}::jsonb`
      );
      venueConditions.push(or(...catConditions));
    }
    if (params.year) venueConditions.push(sql`EXTRACT(YEAR FROM ${publications.publicationDate}) = ${params.year}`);

    const venueResults = await db
      .select({
        venue: publications.journal,
        count: sql<number>`count(*)::int`
      })
      .from(publications)
      .where(venueConditions.length > 0 ? and(...venueConditions) : undefined)
      .groupBy(publications.journal);

    const venues: Record<string, number> = {};
    venueResults.forEach(r => {
      if (r.venue) venues[r.venue] = r.count;
    });

    // Years count (exclude year filter)
    const yearConditions = [...baseConditions];
    if (params.categories && params.categories.length > 0) {
      const catConditions = params.categories.map(cat => 
        sql`${publications.categories}::jsonb @> ${JSON.stringify([cat])}::jsonb`
      );
      yearConditions.push(or(...catConditions));
    }
    if (params.venue) yearConditions.push(eq(publications.journal, params.venue));

    const yearResults = await db
      .select({
        year: sql<number>`EXTRACT(YEAR FROM ${publications.publicationDate})::int`,
        count: sql<number>`count(*)::int`
      })
      .from(publications)
      .where(yearConditions.length > 0 ? and(...yearConditions) : undefined)
      .groupBy(sql`EXTRACT(YEAR FROM ${publications.publicationDate})`);

    const years: Record<number, number> = {};
    yearResults.forEach(r => {
      if (r.year) years[r.year] = r.count;
    });

    return {
      categories: categoryCounts,
      venues,
      years
    };
  }

  async getFeaturedPublications(): Promise<Publication[]> {
    return db
      .select()
      .from(publications)
      .where(and(
        eq(publications.isFeatured, 1),
        eq(publications.status, "approved")
      ))
      .orderBy(desc(publications.publicationDate))
      .limit(30);
  }

  async getPublicationStats(): Promise<{totalPublications: number, totalCitations: number, countriesCount: number, institutionsCount: number, totalByStatus?: Record<string, number>}> {
    const [statsResult] = await db
      .select({
        totalPublications: sql<number>`count(*)::int`,
        totalCitations: sql<number>`coalesce(sum(${publications.citationCount}), 0)::int`
      })
      .from(publications)
      .where(eq(publications.status, "approved"));

    const statusCounts = await db
      .select({
        status: publications.status,
        count: sql<number>`count(*)::int`
      })
      .from(publications)
      .groupBy(publications.status);

    const totalByStatus: Record<string, number> = {};
    statusCounts.forEach(({ status, count }) => {
      totalByStatus[status] = count;
    });

    return {
      totalPublications: statsResult?.totalPublications || 0,
      totalCitations: statsResult?.totalCitations || 0,
      countriesCount: 150, // Mock data
      institutionsCount: 500, // Mock data
      totalByStatus
    };
  }

  async getMostRecentPublicationDate(): Promise<Date | null> {
    const [result] = await db
      .select({
        publicationDate: publications.publicationDate
      })
      .from(publications)
      .orderBy(desc(publications.publicationDate))
      .limit(1);
    
    return result?.publicationDate || null;
  }

  // Category methods
  async getCategories(): Promise<Category[]> {
    return db.select().from(categories);
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const [category] = await db
      .insert(categories)
      .values(insertCategory)
      .returning();
    return category;
  }

  async getCategoryByName(name: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.name, name));
    return category || undefined;
  }
}

export const storage = new DatabaseStorage();
