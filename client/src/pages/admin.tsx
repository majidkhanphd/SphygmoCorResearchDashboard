import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import Navigation from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Search, Check, X, ExternalLink, Loader2, Pencil, Star, Sparkles, CheckCheck,
  LayoutDashboard, FileText, ShieldAlert, Settings, AlertTriangle, Copy, FileQuestion
} from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/hooks/use-toast";
import { PaginationControls } from "@/components/pagination-controls";
import { RESEARCH_AREAS, RESEARCH_AREA_DISPLAY_NAMES } from "@shared/schema";
import type { Publication, SuggestedCategory } from "@shared/schema";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  ColumnDef,
  ColumnResizeMode,
} from "@tanstack/react-table";

type AdminSection = "dashboard" | "publications" | "data-quality" | "operations";

interface SyncStatus {
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

interface BatchCategorizationStatus {
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

interface CitationUpdateStatus {
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

interface DataQualitySummary {
  totalPublications: number;
  duplicateGroups: number;
  missingAbstract: number;
  missingDoi: number;
  missingCategories: number;
  missingAuthors: number;
}

interface DuplicateGroup {
  reason: string;
  publications: Publication[];
}

const NAV_ITEMS: { key: AdminSection; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "publications", label: "Publications", icon: FileText },
  { key: "data-quality", label: "Data Quality", icon: ShieldAlert },
  { key: "operations", label: "Operations", icon: Settings },
];

function invalidateAdminQueries() {
  queryClient.invalidateQueries({ queryKey: ["/api/admin/publications"] });
  queryClient.invalidateQueries({ queryKey: ["/api/admin/publications-list/featured"] });
  queryClient.invalidateQueries({ queryKey: ["/api/admin/publications-list/featured/count"] });
  queryClient.invalidateQueries({ queryKey: ["/api/admin/publications/needing-review"] });
  queryClient.invalidateQueries({ queryKey: ["/api/admin/publications/needing-review/count"] });
  queryClient.invalidateQueries({ queryKey: ["/api/publications/search"] });
  queryClient.invalidateQueries({ queryKey: ["/api/publications/stats"] });
  queryClient.invalidateQueries({ queryKey: ["/api/publications/featured"] });
}

function getConfidenceBadgeClass(confidence: number) {
  if (confidence >= 0.8) return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
  if (confidence >= 0.6) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
  return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
}

function getSourceBadgeClass(source: 'ml' | 'keyword') {
  return source === 'ml'
    ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
    : "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
}

function Sidebar({ active, onNavigate }: { active: AdminSection; onNavigate: (s: AdminSection) => void }) {
  return (
    <aside className="w-14 md:w-[220px] shrink-0 bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 min-h-[calc(100vh-57px)] sticky top-[57px]">
      <nav className="flex flex-col gap-1 p-2 md:p-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full text-left ${
                isActive
                  ? "bg-[#007AFF]/10 text-[#007AFF] dark:bg-[#007AFF]/20 dark:text-[#6cb4ff]"
                  : "text-[#6e6e73] dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-[#1d1d1f] dark:hover:text-white"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="hidden md:inline">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function DashboardSection({ onNavigate }: { onNavigate: (s: AdminSection) => void }) {
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

function PublicationsSection() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "rejected" | "featured" | "category-review">("pending");
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPublication, setEditingPublication] = useState<Publication | null>(null);
  const [editCategories, setEditCategories] = useState<string[]>([]);
  const [editSuggestedCategories, setEditSuggestedCategories] = useState<string[]>([]);
  const [selectedPublications, setSelectedPublications] = useState<Set<string>>(new Set());
  const [bulkGenerateDialogOpen, setBulkGenerateDialogOpen] = useState(false);
  const [bulkGenerateUseML, setBulkGenerateUseML] = useState(true);
  const [columnResizeMode] = useState<ColumnResizeMode>("onEnd");
  const debouncedSearch = useDebounce(searchQuery, 400);
  const { toast } = useToast();

  useEffect(() => { setCurrentPage(1); }, [activeTab, debouncedSearch]);

  const offset = (currentPage - 1) * perPage;
  const searchParam = debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : '';

  const queryUrl = activeTab === "featured"
    ? `/api/admin/publications-list/featured?limit=${perPage}&offset=${offset}${searchParam}`
    : activeTab === "category-review"
    ? `/api/admin/publications/needing-review?limit=${perPage}&offset=${offset}${searchParam}`
    : `/api/admin/publications/${activeTab}?limit=${perPage}&offset=${offset}${searchParam}`;

  const queryKey = activeTab === "featured"
    ? ['/api/admin/publications-list/featured', { limit: perPage, offset, search: debouncedSearch }]
    : activeTab === "category-review"
    ? ['/api/admin/publications/needing-review', { limit: perPage, offset, search: debouncedSearch }]
    : ['/api/admin/publications', activeTab, { limit: perPage, offset, search: debouncedSearch }];

  const { data: publicationsData, isLoading } = useQuery<{ success: boolean; publications: Publication[]; total: number; totalPages: number; currentPage: number }>({
    queryKey,
    queryFn: async () => {
      const response = await fetch(queryUrl);
      if (!response.ok) throw new Error('Failed to fetch publications');
      return response.json();
    },
  });

  const { data: statsData } = useQuery<{ success: boolean; stats: { totalByStatus: { pending: number; approved: number; rejected: number } } }>({
    queryKey: ["/api/publications/stats"],
  });

  const { data: categoryReviewData } = useQuery<{ success: boolean; total: number }>({
    queryKey: ['/api/admin/publications/needing-review/count'],
    queryFn: async () => {
      const response = await fetch('/api/admin/publications/needing-review?limit=1&offset=0');
      if (!response.ok) throw new Error('Failed to fetch category review count');
      const data = await response.json();
      return { success: true, total: data.total || 0 };
    },
  });

  const { data: featuredCountData } = useQuery<{ success: boolean; total: number }>({
    queryKey: ['/api/admin/publications-list/featured/count'],
    queryFn: async () => {
      const response = await fetch('/api/admin/publications-list/featured?limit=1&offset=0');
      if (!response.ok) throw new Error('Failed to fetch featured count');
      const data = await response.json();
      return { success: true, total: data.total || 0 };
    },
  });

  const filteredPublications = publicationsData?.publications || [];
  const stats = statsData?.stats?.totalByStatus || { pending: 0, approved: 0, rejected: 0 };

  const approveMutation = useMutation({
    mutationFn: async (publicationId: string) => await apiRequest("POST", `/api/admin/publications/${publicationId}/approve`),
    onSuccess: () => { invalidateAdminQueries(); toast({ title: "Publication Approved", description: "The publication is now visible on the website." }); },
    onError: (error: any) => { toast({ title: "Approval Failed", description: error.message || "Failed to approve publication", variant: "destructive" }); },
  });

  const rejectMutation = useMutation({
    mutationFn: async (publicationId: string) => await apiRequest("POST", `/api/admin/publications/${publicationId}/reject`),
    onSuccess: () => { invalidateAdminQueries(); toast({ title: "Publication Rejected", description: "The publication has been rejected." }); },
    onError: (error: any) => { toast({ title: "Rejection Failed", description: error.message || "Failed to reject publication", variant: "destructive" }); },
  });

  const updateCategoriesMutation = useMutation({
    mutationFn: async ({ id, categories }: { id: string; categories: string[] }) => await apiRequest("PATCH", `/api/admin/publications/${id}/categories`, { categories }),
    onSuccess: () => { invalidateAdminQueries(); setEditDialogOpen(false); setEditingPublication(null); toast({ title: "Publication Updated", description: "Categories updated successfully." }); },
    onError: (error: any) => { toast({ title: "Update Failed", description: error.message || "Failed to update publication", variant: "destructive" }); },
  });

  const changeStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "pending" | "approved" | "rejected" }) => await apiRequest("PATCH", `/api/admin/publications/${id}/status`, { status }),
    onSuccess: (_data, variables) => {
      invalidateAdminQueries();
      const msgs: Record<string, { title: string; description: string }> = {
        pending: { title: "Publication Moved to Pending", description: "The publication has been moved to pending review." },
        approved: { title: "Publication Approved", description: "The publication is now visible on the website." },
        rejected: { title: "Publication Rejected", description: "The publication has been rejected." },
      };
      toast(msgs[variables.status]);
    },
    onError: (error: any) => { toast({ title: "Status Change Failed", description: error.message || "Failed to change publication status", variant: "destructive" }); },
  });

  const toggleFeaturedMutation = useMutation({
    mutationFn: async (publicationId: string) => await apiRequest("PATCH", `/api/publications/${publicationId}/featured`),
    onSuccess: () => { invalidateAdminQueries(); toast({ title: "Featured Status Updated", description: "The publication's featured status has been toggled." }); },
    onError: (error: any) => { toast({ title: "Toggle Failed", description: error.message || "Failed to toggle featured status", variant: "destructive" }); },
  });

  const generateSuggestionsMutation = useMutation({
    mutationFn: async ({ id, useML = true }: { id: string; useML?: boolean }) => await apiRequest("POST", `/api/admin/publications/${id}/generate-suggestions`, { useML }),
    onSuccess: () => { invalidateAdminQueries(); toast({ title: "Suggestions Generated", description: "Category suggestions have been generated for this publication." }); },
    onError: (error: any) => { toast({ title: "Generation Failed", description: error.message || "Failed to generate suggestions", variant: "destructive" }); },
  });

  const approveCategoriesMutation = useMutation({
    mutationFn: async ({ id, categories }: { id: string; categories: string[] }) => await apiRequest("POST", `/api/admin/publications/${id}/approve-categories`, { categories, reviewerName: 'admin' }),
    onSuccess: () => { invalidateAdminQueries(); setEditDialogOpen(false); setSelectedPublications(new Set()); toast({ title: "Categories Approved", description: "Selected categories have been approved." }); },
    onError: (error: any) => { toast({ title: "Approval Failed", description: error.message || "Failed to approve categories", variant: "destructive" }); },
  });

  const rejectSuggestionsMutation = useMutation({
    mutationFn: async (id: string) => await apiRequest("POST", `/api/admin/publications/${id}/reject-suggestions`, { reviewerName: 'admin' }),
    onSuccess: () => { invalidateAdminQueries(); setSelectedPublications(new Set()); toast({ title: "Suggestions Rejected", description: "Category suggestions have been rejected." }); },
    onError: (error: any) => { toast({ title: "Rejection Failed", description: error.message || "Failed to reject suggestions", variant: "destructive" }); },
  });

  const batchGenerateSuggestionsMutation = useMutation({
    mutationFn: async ({ publicationIds, useML = true }: { publicationIds: string[]; useML?: boolean }) => await apiRequest("POST", "/api/admin/publications/batch-generate-suggestions", { publicationIds, useML }),
    onSuccess: () => { invalidateAdminQueries(); setBulkGenerateDialogOpen(false); setSelectedPublications(new Set()); toast({ title: "Bulk Generation Complete", description: "Category suggestions have been generated for selected publications." }); },
    onError: (error: any) => { toast({ title: "Bulk Generation Failed", description: error.message || "Failed to generate suggestions", variant: "destructive" }); },
  });

  const bulkApproveMutation = useMutation({
    mutationFn: async (publicationIds: string[]) => {
      const promises = publicationIds.map(id => {
        const pub = filteredPublications.find(p => p.id === id);
        if (pub?.suggestedCategories) {
          const categories = pub.suggestedCategories.map(sc => sc.category);
          return apiRequest("POST", `/api/admin/publications/${id}/approve-categories`, { categories, reviewerName: 'admin' });
        }
        return Promise.resolve();
      });
      return Promise.all(promises);
    },
    onSuccess: () => { invalidateAdminQueries(); setSelectedPublications(new Set()); toast({ title: "Bulk Approval Complete", description: "Category suggestions have been approved for selected publications." }); },
    onError: (error: any) => { toast({ title: "Bulk Approval Failed", description: error.message || "Failed to approve categories", variant: "destructive" }); },
  });

  const bulkRejectMutation = useMutation({
    mutationFn: async (publicationIds: string[]) => {
      const promises = publicationIds.map(id => apiRequest("POST", `/api/admin/publications/${id}/reject-suggestions`, { reviewerName: 'admin' }));
      return Promise.all(promises);
    },
    onSuccess: () => { invalidateAdminQueries(); setSelectedPublications(new Set()); toast({ title: "Bulk Rejection Complete", description: "Category suggestions have been rejected for selected publications." }); },
    onError: (error: any) => { toast({ title: "Bulk Rejection Failed", description: error.message || "Failed to reject suggestions", variant: "destructive" }); },
  });

  const openEditDialog = (publication: Publication) => {
    setEditingPublication(publication);
    setEditCategories(publication.categories || []);
    if (publication.suggestedCategories && publication.suggestedCategories.length > 0) {
      setEditSuggestedCategories(publication.suggestedCategories.map(sc => sc.category));
    } else {
      setEditSuggestedCategories([]);
    }
    setEditDialogOpen(true);
  };

  const handleSaveCategories = () => {
    if (!editingPublication) return;
    if (activeTab === "category-review" && editingPublication.suggestedCategories && editingPublication.suggestedCategories.length > 0) {
      approveCategoriesMutation.mutate({ id: editingPublication.id, categories: editSuggestedCategories });
    } else {
      updateCategoriesMutation.mutate({ id: editingPublication.id, categories: editCategories });
    }
  };

  const toggleCategory = (category: string) => {
    setEditCategories(prev => prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]);
  };

  const toggleSuggestedCategory = (category: string) => {
    setEditSuggestedCategories(prev => prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]);
  };

  const handleAcceptAllSuggestions = (publication: Publication) => {
    if (!publication.suggestedCategories || publication.suggestedCategories.length === 0) return;
    approveCategoriesMutation.mutate({ id: publication.id, categories: publication.suggestedCategories.map(sc => sc.category) });
  };

  const handleToggleSelection = (publicationId: string) => {
    setSelectedPublications(prev => {
      const newSet = new Set(prev);
      if (newSet.has(publicationId)) newSet.delete(publicationId);
      else newSet.add(publicationId);
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedPublications.size === filteredPublications.length) setSelectedPublications(new Set());
    else setSelectedPublications(new Set(filteredPublications.map(p => p.id)));
  };

  const baseColumns: ColumnDef<Publication>[] = [
    {
      accessorKey: "title",
      header: "Title",
      size: 350,
      minSize: 200,
      cell: ({ row }) => (
        <div className="space-y-1">
          <div className="text-sm">{row.original.title}</div>
          <div className="text-xs text-[#6e6e73] dark:text-gray-400 line-clamp-1">{row.original.authors}</div>
        </div>
      ),
    },
    {
      accessorKey: "journal",
      header: "Journal",
      size: 150,
      cell: ({ row }) => <div className="text-sm line-clamp-2">{row.original.journal}</div>,
    },
    {
      accessorKey: "publicationDate",
      header: "Date",
      size: 120,
      cell: ({ row }) => (
        <div className="text-sm">
          {new Date(row.original.publicationDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
        </div>
      ),
    },
    {
      accessorKey: "categories",
      header: "Categories",
      size: 100,
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.categories && row.original.categories.length > 0 ? (
            row.original.categories.map((category) => (
              <Badge key={category} variant="secondary" className="text-xs">
                {RESEARCH_AREA_DISPLAY_NAMES[category] || category}
              </Badge>
            ))
          ) : (
            <span className="text-xs text-[#6e6e73] dark:text-gray-400">None</span>
          )}
        </div>
      ),
    },
  ];

  const pendingColumns = useMemo<ColumnDef<Publication>[]>(() => [
    ...baseColumns,
    {
      id: "actions",
      header: "Actions",
      size: 350,
      enableResizing: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2 flex-wrap">
          <Button size="sm" variant="ghost" onClick={() => row.original.pubmedUrl && window.open(row.original.pubmedUrl, '_blank')} className="h-8 w-8 p-0" title="View on PubMed">
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => openEditDialog(row.original)} className="h-8 w-8 p-0" title="Edit Categories">
            <Pencil className="h-4 w-4" />
          </Button>
          {(!row.original.suggestedCategories || row.original.suggestedCategories.length === 0) && (
            <Button size="sm" variant="outline" onClick={() => generateSuggestionsMutation.mutate({ id: row.original.id, useML: true })} disabled={generateSuggestionsMutation.isPending} className="h-8" title="Generate category suggestions">
              <Sparkles className="h-4 w-4 mr-1" />
              Generate
            </Button>
          )}
          <Button size="sm" variant="default" onClick={() => approveMutation.mutate(row.original.id)} disabled={approveMutation.isPending} className="h-8 bg-green-600 hover:bg-green-700 text-white">
            <Check className="h-4 w-4 mr-1" />
            Approve
          </Button>
          <Button size="sm" variant="outline" onClick={() => rejectMutation.mutate(row.original.id)} disabled={rejectMutation.isPending} className="h-8">
            <X className="h-4 w-4 mr-1" />
            Reject
          </Button>
        </div>
      ),
    },
  ], [approveMutation, rejectMutation, generateSuggestionsMutation]);

  const approvedRejectedColumns = useMemo<ColumnDef<Publication>[]>(() => [
    ...baseColumns,
    {
      id: "actions",
      header: "Actions",
      size: 350,
      enableResizing: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2 flex-wrap">
          <Button size="sm" variant="ghost" onClick={() => row.original.pubmedUrl && window.open(row.original.pubmedUrl, '_blank')} className="h-8 w-8 p-0" title="View on PubMed">
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button size="sm" variant={row.original.isFeatured === 1 ? "default" : "ghost"} onClick={() => toggleFeaturedMutation.mutate(row.original.id)} disabled={toggleFeaturedMutation.isPending} className="h-8 w-8 p-0" title={row.original.isFeatured === 1 ? "Remove from Featured" : "Add to Featured"}>
            <Star className={`h-4 w-4 ${row.original.isFeatured === 1 ? 'fill-current' : ''}`} />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => openEditDialog(row.original)} className="h-8 w-8 p-0" title="Edit Categories">
            <Pencil className="h-4 w-4" />
          </Button>
          {(!row.original.suggestedCategories || row.original.suggestedCategories.length === 0) && (
            <Button size="sm" variant="outline" onClick={() => generateSuggestionsMutation.mutate({ id: row.original.id, useML: true })} disabled={generateSuggestionsMutation.isPending} className="h-8" title="Generate category suggestions">
              <Sparkles className="h-4 w-4 mr-1" />
              Generate
            </Button>
          )}
          <Select
            value={row.original.status}
            onValueChange={(value) => changeStatusMutation.mutate({ id: row.original.id, status: value as "pending" | "approved" | "rejected" })}
            disabled={changeStatusMutation.isPending}
          >
            <SelectTrigger className="h-8 w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="pending">Move to Pending</SelectItem>
              <SelectItem value="rejected">Reject</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ),
    },
  ], [changeStatusMutation, toggleFeaturedMutation, generateSuggestionsMutation]);

  const categoryReviewColumns = useMemo<ColumnDef<Publication>[]>(() => [
    {
      id: "select",
      header: () => (
        <Checkbox
          checked={selectedPublications.size === filteredPublications.length && filteredPublications.length > 0}
          onCheckedChange={handleSelectAll}
          aria-label="Select all"
        />
      ),
      size: 50,
      enableResizing: false,
      cell: ({ row }) => (
        <Checkbox
          checked={selectedPublications.has(row.original.id)}
          onCheckedChange={() => handleToggleSelection(row.original.id)}
          aria-label="Select row"
        />
      ),
    },
    {
      accessorKey: "title",
      header: "Publication",
      size: 300,
      minSize: 200,
      cell: ({ row }) => (
        <div className="space-y-2">
          <div className="text-sm font-medium">{row.original.title}</div>
          <div className="text-xs text-[#6e6e73] dark:text-gray-400 line-clamp-1">{row.original.authors}</div>
          <div className="text-xs text-[#6e6e73] dark:text-gray-400">
            {row.original.journal} &bull; {new Date(row.original.publicationDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
          </div>
        </div>
      ),
    },
    {
      accessorKey: "reviewReason",
      header: "Review Reason",
      size: 150,
      cell: ({ row }) => {
        const hasCategories = row.original.categories && row.original.categories.length > 0;
        const hasSuggestions = row.original.suggestedCategories && row.original.suggestedCategories.length > 0;
        const hasLowConfidence = hasSuggestions && row.original.suggestedCategories && row.original.suggestedCategories.some(s => s.confidence < 0.8);
        let reason = "";
        let badgeClass = "";
        if (!hasCategories && !hasSuggestions) { reason = "Uncategorized"; badgeClass = "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"; }
        else if (hasLowConfidence) { reason = "Low Confidence"; badgeClass = "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"; }
        else if (row.original.categoryReviewStatus === 'pending_review') { reason = "Pending Review"; badgeClass = "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"; }
        else { reason = "Needs Review"; badgeClass = "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"; }
        return <Badge className={`text-xs ${badgeClass}`}>{reason}</Badge>;
      },
    },
    {
      accessorKey: "categories",
      header: "Current Categories",
      size: 180,
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.categories && row.original.categories.length > 0 ? (
            row.original.categories.map((category) => (
              <Badge key={category} variant="secondary" className="text-xs">{RESEARCH_AREA_DISPLAY_NAMES[category] || category}</Badge>
            ))
          ) : (
            <span className="text-xs text-[#6e6e73] dark:text-gray-400">None</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "suggestedCategories",
      header: "Suggested Categories",
      size: 280,
      cell: ({ row }) => (
        <div className="space-y-2">
          {row.original.suggestedCategories && row.original.suggestedCategories.length > 0 ? (
            row.original.suggestedCategories.map((suggestion, idx) => (
              <div key={idx} className="flex items-center gap-2 flex-wrap">
                <Badge className={`text-xs ${getConfidenceBadgeClass(suggestion.confidence)}`}>
                  {suggestion.confidence >= 0.8 && <Check className="h-3 w-3 mr-1" />}
                  {RESEARCH_AREA_DISPLAY_NAMES[suggestion.category] || suggestion.category}
                  <span className="ml-1 opacity-75">({Math.round(suggestion.confidence * 100)}%)</span>
                </Badge>
                <Badge className={`text-xs ${getSourceBadgeClass(suggestion.source)}`}>
                  {suggestion.source === 'ml' ? 'ML' : 'Keyword'}
                </Badge>
              </div>
            ))
          ) : (
            <span className="text-xs text-[#6e6e73] dark:text-gray-400">No suggestions</span>
          )}
        </div>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      size: 400,
      enableResizing: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2 flex-wrap">
          <Button size="sm" variant="ghost" onClick={() => row.original.pubmedUrl && window.open(row.original.pubmedUrl, '_blank')} className="h-8 w-8 p-0" title="View on PubMed">
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="default" onClick={() => handleAcceptAllSuggestions(row.original)} disabled={approveCategoriesMutation.isPending || !row.original.suggestedCategories || row.original.suggestedCategories.length === 0} className="h-8 bg-green-600 hover:bg-green-700 text-white">
            <CheckCheck className="h-4 w-4 mr-1" />
            Accept
          </Button>
          <Button size="sm" variant="outline" onClick={() => openEditDialog(row.original)} disabled={!row.original.suggestedCategories || row.original.suggestedCategories.length === 0} className="h-8">
            <Pencil className="h-4 w-4 mr-1" />
            Edit & Approve
          </Button>
          <Button size="sm" variant="outline" onClick={() => rejectSuggestionsMutation.mutate(row.original.id)} disabled={rejectSuggestionsMutation.isPending} className="h-8">
            <X className="h-4 w-4 mr-1" />
            Reject
          </Button>
        </div>
      ),
    },
  ], [selectedPublications, filteredPublications, approveCategoriesMutation, rejectSuggestionsMutation]);

  const pendingTable = useReactTable({ data: filteredPublications, columns: pendingColumns, getCoreRowModel: getCoreRowModel(), columnResizeMode, enableColumnResizing: true });
  const approvedRejectedTable = useReactTable({ data: filteredPublications, columns: approvedRejectedColumns, getCoreRowModel: getCoreRowModel(), columnResizeMode, enableColumnResizing: true });
  const categoryReviewTable = useReactTable({ data: filteredPublications, columns: categoryReviewColumns, getCoreRowModel: getCoreRowModel(), columnResizeMode, enableColumnResizing: true });

  const renderTable = (table: ReturnType<typeof useReactTable<Publication>>) => (
    <div className="overflow-x-auto">
      <table className="w-full" style={{ tableLayout: 'fixed', width: '100%', minWidth: table.getTotalSize() }}>
        <thead className="border-b">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="h-12 px-4 text-left align-middle font-medium text-muted-foreground relative group" style={{ width: header.getSize() }}>
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getCanResize() && (
                    <div
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none ${header.column.getIsResizing() ? 'bg-[#007AFF] w-1' : 'bg-transparent group-hover:bg-gray-300 dark:group-hover:bg-gray-600'}`}
                    />
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-b transition-colors hover:bg-muted/50">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="p-4 align-middle" style={{ width: cell.column.getSize() }}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const activeTable = activeTab === "pending" ? pendingTable : activeTab === "category-review" ? categoryReviewTable : approvedRejectedTable;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#1d1d1f] dark:text-white mb-1">Publications</h2>
        <p className="text-sm text-[#6e6e73] dark:text-gray-400">Review and manage publications</p>
      </div>

      <Card>
        <CardContent className="pt-6 flex justify-center">
          <div className="relative w-full max-w-xl">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#6e6e73] h-4 w-4" />
            <Input
              type="text"
              placeholder="Search by title, author, or journal..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
            {debouncedSearch && publicationsData && (
              <p className="mt-2 text-sm text-[#6e6e73] dark:text-gray-400 text-center">
                Found {publicationsData.total} publication{publicationsData.total !== 1 ? 's' : ''} matching &ldquo;{debouncedSearch}&rdquo;
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
          <CardHeader className="pb-3">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="pending">Pending ({stats.pending || 0})</TabsTrigger>
              <TabsTrigger value="approved">Approved ({stats.approved || 0})</TabsTrigger>
              <TabsTrigger value="rejected">Rejected ({stats.rejected || 0})</TabsTrigger>
              <TabsTrigger value="featured">Featured ({featuredCountData?.total || 0})</TabsTrigger>
              <TabsTrigger value="category-review">Category Review ({categoryReviewData?.total || 0})</TabsTrigger>
            </TabsList>
          </CardHeader>

          {["pending", "approved", "rejected", "featured", "category-review"].map((tab) => (
            <TabsContent key={tab} value={tab} className="mt-0">
              <CardContent className="p-0">
                {tab === "category-review" && selectedPublications.size > 0 && (
                  <div className="p-4 border-b bg-[#f5f5f7] dark:bg-gray-900">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm font-medium text-[#1d1d1f] dark:text-white">{selectedPublications.size} selected</span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setBulkGenerateDialogOpen(true)} disabled={batchGenerateSuggestionsMutation.isPending}>
                          <Sparkles className="h-4 w-4 mr-1" />
                          Bulk Generate Suggestions
                        </Button>
                        <Button size="sm" variant="default" onClick={() => bulkApproveMutation.mutate(Array.from(selectedPublications))} disabled={bulkApproveMutation.isPending} className="bg-green-600 hover:bg-green-700 text-white">
                          <CheckCheck className="h-4 w-4 mr-1" />
                          Bulk Accept
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => bulkRejectMutation.mutate(Array.from(selectedPublications))} disabled={bulkRejectMutation.isPending}>
                          <X className="h-4 w-4 mr-1" />
                          Bulk Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                {isLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-[#007AFF]" />
                  </div>
                ) : filteredPublications.length === 0 ? (
                  <div className="py-16 text-center">
                    <p className="text-[#6e6e73] dark:text-gray-400">
                      {debouncedSearch ? "No publications match your search" : `No ${tab === "category-review" ? "publications need category review" : tab + " publications"}`}
                    </p>
                  </div>
                ) : (
                  <>
                    {renderTable(activeTable)}
                    <div className="p-4 border-t">
                      <PaginationControls total={publicationsData?.total || 0} currentPage={currentPage} perPage={perPage} onPageChange={setCurrentPage} onPerPageChange={setPerPage} />
                    </div>
                  </>
                )}
              </CardContent>
            </TabsContent>
          ))}
        </Tabs>
      </Card>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {activeTab === "category-review" && editingPublication?.suggestedCategories && editingPublication.suggestedCategories.length > 0
                ? "Edit & Approve Categories" : "Edit Categories"}
            </DialogTitle>
            <DialogDescription>
              {activeTab === "category-review" && editingPublication?.suggestedCategories && editingPublication.suggestedCategories.length > 0
                ? "Select suggested categories to approve, or add additional ones"
                : "Select the research areas that apply to this publication"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            {activeTab === "category-review" && editingPublication?.suggestedCategories && editingPublication.suggestedCategories.length > 0 ? (
              <>
                <div className="space-y-3">
                  <h3 className="font-medium text-sm text-[#1d1d1f] dark:text-white">Suggested Categories</h3>
                  {editingPublication.suggestedCategories.map((suggestion) => (
                    <div key={suggestion.category} className="flex items-center space-x-2">
                      <Checkbox id={`suggested-${suggestion.category}`} checked={editSuggestedCategories.includes(suggestion.category)} onCheckedChange={() => toggleSuggestedCategory(suggestion.category)} />
                      <Label htmlFor={`suggested-${suggestion.category}`} className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2">
                        {RESEARCH_AREA_DISPLAY_NAMES[suggestion.category]}
                        <Badge className={`text-xs ${getConfidenceBadgeClass(suggestion.confidence)}`}>{Math.round(suggestion.confidence * 100)}%</Badge>
                        <Badge className={`text-xs ${getSourceBadgeClass(suggestion.source)}`}>{suggestion.source === 'ml' ? 'ML' : 'Keyword'}</Badge>
                      </Label>
                    </div>
                  ))}
                </div>
                <div className="space-y-3 pt-4 border-t">
                  <h3 className="font-medium text-sm text-[#1d1d1f] dark:text-white">Add Other Categories</h3>
                  {RESEARCH_AREAS.filter(area => !editingPublication.suggestedCategories?.some(sc => sc.category === area)).map((area) => (
                    <div key={area} className="flex items-center space-x-2">
                      <Checkbox id={`additional-${area}`} checked={editSuggestedCategories.includes(area)} onCheckedChange={() => toggleSuggestedCategory(area)} />
                      <Label htmlFor={`additional-${area}`} className="text-sm font-medium leading-none cursor-pointer">{RESEARCH_AREA_DISPLAY_NAMES[area]}</Label>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="space-y-3">
                {RESEARCH_AREAS.map((area) => (
                  <div key={area} className="flex items-center space-x-2">
                    <Checkbox id={area} checked={editCategories.includes(area)} onCheckedChange={() => toggleCategory(area)} />
                    <Label htmlFor={area} className="text-sm font-medium leading-none cursor-pointer">{RESEARCH_AREA_DISPLAY_NAMES[area]}</Label>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveCategories} disabled={updateCategoriesMutation.isPending || approveCategoriesMutation.isPending}>
              {(updateCategoriesMutation.isPending || approveCategoriesMutation.isPending) ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
              ) : (
                activeTab === "category-review" && editingPublication?.suggestedCategories && editingPublication.suggestedCategories.length > 0
                  ? "Approve Selected" : "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkGenerateDialogOpen} onOpenChange={setBulkGenerateDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Bulk Generate Suggestions</DialogTitle>
            <DialogDescription>Generate category suggestions for {selectedPublications.size} selected publication{selectedPublications.size !== 1 ? 's' : ''}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex items-center space-x-2">
              <Checkbox id="use-ml" checked={bulkGenerateUseML} onCheckedChange={(checked) => setBulkGenerateUseML(checked as boolean)} />
              <Label htmlFor="use-ml" className="text-sm font-medium leading-none cursor-pointer">Use ML-based suggestions (recommended)</Label>
            </div>
            <p className="text-sm text-[#6e6e73] dark:text-gray-400">
              {bulkGenerateUseML
                ? "ML-based suggestions use advanced models to analyze publication content and provide high-confidence category recommendations."
                : "Keyword-based suggestions use simple keyword matching from publication titles and abstracts."}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkGenerateDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => batchGenerateSuggestionsMutation.mutate({ publicationIds: Array.from(selectedPublications), useML: bulkGenerateUseML })} disabled={batchGenerateSuggestionsMutation.isPending}>
              {batchGenerateSuggestionsMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</> : "Generate Suggestions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DataQualitySection() {
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

function OperationsSection() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [batchCategorizationStatus, setBatchCategorizationStatus] = useState<BatchCategorizationStatus | null>(null);
  const [citationStatus, setCitationStatus] = useState<CitationUpdateStatus | null>(null);
  const [batchCategorizeDialogOpen, setBatchCategorizeDialogOpen] = useState(false);
  const [batchCategorizeFilter, setBatchCategorizeFilter] = useState<"all" | "uncategorized" | "pending" | "approved">("uncategorized");
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  const completionTimeout = useRef<NodeJS.Timeout | null>(null);
  const batchPollingInterval = useRef<NodeJS.Timeout | null>(null);
  const batchCompletionTimeout = useRef<NodeJS.Timeout | null>(null);
  const citationPollingInterval = useRef<NodeJS.Timeout | null>(null);
  const citationCompletionTimeout = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const fetchSyncStatus = async () => {
    try {
      const response = await apiRequest("GET", "/api/admin/sync-status");
      const data = await response.json();
      const newStatus: SyncStatus = {
        status: data.status, type: data.type, phase: data.phase, processed: data.processed,
        total: data.total, imported: data.imported, skipped: data.skipped, approved: data.approved,
        pending: data.pending, startTime: data.startTime || null, endTime: data.endTime || null,
        error: data.error, lastSuccessTime: data.lastSuccessTime || null,
      };
      setSyncStatus(newStatus);
      return newStatus;
    } catch (error) { return null; }
  };

  useEffect(() => {
    if (syncStatus?.status === "running") {
      if (completionTimeout.current) { clearTimeout(completionTimeout.current); completionTimeout.current = null; }
      pollingInterval.current = setInterval(fetchSyncStatus, 2000);
    } else {
      if (pollingInterval.current) { clearInterval(pollingInterval.current); pollingInterval.current = null; }
      if (syncStatus?.status === "completed") {
        invalidateAdminQueries();
        toast({ title: "Sync Complete", description: `Imported ${syncStatus.imported} publications (${syncStatus.approved} approved, ${syncStatus.pending} pending)` });
        if (completionTimeout.current) clearTimeout(completionTimeout.current);
        completionTimeout.current = setTimeout(() => {
          setSyncStatus((current) => current?.status === "completed" ? null : current);
        }, 5000);
      } else if (syncStatus?.status === "error") {
        toast({ title: "Sync Failed", description: syncStatus.error || "An error occurred during sync", variant: "destructive" });
      }
    }
    return () => {
      if (pollingInterval.current) clearInterval(pollingInterval.current);
      if (completionTimeout.current) clearTimeout(completionTimeout.current);
    };
  }, [syncStatus?.status]);

  const fetchBatchCategorizationStatus = async () => {
    try {
      const response = await apiRequest("GET", "/api/admin/batch-categorization/status");
      const data = await response.json();
      setBatchCategorizationStatus({
        status: data.status, filter: data.filter, phase: data.phase, processed: data.processed,
        total: data.total, success: data.success, failed: data.failed, skipped: data.skipped,
        currentPublication: data.currentPublication, startTime: data.startTime || null,
        endTime: data.endTime || null, error: data.error, etaSeconds: data.etaSeconds || null,
      });
    } catch (error) { return null; }
  };

  useEffect(() => {
    if (batchCategorizationStatus?.status === "running") {
      if (batchCompletionTimeout.current) { clearTimeout(batchCompletionTimeout.current); batchCompletionTimeout.current = null; }
      batchPollingInterval.current = setInterval(fetchBatchCategorizationStatus, 500);
    } else {
      if (batchPollingInterval.current) { clearInterval(batchPollingInterval.current); batchPollingInterval.current = null; }
      if (batchCategorizationStatus?.status === "completed") {
        batchCompletionTimeout.current = setTimeout(() => {
          invalidateAdminQueries();
          toast({ title: "Batch Categorization Complete", description: `Successfully categorized ${batchCategorizationStatus.success} publications (${batchCategorizationStatus.skipped} skipped, ${batchCategorizationStatus.failed} failed)` });
        }, 1000);
      }
    }
    return () => {
      if (batchPollingInterval.current) clearInterval(batchPollingInterval.current);
      if (batchCompletionTimeout.current) clearTimeout(batchCompletionTimeout.current);
    };
  }, [batchCategorizationStatus?.status]);

  const fetchCitationStatus = async () => {
    try {
      const response = await apiRequest("GET", "/api/admin/citation-status");
      const data = await response.json();
      setCitationStatus(data);
    } catch (error) { return null; }
  };

  useEffect(() => {
    if (citationStatus?.status === "running") {
      if (citationCompletionTimeout.current) { clearTimeout(citationCompletionTimeout.current); citationCompletionTimeout.current = null; }
      citationPollingInterval.current = setInterval(fetchCitationStatus, 1000);
    } else {
      if (citationPollingInterval.current) { clearInterval(citationPollingInterval.current); citationPollingInterval.current = null; }
      if (citationStatus?.status === "completed") {
        citationCompletionTimeout.current = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/publications/search"] });
          toast({ title: "Citation Update Complete", description: `Updated ${citationStatus.updated} of ${citationStatus.total} publications` });
        }, 1000);
      }
      if (citationStatus?.status === "error") {
        toast({ title: "Citation Update Failed", description: citationStatus.error || "Unknown error occurred", variant: "destructive" });
      }
    }
    return () => {
      if (citationPollingInterval.current) clearInterval(citationPollingInterval.current);
      if (citationCompletionTimeout.current) clearTimeout(citationCompletionTimeout.current);
    };
  }, [citationStatus?.status]);

  useEffect(() => { fetchSyncStatus(); fetchBatchCategorizationStatus(); fetchCitationStatus(); }, []);

  const handleFullSync = async () => {
    try {
      await apiRequest("POST", "/api/admin/sync-pubmed", { maxPerTerm: 5000 });
      toast({ title: "Full Sync Started", description: "Syncing all publications from PubMed. Progress will update automatically." });
      fetchSyncStatus();
    } catch (error: any) { toast({ title: "Sync Failed", description: error.message || "Failed to start full sync", variant: "destructive" }); }
  };

  const handleIncrementalSync = async () => {
    try {
      await apiRequest("POST", "/api/admin/sync-pubmed-incremental", { maxPerTerm: 5000 });
      toast({ title: "Incremental Sync Started", description: "Fetching publications from the past 12 months. Progress will update automatically." });
      fetchSyncStatus();
    } catch (error: any) { toast({ title: "Sync Failed", description: error.message || "Failed to start incremental sync", variant: "destructive" }); }
  };

  const handleCancelSync = async () => {
    try {
      await apiRequest("POST", "/api/admin/sync-cancel");
      toast({ title: "Cancellation Requested", description: "The sync will stop after the current batch completes." });
    } catch (error: any) { toast({ title: "Cancel Failed", description: error.message || "Failed to cancel sync", variant: "destructive" }); }
  };

  const handleRefetchAbstracts = async () => {
    try {
      await apiRequest("POST", "/api/admin/refetch-abstracts");
      toast({ title: "Abstract Refetch Started", description: "Fetching missing abstracts from PubMed. Progress will update automatically." });
      fetchSyncStatus();
    } catch (error: any) { toast({ title: "Refetch Failed", description: error.message || "Failed to start abstract refetch", variant: "destructive" }); }
  };

  const handleUpdateCitations = async () => {
    try {
      const response = await apiRequest("POST", "/api/admin/update-citations");
      const data = await response.json();
      if (data.success) { toast({ title: "Citation Update Started", description: data.message }); fetchCitationStatus(); }
      else { toast({ title: "Update Failed", description: data.message, variant: "destructive" }); }
    } catch (error: any) { toast({ title: "Update Failed", description: error.message || "Failed to start citation update", variant: "destructive" }); }
  };

  const handleStartBatchCategorization = async () => {
    try {
      await apiRequest("POST", "/api/admin/batch-categorization/start", { filter: batchCategorizeFilter });
      toast({ title: "Batch Categorization Started", description: "Generating ML-powered category suggestions. Progress will update automatically." });
      setBatchCategorizeDialogOpen(false);
      fetchBatchCategorizationStatus();
    } catch (error: any) { toast({ title: "Batch Categorization Failed", description: error.message || "Failed to start batch categorization", variant: "destructive" }); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#1d1d1f] dark:text-white mb-1">Operations</h2>
        <p className="text-sm text-[#6e6e73] dark:text-gray-400">Sync, categorization, and citation management</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>PubMed Sync</CardTitle>
          <CardDescription>Sync publications from PubMed Central</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <h3 className="font-medium text-sm text-[#1d1d1f] dark:text-white">Full Sync</h3>
              <p className="text-sm text-[#6e6e73] dark:text-gray-400">Run a complete sync from 2000 to present.</p>
              <Button onClick={handleFullSync} disabled={syncStatus?.status === "running"} className="w-full">
                {syncStatus?.status === "running" && syncStatus.type === "full" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Syncing...</> : "Start Full Sync"}
              </Button>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-sm text-[#1d1d1f] dark:text-white">Incremental Sync</h3>
              <p className="text-sm text-[#6e6e73] dark:text-gray-400">Sync publications from the past 12 months.</p>
              <Button onClick={handleIncrementalSync} disabled={syncStatus?.status === "running"} variant="outline" className="w-full">
                {syncStatus?.status === "running" && syncStatus.type === "incremental" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Syncing...</> : "Sync Past 12 Months"}
              </Button>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-sm text-[#1d1d1f] dark:text-white">Refetch Abstracts</h3>
              <p className="text-sm text-[#6e6e73] dark:text-gray-400">Fetch missing abstracts using improved parser.</p>
              <Button onClick={handleRefetchAbstracts} disabled={syncStatus?.status === "running"} variant="outline" className="w-full">
                {syncStatus?.status === "running" && syncStatus.phase?.includes("abstract") ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Fetching...</> : "Refetch Missing Abstracts"}
              </Button>
            </div>
          </div>

          {syncStatus?.status === "running" && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                  <span className="font-medium text-sm text-blue-900 dark:text-blue-100">{syncStatus.phase}</span>
                </div>
                <span className="text-sm text-blue-700 dark:text-blue-300">{syncStatus.processed}/{syncStatus.total} batches</span>
              </div>
              <Progress value={syncStatus.total > 0 ? (syncStatus.processed / syncStatus.total) * 100 : 0} className="h-2 mb-2" />
              <div className="flex items-center justify-between">
                <div className="flex gap-4 text-xs text-blue-700 dark:text-blue-300">
                  <span>Imported: {syncStatus.imported}</span>
                  <span>Skipped: {syncStatus.skipped}</span>
                  <span>Approved: {syncStatus.approved}</span>
                  <span>Pending: {syncStatus.pending}</span>
                </div>
                <Button onClick={handleCancelSync} variant="destructive" size="sm" className="ml-4">
                  <X className="mr-1 h-3 w-3" />Cancel Sync
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ML Categorization</CardTitle>
          <CardDescription>Generate ML-powered category suggestions for multiple publications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-[#6e6e73] dark:text-gray-400">
            Use GPT-5 nano to automatically generate category suggestions for publications. High-confidence suggestions (&ge;80%) are auto-approved, while others are flagged for manual review.
          </p>
          <Button onClick={() => setBatchCategorizeDialogOpen(true)} disabled={batchCategorizationStatus?.status === "running"} variant="outline">
            {batchCategorizationStatus?.status === "running" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Categorizing...</> : <><Sparkles className="mr-2 h-4 w-4" />Bulk Generate Categories</>}
          </Button>

          {batchCategorizationStatus?.status === "running" && (() => {
            const percentage = batchCategorizationStatus.total > 0 ? (batchCategorizationStatus.processed / batchCategorizationStatus.total) * 100 : 0;
            let etaText = "Calculating...";
            if (batchCategorizationStatus.etaSeconds !== null && batchCategorizationStatus.etaSeconds >= 0) {
              const etaSec = batchCategorizationStatus.etaSeconds;
              etaText = etaSec < 60 ? `~${etaSec}s remaining` : `~${Math.ceil(etaSec / 60)} min${Math.ceil(etaSec / 60) > 1 ? 's' : ''} remaining`;
            }
            return (
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-purple-600 dark:text-purple-400" />
                    <span className="font-medium text-sm text-purple-900 dark:text-purple-100">{batchCategorizationStatus.phase}</span>
                  </div>
                  <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">{percentage.toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-purple-700 dark:text-purple-300">{batchCategorizationStatus.processed}/{batchCategorizationStatus.total} publications</span>
                  <span className="text-xs text-purple-600 dark:text-purple-400">{etaText}</span>
                </div>
                <Progress value={percentage} className="h-2 mb-2" />
                <div className="flex gap-4 text-xs text-purple-700 dark:text-purple-300">
                  <span>Success: {batchCategorizationStatus.success}</span>
                  <span>Skipped: {batchCategorizationStatus.skipped}</span>
                  <span>Failed: {batchCategorizationStatus.failed}</span>
                </div>
                {batchCategorizationStatus.currentPublication && (
                  <p className="mt-2 text-xs text-purple-600 dark:text-purple-400 truncate">Current: {batchCategorizationStatus.currentPublication}</p>
                )}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Citation Updates</CardTitle>
          <CardDescription>Fetch citation counts from OpenAlex for all publications with DOIs</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleUpdateCitations} disabled={citationStatus?.status === "running" || syncStatus?.status === "running"} variant="outline">
            {citationStatus?.status === "running" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating...</> : "Update Citation Counts"}
          </Button>

          {citationStatus?.status === "running" && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-blue-900 dark:text-blue-100">{citationStatus.phase}</span>
                <span className="text-sm text-blue-700 dark:text-blue-300">{citationStatus.processed}/{citationStatus.total}</span>
              </div>
              <Progress value={citationStatus.total > 0 ? (citationStatus.processed / citationStatus.total) * 100 : 0} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={batchCategorizeDialogOpen} onOpenChange={setBatchCategorizeDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Bulk Generate Categories</DialogTitle>
            <DialogDescription>Use GPT-5 nano to generate ML-powered category suggestions for publications</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="filter-select">Select Publications</Label>
              <Select value={batchCategorizeFilter} onValueChange={(value: "all" | "uncategorized" | "pending" | "approved") => setBatchCategorizeFilter(value)}>
                <SelectTrigger id="filter-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="uncategorized">Uncategorized Only (Approved publications with no categories)</SelectItem>
                  <SelectItem value="approved">All Approved Publications</SelectItem>
                  <SelectItem value="pending">Pending Publications</SelectItem>
                  <SelectItem value="all">All Publications (Pending + Approved)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>How it works:</strong> GPT-5 nano analyzes each publication's title and abstract to suggest relevant research areas. High-confidence suggestions (&ge;80%) are auto-approved, while lower confidence suggestions are flagged for manual review in the Category Review tab.
              </p>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-900 dark:text-amber-100">
                <strong>Cost:</strong> ~$0.13 for all 2,911 publications using GPT-5 nano ($0.05/1M input, $0.40/1M output tokens)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchCategorizeDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleStartBatchCategorization}>
              <Sparkles className="mr-2 h-4 w-4" />Start Categorization
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Admin() {
  const [activeSection, setActiveSection] = useState<AdminSection>("dashboard");

  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-black">
      <Navigation />
      <div className="flex">
        <Sidebar active={activeSection} onNavigate={setActiveSection} />
        <main className="flex-1 min-w-0 p-6 lg:p-8">
          {activeSection === "dashboard" && <DashboardSection onNavigate={setActiveSection} />}
          {activeSection === "publications" && <PublicationsSection />}
          {activeSection === "data-quality" && <DataQualitySection />}
          {activeSection === "operations" && <OperationsSection />}
        </main>
      </div>
    </div>
  );
}
