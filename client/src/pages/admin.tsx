import { useState, useMemo } from "react";
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
import { Search, Check, X, ExternalLink, Loader2, Pencil } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/hooks/use-toast";
import { RESEARCH_AREAS, RESEARCH_AREA_DISPLAY_NAMES } from "@shared/schema";
import type { Publication } from "@shared/schema";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  ColumnDef,
  ColumnResizeMode,
} from "@tanstack/react-table";

export default function Admin() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPublication, setEditingPublication] = useState<Publication | null>(null);
  const [editCategories, setEditCategories] = useState<string[]>([]);
  const [columnResizeMode] = useState<ColumnResizeMode>("onEnd");
  const [isSyncingFull, setIsSyncingFull] = useState(false);
  const [isSyncingIncremental, setIsSyncingIncremental] = useState(false);
  const debouncedSearch = useDebounce(searchQuery, 400);
  const { toast } = useToast();

  const { data: publicationsData, isLoading } = useQuery<{ success: boolean; publications: Publication[]; total: number }>({
    queryKey: [`/api/admin/publications/${activeTab}`],
  });

  const { data: statsData } = useQuery<{ success: boolean; stats: { totalByStatus: { pending: number; approved: number; rejected: number } } }>({
    queryKey: ["/api/publications/stats"],
  });

  const approveMutation = useMutation({
    mutationFn: async (publicationId: string) => {
      return await apiRequest("POST", `/api/admin/publications/${publicationId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications/approved"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications/rejected"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/search"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/stats"] });
      toast({
        title: "Publication Approved",
        description: "The publication is now visible on the website.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Approval Failed",
        description: error.message || "Failed to approve publication",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (publicationId: string) => {
      return await apiRequest("POST", `/api/admin/publications/${publicationId}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications/approved"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications/rejected"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/search"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/stats"] });
      toast({
        title: "Publication Rejected",
        description: "The publication has been rejected.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Rejection Failed",
        description: error.message || "Failed to reject publication",
        variant: "destructive",
      });
    },
  });

  const updateCategoriesMutation = useMutation({
    mutationFn: async ({ id, categories }: { id: string; categories: string[] }) => {
      return await apiRequest("PATCH", `/api/admin/publications/${id}/categories`, {
        categories,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications/approved"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications/rejected"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/search"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/stats"] });
      setEditDialogOpen(false);
      setEditingPublication(null);
      toast({
        title: "Publication Updated",
        description: "Categories updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update publication",
        variant: "destructive",
      });
    },
  });

  const changeStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "pending" | "approved" | "rejected" }) => {
      return await apiRequest("PATCH", `/api/admin/publications/${id}/status`, {
        status,
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications/approved"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications/rejected"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/search"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/stats"] });
      const statusMessages = {
        pending: { title: "Publication Moved to Pending", description: "The publication has been moved to pending review." },
        approved: { title: "Publication Approved", description: "The publication is now visible on the website." },
        rejected: { title: "Publication Rejected", description: "The publication has been rejected." },
      };
      toast(statusMessages[variables.status]);
    },
    onError: (error: any) => {
      toast({
        title: "Status Change Failed",
        description: error.message || "Failed to change publication status",
        variant: "destructive",
      });
    },
  });

  const handleFullSync = async () => {
    setIsSyncingFull(true);
    try {
      const response: any = await apiRequest("POST", "/api/admin/sync-pubmed", {
        maxPerTerm: 5000,
      });
      toast({
        title: "Full Sync Started",
        description: response.message || "PubMed full sync started in background. Check logs for progress.",
      });
    } catch (error: any) {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to start full sync",
        variant: "destructive",
      });
    } finally {
      setIsSyncingFull(false);
    }
  };

  const handleIncrementalSync = async () => {
    setIsSyncingIncremental(true);
    try {
      const response: any = await apiRequest("POST", "/api/admin/sync-pubmed-incremental", {
        maxPerTerm: 5000,
      });
      toast({
        title: "Incremental Sync Started",
        description: response.message || "Incremental sync started. Fetching new publications since last sync.",
      });
    } catch (error: any) {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to start incremental sync",
        variant: "destructive",
      });
    } finally {
      setIsSyncingIncremental(false);
    }
  };

  const openEditDialog = (publication: Publication) => {
    setEditingPublication(publication);
    setEditCategories(publication.categories || []);
    setEditDialogOpen(true);
  };

  const handleSaveCategories = () => {
    if (!editingPublication) return;
    
    updateCategoriesMutation.mutate({
      id: editingPublication.id,
      categories: editCategories,
    });
  };

  const toggleCategory = (category: string) => {
    setEditCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const filteredPublications = publicationsData?.publications.filter(pub => {
    if (!debouncedSearch) return true;
    const search = debouncedSearch.toLowerCase();
    return (
      pub.title.toLowerCase().includes(search) ||
      pub.authors.toLowerCase().includes(search) ||
      pub.journal.toLowerCase().includes(search)
    );
  }) || [];

  const stats = statsData?.stats?.totalByStatus || { pending: 0, approved: 0, rejected: 0 };

  const pendingColumns = useMemo<ColumnDef<Publication>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Title",
        size: 350,
        minSize: 200,
        cell: ({ row }) => (
          <div className="space-y-1">
            <div className="line-clamp-2 text-sm" data-testid={`text-title-${row.original.id}`}>
              {row.original.title}
            </div>
            <div className="text-xs text-[#6e6e73] dark:text-gray-400 line-clamp-1" data-testid={`text-authors-${row.original.id}`}>
              {row.original.authors}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "journal",
        header: "Journal",
        size: 150,
        cell: ({ row }) => (
          <div className="text-sm line-clamp-2" data-testid={`text-journal-${row.original.id}`}>
            {row.original.journal}
          </div>
        ),
      },
      {
        accessorKey: "publicationDate",
        header: "Date",
        size: 120,
        cell: ({ row }) => (
          <div className="text-sm" data-testid={`text-date-${row.original.id}`}>
            {new Date(row.original.publicationDate).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'short' 
            })}
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
                <Badge key={category} variant="secondary" className="text-xs" data-testid={`badge-category-${row.original.id}-${category}`}>
                  {RESEARCH_AREA_DISPLAY_NAMES[category] || category}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-[#6e6e73] dark:text-gray-400">None</span>
            )}
          </div>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        size: 280,
        enableResizing: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => row.original.pubmedUrl && window.open(row.original.pubmedUrl, '_blank')}
              className="h-8 w-8 p-0"
              title="View on PubMed"
              data-testid={`button-view-${row.original.id}`}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => openEditDialog(row.original)}
              className="h-8 w-8 p-0"
              title="Edit Categories"
              data-testid={`button-edit-${row.original.id}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={() => approveMutation.mutate(row.original.id)}
              disabled={approveMutation.isPending}
              className="h-8 bg-green-600 hover:bg-green-700 text-white"
              data-testid={`button-approve-${row.original.id}`}
            >
              <Check className="h-4 w-4 mr-1" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => rejectMutation.mutate(row.original.id)}
              disabled={rejectMutation.isPending}
              className="h-8"
              data-testid={`button-reject-${row.original.id}`}
            >
              <X className="h-4 w-4 mr-1" />
              Reject
            </Button>
          </div>
        ),
      },
    ],
    [approveMutation, rejectMutation]
  );

  const approvedRejectedColumns = useMemo<ColumnDef<Publication>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Title",
        size: 350,
        minSize: 200,
        cell: ({ row }) => (
          <div className="space-y-1">
            <div className="line-clamp-2 text-sm" data-testid={`text-title-${row.original.id}`}>
              {row.original.title}
            </div>
            <div className="text-xs text-[#6e6e73] dark:text-gray-400 line-clamp-1" data-testid={`text-authors-${row.original.id}`}>
              {row.original.authors}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "journal",
        header: "Journal",
        size: 150,
        cell: ({ row }) => (
          <div className="text-sm line-clamp-2" data-testid={`text-journal-${row.original.id}`}>
            {row.original.journal}
          </div>
        ),
      },
      {
        accessorKey: "publicationDate",
        header: "Date",
        size: 120,
        cell: ({ row }) => (
          <div className="text-sm" data-testid={`text-date-${row.original.id}`}>
            {new Date(row.original.publicationDate).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'short' 
            })}
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
                <Badge key={category} variant="secondary" className="text-xs" data-testid={`badge-category-${row.original.id}-${category}`}>
                  {RESEARCH_AREA_DISPLAY_NAMES[category] || category}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-[#6e6e73] dark:text-gray-400">None</span>
            )}
          </div>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        size: 280,
        enableResizing: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => row.original.pubmedUrl && window.open(row.original.pubmedUrl, '_blank')}
              className="h-8 w-8 p-0"
              title="View on PubMed"
              data-testid={`button-view-${row.original.id}`}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => openEditDialog(row.original)}
              className="h-8 w-8 p-0"
              title="Edit Categories"
              data-testid={`button-edit-${row.original.id}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Select
              value={activeTab}
              onValueChange={(value) => changeStatusMutation.mutate({ id: row.original.id, status: value as "pending" | "approved" | "rejected" })}
              disabled={changeStatusMutation.isPending}
            >
              <SelectTrigger className="h-8 w-[140px]" data-testid={`select-status-${row.original.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="approved" data-testid="option-status-approved">Approved</SelectItem>
                <SelectItem value="pending" data-testid="option-status-pending">Move to Pending</SelectItem>
                <SelectItem value="rejected" data-testid="option-status-rejected">Reject</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ),
      },
    ],
    [activeTab, changeStatusMutation]
  );

  const pendingTable = useReactTable({
    data: filteredPublications,
    columns: pendingColumns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode,
    enableColumnResizing: true,
  });

  const approvedRejectedTable = useReactTable({
    data: filteredPublications,
    columns: approvedRejectedColumns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode,
    enableColumnResizing: true,
  });

  const renderTable = (table: ReturnType<typeof useReactTable<Publication>>) => (
    <div className="overflow-x-auto">
      <table className="w-full" style={{ tableLayout: 'fixed', width: table.getTotalSize() }}>
        <thead className="border-b">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="h-12 px-4 text-left align-middle font-medium text-muted-foreground relative group"
                  style={{ width: header.getSize() }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getCanResize() && (
                    <div
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none ${
                        header.column.getIsResizing() 
                          ? 'bg-[#007AFF] w-1' 
                          : 'bg-transparent group-hover:bg-gray-300 dark:group-hover:bg-gray-600'
                      }`}
                    />
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-b transition-colors hover:bg-muted/50" data-testid={`row-publication-${row.original.id}`}>
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className="p-4 align-middle"
                  style={{ width: cell.column.getSize() }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-black">
      <Navigation />
      
      <main className="max-w-[980px] mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-[#1d1d1f] dark:text-white mb-3">
            Publication Admin
          </h1>
          <p className="text-lg text-[#6e6e73] dark:text-gray-400">
            Review and manage publications
          </p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>PubMed Sync</CardTitle>
            <CardDescription>Sync publications from PubMed Central</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <h3 className="font-medium mb-2 text-sm text-[#1d1d1f] dark:text-white">Full Sync</h3>
                <p className="text-sm text-[#6e6e73] dark:text-gray-400 mb-3">
                  Run a complete sync from 2000 to present. This will fetch all SphygmoCor publications from PubMed Central.
                </p>
                <Button 
                  onClick={handleFullSync} 
                  disabled={isSyncingFull || isSyncingIncremental}
                  className="w-full sm:w-auto"
                  data-testid="button-full-sync"
                >
                  {isSyncingFull ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    "Start Full Sync"
                  )}
                </Button>
              </div>
              <div className="flex-1">
                <h3 className="font-medium mb-2 text-sm text-[#1d1d1f] dark:text-white">Incremental Sync</h3>
                <p className="text-sm text-[#6e6e73] dark:text-gray-400 mb-3">
                  Sync only new publications since the most recent one in your database. Faster and more efficient.
                </p>
                <Button 
                  onClick={handleIncrementalSync} 
                  disabled={isSyncingFull || isSyncingIncremental}
                  variant="outline"
                  className="w-full sm:w-auto"
                  data-testid="button-incremental-sync"
                >
                  {isSyncingIncremental ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    "Sync New Publications"
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Search Publications</CardTitle>
            <CardDescription>Filter publications by title, author, or journal</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#6e6e73] h-4 w-4" />
              <Input
                type="text"
                placeholder="Search by title, author, or journal..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-publications"
              />
            </div>
            {debouncedSearch && (
              <p className="mt-2 text-sm text-[#6e6e73] dark:text-gray-400">
                Showing {filteredPublications.length} of {publicationsData?.publications.length || 0} publications
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "pending" | "approved" | "rejected")} data-testid="tabs-status">
            <CardHeader className="pb-3">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="pending" data-testid="tab-pending">
                  Pending ({stats.pending || 0})
                </TabsTrigger>
                <TabsTrigger value="approved" data-testid="tab-approved">
                  Approved ({stats.approved || 0})
                </TabsTrigger>
                <TabsTrigger value="rejected" data-testid="tab-rejected">
                  Rejected ({stats.rejected || 0})
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <TabsContent value="pending" className="mt-0">
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-[#0071e3]" />
                  </div>
                ) : filteredPublications.length === 0 ? (
                  <div className="py-16 text-center">
                    <p className="text-[#6e6e73] dark:text-gray-400">
                      {debouncedSearch ? "No publications match your search" : "No pending publications"}
                    </p>
                  </div>
                ) : (
                  renderTable(pendingTable)
                )}
              </CardContent>
            </TabsContent>

            <TabsContent value="approved" className="mt-0">
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-[#0071e3]" />
                  </div>
                ) : filteredPublications.length === 0 ? (
                  <div className="py-16 text-center">
                    <p className="text-[#6e6e73] dark:text-gray-400">
                      {debouncedSearch ? "No publications match your search" : "No approved publications"}
                    </p>
                  </div>
                ) : (
                  renderTable(approvedRejectedTable)
                )}
              </CardContent>
            </TabsContent>

            <TabsContent value="rejected" className="mt-0">
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-[#0071e3]" />
                  </div>
                ) : filteredPublications.length === 0 ? (
                  <div className="py-16 text-center">
                    <p className="text-[#6e6e73] dark:text-gray-400">
                      {debouncedSearch ? "No publications match your search" : "No rejected publications"}
                    </p>
                  </div>
                ) : (
                  renderTable(approvedRejectedTable)
                )}
              </CardContent>
            </TabsContent>
          </Tabs>
        </Card>
      </main>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Categories</DialogTitle>
            <DialogDescription>
              Select the research areas that apply to this publication
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-3">
              {RESEARCH_AREAS.map((area) => (
                <div key={area} className="flex items-center space-x-2">
                  <Checkbox
                    id={area}
                    checked={editCategories.includes(area)}
                    onCheckedChange={() => toggleCategory(area)}
                    data-testid={`checkbox-category-${area}`}
                  />
                  <Label
                    htmlFor={area}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {RESEARCH_AREA_DISPLAY_NAMES[area]}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button 
              onClick={handleSaveCategories} 
              disabled={updateCategoriesMutation.isPending}
              data-testid="button-save-categories"
            >
              {updateCategoriesMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
