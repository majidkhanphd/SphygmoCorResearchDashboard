import type { Publication } from "@shared/schema";

export type AdminSection = "dashboard" | "publications" | "data-quality" | "operations";

export interface SyncStatus {
  status: "idle" | "running" | "completed" | "error";
  type: "full" | "incremental" | null;
  phase: string;
  processed: number;
  total: number;
  imported: number;
  skipped: number;
  approved: number;
  pending: number;
  startTime: number | null;
  endTime: number | null;
  error: string | null;
  lastSuccessTime: number | null;
}

export interface BatchCategorizationStatus {
  status: "idle" | "running" | "completed" | "error";
  filter: "all" | "uncategorized" | "pending" | "approved" | null;
  phase: string;
  processed: number;
  total: number;
  success: number;
  failed: number;
  skipped: number;
  currentPublication: string | null;
  startTime: number | null;
  endTime: number | null;
  error: string | null;
  etaSeconds: number | null;
}

export interface CitationUpdateStatus {
  status: "idle" | "running" | "completed" | "error";
  phase: string;
  processed: number;
  total: number;
  updated: number;
  startTime: number | null;
  endTime: number | null;
  error: string | null;
  lastSuccessTime: number | null;
}

export interface DataQualitySummary {
  totalPublications: number;
  duplicateGroups: number;
  missingAbstract: number;
  missingDoi: number;
  missingCategories: number;
  missingAuthors: number;
}

export interface DuplicateGroup {
  reason: string;
  publications: Publication[];
}
