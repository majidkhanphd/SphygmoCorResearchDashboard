import { apiRequest } from "@/lib/queryClient";
import type { SearchPublicationsResponse } from "@shared/schema";

export interface PubMedSearchResult {
  imported: number;
  publications: any[];
  message: string;
}

export async function searchPubMed(query: string, maxResults: number = 20): Promise<PubMedSearchResult> {
  const response = await apiRequest("POST", "/api/pubmed/search", {
    query,
    maxResults
  });
  
  return response.json();
}

export async function getPublicationStats() {
  const response = await apiRequest("GET", "/api/publications/stats");
  return response.json();
}

export async function getFeaturedPublications() {
  const response = await apiRequest("GET", "/api/publications/featured");
  return response.json();
}

export async function searchPublications(params: {
  query?: string;
  categories?: string[];
  researchArea?: string;
  venue?: string;
  year?: number;
  sortBy?: string;
  limit?: number;
  offset?: number;
}): Promise<SearchPublicationsResponse> {
  const searchParams = new URLSearchParams();
  
  if (params.query) searchParams.append("query", params.query);
  if (params.categories) searchParams.append("categories", params.categories.join(","));
  if (params.researchArea) searchParams.append("researchArea", params.researchArea);
  if (params.venue) searchParams.append("venue", params.venue);
  if (params.year) searchParams.append("year", params.year.toString());
  if (params.sortBy) searchParams.append("sortBy", params.sortBy);
  if (params.limit) searchParams.append("limit", params.limit.toString());
  if (params.offset) searchParams.append("offset", params.offset.toString());

  const response = await apiRequest("GET", `/api/publications/search?${searchParams.toString()}`);
  return response.json();
}

export async function getCategories() {
  const response = await apiRequest("GET", "/api/categories");
  return response.json();
}
