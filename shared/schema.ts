import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, json, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export type SuggestedCategory = {
  category: string;
  confidence: number;
  source: 'ml' | 'keyword';
};

export const publications = pgTable("publications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pmid: varchar("pmid").unique(), // PubMed ID
  pmcId: varchar("pmc_id"), // PubMed Central ID
  title: text("title").notNull(),
  authors: text("authors").notNull(),
  journal: text("journal").notNull(),
  publicationDate: timestamp("publication_date").notNull(),
  abstract: text("abstract"),
  doi: varchar("doi"),
  keywords: json("keywords").$type<string[]>().default([]),
  researchArea: text("research_area"), // Legacy single research area field
  categories: jsonb("categories").$type<string[]>().default([]), // Multiple selections from 11 fixed research areas
  citationCount: integer("citation_count").default(0),
  isFeatured: integer("is_featured").default(0), // 0 or 1 for boolean
  pubmedUrl: text("pubmed_url"),
  journalImpactFactor: integer("journal_impact_factor"),
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  suggestedCategories: json("suggested_categories").$type<SuggestedCategory[]>(),
  categoryReviewStatus: text("category_review_status"),
  categoryReviewedBy: varchar("category_reviewed_by"),
  categoryReviewedAt: timestamp("category_reviewed_at"),
  categoriesLastUpdatedBy: varchar("categories_last_updated_by"),
  syncSource: text("sync_source").default("unknown"), // Source of the sync (pubmed, pmc, manual)
  keywordEvidence: jsonb("keyword_evidence"), // JSON evidence for keyword-based categorization
  createdAt: timestamp("created_at").defaultNow()
});

// Database backups table for storing backup data
export const databaseBackups = pgTable("database_backups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  description: text("description"),
  recordCount: integer("record_count").notNull(),
  data: jsonb("data").notNull(),
});

export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  color: varchar("color").notNull(), // for UI category badges
});

export const insertPublicationSchema = createInsertSchema(publications).omit({
  id: true,
  createdAt: true,
  categoryReviewedAt: true,
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
});

export type InsertPublication = z.infer<typeof insertPublicationSchema>;
export type Publication = typeof publications.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

// Search and filter schemas
export const searchPublicationsSchema = z.object({
  query: z.string().optional(),
  categories: z.array(z.string()).optional(), // Filter by one or more of the 11 fixed research areas
  venue: z.string().optional(), // Filter by journal/venue
  year: z.number().optional(),
  sortBy: z.enum(["newest", "oldest", "most-cited"]).default("newest"),
  limit: z.number().default(20),
  offset: z.number().default(0),
  featured: z.boolean().optional(), // Filter for featured publications
});

export type SearchPublicationsParams = z.infer<typeof searchPublicationsSchema>;

// Filter counts interface for search response
export interface FilterCounts {
  categories: Record<string, number>; // Counts for each of the 11 research areas
  venues: Record<string, number>;
  childJournalCounts: Record<string, Record<string, number>>; // Parent -> {child: count}
  years: Record<number, number>;
}

// Search response interface with filter counts and pagination
export interface SearchPublicationsResponse {
  publications: Publication[];
  total: number;
  totalPages: number;
  currentPage: number;
  filterCounts: FilterCounts;
}

// Fixed research areas for CONNEQT Health cardiovascular research
export const RESEARCH_AREAS = [
  "Chronic Kidney Disease (CKD)",
  "Chronic Obstructive Pulmonary Disease (COPD)",
  "Early Vascular Aging (EVA)",
  "Heart Failure",
  "Hypertension",
  "Longevity",
  "Maternal Health",
  "Men's Health",
  "Metabolic Health",
  "Neuroscience",
  "Women's Health"
] as const;

export type ResearchArea = typeof RESEARCH_AREAS[number];

// Mapping from slugs to display names
export const RESEARCH_AREA_DISPLAY_NAMES: Record<string, string> = {
  "ckd": "Chronic Kidney Disease (CKD)",
  "copd": "Chronic Obstructive Pulmonary Disease (COPD)",
  "eva": "Early Vascular Aging (EVA)",
  "heart-failure": "Heart Failure",
  "hypertension": "Hypertension",
  "longevity": "Longevity",
  "maternal-health": "Maternal Health",
  "mens-health": "Men's Health",
  "metabolic-health": "Metabolic Health",
  "neuroscience": "Neuroscience",
  "womens-health": "Women's Health"
};

// Reverse mapping from display names to slugs (case-insensitive)
export const RESEARCH_AREA_NAME_TO_SLUG: Record<string, string> = {
  "chronic kidney disease (ckd)": "ckd",
  "chronic kidney disease": "ckd",
  "ckd": "ckd",
  "chronic obstructive pulmonary disease (copd)": "copd",
  "chronic obstructive pulmonary disease": "copd",
  "copd": "copd",
  "early vascular aging (eva)": "eva",
  "early vascular aging": "eva",
  "eva": "eva",
  "heart failure": "heart-failure",
  "hypertension": "hypertension",
  "longevity": "longevity",
  "maternal health": "maternal-health",
  "men's health": "mens-health",
  "metabolic health": "metabolic-health",
  "neuroscience": "neuroscience",
  "women's health": "womens-health"
};

// Mapping from slugs to uppercase abbreviations or short names for badge display
export const RESEARCH_AREA_BADGE_NAMES: Record<string, string> = {
  "ckd": "CKD",
  "copd": "COPD",
  "eva": "EVA",
  "heart-failure": "Heart Failure",
  "hypertension": "Hypertension",
  "longevity": "Longevity",
  "maternal-health": "Maternal Health",
  "mens-health": "Men's Health",
  "metabolic-health": "Metabolic Health",
  "neuroscience": "Neuroscience",
  "womens-health": "Women's Health"
};

// Utility function to get display name from research area slug
export const getResearchAreaDisplayName = (slug: string | null | undefined): string | null => {
  if (!slug) return null;
  return RESEARCH_AREA_DISPLAY_NAMES[slug] || slug;
};

/**
 * Normalize a category string to its canonical slug form
 * Handles various input formats:
 * - "Chronic Kidney Disease (CKD)" -> "ckd"
 * - "Early Vascular Aging (EVA)" -> "eva"
 * - "eva" -> "eva"
 * - "EVA" -> "eva"
 * - "Heart Failure" -> "heart-failure"
 */
export const normalizeCategoryToSlug = (category: string | null | undefined): string | null => {
  if (!category) return null;
  
  const normalized = category.toLowerCase().trim();
  
  // Check direct mapping first
  if (RESEARCH_AREA_NAME_TO_SLUG[normalized]) {
    return RESEARCH_AREA_NAME_TO_SLUG[normalized];
  }
  
  // If it's already a slug (contains hyphens), return as-is
  if (normalized.includes('-')) {
    return normalized;
  }
  
  // Try to extract abbreviation from parentheses if present
  const match = category.match(/\(([A-Z]+)\)/);
  if (match) {
    const abbrev = match[1].toLowerCase();
    if (RESEARCH_AREA_NAME_TO_SLUG[abbrev]) {
      return RESEARCH_AREA_NAME_TO_SLUG[abbrev];
    }
  }
  
  // Return null if we can't normalize it
  return null;
};

/**
 * Get the badge display name for a category
 * Returns uppercase abbreviations for CKD, COPD, EVA
 * Returns title case for others
 */
export const getCategoryBadgeName = (category: string | null | undefined): string | null => {
  if (!category) return null;
  
  // First normalize to slug
  const slug = normalizeCategoryToSlug(category);
  if (!slug) {
    // If we can't normalize, try to extract abbreviation from parentheses
    const match = category.match(/\(([A-Z]+)\)/);
    if (match) {
      return match[1]; // Return the abbreviation in uppercase
    }
    // Otherwise return the category as-is
    return category;
  }
  
  // Return the badge name
  return RESEARCH_AREA_BADGE_NAMES[slug] || slug;
};

/**
 * Normalize an array of categories to slugs
 * Filters out any that can't be normalized
 */
export const normalizeCategoriesArray = (categories: string[] | null | undefined): string[] => {
  if (!categories || !Array.isArray(categories)) return [];
  
  return categories
    .map(cat => normalizeCategoryToSlug(cat))
    .filter((slug): slug is string => slug !== null);
};
