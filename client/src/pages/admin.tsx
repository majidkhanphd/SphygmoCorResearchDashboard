import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import Navigation from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Check, X, ExternalLink, Loader2 } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/hooks/use-toast";
import type { Publication } from "@shared/schema";

export default function Admin() {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 400);
  const { toast } = useToast();

  const { data: pendingPubs, isLoading } = useQuery<{ success: boolean; publications: Publication[]; total: number }>({
    queryKey: ["/api/admin/publications/pending"],
  });

  const { data: statsData } = useQuery<{ success: boolean; stats: { totalPublications: number; totalByStatus: Record<string, number> } }>({
    queryKey: ["/api/publications/stats"],
  });

  const approveMutation = useMutation({
    mutationFn: async (publicationId: string) => {
      return await apiRequest("POST", `/api/admin/publications/${publicationId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/publications/pending"] });
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

  const filteredPublications = pendingPubs?.publications.filter(pub => {
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
            Review and manage pending publications
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

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Search Publications</CardTitle>
            <CardDescription>Filter pending publications by title, author, or journal</CardDescription>
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
                Showing {filteredPublications.length} of {pendingPubs?.publications.length || 0} publications
              </p>
            )}
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-[#0071e3]" />
          </div>
        ) : filteredPublications.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-[#6e6e73] dark:text-gray-400">
                {debouncedSearch ? "No publications match your search" : "No pending publications"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Pending Publications ({filteredPublications.length})</CardTitle>
              <CardDescription>Review and approve publications for the website</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40%]">Title</TableHead>
                      <TableHead className="w-[20%]">Journal</TableHead>
                      <TableHead className="w-[15%]">Date</TableHead>
                      <TableHead className="w-[10%]">Area</TableHead>
                      <TableHead className="w-[15%] text-right">Actions</TableHead>
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
                              {pub.researchArea}
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
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
