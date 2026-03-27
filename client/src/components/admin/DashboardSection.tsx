import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import type { AdminSection, DataQualitySummary } from "./admin-types";

export function DashboardSection({ onNavigate }: { onNavigate: (s: AdminSection) => void }) {
  const { data: statsData } = useQuery<{ success: boolean; stats: { totalByStatus: { pending: number; approved: number; rejected: number } } }>({
    queryKey: ["/api/publications/stats"],
  });

  const { data: qualityData, isLoading: qualityLoading } = useQuery<{ success: boolean; summary: DataQualitySummary }>({
    queryKey: ["/api/admin/data-quality/summary"],
    queryFn: async () => {
      const res = await fetch("/api/admin/data-quality/summary");
      if (!res.ok) return { success: false, summary: { totalPublications: 0, duplicateGroups: 0, missingAbstract: 0, missingDoi: 0, missingCategories: 0, missingAuthors: 0 } };
      const data = await res.json();
      const s = data.summary || {};
      return {
        success: data.success,
        summary: {
          totalPublications: s.totalPublications ?? 0,
          duplicateGroups: s.duplicatesCount ?? s.duplicateGroups ?? 0,
          missingAbstract: s.missingAbstractCount ?? s.missingAbstract ?? 0,
          missingDoi: s.missingDoiCount ?? s.missingDoi ?? 0,
          missingCategories: s.missingCategoriesCount ?? s.missingCategories ?? 0,
          missingAuthors: s.missingAuthorsCount ?? s.missingAuthors ?? 0,
        },
      };
    },
  });

  const stats = statsData?.stats?.totalByStatus || { pending: 0, approved: 0, rejected: 0 };
  const summary = qualityData?.summary;
  const totalPubs = (stats.pending || 0) + (stats.approved || 0) + (stats.rejected || 0);
  const dataIssues = summary ? (summary.missingAbstract + summary.missingDoi + summary.missingCategories + summary.missingAuthors) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#1d1d1f] dark:text-white mb-1">Dashboard</h2>
        <p className="text-sm text-[#6e6e73] dark:text-gray-400">Overview of publication management</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate("publications")}>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-[#6e6e73] dark:text-gray-400 mb-1">Total Publications</div>
            <div className="text-3xl font-bold text-[#1d1d1f] dark:text-white">{totalPubs}</div>
            <div className="flex gap-3 mt-2 text-xs text-[#6e6e73] dark:text-gray-400">
              <span className="text-green-600 dark:text-green-400">{stats.approved} approved</span>
              <span className="text-amber-600 dark:text-amber-400">{stats.pending} pending</span>
              <span className="text-red-600 dark:text-red-400">{stats.rejected} rejected</span>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow border-amber-200 dark:border-amber-800" onClick={() => onNavigate("publications")}>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-[#6e6e73] dark:text-gray-400 mb-1">Pending Review</div>
            <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">{stats.pending || 0}</div>
            <div className="mt-2 text-xs text-[#6e6e73] dark:text-gray-400">Awaiting approval</div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate("data-quality")}>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-[#6e6e73] dark:text-gray-400 mb-1">Data Issues</div>
            <div className="text-3xl font-bold text-[#1d1d1f] dark:text-white">
              {qualityLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : dataIssues}
            </div>
            <div className="mt-2 text-xs text-[#6e6e73] dark:text-gray-400">Publications missing key data</div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate("data-quality")}>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-[#6e6e73] dark:text-gray-400 mb-1">Potential Duplicates</div>
            <div className="text-3xl font-bold text-[#1d1d1f] dark:text-white">
              {qualityLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : (summary?.duplicateGroups || 0)}
            </div>
            <div className="mt-2 text-xs text-[#6e6e73] dark:text-gray-400">Duplicate groups detected</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
