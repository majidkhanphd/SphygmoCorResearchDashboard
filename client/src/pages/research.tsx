import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import Navigation from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronUp, Search, X, Star, ExternalLink } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { searchPublications } from "@/services/pubmed";
import type { Publication } from "@shared/schema";
import { getResearchAreaDisplayName, RESEARCH_AREA_DISPLAY_NAMES, RESEARCH_AREAS } from "@shared/schema";

export default function Home() {
  const [inputValue, setInputValue] = useState("");
  const debouncedSearchQuery = useDebounce(inputValue, 400);
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "relevance">("newest");
  const [selectedResearchArea, setSelectedResearchArea] = useState<string | null>(null);
  const [selectedVenue, setSelectedVenue] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [showAllAreas, setShowAllAreas] = useState(false);
  const [showAllVenues, setShowAllVenues] = useState(false);
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false);
  const limit = 50;

  const { 
    data, 
    isLoading, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage 
  } = useInfiniteQuery({
    queryKey: ["/api/publications/search", { 
      query: debouncedSearchQuery || undefined, 
      researchArea: selectedResearchArea || undefined,
      venue: selectedVenue || undefined,
      year: selectedYear || undefined,
      sortBy,
      limit,
      featured: showFeaturedOnly || undefined
    }],
    queryFn: ({ pageParam = 0 }) => searchPublications({
      query: debouncedSearchQuery || undefined,
      researchArea: selectedResearchArea || undefined,
      venue: selectedVenue || undefined,
      year: selectedYear || undefined,
      sortBy,
      limit,
      offset: pageParam * limit,
      featured: showFeaturedOnly || undefined
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
    setShowFeaturedOnly(false);
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
    researchAreas: {},
    venues: {},
    years: {}
  };
  
  // Transform backend filter counts to match frontend expectations
  const filterCounts = {
    areas: backendFilterCounts.researchAreas,
    venues: backendFilterCounts.venues, 
    years: backendFilterCounts.years
  };

  // Get venues from backend filter counts for authoritative list
  const venues = Object.keys(backendFilterCounts.venues).sort();
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
      
      {/* Apple's exact hero section */}
      <div className="max-w-[980px] mx-auto px-6" style={{ paddingTop: '56px', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif' }}>
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
        
        {/* Featured Publications Toggle - Apple style */}
        <div style={{ marginBottom: '48px' }} role="tablist" aria-label="Publication filter">
          <div className="inline-flex items-center rounded-xl apple-transition" style={{
            backgroundColor: '#F6F6F6',
            border: '1px solid #E5E5E7',
            padding: '4px'
          }}>
            <button
              id="tab-all-publications"
              onClick={() => setShowFeaturedOnly(false)}
              className={`px-4 py-2 rounded-lg text-sm font-medium apple-transition apple-focus-ring ${
                !showFeaturedOnly ? 'shadow-sm' : ''
              }`}
              style={{
                backgroundColor: !showFeaturedOnly ? '#FFFFFF' : 'transparent',
                color: !showFeaturedOnly ? '#1D1D1F' : '#6E6E73',
                border: 'none',
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif'
              }}
              data-testid="toggle-all-publications"
              role="tab"
              aria-selected={!showFeaturedOnly}
              aria-controls="publications-tabpanel"
            >
              All Publications
            </button>
            <button
              id="tab-featured-publications"
              onClick={() => setShowFeaturedOnly(true)}
              className={`px-4 py-2 rounded-lg text-sm font-medium apple-transition apple-focus-ring flex items-center gap-1 ${
                showFeaturedOnly ? 'shadow-sm' : ''
              }`}
              style={{
                backgroundColor: showFeaturedOnly ? '#FFFFFF' : 'transparent',
                color: showFeaturedOnly ? '#1D1D1F' : '#6E6E73',
                border: 'none',
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif'
              }}
              data-testid="toggle-featured-publications"
              role="tab"
              aria-selected={showFeaturedOnly}
              aria-controls="publications-tabpanel"
            >
              <Star className="h-4 w-4" fill={showFeaturedOnly ? '#FFD60A' : 'none'} stroke={showFeaturedOnly ? '#FFD60A' : 'currentColor'} />
              Featured
            </button>
          </div>
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
          <div className="flex gap-4 items-end mb-6">
            <div className="relative max-w-2xl flex-1" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif' }}>
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
            <div className="w-48">
              <Select value={sortBy} onValueChange={(value: "newest" | "oldest" | "relevance") => setSortBy(value)}>
                <SelectTrigger 
                  className="rounded-xl transition-all duration-200 ease-in-out"
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
        </div>
        
        {/* Active Filter Chips */}
        {(selectedResearchArea || selectedVenue || selectedYear || debouncedSearchQuery || showFeaturedOnly) && (
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
              {showFeaturedOnly && (
                <div 
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full transition-colors"
                  style={{ backgroundColor: '#F6F6F6', color: '#1D1D1F', fontSize: '14px' }}
                  data-testid="filter-chip-featured"
                >
                  <Star className="h-3 w-3" fill="#FFD60A" stroke="#FFD60A" />
                  <span>Featured Publications</span>
                  <button
                    onClick={() => setShowFeaturedOnly(false)}
                    className="hover:opacity-70 transition-opacity"
                    data-testid="clear-featured-filter"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
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
                  <span>Venue: {selectedVenue}</span>
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
        <div className="flex gap-16">
          {/* Left sidebar - Apple ML Research Style */}
          <aside className="w-64 flex-shrink-0" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif' }} role="complementary" aria-label="Research filters">
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
            
            {/* Venues Filter */}
            <section className="mb-10" role="group" aria-labelledby="venues-heading">
              {/* Uppercase caption */}
              <div className="mb-3">
                <span className="text-xs font-medium tracking-wider uppercase" style={{ color: '#6E6E73' }}>VENUES</span>
              </div>
              
              {/* Italic category label */}
              <h3 id="venues-heading" className="text-base font-medium italic mb-4" style={{ color: '#1D1D1F' }}>Venues</h3>
              
              {/* Clear button */}
              {selectedVenue && (
                <button
                  onClick={() => handleVenueChange(null)}
                  className="text-sm mb-3 apple-transition apple-focus-ring"
                  style={{ color: '#007AFF' }}
                  data-testid="clear-venues"
                  aria-label="Clear venue filter"
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
                  All venues
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
                    aria-label={showAllVenues ? "Show fewer venues" : "Show more venues"}
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
                  All years
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
          
          {/* Main content area - Apple typography */}
          <section 
            className="flex-1" 
            id="publications-tabpanel" 
            role="tabpanel" 
            aria-labelledby={showFeaturedOnly ? "tab-featured-publications" : "tab-all-publications"}
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
                {/* Apple-style Publications List using ordered list */}
                <ol style={{ listStyle: 'none', padding: 0, margin: 0 }} data-testid="publications-list">
                  {allPublications?.map((publication: Publication, index) => {
                    const publicationYear = new Date(publication.publicationDate).getFullYear();
                    // Transform authors: replace commas with em dashes
                    const formattedAuthors = publication.authors
                      .split(', ')
                      .join(' — ');
                    
                    return (
                      <li key={publication.id} data-testid={`publication-${publication.id}`}>
                        {/* Apple-style publication entry */}
                        <div style={{ 
                          paddingTop: index === 0 ? 0 : '24px', 
                          paddingBottom: '24px'
                        }}>
                          {/* Horizontal separator line (except for first item) */}
                          {index > 0 && (
                            <div 
                              style={{ 
                                height: '1px', 
                                backgroundColor: '#E5E5E7', 
                                marginBottom: '24px',
                                marginTop: '-24px'
                              }} 
                            />
                          )}
                          
                          {/* Title - Apple's conservative typography */}
                          <h3 style={{ 
                            fontSize: '17px', 
                            fontWeight: '400', 
                            lineHeight: '1.35', 
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
                          
                          {/* Authors with em dash separators */}
                          <div style={{ 
                            fontSize: '14px', 
                            fontWeight: '400', 
                            lineHeight: '1.4', 
                            color: '#6E6E73'
                          }} data-testid="publication-authors">
                            {formattedAuthors}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
                
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
    </div>
  );
}