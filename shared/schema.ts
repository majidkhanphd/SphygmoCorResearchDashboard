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
  year: z.number().optional(),
  sortBy: z.enum(["newest", "oldest", "citations", "impact"]).default("newest"),
  limit: z.number().default(20),
  offset: z.number().default(0),
});

export type SearchPublicationsParams = z.infer<typeof searchPublicationsSchema>;
