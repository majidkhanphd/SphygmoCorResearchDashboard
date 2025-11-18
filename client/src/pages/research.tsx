import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import Navigation from "@/components/navigation";
import HeroBanner from "@/components/hero-banner";
import FeaturedCarousel from "@/components/featured-carousel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Search, X, Star, ExternalLink } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { searchPublications } from "@/services/pubmed";
import type { Publication } from "@shared/schema";
import { getResearchAreaDisplayName, RESEARCH_AREA_DISPLAY_NAMES, RESEARCH_AREAS } from "@shared/schema";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { PaginationControls } from "@/components/pagination-controls";
import { sanitizeText } from "@shared/sanitize";
import { getChildJournals, isParentJournal, type JournalGroup, JOURNAL_GROUPS } from "@shared/journal-mappings";

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
  const [showAllYears, setShowAllYears] = useState(false);
  const [expandedParentJournals, setExpandedParentJournals] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState<number>(() => {
    const saved = localStorage.getItem('publicationsPerPage');
    return saved ? parseInt(saved) : 25;
  });
  const resultsRef = useRef<HTMLDivElement>(null);
  const sidebarPanelRef = useRef<ImperativePanelHandle>(null);
  const [sidebarSize, setSidebarSize] = useState(16);
  const [lastExpandedSize, setLastExpandedSize] = useState(18);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [publicationsHeight, setPublicationsHeight] = useState<number | null>(null);
  const [sidebarDefaultSize, setSidebarDefaultSize] = useState(() => {
    // Mobile gets wider sidebar (40%), tablet+ gets narrower (16%)
    return typeof window !== 'undefined' && window.innerWidth < 768 ? 40 : 16;
  });

  // Update sidebar default size on window resize
  useEffect(() => {
    const handleResize = () => {
      const newDefaultSize = window.innerWidth < 768 ? 40 : 16;
      setSidebarDefaultSize(newDefaultSize);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Reset to page 1 when filters or perPage changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, selectedResearchArea, selectedVenue, selectedYear, sortBy, perPage]);
  
  // Persist perPage to localStorage
  useEffect(() => {
    localStorage.setItem('publicationsPerPage', perPage.toString());
  }, [perPage]);

  const { 
    data, 
    isLoading
  } = useQuery({
    queryKey: ["/api/publications/search", { 
      query: debouncedSearchQuery || undefined, 
      categories: selectedResearchArea ? [selectedResearchArea] : undefined,
      venue: selectedVenue || undefined,
      year: selectedYear || undefined,
      sortBy,
      limit: perPage,
      page: currentPage
    }],
    queryFn: () => searchPublications({
      query: debouncedSearchQuery || undefined,
      categories: selectedResearchArea ? [selectedResearchArea] : undefined,
      venue: selectedVenue || undefined,
      year: selectedYear || undefined,
      sortBy,
      limit: perPage,
      offset: (currentPage - 1) * perPage
    })
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

  const toggleParentJournal = (parentJournal: string) => {
    setExpandedParentJournals(prev => {
      const next = new Set(prev);
      if (next.has(parentJournal)) {
        next.delete(parentJournal);
      } else {
        next.add(parentJournal);
      }
      return next;
    });
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top of results
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Handle sidebar resize to store last expanded size and sync collapsed state
  const handlePanelLayout = (sizes: number[]) => {
    const currentSidebarSize = sizes[0];
    setSidebarSize(currentSidebarSize);

    // Check actual collapsed state from the panel
    const actuallyCollapsed = sidebarPanelRef.current?.isCollapsed() ?? false;

    // Sync React state with panel state
    if (actuallyCollapsed !== isSidebarCollapsed) {
      setIsSidebarCollapsed(actuallyCollapsed);
    }

    // Store last expanded size when panel is open and reasonably wide
    if (!actuallyCollapsed && currentSidebarSize > 16) {
      setLastExpandedSize(currentSidebarSize);
    }
  };

  // Handle collapsing the sidebar (via button)
  const handleCollapseSidebar = () => {
    sidebarPanelRef.current?.collapse();
    setIsSidebarCollapsed(true);
  };

  // Handle expanding the sidebar (via button)
  const handleExpandSidebar = () => {
    // Expand to last size or default to 18% (safe minimum)
    const targetSize = lastExpandedSize > 16 ? lastExpandedSize : 18;
    sidebarPanelRef.current?.resize(targetSize);
    setIsSidebarCollapsed(false);
  };

  // Get publications from current page
  const allPublications = data?.publications || [];
  
  // Get authoritative filter counts from the backend
  const backendFilterCounts = data?.filterCounts || {
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
  
  // Get pagination data
  const totalPages = data?.totalPages || 0;
  const totalResults = data?.total || 0;

  // Get venues from backend filter counts for authoritative list - sorted by count (descending)
  const venues = Object.keys(backendFilterCounts.venues).sort((a, b) => {
    const countA = backendFilterCounts.venues[a] || 0;
    const countB = backendFilterCounts.venues[b] || 0;
    return countB - countA; // Sort descending by count
  });
  const visibleVenues = showAllVenues ? venues : venues.slice(0, 10);

  // Get research areas from schema - sorted by count (descending)
  const researchAreas = Object.entries(RESEARCH_AREA_DISPLAY_NAMES).sort((a, b) => {
    const countA = filterCounts.areas[a[0]] || 0;
    const countB = filterCounts.areas[b[0]] || 0;
    return countB - countA; // Sort descending by count
  });
  const visibleAreas = showAllAreas ? researchAreas : researchAreas.slice(0, 5);

  // Get years from 2000 to present
  const currentYear = new Date().getFullYear();
  const availableYears = Array.from(
    { length: currentYear - 2000 + 1 }, 
    (_, i) => currentYear - i
  );
  const visibleYears = showAllYears ? availableYears : availableYears.slice(0, 5);
  
  // Calculate total count for all years
  const totalYearCount = Object.values(filterCounts.years).reduce((sum, count) => sum + (count as number), 0);

  // Track visible publications section height for dynamic journal list sizing
  useEffect(() => {
    const updateHeight = () => {
      if (resultsRef.current) {
        const rect = resultsRef.current.getBoundingClientRect();
        // Use the visible viewport height, not the scrollable content height
        setPublicationsHeight(rect.height);
      }
    };

    // Initial measurement
    updateHeight();

    // Update on window resize
    window.addEventListener('resize', updateHeight);
    
    // Update when publications change or container resizes
    const observer = new ResizeObserver(updateHeight);
    if (resultsRef.current) {
      observer.observe(resultsRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateHeight);
      observer.disconnect();
    };
  }, [allPublications, perPage, currentPage]);

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation - Top of page with logo */}
      <Navigation />
      
      {/* Hero Banner - Full width */}
      <HeroBanner />
      
      {/* Featured Research Carousel */}
      <FeaturedCarousel />
      
      {/* Publications Section */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8" style={{ paddingTop: '48px', paddingBottom: '64px', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif' }}>
        {/* Main title - Apple's exact typography */}
        <div className="text-center" style={{ marginBottom: '64px' }}>
          <h1 style={{ fontSize: '48px', fontWeight: '300', letterSpacing: '-0.02em', color: '#1D1D1F', marginBottom: '12px', lineHeight: '1.1' }} data-testid="main-title">
            Publications
          </h1>
          <p
            style={{ fontSize: '18px', color: '#6E6E73', maxWidth: '820px', margin: '0 auto', lineHeight: '1.4' }}
            className="ml-[50px] mr-[50px] text-center pl-[30px] pr-[30px]">
            Browse our comprehensive collection of peer-reviewed research spanning decades of SphygmoCor technology in practice worldwide.
          </p>
        </div>
        
        {/* Page Last Updated */}
        <div className="text-center" style={{ marginBottom: '32px' }}>
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
        <ResizablePanelGroup direction="horizontal" className="w-full" onLayout={handlePanelLayout}>
          <ResizablePanel 
            ref={sidebarPanelRef} 
            defaultSize={sidebarDefaultSize} 
            minSize={16} 
            maxSize={40}
            collapsible={true}
            collapsedSize={1}
            className={`transition-all duration-200 ease-in-out ${isSidebarCollapsed ? 'w-0 overflow-hidden' : ''}`}
            style={{ 
              ...(isSidebarCollapsed ? { width: '0px', minWidth: '0px' } : {})
            }}
          >
            {/* Left sidebar - Apple ML Research Style */}
            <div className={`${isSidebarCollapsed ? 'hidden' : 'block'}`}>
            <aside className="min-w-0 pr-8 relative" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif', overflowWrap: 'anywhere', wordBreak: 'break-word' }} role="complementary" aria-label="Research filters">
            {/* Collapse button - top right of sidebar */}
            {!isSidebarCollapsed && (
              <button
                onClick={handleCollapseSidebar}
                className="absolute top-0 right-2 p-2 rounded-full hover:bg-gray-100 transition-colors duration-200"
                aria-label="Collapse sidebar"
                data-testid="collapse-sidebar-button"
                title="Collapse sidebar"
              >
                <ChevronLeft className="h-5 w-5" style={{ color: '#007AFF' }} />
              </button>
            )}
            
            {/* Research Areas Filter */}
            <section className="mb-10 min-w-0" role="group" aria-labelledby="research-areas-heading">
              {/* Uppercase caption */}
              <div className="mb-3 min-w-0">
                <span className="text-xs font-medium tracking-wider uppercase break-words" style={{ color: '#6E6E73' }}>RESEARCH AREAS</span>
              </div>
              
              {/* Italic category label */}
              <h3 id="research-areas-heading" className="text-base font-medium italic mb-4 min-w-0 break-words" style={{ color: '#1D1D1F' }}>Research areas</h3>
              
              {/* Clear button */}
              {selectedResearchArea && (
                <button
                  onClick={() => handleResearchAreaChange(null)}
                  className="text-sm mb-3 apple-transition apple-focus-ring break-words"
                  style={{ color: '#007AFF' }}
                  data-testid="clear-research-areas"
                  aria-label="Clear research area filter"
                >
                  Clear all
                </button>
              )}
              
              <div className="space-y-1 min-w-0">
                <button
                  onClick={() => handleResearchAreaChange(null)}
                  className={`block text-sm w-full text-left py-1 apple-transition apple-focus-ring break-words ${
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
                  const categoryColor = CATEGORY_COLORS[slug];
                  return (
                    <button
                      key={slug}
                      onClick={() => handleResearchAreaChange(slug)}
                      className={`flex items-center text-sm w-full text-left py-1 apple-transition apple-focus-ring break-words ${
                        selectedResearchArea === slug
                          ? "font-medium"
                          : "hover:opacity-80"
                      }`}
                      style={{ color: selectedResearchArea === slug ? '#1D1D1F' : '#6E6E73' }}
                      data-testid={`area-${slug}`}
                      aria-pressed={selectedResearchArea === slug}
                      aria-label={`Filter by ${displayName}${count > 0 ? ` (${count} publications)` : ''}`}
                    >
                      {categoryColor && (
                        <span style={{ color: categoryColor.text, marginRight: '6px', fontSize: '10px' }}>●</span>
                      )}
                      <span>{displayName} {count > 0 && `(${count})`}</span>
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
            
            {/* Published Year Filter */}
            <section className="mb-10 min-w-0" role="group" aria-labelledby="years-heading">
              {/* Uppercase caption */}
              <div className="mb-3 min-w-0">
                <span className="text-xs font-medium tracking-wider uppercase break-words" style={{ color: '#6E6E73' }}>YEARS</span>
              </div>
              
              {/* Italic category label */}
              <h3 id="years-heading" className="text-base font-medium italic mb-4 min-w-0 break-words" style={{ color: '#1D1D1F' }}>Years</h3>
              
              {/* Clear button */}
              {selectedYear && (
                <button
                  onClick={() => handleYearChange(null)}
                  className="text-sm mb-3 apple-transition apple-focus-ring break-words"
                  style={{ color: '#007AFF' }}
                  data-testid="clear-years"
                  aria-label="Clear year filter"
                >
                  Clear all
                </button>
              )}
              
              <div className="space-y-1 min-w-0">
                <button
                  onClick={() => handleYearChange(null)}
                  className={`block text-sm w-full text-left py-1 apple-transition apple-focus-ring break-words ${
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
                {visibleYears.map((year) => {
                  const count = filterCounts.years[year] || 0;
                  return (
                    <button
                      key={year}
                      onClick={() => handleYearChange(year)}
                      className={`block text-sm w-full text-left py-1 apple-transition apple-focus-ring break-words ${
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
                {availableYears.length > 5 && (
                  <button
                    onClick={() => setShowAllYears(!showAllYears)}
                    className="flex items-center text-sm py-1 apple-transition apple-focus-ring"
                    style={{ color: '#007AFF' }}
                    data-testid="toggle-years"
                    aria-expanded={showAllYears}
                    aria-label={showAllYears ? "Show fewer years" : "Show more years"}
                  >
                    {showAllYears ? (
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
            <section className="mb-10 min-w-0" role="group" aria-labelledby="venues-heading">
              {/* Uppercase caption */}
              <div className="mb-3 min-w-0">
                <span className="text-xs font-medium tracking-wider uppercase break-words" style={{ color: '#6E6E73' }}>JOURNALS</span>
              </div>
              
              {/* Italic category label */}
              <h3 id="venues-heading" className="text-base font-medium italic mb-4 min-w-0 break-words" style={{ color: '#1D1D1F' }}>Journals</h3>
              
              {/* Clear button */}
              {selectedVenue && (
                <button
                  onClick={() => handleVenueChange(null)}
                  className="text-sm mb-3 apple-transition apple-focus-ring break-words"
                  style={{ color: '#007AFF' }}
                  data-testid="clear-venues"
                  aria-label="Clear journal filter"
                >
                  Clear all
                </button>
              )}
              
              <div 
                className="space-y-1 min-w-0 overflow-y-auto"
                style={{ 
                  maxHeight: publicationsHeight ? `${publicationsHeight}px` : '60vh'
                }}
              >
                <button
                  onClick={() => handleVenueChange(null)}
                  className={`block text-sm w-full text-left py-1 apple-transition apple-focus-ring break-words ${
                    !selectedVenue
                      ? "font-medium"
                      : "hover:opacity-80"
                  }`}
                  style={{ color: !selectedVenue ? '#1D1D1F' : '#6E6E73' }}
                  data-testid="venue-all"
                  aria-pressed={!selectedVenue}
                >
                  All Journals
                </button>
                {visibleVenues.map((venue) => {
                  const count = filterCounts.venues[venue] || 0;
                  const hasChildren = isParentJournal(venue);
                  const isExpanded = expandedParentJournals.has(venue);
                  const childJournals = hasChildren ? getChildJournals(venue) : [];
                  
                  return (
                    <div key={venue}>
                      {/* Parent or regular journal */}
                      <div className="flex items-center">
                        {hasChildren && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleParentJournal(venue);
                            }}
                            className="flex-shrink-0 mr-1 apple-transition apple-focus-ring"
                            style={{ color: '#6E6E73' }}
                            aria-label={isExpanded ? `Collapse ${venue}` : `Expand ${venue}`}
                            data-testid={`toggle-journal-${venue.replace(/\s+/g, '-').toLowerCase()}`}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronRight className="h-3 w-3" />
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => handleVenueChange(venue)}
                          className={`block text-sm w-full text-left py-1 apple-transition apple-focus-ring break-words ${
                            selectedVenue === venue
                              ? "font-medium"
                              : "hover:opacity-80"
                          } ${!hasChildren ? 'ml-4' : ''}`}
                          style={{ color: selectedVenue === venue ? '#1D1D1F' : '#6E6E73' }}
                          data-testid={`venue-${venue.replace(/\s+/g, '-').toLowerCase()}`}
                          aria-pressed={selectedVenue === venue}
                          aria-label={`Filter by ${venue}${count > 0 ? ` (${count} publications)` : ''}`}
                        >
                          {venue} {count > 0 && `(${count})`}
                        </button>
                      </div>
                      
                      {/* Child journals (shown when expanded) */}
                      {hasChildren && isExpanded && childJournals.map((childJournal) => {
                        // Child journals won't have their own counts in the venues list
                        // since they're aggregated under the parent
                        return (
                          <button
                            key={childJournal}
                            onClick={() => handleVenueChange(childJournal)}
                            className={`block text-sm w-full text-left py-1 ml-8 apple-transition apple-focus-ring break-words ${
                              selectedVenue === childJournal
                                ? "font-medium"
                                : "hover:opacity-80"
                            }`}
                            style={{ 
                              color: selectedVenue === childJournal ? '#1D1D1F' : '#86868B',
                              fontSize: '13px'
                            }}
                            data-testid={`venue-child-${childJournal.replace(/\s+/g, '-').toLowerCase()}`}
                            aria-pressed={selectedVenue === childJournal}
                          >
                            {childJournal}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
                {venues.length > 10 && (
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
          </aside>
          </div>
          </ResizablePanel>
          
          <ResizableHandle 
            withHandle 
            style={{ 
              width: '8px',
              cursor: 'col-resize',
              backgroundColor: 'rgba(0, 0, 0, 0.05)',
              transition: 'background-color 0.2s'
            }} 
          />
          
          <ResizablePanel defaultSize={72}>
            {/* Main content area - Apple typography */}
            <section 
              ref={resultsRef}
              className="flex-1 min-w-0 pl-8" 
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
                {/* Publications List - Single Column Layout */}
                <div 
                  className="min-w-0"
                  style={{ 
                    display: 'flex',
                    flexDirection: 'column',
                    padding: 0, 
                    margin: 0 
                  }} 
                  data-testid="publications-list"
                >
                  {allPublications?.map((publication: Publication, index) => {
                    const publicationYear = new Date(publication.publicationDate).getFullYear();
                    // Sanitize authors to decode HTML entities
                    const formattedAuthors = sanitizeText(publication.authors);
                    
                    return (
                      <div 
                        key={publication.id} 
                        data-testid={`publication-${publication.id}`}
                        className="min-w-0"
                        style={{
                          paddingTop: '24px',
                          paddingBottom: '24px',
                          borderBottom: '1px solid #E5E5E7',
                          display: 'flex',
                          flexDirection: 'column',
                          width: '100%',
                          maxWidth: '100%',
                          overflow: 'hidden'
                        }}
                      >
                        {/* Publication entry - no card styling */}
                        <div 
                          className="min-w-0 break-words"
                          style={{ 
                            display: 'flex',
                            flexDirection: 'column'
                          }}>
                          
                          {/* Category badges - Apple style */}
                          {publication.categories && publication.categories.length > 0 && (
                            <div style={{ 
                              display: 'flex', 
                              flexWrap: 'wrap', 
                              alignItems: 'center',
                              gap: '4px', 
                              marginBottom: '12px' 
                            }}>
                              {publication.categories.map((category: string, catIndex: number) => {
                                const colors = CATEGORY_COLORS[category] || { text: '#6E6E73' };
                                const displayName = getBadgeDisplayName(category);
                                return (
                                  <span key={category} style={{ display: 'inline-flex', alignItems: 'center' }}>
                                    <span
                                      style={{
                                        fontSize: '12px',
                                        fontWeight: '500',
                                        color: colors.text,
                                      }}
                                      data-testid={`category-badge-${category}`}
                                    >
                                      {displayName}
                                    </span>
                                    {catIndex < (publication.categories?.length || 0) - 1 && (
                                      <span style={{ color: '#E5E5E7', margin: '0 4px' }}>—</span>
                                    )}
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
                            margin: '0 0 8px 0',
                            wordWrap: 'break-word',
                            overflowWrap: 'break-word'
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
                              {sanitizeText(publication.title)}
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
                            gap: '8px',
                            wordWrap: 'break-word',
                            overflowWrap: 'break-word'
                          }}>
                            {/* Venue (italicized) and year */}
                            <span data-testid="publication-venue">
                              <em>{sanitizeText(publication.journal)}</em>, {publicationYear}
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
                            color: '#6E6E73',
                            marginTop: '4px',
                            wordWrap: 'break-word',
                            overflowWrap: 'break-word'
                          }} data-testid="publication-authors">
                            {formattedAuthors}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>
          </ResizablePanel>
        </ResizablePanelGroup>

        {/* Pagination controls - Apple style */}
        {!isLoading && allPublications.length > 0 && (
          <div className="pl-8 mt-8">
            <PaginationControls
              total={totalResults}
              currentPage={currentPage}
              perPage={perPage}
              onPageChange={handlePageChange}
              onPerPageChange={setPerPage}
            />
          </div>
        )}

        {/* Floating expand button when sidebar is collapsed */}
        {isSidebarCollapsed && (
          <button
            onClick={handleExpandSidebar}
            className="fixed z-50 shadow-lg hover:shadow-xl transition-all duration-200 rounded-full p-3 bg-white border border-gray-200 hover:bg-gray-50"
            style={{
              left: '16px',
              top: '50%',
              transform: 'translateY(-50%)'
            }}
            aria-label="Expand sidebar"
            data-testid="expand-sidebar-button"
          >
            <ChevronRight className="h-5 w-5" style={{ color: '#007AFF' }} />
          </button>
        )}
      </div>
      {/* Apple-style Footer */}
      <footer className="border-t" style={{ 
        backgroundColor: '#F6F6F6', 
        borderColor: '#E5E5E7',
        marginTop: '48px',
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
              Copyright © {new Date().getFullYear()} CONNEQT Health. All rights reserved.
            </p>
            <p className="text-xs mt-2" style={{ color: '#86868B', lineHeight: '1.4' }} data-testid="footer-location">
              United States | Austrailia | Worldwide
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}