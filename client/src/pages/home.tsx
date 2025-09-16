import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Navigation from "@/components/navigation";
import HeroSection from "@/components/hero-section";
import FeaturedResearch from "@/components/featured-research";
import PublicationCard from "@/components/publication-card";
import ResearchAreasGrid from "@/components/research-areas-grid";
import ResearchStatistics from "@/components/research-statistics";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { searchPublications, searchPubMed } from "@/services/pubmed";
import { useToast } from "@/hooks/use-toast";
import type { Publication } from "@shared/schema";

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedResearchArea, setSelectedResearchArea] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState("newest");
  const [currentPage, setCurrentPage] = useState(0);
  const limit = 20;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Mutation for sync publications button
  const syncPublicationsMutation = useMutation({
    mutationFn: () => searchPubMed("SphygmoCor cardiovascular", 30),
    onSuccess: (data) => {
      toast({
        title: "Sync Successful",
        description: `${data.message} - ${data.imported} new publications imported.`,
      });
      // Invalidate all publication-related queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ["/api/publications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/search"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/featured"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publications/stats"] });
    },
    onError: (error) => {
      toast({
        title: "Sync Failed",
        description: "Failed to sync publications from PubMed. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleSyncPublications = () => {
    syncPublicationsMutation.mutate();
  };

  const { data, isLoading } = useQuery({
    queryKey: ["/api/publications/search", { 
      query: searchQuery || undefined, 
      researchArea: selectedResearchArea || undefined,
      year: selectedYear || undefined,
      sortBy,
      limit,
      offset: currentPage * limit
    }],
    queryFn: () => searchPublications({
      query: searchQuery || undefined,
      researchArea: selectedResearchArea || undefined,
      year: selectedYear || undefined,
      sortBy,
      limit,
      offset: currentPage * limit
    }),
  });

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(0);
  };

  const handleResearchAreaChange = (area: string | null) => {
    setSelectedResearchArea(area);
    setCurrentPage(0);
  };

  const handleYearChange = (year: number | null) => {
    setSelectedYear(year);
    setCurrentPage(0);
  };

  const handleSortChange = (value: string) => {
    setSortBy(value);
    setCurrentPage(0);
  };

  const loadMore = () => {
    setCurrentPage(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation onSearch={handleSearch} />
      <HeroSection />
      <FeaturedResearch />
      
      <ResearchAreasGrid
        selectedArea={selectedResearchArea}
        onAreaChange={handleResearchAreaChange}
      />
      
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-8">
            <div className="flex justify-center">
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">Year Filter:</span>
                <Select value={selectedYear?.toString() || "all"} onValueChange={(value) => handleYearChange(value === "all" ? null : parseInt(value))}>
                  <SelectTrigger className="w-40" data-testid="year-filter-select">
                    <SelectValue placeholder="All Years" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                    <SelectItem value="earlier">Earlier</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex-1">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Research Publications</h2>
                  <p className="text-muted-foreground" data-testid="publication-count">
                    {data?.total ? `${data.total.toLocaleString()} publications` : "Loading..."}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">Sort by:</span>
                  <Select value={sortBy} onValueChange={handleSortChange}>
                    <SelectTrigger className="w-40" data-testid="sort-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest First</SelectItem>
                      <SelectItem value="oldest">Oldest First</SelectItem>
                      <SelectItem value="citations">Most Cited</SelectItem>
                      <SelectItem value="impact">Journal Impact</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <Skeleton key={i} className="h-80 w-full rounded-2xl" />
                  ))}
                </div>
              ) : data?.publications?.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground text-lg">No publications found matching your criteria.</p>
                  <p className="text-muted-foreground mt-2">Try adjusting your filters or search terms.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {data?.publications?.map((publication: Publication) => (
                    <PublicationCard key={publication.id} publication={publication} />
                  ))}
                </div>
              )}
              
              {data?.publications && data.publications.length < data.total && (
                <div className="text-center mt-12">
                  <Button 
                    variant="secondary"
                    onClick={loadMore}
                    data-testid="load-more-button"
                  >
                    Load More Publications
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <ResearchStatistics />

      {/* PubMed Integration Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <h2 className="text-3xl font-bold mb-4 text-foreground">PubMed Integration</h2>
            <p className="text-lg mb-8 text-muted-foreground">
              Automatically sync and categorize SphygmoCor research papers from PubMed database
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                variant="default"
                data-testid="sync-publications-button"
                onClick={handleSyncPublications}
                disabled={syncPublicationsMutation.isPending}
              >
                <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {syncPublicationsMutation.isPending ? "Syncing..." : "Sync Publications"}
              </Button>
              <Button 
                variant="outline"
                data-testid="api-settings-button"
              >
                <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                API Settings
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="font-semibold text-foreground mb-4">CardiEx Research</h3>
              <p className="text-muted-foreground text-sm">
                Leading cardiovascular research through innovative SphygmoCor technology and data-driven insights.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Research Areas</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-primary">Early Vascular Aging</a></li>
                <li><a href="#" className="hover:text-primary">Heart Failure</a></li>
                <li><a href="#" className="hover:text-primary">Hypertension</a></li>
                <li><a href="#" className="hover:text-primary">Metabolic Health</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-primary">API Documentation</a></li>
                <li><a href="#" className="hover:text-primary">Research Guidelines</a></li>
                <li><a href="#" className="hover:text-primary">Data Access</a></li>
                <li><a href="#" className="hover:text-primary">Support</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Connect</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-primary">Contact Us</a></li>
                <li><a href="#" className="hover:text-primary">Newsletter</a></li>
                <li><a href="#" className="hover:text-primary">LinkedIn</a></li>
                <li><a href="#" className="hover:text-primary">Twitter</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border mt-8 pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; 2024 CardiEx. All rights reserved. | Privacy Policy | Terms of Service</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
