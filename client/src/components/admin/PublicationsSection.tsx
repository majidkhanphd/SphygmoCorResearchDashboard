import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search, Check, X, ExternalLink, Loader2, Pencil, Star, Sparkles, CheckCheck,
} from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/hooks/use-toast";
import { PaginationControls } from "@/components/pagination-controls";
import { RESEARCH_AREAS, RESEARCH_AREA_DISPLAY_NAMES } from "@shared/schema";
import type { Publication } from "@shared/schema";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  ColumnDef,
  ColumnResizeMode,
} from "@tanstack/react-table";
import { invalidateAdminQueries, getConfidenceBadgeClass, getSourceBadgeClass } from "./admin-utils";

export function PublicationsSection() {
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
