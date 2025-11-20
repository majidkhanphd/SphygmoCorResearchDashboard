/**
 * Export utilities for database migration
 * Used by API endpoints to export/import publications
 */

import * as crypto from "crypto";
import type { Publication } from "../../shared/schema";

export interface ExportManifest {
  exportDate: string;
  totalRecords: number;
  checksum: string;
  publications: Publication[];
}

export function createExportManifest(publications: Publication[]): ExportManifest {
  // Calculate checksum for verification
  const dataString = JSON.stringify(publications.map(p => p.pmid || p.doi).sort());
  const checksum = crypto.createHash('sha256').update(dataString).digest('hex').substring(0, 16);

  return {
    exportDate: new Date().toISOString(),
    totalRecords: publications.length,
    checksum,
    publications
  };
}

export function verifyManifest(manifest: ExportManifest): boolean {
  const dataString = JSON.stringify(manifest.publications.map((p: any) => p.pmid || p.doi).sort());
  const checksum = crypto.createHash('sha256').update(dataString).digest('hex').substring(0, 16);
  return checksum === manifest.checksum;
}
