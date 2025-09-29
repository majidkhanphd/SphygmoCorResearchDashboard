import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const publications = pgTable("publications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pmid: varchar("pmid").unique(), // PubMed ID
  title: text("title").notNull(),
  authors: text("authors").notNull(),
  journal: text("journal").notNull(),
  publicationDate: timestamp("publication_date").notNull(),
  abstract: text("abstract"),
  doi: varchar("doi"),
  categories: json("categories").$type<string[]>().default([]),
  keywords: json("keywords").$type<string[]>().default([]),
  researchArea: text("research_area"), // Apple ML-style research areas
  citationCount: integer("citation_count").default(0),
  isFeatured: integer("is_featured").default(0), // 0 or 1 for boolean
  pubmedUrl: text("pubmed_url"),
  journalImpactFactor: integer("journal_impact_factor"),
  createdAt: timestamp("created_at").defaultNow()
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
  categories: z.array(z.string()).optional(),
  researchArea: z.string().optional(),
  venue: z.string().optional(), // Filter by journal/venue
  year: z.number().optional(),
  sortBy: z.enum(["newest", "oldest", "relevance"]).default("newest"),
  limit: z.number().default(20),
  offset: z.number().default(0),
});

export type SearchPublicationsParams = z.infer<typeof searchPublicationsSchema>;

// Filter counts interface for search response
export interface FilterCounts {
  researchAreas: Record<string, number>;
  venues: Record<string, number>;
  years: Record<number, number>;
  categories: Record<string, number>;
}

// Search response interface with filter counts
export interface SearchPublicationsResponse {
  publications: Publication[];
  total: number;
  filterCounts: FilterCounts;
}

// Research area slug to display name mapping
export const RESEARCH_AREA_DISPLAY_NAMES: Record<string, string> = {
  "biomedical-engineering": "Biomedical Engineering",
  "computer-vision": "Computer Vision",
  "data-analysis": "Data Analysis",
  "methods-algorithms": "Methods and Algorithms",
  "nlp": "Natural Language Processing",
  "health-medical": "Health and Medical Research"
};

// Utility function to get display name from research area slug
export const getResearchAreaDisplayName = (slug: string | null | undefined): string | null => {
  if (!slug) return null;
  return RESEARCH_AREA_DISPLAY_NAMES[slug] || slug;
};
