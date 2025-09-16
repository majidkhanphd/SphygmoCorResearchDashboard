import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import Navigation from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { searchPublications } from "@/services/pubmed";
import type { Publication } from "@shared/schema";
import { getResearchAreaDisplayName, RESEARCH_AREA_DISPLAY_NAMES } from "@shared/schema";

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [selectedResearchArea, setSelectedResearchArea] = useState<string | null>(null);
  const [selectedVenue, setSelectedVenue] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [showAllAreas, setShowAllAreas] = useState(false);
  const [showAllVenues, setShowAllVenues] = useState(false);
  const limit = 50;

  const { 
    data, 
    isLoading, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage 
  } = useInfiniteQuery({
    queryKey: ["/api/publications/search", { 
      query: searchQuery || undefined, 
      researchArea: selectedResearchArea || undefined,
      venue: selectedVenue || undefined,
      year: selectedYear || undefined,
      sortBy: "newest",
      limit
    }],
    queryFn: ({ pageParam = 0 }) => searchPublications({
      query: searchQuery || undefined,
      researchArea: selectedResearchArea || undefined,
      venue: selectedVenue || undefined,
      year: selectedYear || undefined,
      sortBy: "newest",
      limit,
      offset: pageParam * limit
    }),
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.publications || lastPage.publications.length < limit) {
        return undefined;
      }
      return allPages.length;
    },
    initialPageParam: 0
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(inputValue);
  };

  const handleReset = () => {
    setInputValue("");
    setSearchQuery("");
  };

  const handleResearchAreaChange = (area: string | null) => {
    setSelectedResearchArea(area);
  };

  const handleVenueChange = (venue: string | null) => {
    setSelectedVenue(venue);
  };

  const handleYearChange = (year: number | null) => {
    setSelectedYear(year);
  };

  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  // Flatten all publications from all pages
  const allPublications = data?.pages.flatMap(page => page.publications) || [];
  
  // Get unique venues from publications
  const venues = allPublications.length > 0 
    ? Array.from(new Set(
        allPublications
          .map((p: any) => p.journal)
          .filter((journal: any): journal is string => typeof journal === 'string' && journal.length > 0)
      )).sort() as string[]
    : [] as string[];
  const visibleVenues = showAllVenues ? venues : venues.slice(0, 5);

  // Get research areas from schema
  const researchAreas = Object.entries(RESEARCH_AREA_DISPLAY_NAMES);
  const visibleAreas = showAllAreas ? researchAreas : researchAreas.slice(0, 5);

  // Get years from publications
  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: 10 }, (_, i) => currentYear - i);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      {/* Apple-style simple header */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        <h1 className="text-5xl font-semibold text-foreground mb-16 leading-tight">
          Explore advancements in Machine Learning
        </h1>
        
        {/* Search bar */}
        <form onSubmit={handleSearch} className="mb-12">
          <div className="relative max-w-2xl">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-muted-foreground" />
            </div>
            <Input
              type="text"
              placeholder="Search publications"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="pl-10 pr-10 py-3 text-base border-border focus:border-primary"
              data-testid="search-input"
            />
            {inputValue && (
              <button
                type="button"
                onClick={handleReset}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                data-testid="reset-button"
              >
                <X className="h-5 w-5 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
        </form>
        
        {/* Main content with sidebar and publications */}
        <div className="flex gap-16">
          {/* Left sidebar */}
          <div className="w-64 flex-shrink-0">
            {/* Research Areas Filter */}
            <div className="mb-8">
              <h3 className="text-sm font-medium text-foreground mb-4">Research areas</h3>
              <div className="space-y-2">
                <button
                  onClick={() => handleResearchAreaChange(null)}
                  className={`block text-sm ${
                    !selectedResearchArea 
                      ? "text-primary font-medium" 
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid="area-all"
                >
                  All
                </button>
                {visibleAreas.map(([slug, displayName]) => (
                  <button
                    key={slug}
                    onClick={() => handleResearchAreaChange(slug)}
                    className={`block text-sm ${
                      selectedResearchArea === slug
                        ? "text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    data-testid={`area-${slug}`}
                  >
                    {displayName}
                  </button>
                ))}
                {researchAreas.length > 5 && (
                  <button
                    onClick={() => setShowAllAreas(!showAllAreas)}
                    className="flex items-center text-sm text-primary hover:text-primary/80"
                    data-testid="toggle-areas"
                  >
                    {showAllAreas ? (
                      <>
                        Less <ChevronUp className="ml-1 h-4 w-4" />
                      </>
                    ) : (
                      <>
                        More <ChevronDown className="ml-1 h-4 w-4" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
            
            {/* Venues Filter */}
            <div className="mb-8">
              <h3 className="text-sm font-medium text-foreground mb-4">Venues</h3>
              <div className="space-y-2">
                <button
                  onClick={() => handleVenueChange(null)}
                  className={`block text-sm ${
                    !selectedVenue
                      ? "text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  } text-left`}
                  data-testid="venue-all"
                >
                  All venues
                </button>
                {visibleVenues.map((venue) => (
                  <button
                    key={venue}
                    onClick={() => handleVenueChange(venue)}
                    className={`block text-sm ${
                      selectedVenue === venue
                        ? "text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    } text-left`}
                    data-testid={`venue-${venue.replace(/\s+/g, '-').toLowerCase()}`}
                  >
                    {venue}
                  </button>
                ))}
                {venues.length > 5 && (
                  <button
                    onClick={() => setShowAllVenues(!showAllVenues)}
                    className="flex items-center text-sm text-primary hover:text-primary/80"
                    data-testid="toggle-venues"
                  >
                    {showAllVenues ? (
                      <>
                        Less <ChevronUp className="ml-1 h-4 w-4" />
                      </>
                    ) : (
                      <>
                        More <ChevronDown className="ml-1 h-4 w-4" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
            
            {/* Published Year Filter */}
            <div className="mb-8">
              <h3 className="text-sm font-medium text-foreground mb-4">Published</h3>
              <div className="space-y-2">
                <button
                  onClick={() => handleYearChange(null)}
                  className={`block text-sm ${
                    !selectedYear
                      ? "text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid="year-all"
                >
                  All years
                </button>
                {availableYears.map((year) => (
                  <button
                    key={year}
                    onClick={() => handleYearChange(year)}
                    className={`block text-sm ${
                      selectedYear === year
                        ? "text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    data-testid={`year-${year}`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          {/* Main content area */}
          <div className="flex-1">
            {isLoading ? (
              <div className="space-y-8">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-6 bg-muted rounded w-3/4"></div>
                    <div className="h-4 bg-muted rounded w-1/2"></div>
                    <div className="h-4 bg-muted rounded w-2/3"></div>
                  </div>
                ))}
              </div>
            ) : allPublications?.length === 0 ? (
              <div className="py-12">
                <p className="text-muted-foreground text-lg">No publications found matching your criteria.</p>
                <p className="text-muted-foreground mt-2">Try adjusting your filters or search terms.</p>
              </div>
            ) : (
              <div className="space-y-8">
                {allPublications?.map((publication: Publication) => {
                  const publicationYear = new Date(publication.publicationDate).getFullYear();
                  const displayArea = getResearchAreaDisplayName(publication.researchArea);
                  
                  return (
                    <article key={publication.id} className="space-y-2" data-testid={`publication-${publication.id}`}>
                      {/* Title */}
                      <h2 className="text-xl font-medium text-foreground leading-tight">
                        <a 
                          href={publication.pubmedUrl || publication.doi || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-primary transition-colors"
                          data-testid="publication-title-link"
                        >
                          {publication.title}
                        </a>
                      </h2>
                      
                      {/* Research area tags */}
                      {displayArea && (
                        <div className="flex flex-wrap gap-2">
                          <Badge 
                            variant="secondary" 
                            className="text-xs font-normal cursor-pointer hover:bg-primary/10"
                            onClick={() => handleResearchAreaChange(publication.researchArea)}
                            data-testid="research-area-tag"
                          >
                            {displayArea}
                          </Badge>
                        </div>
                      )}
                      
                      {/* Venue and year */}
                      <p className="text-sm text-muted-foreground" data-testid="publication-venue">
                        {publication.journal}, {publicationYear}
                      </p>
                      
                      {/* Authors */}
                      <p className="text-sm text-muted-foreground" data-testid="publication-authors">
                        {publication.authors}
                      </p>
                    </article>
                  );
                })}
                
                {/* Load more button */}
                {hasNextPage && (
                  <div className="pt-8">
                    <Button 
                      variant="outline"
                      onClick={loadMore}
                      disabled={isFetchingNextPage}
                      className="text-primary border-primary hover:bg-primary/5"
                      data-testid="load-more-button"
                    >
                      {isFetchingNextPage ? "Loading..." : "Load more"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}