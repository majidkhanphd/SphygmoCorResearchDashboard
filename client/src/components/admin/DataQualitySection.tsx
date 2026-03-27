import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Loader2, AlertTriangle, Copy, FileQuestion } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PaginationControls } from "@/components/pagination-controls";
import type { Publication } from "@shared/schema";
import type { DuplicateGroup } from "./admin-types";

export function DataQualitySection() {
  const [subTab, setSubTab] = useState<"duplicates" | "missing">("duplicates");
  const [missingFilter, setMissingFilter] = useState("all");
  const [missingPage, setMissingPage] = useState(1);
  const [missingPerPage, setMissingPerPage] = useState(25);
  const { toast } = useToast();

  const missingOffset = (missingPage - 1) * missingPerPage;

  const { data: duplicatesData, isLoading: duplicatesLoading } = useQuery<{ success: boolean; groups: DuplicateGroup[]; totalGroups: number }>({
    queryKey: ["/api/admin/data-quality/duplicates", { limit: 20, offset: 0 }],
    queryFn: async () => {
      const res = await fetch("/api/admin/data-quality/duplicates?limit=20&offset=0");
      if (!res.ok) return { success: false, groups: [], totalGroups: 0 };
      return res.json();
    },
  });

  const { data: missingData, isLoading: missingLoading } = useQuery<{ success: boolean; publications: Publication[]; total: number; counts: { noAbstract: number; noDoi: number; noCategories: number; noAuthors: number } }>({
    queryKey: ["/api/admin/data-quality/missing", { filter: missingFilter, limit: missingPerPage, offset: missingOffset }],
    queryFn: async () => {
      const res = await fetch(`/api/admin/data-quality/missing?filter=${missingFilter}&limit=${missingPerPage}&offset=${missingOffset}`);
      if (!res.ok) return { success: false, publications: [], total: 0, counts: { noAbstract: 0, noDoi: 0, noCategories: 0, noAuthors: 0 } };
      return res.json();
    },
  });

  const dismissDuplicateMutation = useMutation({
    mutationFn: async (id: string) => await apiRequest("POST", `/api/admin/data-quality/duplicates/${id}/dismiss`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/data-quality/duplicates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/data-quality/summary"] });
      toast({ title: "Duplicate Dismissed", description: "The duplicate group has been dismissed." });
    },
    onError: (error: any) => { toast({ title: "Dismiss Failed", description: error.message || "Failed to dismiss duplicate", variant: "destructive" }); },
  });

  const counts = missingData?.counts || { noAbstract: 0, noDoi: 0, noCategories: 0, noAuthors: 0 };

  const filterOptions = [
    { key: "all", label: "All", count: (counts.noAbstract + counts.noDoi + counts.noCategories + counts.noAuthors) },
    { key: "no-abstract", label: "No Abstract", count: counts.noAbstract },
    { key: "no-doi", label: "No DOI", count: counts.noDoi },
    { key: "no-categories", label: "No Categories", count: counts.noCategories },
    { key: "no-authors", label: "No Authors", count: counts.noAuthors },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#1d1d1f] dark:text-white mb-1">Data Quality</h2>
        <p className="text-sm text-[#6e6e73] dark:text-gray-400">Identify and resolve data quality issues</p>
      </div>

      <div className="flex gap-2">
        <Button variant={subTab === "duplicates" ? "default" : "outline"} onClick={() => setSubTab("duplicates")} className={subTab === "duplicates" ? "bg-[#007AFF] hover:bg-[#0066d6]" : ""}>
          <Copy className="h-4 w-4 mr-2" />
          Duplicates
          {duplicatesData && <Badge variant="secondary" className="ml-2">{duplicatesData.totalGroups}</Badge>}
        </Button>
        <Button variant={subTab === "missing" ? "default" : "outline"} onClick={() => setSubTab("missing")} className={subTab === "missing" ? "bg-[#007AFF] hover:bg-[#0066d6]" : ""}>
          <FileQuestion className="h-4 w-4 mr-2" />
          Missing Data
        </Button>
      </div>

      {subTab === "duplicates" && (
        <div className="space-y-4">
          {duplicatesLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-[#007AFF]" /></div>
          ) : !duplicatesData?.groups || duplicatesData.groups.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Check className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <p className="text-[#6e6e73] dark:text-gray-400">No duplicate publications detected</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <p className="text-sm text-[#6e6e73] dark:text-gray-400">{duplicatesData.totalGroups} duplicate group{duplicatesData.totalGroups !== 1 ? 's' : ''} found</p>
              {duplicatesData.groups.map((group, gi) => (
                <Card key={gi}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <CardTitle className="text-base">{group.reason}</CardTitle>
                        <Badge variant="secondary">{group.publications.length} publications</Badge>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => dismissDuplicateMutation.mutate(String(gi))} disabled={dismissDuplicateMutation.isPending}>
                        Dismiss
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-3 font-medium text-[#6e6e73] dark:text-gray-400">Title</th>
                            <th className="text-left py-2 px-3 font-medium text-[#6e6e73] dark:text-gray-400">Journal</th>
                            <th className="text-left py-2 px-3 font-medium text-[#6e6e73] dark:text-gray-400">Date</th>
                            <th className="text-left py-2 px-3 font-medium text-[#6e6e73] dark:text-gray-400">DOI</th>
                            <th className="text-left py-2 px-3 font-medium text-[#6e6e73] dark:text-gray-400">PMID</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.publications.map((pub) => (
                            <tr key={pub.id} className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                              <td className="py-2 px-3 max-w-[300px] truncate">{pub.title}</td>
                              <td className="py-2 px-3 max-w-[150px] truncate text-[#6e6e73] dark:text-gray-400">{pub.journal}</td>
                              <td className="py-2 px-3 whitespace-nowrap text-[#6e6e73] dark:text-gray-400">{new Date(pub.publicationDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}</td>
                              <td className="py-2 px-3 text-[#6e6e73] dark:text-gray-400 text-xs">{pub.doi || "—"}</td>
                              <td className="py-2 px-3 text-[#6e6e73] dark:text-gray-400 text-xs">{pub.pmid || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>
      )}

      {subTab === "missing" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((opt) => (
              <Button
                key={opt.key}
                size="sm"
                variant={missingFilter === opt.key ? "default" : "outline"}
                onClick={() => { setMissingFilter(opt.key); setMissingPage(1); }}
                className={missingFilter === opt.key ? "bg-[#007AFF] hover:bg-[#0066d6]" : ""}
              >
                {opt.label}
                <Badge variant="secondary" className="ml-2">{opt.count}</Badge>
              </Button>
            ))}
          </div>

          {missingLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-[#007AFF]" /></div>
          ) : !missingData?.publications || missingData.publications.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Check className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <p className="text-[#6e6e73] dark:text-gray-400">No publications with missing data found</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium text-[#6e6e73] dark:text-gray-400">Title</th>
                        <th className="text-left py-3 px-4 font-medium text-[#6e6e73] dark:text-gray-400">Journal</th>
                        <th className="text-left py-3 px-4 font-medium text-[#6e6e73] dark:text-gray-400">Missing Fields</th>
                      </tr>
                    </thead>
                    <tbody>
                      {missingData.publications.map((pub) => {
                        const missing: string[] = [];
                        if (!pub.abstract) missing.push("Abstract");
                        if (!pub.doi) missing.push("DOI");
                        if (!pub.categories || pub.categories.length === 0) missing.push("Categories");
                        if (!pub.authors || pub.authors.trim() === "") missing.push("Authors");
                        return (
                          <tr key={pub.id} className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td className="py-3 px-4 max-w-[400px]">
                              <div className="truncate font-medium">{pub.title}</div>
                              <div className="text-xs text-[#6e6e73] dark:text-gray-400 truncate mt-1">{pub.authors}</div>
                            </td>
                            <td className="py-3 px-4 max-w-[200px] truncate text-[#6e6e73] dark:text-gray-400">{pub.journal}</td>
                            <td className="py-3 px-4">
                              <div className="flex flex-wrap gap-1">
                                {missing.map((field) => (
                                  <Badge key={field} variant="destructive" className="text-xs">{field}</Badge>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="p-4 border-t">
                  <PaginationControls total={missingData.total} currentPage={missingPage} perPage={missingPerPage} onPageChange={setMissingPage} onPerPageChange={setMissingPerPage} />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
