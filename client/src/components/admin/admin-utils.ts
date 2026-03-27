import { queryClient } from "@/lib/queryClient";
import { LayoutDashboard, FileText, ShieldAlert, Settings } from "lucide-react";
import type { AdminSection } from "./admin-types";

export const NAV_ITEMS: { key: AdminSection; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "publications", label: "Publications", icon: FileText },
  { key: "data-quality", label: "Data Quality", icon: ShieldAlert },
  { key: "operations", label: "Operations", icon: Settings },
];

export function invalidateAdminQueries() {
  queryClient.invalidateQueries({ queryKey: ["/api/admin/publications"] });
  queryClient.invalidateQueries({ queryKey: ["/api/admin/publications-list/featured"] });
  queryClient.invalidateQueries({ queryKey: ["/api/admin/publications-list/featured/count"] });
  queryClient.invalidateQueries({ queryKey: ["/api/admin/publications/needing-review"] });
  queryClient.invalidateQueries({ queryKey: ["/api/admin/publications/needing-review/count"] });
  queryClient.invalidateQueries({ queryKey: ["/api/publications/search"] });
  queryClient.invalidateQueries({ queryKey: ["/api/publications/stats"] });
  queryClient.invalidateQueries({ queryKey: ["/api/publications/featured"] });
}

export function getConfidenceBadgeClass(confidence: number) {
  if (confidence >= 0.8) return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
  if (confidence >= 0.6) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
  return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
}

export function getSourceBadgeClass(source: 'ml' | 'keyword') {
  return source === 'ml'
    ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
    : "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
}
