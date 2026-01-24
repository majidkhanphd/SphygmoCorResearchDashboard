import { type Publication, type InsertPublication, type Category, type InsertCategory, type SearchPublicationsParams, type FilterCounts, type SearchPublicationsResponse, type SuggestedCategory } from "@shared/schema";
import { publications, categories } from "@shared/schema";
import { db } from "./db";
import { eq, and, or, like, sql, desc, asc } from "drizzle-orm";
import { normalizeJournalName, findParentGroup, getChildJournals, JOURNAL_GROUPS } from "@shared/journal-mappings";

// Helper to escape SQL LIKE special characters
function escapeLikePattern(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&');
}

// Build a cache of all distinct journal names at module initialization
let journalNameCache: string[] | null = null;

async function initializeJournalCache(): Promise<void> {
  if (!journalNameCache) {
    const allJournals = await db
      .selectDistinct({ journal: publications.journal })
      .from(publications);
    journalNameCache = allJournals.map(j => j.journal).filter(Boolean) as string[];
  }
}

// Helper to get all raw journal names that match a normalized journal name
// This includes both the exact matches and parent-child relationships
async function getRawJournalNamesForFilter(normalizedJournalName: string): Promise<string[]> {
  // Initialize cache if not already done
  await initializeJournalCache();
  
  if (!journalNameCache) {
    // This shouldn't happen, but fail gracefully
    console.error('Journal cache failed to initialize');
    return [];
  }
  
  const matchingJournals: string[] = [];
  const childJournals = getChildJournals(normalizedJournalName);
  
  for (const rawJournal of journalNameCache) {
    const normalized = normalizeJournalName(rawJournal);
    
    // Direct match to the selected journal (parent or regular)
    if (normalized === normalizedJournalName) {
      matchingJournals.push(rawJournal);
    }
    // If the selected journal is a parent, also match all its children
    else if (childJournals.length > 0 && childJournals.includes(normalized)) {
      matchingJournals.push(rawJournal);
    }
  }
  
  return matchingJournals;
}

export interface IStorage {
  // Publication methods
  getPublication(id: string): Promise<Publication | undefined>;
  getPublicationByPmid(pmid: string): Promise<Publication | undefined>;
  getPublicationByPmcId(pmcId: string): Promise<Publication | undefined>;
  createPublication(publication: InsertPublication): Promise<Publication>;
  updatePublication(id: string, publication: Partial<InsertPublication>): Promise<Publication | undefined>;
  deletePublication(id: string): Promise<boolean>;
  searchPublications(params: SearchPublicationsParams): Promise<SearchPublicationsResponse>;
  getFilterCounts(params: SearchPublicationsParams): Promise<FilterCounts>;
  getFeaturedPublications(): Promise<Publication[]>;
  toggleFeatured(id: string): Promise<Publication | undefined>;
  getPublicationStats(): Promise<{totalPublications: number, totalCitations: number, countriesCount: number, institutionsCount: number, totalByStatus?: Record<string, number>}>;
  getMostRecentPublicationDate(): Promise<Date | null>;

  // Category methods
  getCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  getCategoryByName(name: string): Promise<Category | undefined>;

  // Category suggestion methods
  updateSuggestedCategories(id: string, suggestions: SuggestedCategory[], status: string): Promise<Publication | undefined>;
  approveCategories(id: string, selectedCategories: string[], reviewerName: string): Promise<Publication | undefined>;
  rejectSuggestions(id: string, reviewerName: string): Promise<Publication | undefined>;
  getPublicationsNeedingReview(limit: number, offset: number): Promise<{publications: Publication[], total: number}>;
  
  // Maintenance methods
  cleanupDuplicatesByTitle(): Promise<number>;
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

  async getPublicationByPmcId(pmcId: string): Promise<Publication | undefined> {
    const [publication] = await db.select().from(publications).where(eq(publications.pmcId, pmcId));
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
      const escapedQuery = escapeLikePattern(params.query.toLowerCase());
      const searchQuery = `%${escapedQuery}%`;
      conditions.push(
        or(
          sql`LOWER(${publications.title}) LIKE ${searchQuery} ESCAPE '\\'`,
          sql`LOWER(${publications.authors}) LIKE ${searchQuery} ESCAPE '\\'`,
          sql`LOWER(${publications.abstract}) LIKE ${searchQuery} ESCAPE '\\'`
        )
      );
    }

    if (params.venue) {
      // Get all raw journal names that match the normalized venue
      const matchingJournals = await getRawJournalNamesForFilter(params.venue);
      if (matchingJournals.length > 0) {
        const journalConditions = matchingJournals.map(j => eq(publications.journal, j));
        conditions.push(or(...journalConditions));
      }
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
      case "most-cited":
        orderBy = desc(publications.citationCount);
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
    if (params.venue) {
      const matchingJournals = await getRawJournalNamesForFilter(params.venue);
      if (matchingJournals.length > 0) {
        const journalConditions = matchingJournals.map(j => eq(publications.journal, j));
        categoryConditions.push(or(...journalConditions));
      }
    }
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

    // Apply journal normalization and parent-child grouping
    const normalizedVenues: Record<string, number> = {};
    const childJournalCounts: Record<string, Record<string, number>> = {};
    
    // First pass: normalize journal names and aggregate counts
    venueResults.forEach(r => {
      if (!r.venue) return;
      
      const normalized = normalizeJournalName(r.venue);
      const parentGroup = findParentGroup(normalized);
      
      if (parentGroup && normalized !== parentGroup.parent) {
        // This is a child journal - aggregate under parent
        if (!normalizedVenues[parentGroup.parent]) {
          normalizedVenues[parentGroup.parent] = 0;
        }
        normalizedVenues[parentGroup.parent] += r.count;
        
        // Track individual child counts for potential expansion
        if (!childJournalCounts[parentGroup.parent]) {
          childJournalCounts[parentGroup.parent] = {};
        }
        childJournalCounts[parentGroup.parent][normalized] = r.count;
      } else {
        // Regular journal or parent journal itself
        if (!normalizedVenues[normalized]) {
          normalizedVenues[normalized] = 0;
        }
        normalizedVenues[normalized] += r.count;
      }
    });

    const venues = normalizedVenues;

    // Years count (exclude year filter)
    const yearConditions = [...baseConditions];
    if (params.categories && params.categories.length > 0) {
      const catConditions = params.categories.map(cat => 
        sql`${publications.categories}::jsonb @> ${JSON.stringify([cat])}::jsonb`
      );
      yearConditions.push(or(...catConditions));
    }
    if (params.venue) {
      const matchingJournals = await getRawJournalNamesForFilter(params.venue);
      if (matchingJournals.length > 0) {
        const journalConditions = matchingJournals.map(j => eq(publications.journal, j));
        yearConditions.push(or(...journalConditions));
      }
    }

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

  async toggleFeatured(id: string): Promise<Publication | undefined> {
    const publication = await this.getPublication(id);
    if (!publication) return undefined;

    const newFeaturedStatus = publication.isFeatured === 1 ? 0 : 1;
    const [updated] = await db
      .update(publications)
      .set({ isFeatured: newFeaturedStatus })
      .where(eq(publications.id, id))
      .returning();
    
    return updated || undefined;
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

  // Category suggestion methods
  async updateSuggestedCategories(id: string, suggestions: SuggestedCategory[], status: string): Promise<Publication | undefined> {
    const [updated] = await db
      .update(publications)
      .set({
        suggestedCategories: suggestions as any,
        categoryReviewStatus: status,
        // Reset reviewer metadata when new suggestions are generated (allows re-review)
        categoryReviewedBy: null,
        categoryReviewedAt: null
      })
      .where(eq(publications.id, id))
      .returning();
    return updated || undefined;
  }

  async approveCategories(id: string, selectedCategories: string[], reviewerName: string): Promise<Publication | undefined> {
    const [updated] = await db
      .update(publications)
      .set({
        categories: selectedCategories as any,
        categoryReviewStatus: 'reviewed',
        categoryReviewedBy: reviewerName,
        categoryReviewedAt: new Date(),
        categoriesLastUpdatedBy: 'admin',
        suggestedCategories: null
      })
      .where(eq(publications.id, id))
      .returning();
    return updated || undefined;
  }

  async rejectSuggestions(id: string, reviewerName: string): Promise<Publication | undefined> {
    const [updated] = await db
      .update(publications)
      .set({
        categoryReviewStatus: 'reviewed',
        categoryReviewedBy: reviewerName,
        categoryReviewedAt: new Date(),
        suggestedCategories: null
      })
      .where(eq(publications.id, id))
      .returning();
    return updated || undefined;
  }

  async getPublicationsNeedingReview(limit: number, offset: number): Promise<{publications: Publication[], total: number}> {
    // Get publications with:
    // 1. pending_review status (ML suggestions awaiting human review)
    // 2. Legacy data: suggestions but NULL status
    // 3. Uncategorized: approved but have no categories at all
    const whereClause = or(
      eq(publications.categoryReviewStatus, 'pending_review'),
      and(
        sql`${publications.categoryReviewStatus} IS NULL`,
        sql`${publications.suggestedCategories} IS NOT NULL`
      ),
      and(
        eq(publications.status, 'approved'),
        or(
          sql`${publications.categories} IS NULL`,
          sql`jsonb_array_length(${publications.categories}) = 0`
        )
      )
    );
    
    const pubs = await db
      .select()
      .from(publications)
      .where(whereClause)
      .orderBy(desc(publications.categoryReviewedAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(publications)
      .where(whereClause);

    return {
      publications: pubs,
      total: countResult?.count || 0
    };
  }

  async getPublicationsByApprovalStatus(status: "pending" | "approved" | "rejected"): Promise<Publication[]> {
    return db
      .select()
      .from(publications)
      .where(eq(publications.status, status))
      .orderBy(desc(publications.publicationDate));
  }

  async getUncategorizedPublications(): Promise<Publication[]> {
    return db
      .select()
      .from(publications)
      .where(
        and(
          eq(publications.status, "approved"),
          or(
            sql`${publications.categories} IS NULL`,
            sql`jsonb_array_length(${publications.categories}) = 0`
          )
        )
      )
      .orderBy(desc(publications.publicationDate));
  }

  // Remove duplicates by title, keeping the entry with a valid numeric PubMed ID
  async cleanupDuplicatesByTitle(): Promise<number> {
    // Find all duplicate titles
    const duplicates = await db.execute(sql`
      WITH duplicates AS (
        SELECT title, array_agg(id ORDER BY 
          CASE WHEN pmid ~ '^[0-9]+$' THEN 0 ELSE 1 END,
          created_at DESC
        ) as ids
        FROM publications
        GROUP BY title
        HAVING COUNT(*) > 1
      )
      SELECT unnest(ids[2:]) as id_to_delete
      FROM duplicates
    `);

    let deleted = 0;
    for (const row of duplicates.rows as { id_to_delete: string }[]) {
      try {
        await db.delete(publications).where(eq(publications.id, row.id_to_delete));
        deleted++;
      } catch (error) {
        console.error(`Failed to delete duplicate ${row.id_to_delete}:`, error);
      }
    }

    if (deleted > 0) {
      console.log(`Cleaned up ${deleted} duplicate publications by title`);
    }

    return deleted;
  }
}

export const storage = new DatabaseStorage();
