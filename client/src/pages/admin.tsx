import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import Navigation from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Search, Check, X, ExternalLink, Loader2, Pencil, Trash2 } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/hooks/use-toast";
import { RESEARCH_AREA_DISPLAY_NAMES } from "@shared/schema";
import type { Publication } from "@shared/schema";

export default function Admin() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPublication, setEditingPublication] = useState<Publication | null>(null);
  const [editResearchArea, setEditResearchArea] = useState("");
  const [editCategories, setEditCategories] = useState<string[]>([]);
  const [customCategoryInput, setCustomCategoryInput] = useState("");
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const debouncedSearch = useDebounce(searchQuery, 400);
  const { toast } = useToast();

  const { data: publicationsData, isLoading } = useQuery<{ success: boolean; publications: Publication[]; total: number }>({
    queryKey: [`/api/admin/publications/${activeTab}`],
  });

  const { data: pendingData } = useQuery<{ success: boolean; publications: Publication[]; total: number }>({
    queryKey: ["/api/admin/publications/pending"],
  });

  const { data: approvedData } = useQuery<{ success: boolean; publications: Publication[]; total: number }>({
    queryKey: ["/api/admin/publications/approved"],
  });

  const { data: rejectedData } = useQuery<{ success: boolean; publications: Publication[]; total: number }>({
    queryKey: ["/api/admin/publications/rejected"],
  });

  const { data: statsData } = useQuery<{ success: boolean; stats: { totalPublications: number; totalByStatus: Record<string, number> } }>({
    queryKey: ["/api/publications/stats"],
  });

  const allUniqueCategories = useMemo(() => {
    const allPublications = [
      ...(pendingData?.publications || []),
      ...(approvedData?.publications || []),
      ...(rejectedData?.publications || []),
    ];

    const categoriesSet = new Set<string>();
    allPublications.forEach(pub => {
      if (Array.isArray(pub.categories)) {
        pub.categories.forEach(cat => {
          if (cat && cat.trim()) {
            categoriesSet.add(cat.trim());
          }
        });
      }
    });

    return Array.from(categoriesSet).sort((a, b) => a.localeCompare(b));
  }, [pendingData, approvedData, rejectedData]);

  const approveMutation = useMutation({
    mutationFn: async (publicationId: string) => {
      return await apiRequest("POST", `/api/admin/publications/${publicationId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications/approved"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications/rejected"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/search"] });
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
    mutationFn: async ({ id, researchArea, categories }: { id: string; researchArea: string; categories: string[] }) => {
      return await apiRequest("PATCH", `/api/admin/publications/${id}/categories`, {
        researchArea,
        categories,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications/approved"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications/rejected"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/search"] });
      setEditDialogOpen(false);
      setEditingPublication(null);
      toast({
        title: "Publication Updated",
        description: "Categories and research area updated successfully.",
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

  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryName: string) => {
      return await apiRequest("DELETE", `/api/admin/categories`, { name: categoryName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications/approved"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications/rejected"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/search"] });
      setCategoryToDelete(null);
      toast({
        title: "Category Deleted",
        description: "The category has been removed from all publications.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete category",
        variant: "destructive",
      });
      setCategoryToDelete(null);
    },
  });

  const openEditDialog = (publication: Publication) => {
    setEditingPublication(publication);
    setEditResearchArea(publication.researchArea || "");
    setEditCategories(Array.isArray(publication.categories) ? publication.categories : []);
    setEditDialogOpen(true);
  };

  const handleSaveCategories = () => {
    if (!editingPublication) return;
    
    updateCategoriesMutation.mutate({
      id: editingPublication.id,
      researchArea: editResearchArea,
      categories: editCategories,
    });
  };

  const toggleCategory = (category: string) => {
    setEditCategories(prev => {
      if (prev.includes(category)) {
        return prev.filter(c => c !== category);
      } else {
        return [...prev, category];
      }
    });
  };

  const handleAddCustomCategory = () => {
    const trimmedCategory = customCategoryInput.trim();
    if (trimmedCategory && !editCategories.includes(trimmedCategory)) {
      setEditCategories(prev => [...prev, trimmedCategory]);
      setCustomCategoryInput("");
    }
  };

  const handleDeleteCategory = (categoryName: string) => {
    setCategoryToDelete(categoryName);
  };

  const confirmDeleteCategory = () => {
    if (categoryToDelete) {
      deleteCategoryMutation.mutate(categoryToDelete);
    }
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

  const stats = statsData?.stats?.totalByStatus || {};
  const pending = stats.pending || 0;
  const approved = stats.approved || 0;
  const rejected = stats.rejected || 0;

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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card data-testid="card-stats-pending">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-[#6e6e73] dark:text-gray-400">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-[#1d1d1f] dark:text-white" data-testid="text-pending-count">
                {pending}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-stats-approved">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-[#6e6e73] dark:text-gray-400">Approved</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-green-600 dark:text-green-500" data-testid="text-approved-count">
                {approved}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-stats-rejected">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-[#6e6e73] dark:text-gray-400">Rejected</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-red-600 dark:text-red-500" data-testid="text-rejected-count">
                {rejected}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-8" data-testid="section-category-management">
          <CardHeader>
            <CardTitle>Manage Categories</CardTitle>
            <CardDescription>Remove unused categories from the system</CardDescription>
          </CardHeader>
          <CardContent>
            {allUniqueCategories.length === 0 ? (
              <p className="text-sm text-[#6e6e73] dark:text-gray-400">
                No categories available. Categories will appear here once publications have been added.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {allUniqueCategories.map((category) => (
                  <Badge
                    key={category}
                    variant="secondary"
                    className="pl-3 pr-2 py-1.5"
                    data-testid={`badge-category-${category}`}
                  >
                    {category}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 ml-2 hover:bg-transparent"
                      onClick={() => handleDeleteCategory(category)}
                      disabled={deleteCategoryMutation.isPending}
                      data-testid={`button-delete-category-${category}`}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            )}
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
                  Pending ({pending})
                </TabsTrigger>
                <TabsTrigger value="approved" data-testid="tab-approved">
                  Approved ({approved})
                </TabsTrigger>
                <TabsTrigger value="rejected" data-testid="tab-rejected">
                  Rejected ({rejected})
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
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[35%]">Title</TableHead>
                          <TableHead className="w-[15%]">Journal</TableHead>
                          <TableHead className="w-[12%]">Date</TableHead>
                          <TableHead className="w-[10%]">Area</TableHead>
                          <TableHead className="w-[28%] text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPublications.map((pub) => (
                          <TableRow key={pub.id} data-testid={`row-publication-${pub.id}`}>
                            <TableCell className="font-medium">
                              <div className="space-y-1">
                                <div className="line-clamp-2 text-sm" data-testid={`text-title-${pub.id}`}>
                                  {pub.title}
                                </div>
                                <div className="text-xs text-[#6e6e73] dark:text-gray-400 line-clamp-1" data-testid={`text-authors-${pub.id}`}>
                                  {pub.authors}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm line-clamp-2" data-testid={`text-journal-${pub.id}`}>
                                {pub.journal}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm" data-testid={`text-date-${pub.id}`}>
                                {new Date(pub.publicationDate).toLocaleDateString('en-US', { 
                                  year: 'numeric', 
                                  month: 'short' 
                                })}
                              </div>
                            </TableCell>
                            <TableCell>
                              {pub.researchArea && (
                                <Badge variant="secondary" className="text-xs" data-testid={`badge-area-${pub.id}`}>
                                  {RESEARCH_AREA_DISPLAY_NAMES[pub.researchArea] || pub.researchArea}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => pub.pubmedUrl && window.open(pub.pubmedUrl, '_blank')}
                                  className="h-8 w-8 p-0"
                                  title="View on PubMed"
                                  data-testid={`button-view-${pub.id}`}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openEditDialog(pub)}
                                  className="h-8 w-8 p-0"
                                  title="Edit Categories"
                                  data-testid={`button-edit-${pub.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => approveMutation.mutate(pub.id)}
                                  disabled={approveMutation.isPending}
                                  className="h-8 bg-green-600 hover:bg-green-700 text-white"
                                  data-testid={`button-approve-${pub.id}`}
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => rejectMutation.mutate(pub.id)}
                                  disabled={rejectMutation.isPending}
                                  className="h-8"
                                  data-testid={`button-reject-${pub.id}`}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Reject
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
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
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[40%]">Title</TableHead>
                          <TableHead className="w-[20%]">Journal</TableHead>
                          <TableHead className="w-[12%]">Date</TableHead>
                          <TableHead className="w-[10%]">Area</TableHead>
                          <TableHead className="w-[18%] text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPublications.map((pub) => (
                          <TableRow key={pub.id} data-testid={`row-publication-${pub.id}`}>
                            <TableCell className="font-medium">
                              <div className="space-y-1">
                                <div className="line-clamp-2 text-sm" data-testid={`text-title-${pub.id}`}>
                                  {pub.title}
                                </div>
                                <div className="text-xs text-[#6e6e73] dark:text-gray-400 line-clamp-1" data-testid={`text-authors-${pub.id}`}>
                                  {pub.authors}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm line-clamp-2" data-testid={`text-journal-${pub.id}`}>
                                {pub.journal}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm" data-testid={`text-date-${pub.id}`}>
                                {new Date(pub.publicationDate).toLocaleDateString('en-US', { 
                                  year: 'numeric', 
                                  month: 'short' 
                                })}
                              </div>
                            </TableCell>
                            <TableCell>
                              {pub.researchArea && (
                                <Badge variant="secondary" className="text-xs" data-testid={`badge-area-${pub.id}`}>
                                  {RESEARCH_AREA_DISPLAY_NAMES[pub.researchArea] || pub.researchArea}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => pub.pubmedUrl && window.open(pub.pubmedUrl, '_blank')}
                                  className="h-8 w-8 p-0"
                                  title="View on PubMed"
                                  data-testid={`button-view-${pub.id}`}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openEditDialog(pub)}
                                  className="h-8 w-8 p-0"
                                  title="Edit Categories"
                                  data-testid={`button-edit-${pub.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Select
                                  value="approved"
                                  onValueChange={(value) => changeStatusMutation.mutate({ id: pub.id, status: value as "pending" | "approved" | "rejected" })}
                                  disabled={changeStatusMutation.isPending}
                                >
                                  <SelectTrigger className="h-8 w-[140px]" data-testid={`select-status-${pub.id}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="approved" data-testid="option-status-approved">Approved</SelectItem>
                                    <SelectItem value="pending" data-testid="option-status-pending">Move to Pending</SelectItem>
                                    <SelectItem value="rejected" data-testid="option-status-rejected">Reject</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
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
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[40%]">Title</TableHead>
                          <TableHead className="w-[20%]">Journal</TableHead>
                          <TableHead className="w-[12%]">Date</TableHead>
                          <TableHead className="w-[10%]">Area</TableHead>
                          <TableHead className="w-[18%] text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPublications.map((pub) => (
                          <TableRow key={pub.id} data-testid={`row-publication-${pub.id}`}>
                            <TableCell className="font-medium">
                              <div className="space-y-1">
                                <div className="line-clamp-2 text-sm" data-testid={`text-title-${pub.id}`}>
                                  {pub.title}
                                </div>
                                <div className="text-xs text-[#6e6e73] dark:text-gray-400 line-clamp-1" data-testid={`text-authors-${pub.id}`}>
                                  {pub.authors}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm line-clamp-2" data-testid={`text-journal-${pub.id}`}>
                                {pub.journal}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm" data-testid={`text-date-${pub.id}`}>
                                {new Date(pub.publicationDate).toLocaleDateString('en-US', { 
                                  year: 'numeric', 
                                  month: 'short' 
                                })}
                              </div>
                            </TableCell>
                            <TableCell>
                              {pub.researchArea && (
                                <Badge variant="secondary" className="text-xs" data-testid={`badge-area-${pub.id}`}>
                                  {RESEARCH_AREA_DISPLAY_NAMES[pub.researchArea] || pub.researchArea}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => pub.pubmedUrl && window.open(pub.pubmedUrl, '_blank')}
                                  className="h-8 w-8 p-0"
                                  title="View on PubMed"
                                  data-testid={`button-view-${pub.id}`}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openEditDialog(pub)}
                                  className="h-8 w-8 p-0"
                                  title="Edit Categories"
                                  data-testid={`button-edit-${pub.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Select
                                  value="rejected"
                                  onValueChange={(value) => changeStatusMutation.mutate({ id: pub.id, status: value as "pending" | "approved" | "rejected" })}
                                  disabled={changeStatusMutation.isPending}
                                >
                                  <SelectTrigger className="h-8 w-[140px]" data-testid={`select-status-${pub.id}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="rejected" data-testid="option-status-rejected">Rejected</SelectItem>
                                    <SelectItem value="pending" data-testid="option-status-pending">Move to Pending</SelectItem>
                                    <SelectItem value="approved" data-testid="option-status-approved">Approve</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </TabsContent>
          </Tabs>
        </Card>
      </main>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[525px]" data-testid="dialog-edit-categories">
          <DialogHeader>
            <DialogTitle>Edit Publication Categories</DialogTitle>
            <DialogDescription>
              Update the research area and categories for this publication.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="research-area">Research Area</Label>
              <Select value={editResearchArea} onValueChange={setEditResearchArea}>
                <SelectTrigger id="research-area" data-testid="select-research-area">
                  <SelectValue placeholder="Select research area" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RESEARCH_AREA_DISPLAY_NAMES).map(([slug, displayName]) => (
                    <SelectItem key={slug} value={slug} data-testid={`option-research-area-${slug}`}>
                      {displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Categories (click to toggle)</Label>
              {allUniqueCategories.length === 0 ? (
                <p className="text-sm text-[#6e6e73] dark:text-gray-400 py-4">
                  No categories available. Categories will appear here once publications have been added.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2 p-3 border rounded-md min-h-[100px]">
                  {allUniqueCategories.map((category) => (
                    <Badge
                      key={category}
                      onClick={() => toggleCategory(category)}
                      className={`cursor-pointer transition-colors ${
                        editCategories.includes(category)
                          ? "bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-600 dark:hover:bg-blue-700"
                          : "bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300"
                      }`}
                      data-testid={`badge-toggle-${category}`}
                    >
                      {category}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="custom-category">Add Custom Category</Label>
              <div className="flex gap-2">
                <Input
                  id="custom-category"
                  type="text"
                  placeholder="Enter category name..."
                  value={customCategoryInput}
                  onChange={(e) => setCustomCategoryInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomCategory();
                    }
                  }}
                  data-testid="input-custom-category"
                />
                <Button
                  type="button"
                  onClick={handleAddCustomCategory}
                  disabled={!customCategoryInput.trim()}
                  data-testid="button-add-category"
                >
                  Add
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveCategories}
              disabled={updateCategoriesMutation.isPending}
              data-testid="button-save-categories"
            >
              {updateCategoriesMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!categoryToDelete} onOpenChange={(open) => !open && setCategoryToDelete(null)}>
        <AlertDialogContent data-testid="dialog-delete-category-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the category "{categoryToDelete}" from all publications that use it. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-category">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteCategory}
              disabled={deleteCategoryMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete-category"
            >
              {deleteCategoryMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
