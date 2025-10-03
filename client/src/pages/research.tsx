import { useState, useEffect } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import Navigation from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronUp, Search, X, Star, ExternalLink, Filter } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { searchPublications } from "@/services/pubmed";
import type { Publication } from "@shared/schema";
import { getResearchAreaDisplayName, RESEARCH_AREA_DISPLAY_NAMES, RESEARCH_AREAS } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose
} from "@/components/ui/dialog";

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "ckd": { bg: "#E3F2FD", text: "#0D47A1", border: "#90CAF9" },
  "copd": { bg: "#F3E5F5", text: "#4A148C", border: "#CE93D8" },
  "eva": { bg: "#E0F2F1", text: "#004D40", border: "#80CBC4" },
  "heart-failure": { bg: "#FFF3E0", text: "#E65100", border: "#FFB74D" },
  "hypertension": { bg: "#E1F5FE", text: "#01579B", border: "#81D4FA" },
  "longevity": { bg: "#F3E5F5", text: "#6A1B9A", border: "#CE93D8" },
  "maternal-health": { bg: "#FCE4EC", text: "#880E4F", border: "#F48FB1" },
  "mens-health": { bg: "#E0F2F1", text: "#00695C", border: "#80CBC4" },
  "metabolic-health": { bg: "#FFF8E1", text: "#F57F17", border: "#FFD54F" },
  "neuroscience": { bg: "#EDE7F6", text: "#311B92", border: "#B39DDB" },
  "womens-health": { bg: "#FCE4EC", text: "#AD1457", border: "#F48FB1" }
};

const getBadgeDisplayName = (category: string): string => {
  // Check for specific acronyms that should be all caps
  if (category === 'ckd') return 'CKD';
  if (category === 'copd') return 'COPD';
  if (category === 'eva') return 'EVA';
  
  // Get display name from slug
  const displayName = getResearchAreaDisplayName(category);
  if (!displayName) return category.replace('-', ' ');
  
  return displayName;
};

export default function Home() {
  const [inputValue, setInputValue] = useState("");
  const debouncedSearchQuery = useDebounce(inputValue, 400);
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "relevance">("newest");
  const [selectedResearchArea, setSelectedResearchArea] = useState<string | null>(null);
  const [selectedVenue, setSelectedVenue] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [showAllAreas, setShowAllAreas] = useState(false);
  const [showAllVenues, setShowAllVenues] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const limit = 50;

  // Add responsive state management
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Check on mount
    checkIsMobile();
    
    // Add resize listener
    window.addEventListener('resize', checkIsMobile);
    
    // Cleanup
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  const { 
    data, 
    isLoading, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage 
  } = useInfiniteQuery({
    queryKey: ["/api/publications/search", { 
      query: debouncedSearchQuery || undefined, 
      categories: selectedResearchArea ? [selectedResearchArea] : undefined,
      venue: selectedVenue || undefined,
      year: selectedYear || undefined,
      sortBy,
      limit
    }],
    queryFn: ({ pageParam = 0 }) => searchPublications({
      query: debouncedSearchQuery || undefined,
      categories: selectedResearchArea ? [selectedResearchArea] : undefined,
      venue: selectedVenue || undefined,
      year: selectedYear || undefined,
      sortBy,
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

  const handleReset = () => {
    setInputValue("");
  };

  const clearFilter = (filterType: 'researchArea' | 'venue' | 'year') => {
    switch (filterType) {
      case 'researchArea':
        setSelectedResearchArea(null);
        break;
      case 'venue':
        setSelectedVenue(null);
        break;
      case 'year':
        setSelectedYear(null);
        break;
    }
  };

  const clearAllFilters = () => {
    setSelectedResearchArea(null);
    setSelectedVenue(null);
    setSelectedYear(null);
    setInputValue("");
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
  
  // Get authoritative filter counts from the backend (same across all pages)
  const backendFilterCounts = data?.pages[0]?.filterCounts || {
    categories: {},
    venues: {},
    years: {}
  };
  
  // Transform backend filter counts to match frontend expectations
  const filterCounts = {
    areas: backendFilterCounts.categories,
    venues: backendFilterCounts.venues, 
    years: backendFilterCounts.years
  };

  // Get venues from backend filter counts for authoritative list - sorted by count (descending)
  const venues = Object.keys(backendFilterCounts.venues).sort((a, b) => {
    const countA = backendFilterCounts.venues[a] || 0;
    const countB = backendFilterCounts.venues[b] || 0;
    return countB - countA; // Sort descending by count
  });
  const visibleVenues = showAllVenues ? venues : venues.slice(0, 5);

  // Get research areas from schema - sorted by count (descending)
  const researchAreas = Object.entries(RESEARCH_AREA_DISPLAY_NAMES).sort((a, b) => {
    const countA = filterCounts.areas[a[0]] || 0;
    const countB = filterCounts.areas[b[0]] || 0;
    return countB - countA; // Sort descending by count
  });
  const visibleAreas = showAllAreas ? researchAreas : researchAreas.slice(0, 5);

  // Get years from publications
  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: 10 }, (_, i) => currentYear - i);
  
  // Calculate total count for all years
  const totalYearCount = Object.values(filterCounts.years).reduce((sum, count) => sum + (count as number), 0);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      {/* Apple's exact hero section */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8" style={{ paddingTop: '56px', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif' }}>
        {/* Breadcrumb - Apple style */}
        <nav style={{ marginBottom: '32px' }} data-testid="breadcrumb">
          <span className="text-sm font-normal tracking-widest uppercase" style={{ color: '#6E6E73' }}>CARDIOVASCULAR RESEARCH</span>
        </nav>
        
        {/* Main title - Apple's exact typography */}
        <h1 className="font-semibold leading-tight tracking-tight" style={{ fontSize: '80px', color: '#1D1D1F', marginBottom: '32px', lineHeight: '1.05' }} data-testid="main-title">
          Research
        </h1>
        
        {/* Hero description - Apple's exact content and styling */}
        <div className="max-w-4xl" style={{ marginBottom: '56px' }} data-testid="hero-description">
          <p className="leading-relaxed" style={{ fontSize: '22px', color: '#1D1D1F', marginBottom: '24px', lineHeight: '1.4' }}>
            We advance non-invasive cardiovascular assessment through innovative SphygmoCor technology, measuring central blood pressure, arterial stiffness, and hemodynamic parameters to improve clinical outcomes across hypertension, chronic kidney disease, and heart failure.
          </p>
          <p className="leading-relaxed" style={{ fontSize: '22px', color: '#6E6E73', lineHeight: '1.4' }}>
            Our publications span pulse wave analysis, carotid-femoral pulse wave velocity, vascular aging, device validation, and clinical evidence across diverse populations.
          </p>
        </div>
        
        {/* Page Last Updated */}
        <div style={{ marginBottom: '32px' }}>
          <p className="text-sm" style={{ color: '#6E6E73', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif' }} data-testid="last-updated">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        
        {/* Search and Sort Section - Apple style */}
        <div style={{ marginBottom: '48px' }}>
          {/* Search bar and sort dropdown */}
          <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center mb-6">
            <div className="relative flex-1" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif' }}>
            <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none" style={{ paddingLeft: '16px' }}>
              <Search className="h-5 w-5" style={{ color: '#6E6E73' }} />
            </div>
              <input
                type="text"
                placeholder="Search publications"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="w-full rounded-xl apple-transition apple-focus-ring"
                style={{
                  paddingLeft: '48px',
                  paddingRight: inputValue ? '48px' : '16px',
                  paddingTop: '12px',
                  paddingBottom: '12px',
                  fontSize: '17px',
                  fontWeight: '400',
                  lineHeight: '1.4',
                  color: '#1D1D1F',
                  backgroundColor: '#F6F6F6',
                  border: '1px solid #E5E5E7',
                  outline: 'none'
                }}
                onFocus={(e) => {
                  e.target.style.backgroundColor = '#FFFFFF';
                  e.target.style.borderColor = '#007AFF';
                }}
                onBlur={(e) => {
                  e.target.style.backgroundColor = '#F6F6F6';
                  e.target.style.borderColor = '#E5E5E7';
                }}
                data-testid="search-input"
                aria-label="Search publications by title, author, or keywords"
                role="searchbox"
              />
              {inputValue && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="absolute inset-y-0 right-0 flex items-center apple-transition apple-focus-ring"
                  style={{ paddingRight: '16px' }}
                  data-testid="reset-button"
                  aria-label="Clear search"
                >
                  <X 
                    className="h-5 w-5 apple-transition" 
                    style={{ color: '#6E6E73' }}
                    onMouseEnter={(e) => (e.target as HTMLElement).style.color = '#1D1D1F'}
                    onMouseLeave={(e) => (e.target as HTMLElement).style.color = '#6E6E73'}
                  />
                </button>
              )}
            </div>
            
            {/* Sort Dropdown */}
            <div className="w-full sm:w-48 flex-shrink-0">
              <Select value={sortBy} onValueChange={(value: "newest" | "oldest" | "relevance") => setSortBy(value)}>
                <SelectTrigger 
                  className="w-full rounded-xl transition-all duration-200 ease-in-out"
                  style={{
                    paddingTop: '12px',
                    paddingBottom: '12px',
                    fontSize: '17px',
                    fontWeight: '400',
                    lineHeight: '1.4',
                    color: '#1D1D1F',
                    backgroundColor: '#F6F6F6',
                    border: '1px solid #E5E5E7',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif'
                  }}
                  data-testid="sort-dropdown"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest" data-testid="sort-newest">Newest</SelectItem>
                  <SelectItem value="oldest" data-testid="sort-oldest">Oldest</SelectItem>
                  <SelectItem value="relevance" data-testid="sort-relevance">Relevance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Mobile Filters | Reset button */}
          {isMobile && (
            <div className="flex items-center justify-center gap-0 mt-4">
              <button
                onClick={() => setIsFilterModalOpen(true)}
                className="px-4 py-2 text-sm font-normal transition-colors"
                style={{ color: '#007AFF' }}
                data-testid="mobile-filters-button"
              >
                Filters
              </button>
              <span className="px-2" style={{ color: '#E5E5E7' }}>|</span>
              <button
                onClick={clearAllFilters}
                className="px-4 py-2 text-sm font-normal transition-colors"
                style={{ color: '#007AFF' }}
                data-testid="mobile-reset-button"
              >
                Reset
              </button>
            </div>
          )}
        </div>
        
        {/* Active Filter Chips */}
        {(selectedResearchArea || selectedVenue || selectedYear || debouncedSearchQuery) && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-medium" style={{ color: '#1D1D1F' }}>Active filters:</span>
              <button
                onClick={clearAllFilters}
                className="text-sm transition-colors"
                style={{ color: '#007AFF' }}
                data-testid="clear-all-filters"
              >
                Clear all
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {debouncedSearchQuery && (
                <div 
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full transition-colors"
                  style={{ backgroundColor: '#F6F6F6', color: '#1D1D1F', fontSize: '14px' }}
                  data-testid="filter-chip-search"
                >
                  <span>Search: {debouncedSearchQuery}</span>
                  <button
                    onClick={() => setInputValue('')}
                    className="hover:opacity-70 transition-opacity"
                    data-testid="clear-search-filter"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              {selectedResearchArea && (
                <div 
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full transition-colors"
                  style={{ backgroundColor: '#F6F6F6', color: '#1D1D1F', fontSize: '14px' }}
                  data-testid="filter-chip-research-area"
                >
                  <span>Research Area: {getResearchAreaDisplayName(selectedResearchArea)}</span>
                  <button
                    onClick={() => clearFilter('researchArea')}
                    className="hover:opacity-70 transition-opacity"
                    data-testid="clear-research-area-filter"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              {selectedVenue && (
                <div 
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full transition-colors"
                  style={{ backgroundColor: '#F6F6F6', color: '#1D1D1F', fontSize: '14px' }}
                  data-testid="filter-chip-venue"
                >
                  <span>Journal: {selectedVenue}</span>
                  <button
                    onClick={() => clearFilter('venue')}
                    className="hover:opacity-70 transition-opacity"
                    data-testid="clear-venue-filter"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              {selectedYear && (
                <div 
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full transition-colors"
                  style={{ backgroundColor: '#F6F6F6', color: '#1D1D1F', fontSize: '14px' }}
                  data-testid="filter-chip-year"
                >
                  <span>Year: {selectedYear}</span>
                  <button
                    onClick={() => clearFilter('year')}
                    className="hover:opacity-70 transition-opacity"
                    data-testid="clear-year-filter"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main content with sidebar and publications */}
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-16">
          {/* Left sidebar - Apple ML Research Style - Only show when not mobile */}
          {!isMobile && (
            <aside className="w-full lg:w-64 flex-shrink-0" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif' }} role="complementary" aria-label="Research filters">
            {/* Research Areas Filter */}
            <section className="mb-10" role="group" aria-labelledby="research-areas-heading">
              {/* Uppercase caption */}
              <div className="mb-3">
                <span className="text-xs font-medium tracking-wider uppercase" style={{ color: '#6E6E73' }}>RESEARCH AREAS</span>
              </div>
              
              {/* Italic category label */}
              <h3 id="research-areas-heading" className="text-base font-medium italic mb-4" style={{ color: '#1D1D1F' }}>Research areas</h3>
              
              {/* Clear button */}
              {selectedResearchArea && (
                <button
                  onClick={() => handleResearchAreaChange(null)}
                  className="text-sm mb-3 apple-transition apple-focus-ring"
                  style={{ color: '#007AFF' }}
                  data-testid="clear-research-areas"
                  aria-label="Clear research area filter"
                >
                  Clear all
                </button>
              )}
              
              <div className="space-y-1">
                <button
                  onClick={() => handleResearchAreaChange(null)}
                  className={`block text-sm w-full text-left py-1 apple-transition apple-focus-ring ${
                    !selectedResearchArea 
                      ? "font-medium" 
                      : "hover:opacity-80"
                  }`}
                  style={{ color: !selectedResearchArea ? '#1D1D1F' : '#6E6E73' }}
                  data-testid="area-all"
                  aria-pressed={!selectedResearchArea}
                >
                  All
                </button>
                {visibleAreas.map(([slug, displayName]) => {
                  const count = filterCounts.areas[slug] || 0;
                  return (
                    <button
                      key={slug}
                      onClick={() => handleResearchAreaChange(slug)}
                      className={`block text-sm w-full text-left py-1 apple-transition apple-focus-ring ${
                        selectedResearchArea === slug
                          ? "font-medium"
                          : "hover:opacity-80"
                      }`}
                      style={{ color: selectedResearchArea === slug ? '#1D1D1F' : '#6E6E73' }}
                      data-testid={`area-${slug}`}
                      aria-pressed={selectedResearchArea === slug}
                      aria-label={`Filter by ${displayName}${count > 0 ? ` (${count} publications)` : ''}`}
                    >
                      {displayName} {count > 0 && `(${count})`}
                    </button>
                  );
                })}
                {researchAreas.length > 5 && (
                  <button
                    onClick={() => setShowAllAreas(!showAllAreas)}
                    className="flex items-center text-sm py-1 apple-transition apple-focus-ring"
                    style={{ color: '#007AFF' }}
                    data-testid="toggle-areas"
                    aria-expanded={showAllAreas}
                    aria-label={showAllAreas ? "Show fewer research areas" : "Show more research areas"}
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
            </section>
            
            {/* Thin separator */}
            <div className="h-px mb-10" style={{ backgroundColor: '#E5E5E7' }}></div>
            
            {/* Journals Filter */}
            <section className="mb-10" role="group" aria-labelledby="venues-heading">
              {/* Uppercase caption */}
              <div className="mb-3">
                <span className="text-xs font-medium tracking-wider uppercase" style={{ color: '#6E6E73' }}>JOURNALS</span>
              </div>
              
              {/* Italic category label */}
              <h3 id="venues-heading" className="text-base font-medium italic mb-4" style={{ color: '#1D1D1F' }}>Journals</h3>
              
              {/* Clear button */}
              {selectedVenue && (
                <button
                  onClick={() => handleVenueChange(null)}
                  className="text-sm mb-3 apple-transition apple-focus-ring"
                  style={{ color: '#007AFF' }}
                  data-testid="clear-venues"
                  aria-label="Clear journal filter"
                >
                  Clear all
                </button>
              )}
              
              <div className="space-y-1">
                <button
                  onClick={() => handleVenueChange(null)}
                  className={`block text-sm w-full text-left py-1 apple-transition apple-focus-ring ${
                    !selectedVenue
                      ? "font-medium"
                      : "hover:opacity-80"
                  }`}
                  style={{ color: !selectedVenue ? '#1D1D1F' : '#6E6E73' }}
                  data-testid="venue-all"
                  aria-pressed={!selectedVenue}
                >
                  All journals
                </button>
                {visibleVenues.map((venue) => {
                  const count = filterCounts.venues[venue] || 0;
                  return (
                    <button
                      key={venue}
                      onClick={() => handleVenueChange(venue)}
                      className={`block text-sm w-full text-left py-1 apple-transition apple-focus-ring ${
                        selectedVenue === venue
                          ? "font-medium"
                          : "hover:opacity-80"
                      }`}
                      style={{ color: selectedVenue === venue ? '#1D1D1F' : '#6E6E73' }}
                      data-testid={`venue-${venue.replace(/\s+/g, '-').toLowerCase()}`}
                      aria-pressed={selectedVenue === venue}
                      aria-label={`Filter by ${venue}${count > 0 ? ` (${count} publications)` : ''}`}
                    >
                      {venue} {count > 0 && `(${count})`}
                    </button>
                  );
                })}
                {venues.length > 5 && (
                  <button
                    onClick={() => setShowAllVenues(!showAllVenues)}
                    className="flex items-center text-sm py-1 apple-transition apple-focus-ring"
                    style={{ color: '#007AFF' }}
                    data-testid="toggle-venues"
                    aria-expanded={showAllVenues}
                    aria-label={showAllVenues ? "Show fewer journals" : "Show more journals"}
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
            </section>
            
            {/* Thin separator */}
            <div className="h-px mb-10" style={{ backgroundColor: '#E5E5E7' }}></div>
            
            {/* Published Year Filter */}
            <section className="mb-10" role="group" aria-labelledby="years-heading">
              {/* Uppercase caption */}
              <div className="mb-3">
                <span className="text-xs font-medium tracking-wider uppercase" style={{ color: '#6E6E73' }}>YEARS</span>
              </div>
              
              {/* Italic category label */}
              <h3 id="years-heading" className="text-base font-medium italic mb-4" style={{ color: '#1D1D1F' }}>Years</h3>
              
              {/* Clear button */}
              {selectedYear && (
                <button
                  onClick={() => handleYearChange(null)}
                  className="text-sm mb-3 apple-transition apple-focus-ring"
                  style={{ color: '#007AFF' }}
                  data-testid="clear-years"
                  aria-label="Clear year filter"
                >
                  Clear all
                </button>
              )}
              
              <div className="space-y-1">
                <button
                  onClick={() => handleYearChange(null)}
                  className={`block text-sm w-full text-left py-1 apple-transition apple-focus-ring ${
                    !selectedYear
                      ? "font-medium"
                      : "hover:opacity-80"
                  }`}
                  style={{ color: !selectedYear ? '#1D1D1F' : '#6E6E73' }}
                  data-testid="year-all"
                  aria-pressed={!selectedYear}
                >
                  All years {totalYearCount > 0 && `(${totalYearCount})`}
                </button>
                {availableYears.map((year) => {
                  const count = filterCounts.years[year] || 0;
                  return (
                    <button
                      key={year}
                      onClick={() => handleYearChange(year)}
                      className={`block text-sm w-full text-left py-1 apple-transition apple-focus-ring ${
                        selectedYear === year
                          ? "font-medium"
                          : "hover:opacity-80"
                      }`}
                      style={{ color: selectedYear === year ? '#1D1D1F' : '#6E6E73' }}
                      data-testid={`year-${year}`}
                      aria-pressed={selectedYear === year}
                      aria-label={`Filter by ${year}${count > 0 ? ` (${count} publications)` : ''}`}
                    >
                      {year} {count > 0 && `(${count})`}
                    </button>
                  );
                })}
              </div>
            </section>
          </aside>
          )}
          
          {/* Main content area - Apple typography */}
          <section 
            className="flex-1" 
            id="publications-section" 
            role="main" 
            aria-label="Publications list" 
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif' }}
          >
            {isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div className="h-6 rounded" style={{ backgroundColor: '#F6F6F6', width: '75%' }}></div>
                    <div className="h-4 rounded" style={{ backgroundColor: '#F6F6F6', width: '50%' }}></div>
                    <div className="h-4 rounded" style={{ backgroundColor: '#F6F6F6', width: '66%' }}></div>
                  </div>
                ))}
              </div>
            ) : allPublications?.length === 0 ? (
              <div style={{ paddingTop: '48px', paddingBottom: '48px' }}>
                <p style={{ color: '#6E6E73', fontSize: '18px', fontWeight: '400', lineHeight: '1.4', marginBottom: '8px' }}>
                  No publications found matching your criteria.
                </p>
                <p style={{ color: '#6E6E73', fontSize: '16px', fontWeight: '400', lineHeight: '1.4' }}>
                  Try adjusting your filters or search terms.
                </p>
              </div>
            ) : (
              <>
                {/* Publications Grid Layout */}
                <div 
                  style={{ 
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                    gap: '24px',
                    padding: 0, 
                    margin: 0 
                  }} 
                  data-testid="publications-list"
                >
                  {allPublications?.map((publication: Publication, index) => {
                    const publicationYear = new Date(publication.publicationDate).getFullYear();
                    // Transform authors: replace commas with em dashes
                    const formattedAuthors = publication.authors
                      .split(', ')
                      .join(' — ');
                    
                    return (
                      <div 
                        key={publication.id} 
                        data-testid={`publication-${publication.id}`}
                        style={{
                          padding: '20px',
                          backgroundColor: '#FAFAFA',
                          borderRadius: '12px',
                          border: '1px solid #E5E5E7',
                          display: 'flex',
                          flexDirection: 'column',
                          height: '100%'
                        }}
                      >
                        {/* Apple-style publication entry card */}
                        <div style={{ 
                          display: 'flex',
                          flexDirection: 'column',
                          height: '100%'
                        }}>
                          
                          {/* Category badges - Apple style */}
                          {publication.categories && publication.categories.length > 0 && (
                            <div style={{ 
                              display: 'flex', 
                              flexWrap: 'wrap', 
                              gap: '8px', 
                              marginBottom: '12px' 
                            }}>
                              {publication.categories.map((category: string) => {
                                const colors = CATEGORY_COLORS[category] || { 
                                  bg: '#F6F6F6', 
                                  text: '#1D1D1F', 
                                  border: '#E5E5E7' 
                                };
                                return (
                                  <span
                                    key={category}
                                    style={{
                                      display: 'inline-block',
                                      padding: '4px 10px',
                                      fontSize: '12px',
                                      fontWeight: '500',
                                      borderRadius: '4px',
                                      backgroundColor: colors.bg,
                                      color: colors.text,
                                      border: `1px solid ${colors.border}`
                                    }}
                                    data-testid={`category-badge-${category}`}
                                  >
                                    {getBadgeDisplayName(category)}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                          
                          {/* Title - Apple's conservative typography */}
                          <h3 style={{ 
                            fontSize: '21px', 
                            fontWeight: '600', 
                            lineHeight: '1.3', 
                            color: '#1D1D1F', 
                            marginBottom: '8px',
                            margin: '0 0 8px 0'
                          }}>
                            <a 
                              href={publication.pubmedUrl || publication.doi || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="transition-colors duration-200"
                              style={{ color: '#1D1D1F', textDecoration: 'none' }}
                              onMouseEnter={(e) => (e.target as HTMLElement).style.color = '#007AFF'}
                              onMouseLeave={(e) => (e.target as HTMLElement).style.color = '#1D1D1F'}
                              data-testid="publication-title-link"
                            >
                              {publication.title}
                            </a>
                          </h3>
                          
                          {/* Citation metadata - Apple's exact layout */}
                          <div style={{ 
                            fontSize: '14px', 
                            fontWeight: '400', 
                            lineHeight: '1.4', 
                            color: '#6E6E73',
                            marginBottom: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '8px'
                          }}>
                            {/* Venue (italicized) and year */}
                            <span data-testid="publication-venue">
                              <em>{publication.journal}</em>, {publicationYear}
                            </span>
                            
                            {/* DOI Badge */}
                            {publication.doi && (
                              <a
                                href={`https://doi.org/${publication.doi}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded transition-colors duration-200"
                                style={{
                                  backgroundColor: '#F0F7FF',
                                  color: '#007AFF',
                                  fontSize: '12px',
                                  fontWeight: '500',
                                  textDecoration: 'none',
                                  border: '1px solid #B3D9FF'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#E0F0FF';
                                  e.currentTarget.style.borderColor = '#80C7FF';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = '#F0F7FF';
                                  e.currentTarget.style.borderColor = '#B3D9FF';
                                }}
                                data-testid="doi-badge"
                              >
                                DOI
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                            
                            {/* Featured Badge */}
                            {publication.isFeatured === 1 && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-1 rounded"
                                style={{
                                  backgroundColor: '#FFF8E1',
                                  color: '#FF8F00',
                                  fontSize: '12px',
                                  fontWeight: '500',
                                  border: '1px solid #FFE0B2'
                                }}
                                data-testid="featured-badge"
                              >
                                <Star className="h-3 w-3" fill="#FFD60A" stroke="#FFD60A" />
                                Featured
                              </span>
                            )}
                          </div>
                          
                          {/* Authors with em dash separators - positioned at bottom */}
                          <div style={{ 
                            fontSize: '14px', 
                            fontWeight: '400', 
                            lineHeight: '1.4', 
                            color: '#6E6E73',
                            marginTop: 'auto',
                            paddingTop: '12px'
                          }} data-testid="publication-authors">
                            {formattedAuthors}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Load more button - Apple style */}
                {hasNextPage && (
                  <div style={{ paddingTop: '32px', borderTop: '1px solid #E5E5E7', marginTop: '32px' }}>
                    <button
                      onClick={loadMore}
                      disabled={isFetchingNextPage}
                      className="inline-flex items-center justify-center rounded-xl transition-all duration-200"
                      style={{
                        paddingLeft: '24px',
                        paddingRight: '24px',
                        paddingTop: '12px',
                        paddingBottom: '12px',
                        fontSize: '16px',
                        fontWeight: '500',
                        color: '#007AFF',
                        backgroundColor: 'transparent',
                        border: '1px solid #007AFF',
                        outline: 'none',
                        cursor: isFetchingNextPage ? 'not-allowed' : 'pointer',
                        opacity: isFetchingNextPage ? 0.6 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (!isFetchingNextPage) {
                          e.currentTarget.style.backgroundColor = '#F0F7FF';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      data-testid="load-more-button"
                    >
                      {isFetchingNextPage ? "Loading..." : "Load more"}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
      
      {/* Apple-style Footer */}
      <footer className="border-t" style={{ 
        backgroundColor: '#F6F6F6', 
        borderColor: '#E5E5E7',
        marginTop: '96px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif'
      }}>
        <div className="max-w-[980px] mx-auto px-6" style={{ paddingTop: '48px', paddingBottom: '48px' }}>
          {/* Footer Links */}
          <div className="flex flex-wrap items-center justify-center gap-6 mb-8">
            <a 
              href="#" 
              className="text-sm transition-colors duration-200" 
              style={{ color: '#6E6E73', textDecoration: 'none' }}
              onMouseEnter={(e) => (e.target as HTMLElement).style.color = '#1D1D1F'}
              onMouseLeave={(e) => (e.target as HTMLElement).style.color = '#6E6E73'}
              data-testid="footer-link-privacy"
            >
              Privacy Policy
            </a>
            <span style={{ color: '#E5E5E7' }}>|</span>
            <a 
              href="#" 
              className="text-sm transition-colors duration-200" 
              style={{ color: '#6E6E73', textDecoration: 'none' }}
              onMouseEnter={(e) => (e.target as HTMLElement).style.color = '#1D1D1F'}
              onMouseLeave={(e) => (e.target as HTMLElement).style.color = '#6E6E73'}
              data-testid="footer-link-terms"
            >
              Terms of Use
            </a>
            <span style={{ color: '#E5E5E7' }}>|</span>
            <a 
              href="#" 
              className="text-sm transition-colors duration-200" 
              style={{ color: '#6E6E73', textDecoration: 'none' }}
              onMouseEnter={(e) => (e.target as HTMLElement).style.color = '#1D1D1F'}
              onMouseLeave={(e) => (e.target as HTMLElement).style.color = '#6E6E73'}
              data-testid="footer-link-sales"
            >
              Sales and Refunds
            </a>
            <span style={{ color: '#E5E5E7' }}>|</span>
            <a 
              href="#" 
              className="text-sm transition-colors duration-200" 
              style={{ color: '#6E6E73', textDecoration: 'none' }}
              onMouseEnter={(e) => (e.target as HTMLElement).style.color = '#1D1D1F'}
              onMouseLeave={(e) => (e.target as HTMLElement).style.color = '#6E6E73'}
              data-testid="footer-link-legal"
            >
              Legal
            </a>
            <span style={{ color: '#E5E5E7' }}>|</span>
            <a 
              href="#" 
              className="text-sm transition-colors duration-200" 
              style={{ color: '#6E6E73', textDecoration: 'none' }}
              onMouseEnter={(e) => (e.target as HTMLElement).style.color = '#1D1D1F'}
              onMouseLeave={(e) => (e.target as HTMLElement).style.color = '#6E6E73'}
              data-testid="footer-link-sitemap"
            >
              Site Map
            </a>
          </div>
          
          {/* Copyright */}
          <div className="text-center">
            <p className="text-sm" style={{ color: '#6E6E73', lineHeight: '1.4' }} data-testid="footer-copyright">
              Copyright © {new Date().getFullYear()} Apple Inc. All rights reserved.
            </p>
            <p className="text-xs mt-2" style={{ color: '#86868B', lineHeight: '1.4' }} data-testid="footer-location">
              United States
            </p>
          </div>
        </div>
      </footer>
      
      {/* Filter Modal for Mobile */}
      <Dialog open={isFilterModalOpen} onOpenChange={setIsFilterModalOpen}>
        <DialogContent 
          className="h-full w-full max-w-none rounded-none sm:rounded-none"
          style={{
            backgroundColor: '#FFFFFF',
            padding: 0,
            margin: 0,
            maxHeight: '100vh',
            height: '100vh',
            overflowY: 'auto'
          }}
        >
          <div style={{ padding: '20px', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif' }}>
            {/* Header with Done button */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold" style={{ color: '#1D1D1F' }}>Filters</h2>
              <button
                onClick={() => setIsFilterModalOpen(false)}
                className="px-4 py-2 text-base font-medium"
                style={{ color: '#007AFF' }}
                data-testid="modal-done-button"
              >
                Done
              </button>
            </div>
            
            {/* Filter Sections - Same as sidebar */}
            {/* Research Areas Filter */}
            <section className="mb-10" role="group" aria-labelledby="modal-research-areas-heading">
              <div className="mb-3">
                <span className="text-xs font-medium tracking-wider uppercase" style={{ color: '#6E6E73' }}>RESEARCH AREAS</span>
              </div>
              
              <h3 id="modal-research-areas-heading" className="text-base font-medium italic mb-4" style={{ color: '#1D1D1F' }}>Research areas</h3>
              
              {selectedResearchArea && (
                <button
                  onClick={() => handleResearchAreaChange(null)}
                  className="text-sm mb-3"
                  style={{ color: '#007AFF' }}
                  data-testid="modal-clear-research-areas"
                >
                  Clear all
                </button>
              )}
              
              <div className="space-y-2">
                <button
                  onClick={() => handleResearchAreaChange(null)}
                  className={`block text-base w-full text-left py-2 ${
                    !selectedResearchArea 
                      ? "font-medium" 
                      : ""
                  }`}
                  style={{ color: !selectedResearchArea ? '#1D1D1F' : '#6E6E73' }}
                  data-testid="modal-area-all"
                >
                  All
                </button>
                {researchAreas.map(([slug, displayName]) => {
                  const count = filterCounts.areas[slug] || 0;
                  return (
                    <button
                      key={slug}
                      onClick={() => handleResearchAreaChange(slug)}
                      className={`block text-base w-full text-left py-2 ${
                        selectedResearchArea === slug
                          ? "font-medium"
                          : ""
                      }`}
                      style={{ color: selectedResearchArea === slug ? '#1D1D1F' : '#6E6E73' }}
                      data-testid={`modal-area-${slug}`}
                    >
                      {displayName} {count > 0 && `(${count})`}
                    </button>
                  );
                })}
              </div>
            </section>
            
            <div className="h-px mb-10" style={{ backgroundColor: '#E5E5E7' }}></div>
            
            {/* Journals Filter */}
            <section className="mb-10" role="group" aria-labelledby="modal-venues-heading">
              <div className="mb-3">
                <span className="text-xs font-medium tracking-wider uppercase" style={{ color: '#6E6E73' }}>JOURNALS</span>
              </div>
              
              <h3 id="modal-venues-heading" className="text-base font-medium italic mb-4" style={{ color: '#1D1D1F' }}>Journals</h3>
              
              {selectedVenue && (
                <button
                  onClick={() => handleVenueChange(null)}
                  className="text-sm mb-3"
                  style={{ color: '#007AFF' }}
                  data-testid="modal-clear-venues"
                >
                  Clear all
                </button>
              )}
              
              <div className="space-y-2">
                <button
                  onClick={() => handleVenueChange(null)}
                  className={`block text-base w-full text-left py-2 ${
                    !selectedVenue
                      ? "font-medium"
                      : ""
                  }`}
                  style={{ color: !selectedVenue ? '#1D1D1F' : '#6E6E73' }}
                  data-testid="modal-venue-all"
                >
                  All journals
                </button>
                {venues.map((venue) => {
                  const count = filterCounts.venues[venue] || 0;
                  return (
                    <button
                      key={venue}
                      onClick={() => handleVenueChange(venue)}
                      className={`block text-base w-full text-left py-2 ${
                        selectedVenue === venue
                          ? "font-medium"
                          : ""
                      }`}
                      style={{ color: selectedVenue === venue ? '#1D1D1F' : '#6E6E73' }}
                      data-testid={`modal-venue-${venue.replace(/\s+/g, '-').toLowerCase()}`}
                    >
                      {venue} {count > 0 && `(${count})`}
                    </button>
                  );
                })}
              </div>
            </section>
            
            <div className="h-px mb-10" style={{ backgroundColor: '#E5E5E7' }}></div>
            
            {/* Published Year Filter */}
            <section className="mb-10" role="group" aria-labelledby="modal-years-heading">
              <div className="mb-3">
                <span className="text-xs font-medium tracking-wider uppercase" style={{ color: '#6E6E73' }}>YEARS</span>
              </div>
              
              <h3 id="modal-years-heading" className="text-base font-medium italic mb-4" style={{ color: '#1D1D1F' }}>Years</h3>
              
              {selectedYear && (
                <button
                  onClick={() => handleYearChange(null)}
                  className="text-sm mb-3"
                  style={{ color: '#007AFF' }}
                  data-testid="modal-clear-years"
                >
                  Clear all
                </button>
              )}
              
              <div className="space-y-2">
                <button
                  onClick={() => handleYearChange(null)}
                  className={`block text-base w-full text-left py-2 ${
                    !selectedYear
                      ? "font-medium"
                      : ""
                  }`}
                  style={{ color: !selectedYear ? '#1D1D1F' : '#6E6E73' }}
                  data-testid="modal-year-all"
                >
                  All years {totalYearCount > 0 && `(${totalYearCount})`}
                </button>
                {availableYears.map((year) => {
                  const count = filterCounts.years[year] || 0;
                  return (
                    <button
                      key={year}
                      onClick={() => handleYearChange(year)}
                      className={`block text-base w-full text-left py-2 ${
                        selectedYear === year
                          ? "font-medium"
                          : ""
                      }`}
                      style={{ color: selectedYear === year ? '#1D1D1F' : '#6E6E73' }}
                      data-testid={`modal-year-${year}`}
                    >
                      {year} {count > 0 && `(${count})`}
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}