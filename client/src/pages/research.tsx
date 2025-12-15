import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
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
import { getResearchAreaDisplayName, RESEARCH_AREA_DISPLAY_NAMES, RESEARCH_AREAS, getCategoryBadgeName, normalizeCategoryToSlug } from "@shared/schema";
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
  // Use the new getCategoryBadgeName function which handles all formats
  // Returns uppercase abbreviations (CKD, EVA, COPD) for those categories
  const badgeName = getCategoryBadgeName(category);
  return badgeName || category;
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
  const [lastExpandedSize, setLastExpandedSize] = useState(() => {
    // Mobile gets wider default (40%), desktop gets narrower (18%)
    return typeof window !== 'undefined' && window.innerWidth < 768 ? 40 : 18;
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return typeof window !== 'undefined' && window.innerWidth < 640;
  });
  const [isMobileScreen, setIsMobileScreen] = useState(() => {
    return typeof window !== 'undefined' && window.innerWidth < 640;
  });
  const [isPublicationsSectionVisible, setIsPublicationsSectionVisible] = useState(false);
  const [publicationsHeight, setPublicationsHeight] = useState<number | null>(null);
  const [sidebarDefaultSize, setSidebarDefaultSize] = useState(() => {
    // Mobile gets wider sidebar (36%), tablet+ gets narrower (16%)
    return typeof window !== 'undefined' && window.innerWidth < 768 ? 36 : 16;
  });
  const [sidebarMinSize, setSidebarMinSize] = useState(() => {
    // Mobile needs larger minimum (25%), desktop can be narrower (16%)
    return typeof window !== 'undefined' && window.innerWidth < 768 ? 25 : 16;
  });
  
  // Initialize sidebar collapsed state based on screen size
  const [initialSidebarCollapsed] = useState(() => {
    return typeof window !== 'undefined' && window.innerWidth < 640;
  });

  // Update sidebar default size and min size on window resize
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      const isSmall = window.innerWidth < 640;
      const newDefaultSize = isMobile ? 36 : 16;
      const newMinSize = isMobile ? 25 : 16;
      setSidebarDefaultSize(newDefaultSize);
      setSidebarMinSize(newMinSize);
      setIsMobileScreen(isSmall);
      
      // Update lastExpandedSize to respect new breakpoint
      setLastExpandedSize(prev => {
        if (isMobile) {
          // On mobile, ensure lastExpandedSize is at least 25%
          return Math.max(prev, 25);
        } else {
          // On desktop, clamp to reasonable range (16-40%)
          return Math.max(16, Math.min(prev, 40));
        }
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Collapse sidebar on mount if on mobile
  useLayoutEffect(() => {
    if (initialSidebarCollapsed && sidebarPanelRef.current) {
      sidebarPanelRef.current.collapse();
      setIsSidebarCollapsed(true);
    }
  }, [initialSidebarCollapsed]);

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
    
    // Also check if size is at collapsed size (1%)
    const isAtCollapsedSize = currentSidebarSize <= 1;

    // Sync React state with panel state - check both conditions
    const shouldBeCollapsed = actuallyCollapsed || isAtCollapsedSize;
    if (shouldBeCollapsed !== isSidebarCollapsed) {
      setIsSidebarCollapsed(shouldBeCollapsed);
    }

    // Store last expanded size when panel is open and reasonably wide
    if (!shouldBeCollapsed && currentSidebarSize > 16) {
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
    // Expand to last size, but respect the current minimum size
    const targetSize = Math.max(lastExpandedSize, sidebarMinSize, sidebarDefaultSize);
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

  // Track visible publications section height for dynamic journal list sizing and visibility
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

  // Track if publications section is visible in viewport for expand button
  useEffect(() => {
    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        setIsPublicationsSectionVisible(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    if (resultsRef.current) {
      intersectionObserver.observe(resultsRef.current);
    }

    return () => {
      intersectionObserver.disconnect();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation - Top of page with logo */}
      <Navigation />
      
      {/* Hero Banner - Full width */}
      <HeroBanner />
      
      {/* Featured Research Carousel */}
      <FeaturedCarousel />
      
      {/* Publications Section */}
      <div className="w-full py-1 sm:py-2 md:py-2">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif' }}>
        {/* Main title - Apple's exact typography - Responsive */}
        <div className="text-center mb-4 sm:mb-6 md:mb-8">
          <h1 className="text-sm sm:text-2xl md:text-3xl font-light mb-2 sm:mb-3" style={{ letterSpacing: '-0.02em', color: '#1D1D1F', lineHeight: '1.1' }} data-testid="main-title">
            Publications
          </h1>
          <p className="text-xs sm:text-sm md:text-sm px-2 sm:px-8 md:px-12 lg:px-16 text-center w-full" style={{ color: '#6E6E73', lineHeight: '1.4' }}>
            Browse our comprehensive collection of peer-reviewed research spanning decades of SphygmoCor technology in practice worldwide.
          </p>
        </div>
        
        {/* Page Last Updated */}
        <div className="text-center mb-6 sm:mb-8">
          <p className="text-xs sm:text-sm" style={{ color: '#6E6E73', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif' }} data-testid="last-updated">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        
        {/* Search and Sort Section - Apple style */}
        <div className="mb-6 sm:mb-10 md:mb-12">
          {/* Search bar and sort dropdown */}
          <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row items-stretch sm:items-center mb-6">
            <div className="relative flex-1" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif' }}>
            <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none pl-3 sm:pl-4">
              <Search className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: '#6E6E73' }} />
            </div>
              <input
                type="text"
                placeholder="Search publications"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="w-full rounded-[5px] apple-transition apple-focus-ring py-2 sm:py-3 text-sm sm:text-base"
                style={{
                  paddingLeft: '2.5rem',
                  paddingRight: inputValue ? '2.5rem' : '1rem',
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
                  e.target.style.borderColor = '#AF87FF';
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
                  className="absolute inset-y-0 right-0 flex items-center apple-transition apple-focus-ring pr-3 sm:pr-4"
                  data-testid="reset-button"
                  aria-label="Clear search"
                >
                  <X 
                    className="h-4 w-4 sm:h-5 sm:w-5 apple-transition" 
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
                  className="w-full rounded-[5px] transition-all duration-200 ease-in-out py-2 sm:py-3 text-sm sm:text-base"
                  style={{
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
                style={{ color: '#AF87FF' }}
                data-testid="clear-all-filters"
              >
                Clear all
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {debouncedSearchQuery && (
                <div 
                  className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full transition-colors text-xs sm:text-sm"
                  style={{ backgroundColor: '#F6F6F6', color: '#1D1D1F' }}
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
                  className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full transition-colors text-xs sm:text-sm"
                  style={{ backgroundColor: '#F6F6F6', color: '#1D1D1F' }}
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
                  className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full transition-colors text-xs sm:text-sm"
                  style={{ backgroundColor: '#F6F6F6', color: '#1D1D1F' }}
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
                  className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full transition-colors text-xs sm:text-sm"
                  style={{ backgroundColor: '#F6F6F6', color: '#1D1D1F' }}
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
            defaultSize={initialSidebarCollapsed ? 1 : sidebarDefaultSize} 
            minSize={sidebarMinSize} 
            maxSize={isMobileScreen ? 30 : 25}
            collapsible={true}
            collapsedSize={1}
            className={`transition-all duration-200 ease-in-out ${isSidebarCollapsed ? 'w-0 overflow-hidden' : ''}`}
            style={{ 
              ...(isSidebarCollapsed ? { width: '0px', minWidth: '0px' } : {})
            }}
          >
            {/* Left sidebar - Apple ML Research Style */}
            <div className={`${isSidebarCollapsed ? 'hidden' : 'block'}`}>
            <aside className="min-w-0 pr-2 relative" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif', overflowWrap: 'anywhere', wordBreak: 'break-word' }} role="complementary" aria-label="Research filters">
            {/* Collapse button - top right of sidebar */}
            {!isSidebarCollapsed && (
              <button
                onClick={handleCollapseSidebar}
                className="absolute top-0 right-2 p-2 rounded-full hover:bg-gray-100 transition-colors duration-200"
                aria-label="Collapse sidebar"
                data-testid="collapse-sidebar-button"
                title="Collapse sidebar"
              >
                <ChevronLeft className="h-5 w-5" style={{ color: '#AF87FF' }} />
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
                  style={{ color: '#AF87FF' }}
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
                <AnimatePresence>
                {visibleAreas.map(([slug, displayName]) => {
                  const count = filterCounts.areas[slug] || 0;
                  const categoryColor = CATEGORY_COLORS[slug];
                  return (
                    <motion.button
                      key={slug}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
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
                    </motion.button>
                  );
                })}
                </AnimatePresence>
                {researchAreas.length > 5 && (
                  <button
                    onClick={() => setShowAllAreas(!showAllAreas)}
                    className="flex items-center text-sm py-1 apple-transition apple-focus-ring"
                    style={{ color: '#AF87FF' }}
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
                  style={{ color: '#AF87FF' }}
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
                <AnimatePresence>
                {visibleYears.map((year) => {
                  const count = filterCounts.years[year] || 0;
                  return (
                    <motion.button
                      key={year}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
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
                    </motion.button>
                  );
                })}
                </AnimatePresence>
                {availableYears.length > 5 && (
                  <button
                    onClick={() => setShowAllYears(!showAllYears)}
                    className="flex items-center text-sm py-1 apple-transition apple-focus-ring"
                    style={{ color: '#AF87FF' }}
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
                  style={{ color: '#AF87FF' }}
                  data-testid="clear-venues"
                  aria-label="Clear journal filter"
                >
                  Clear all
                </button>
              )}
              
              <div 
                className="space-y-1 min-w-0 overflow-y-auto sidebar-scrollbar"
                style={{ 
                  maxHeight: publicationsHeight ? `${publicationsHeight}px` : '60vh',
                  paddingRight: '4px',
                  marginRight: '-4px'
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
                <AnimatePresence>
                {visibleVenues.map((venue) => {
                  const count = filterCounts.venues[venue] || 0;
                  const hasChildren = isParentJournal(venue);
                  const isExpanded = expandedParentJournals.has(venue);
                  const childJournals = hasChildren ? getChildJournals(venue) : [];
                  
                  return (
                    <motion.div 
                      key={venue}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                    >
                      {/* Parent or regular journal */}
                      <div className="flex items-center">
                        {hasChildren && (
                          <motion.button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleParentJournal(venue);
                            }}
                            className="flex-shrink-0 mr-1 apple-transition apple-focus-ring"
                            style={{ color: '#6E6E73' }}
                            aria-label={isExpanded ? `Collapse ${venue}` : `Expand ${venue}`}
                            data-testid={`toggle-journal-${venue.replace(/\s+/g, '-').toLowerCase()}`}
                            animate={{ rotate: isExpanded ? 90 : 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                          >
                            <ChevronRight className="h-3 w-3" />
                          </motion.button>
                        )}
                        <button
                          onClick={() => handleVenueChange(venue)}
                          className={`block text-sm w-full text-left py-2 sm:py-1 px-1 sm:px-0 apple-transition apple-focus-ring break-words ${
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
                      <AnimatePresence>
                      {hasChildren && isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2, ease: "easeInOut" }}
                        >
                          {childJournals.map((childJournal) => {
                            // Child journals won't have their own counts in the venues list
                            // since they're aggregated under the parent
                            return (
                              <motion.button
                                key={childJournal}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                transition={{ duration: 0.15, ease: "easeInOut" }}
                                onClick={() => handleVenueChange(childJournal)}
                                className={`block text-sm w-full text-left py-2 sm:py-1 px-1 sm:px-0 ml-6 sm:ml-8 apple-transition apple-focus-ring break-words ${
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
                              </motion.button>
                            );
                          })}
                        </motion.div>
                      )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
                </AnimatePresence>
                {venues.length > 10 && (
                  <button
                    onClick={() => setShowAllVenues(!showAllVenues)}
                    className="flex items-center text-sm py-1 apple-transition apple-focus-ring"
                    style={{ color: '#AF87FF' }}
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
              className="flex-1 min-w-0 pl-4 sm:pl-6 md:pl-8" 
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
              <div className="py-8 sm:py-10 md:py-12">
                <p className="text-base sm:text-lg mb-2" style={{ color: '#6E6E73', fontWeight: '400', lineHeight: '1.4' }}>
                  No publications found matching your criteria.
                </p>
                <p className="text-sm sm:text-base" style={{ color: '#6E6E73', fontWeight: '400', lineHeight: '1.4' }}>
                  Try adjusting your filters or search terms.
                </p>
              </div>
            ) : (
              <>
                {/* Publications List - Single Column Layout */}
                <motion.div 
                  className="min-w-0"
                  style={{ 
                    display: 'flex',
                    flexDirection: 'column',
                    padding: 0, 
                    margin: 0 
                  }} 
                  data-testid="publications-list"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4 }}
                >
                  <AnimatePresence>
                  {allPublications?.map((publication: Publication, index) => {
                    const publicationYear = new Date(publication.publicationDate).getFullYear();
                    // Sanitize authors to decode HTML entities
                    const formattedAuthors = sanitizeText(publication.authors);
                    
                    return (
                      <motion.div 
                        key={publication.id} 
                        data-testid={`publication-${publication.id}`}
                        className="min-w-0 py-4 sm:py-5 md:py-6"
                        style={{
                          borderBottom: '1px solid #E5E5E7',
                          display: 'flex',
                          flexDirection: 'column',
                          width: '100%',
                          maxWidth: '100%',
                          overflow: 'hidden'
                        }}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ 
                          duration: 0.4,
                          delay: index * 0.05,
                          ease: [0.25, 0.46, 0.45, 0.94]
                        }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.1 }}
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
                                // Normalize category to slug for consistent color lookup and keys
                                const categorySlug = normalizeCategoryToSlug(category) || category;
                                const colors = CATEGORY_COLORS[categorySlug] || { text: '#6E6E73' };
                                const displayName = getBadgeDisplayName(category);
                                return (
                                  <span key={categorySlug} style={{ display: 'inline-flex', alignItems: 'center' }}>
                                    <span
                                      style={{
                                        fontSize: '12px',
                                        fontWeight: '500',
                                        color: colors.text,
                                      }}
                                      data-testid={`category-badge-${categorySlug}`}
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
                          
                          {/* Title - Apple's conservative typography - Responsive */}
                          <h3 className="text-lg sm:text-xl font-semibold mb-2" style={{ 
                            lineHeight: '1.3', 
                            color: '#1D1D1F', 
                            wordWrap: 'break-word',
                            overflowWrap: 'break-word'
                          }}>
                            <a 
                              href={publication.pubmedUrl || publication.doi || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="transition-colors duration-200"
                              style={{ color: '#1D1D1F', textDecoration: 'none' }}
                              onMouseEnter={(e) => (e.target as HTMLElement).style.color = '#AF87FF'}
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
                                  backgroundColor: '#F5F0FF',
                                  color: '#AF87FF',
                                  fontSize: '12px',
                                  fontWeight: '500',
                                  textDecoration: 'none',
                                  border: '1px solid #D4C4FF'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#EDE5FF';
                                  e.currentTarget.style.borderColor = '#C4B0FF';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = '#F5F0FF';
                                  e.currentTarget.style.borderColor = '#D4C4FF';
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
                      </motion.div>
                    );
                  })}
                  </AnimatePresence>
                </motion.div>
              </>
            )}
          </section>
          </ResizablePanel>
        </ResizablePanelGroup>

        {/* Pagination controls - Apple style */}
        {!isLoading && allPublications.length > 0 && (
          <div className="pl-4 sm:pl-6 md:pl-8 mt-6 sm:mt-8">
            <PaginationControls
              total={totalResults}
              currentPage={currentPage}
              perPage={perPage}
              onPageChange={handlePageChange}
              onPerPageChange={setPerPage}
            />
          </div>
        )}

        {/* Floating expand button when sidebar is collapsed on mobile and publications are visible */}
        <AnimatePresence>
          {isSidebarCollapsed && isMobileScreen && isPublicationsSectionVisible && (
            <motion.button
              onClick={handleExpandSidebar}
              className="fixed z-50 shadow-lg hover:shadow-xl transition-all duration-200 rounded-full p-3 bg-white border-2 border-gray-200 hover:bg-gray-50 flex items-center justify-center"
              style={{
                left: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '44px',
                height: '44px'
              }}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              aria-label="Expand sidebar"
              data-testid="expand-sidebar-button"
            >
              <ChevronRight size={24} style={{ color: '#AF87FF', strokeWidth: 2 }} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      </div>
      {/* FDA Clearance Timeline Section */}
      <section className="w-full py-16 sm:py-20" style={{ backgroundColor: '#FAFAFA', fontFamily: 'Montserrat, -apple-system, BlinkMacSystemFont, sans-serif' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl sm:text-3xl md:text-4xl font-light mb-12 sm:mb-16" style={{ color: '#242422', lineHeight: '1.3' }}>
            Backed by Over 50 Years of Research, 20+ Years of Commercial Use, and 5x FDA-Clearances to Date<sup>†</sup>
          </h2>
          
          {/* FDA Timeline Grid */}
          <div className="relative">
            {/* Horizontal connecting line - visible on lg screens */}
            <div className="hidden lg:block absolute top-[72px] left-[8%] right-[8%] h-[1px]" style={{ backgroundColor: '#E5E7EB' }}></div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6 sm:gap-8 mb-8">
              {/* 2002 */}
              <div className="text-center relative">
                <div className="inline-flex items-center gap-2 mb-4">
                  <span className="px-3 py-1 text-xs font-bold rounded-sm" style={{ backgroundColor: '#22C55E', color: 'white' }}>FDA</span>
                  <span className="text-[10px] font-medium tracking-wide" style={{ color: '#9CA3AF' }}>CLEARED</span>
                </div>
                <div className="text-2xl font-semibold mb-3 relative" style={{ color: '#242422' }}>
                  2002
                  <div className="hidden lg:block absolute left-1/2 -translate-x-1/2 top-full mt-1 w-2 h-2 rounded-full bg-white border-2" style={{ borderColor: '#E5E7EB' }}></div>
                </div>
                <div className="text-xs" style={{ color: '#6B7280', lineHeight: '1.5' }}>
                  510K Clearance:<br />SphygmoCor Px
                </div>
              </div>
              
              {/* 2007 */}
              <div className="text-center relative">
                <div className="inline-flex items-center gap-2 mb-4">
                  <span className="px-3 py-1 text-xs font-bold rounded-sm" style={{ backgroundColor: '#22C55E', color: 'white' }}>FDA</span>
                  <span className="text-[10px] font-medium tracking-wide" style={{ color: '#9CA3AF' }}>CLEARED</span>
                </div>
                <div className="text-2xl font-semibold mb-3 relative" style={{ color: '#242422' }}>
                  2007
                  <div className="hidden lg:block absolute left-1/2 -translate-x-1/2 top-full mt-1 w-2 h-2 rounded-full bg-white border-2" style={{ borderColor: '#E5E7EB' }}></div>
                </div>
                <div className="text-xs" style={{ color: '#6B7280', lineHeight: '1.5' }}>
                  510K Clearance:<br />SphygmoCor CvMS
                </div>
              </div>
              
              {/* 2012 */}
              <div className="text-center relative">
                <div className="inline-flex items-center gap-2 mb-4">
                  <span className="px-3 py-1 text-xs font-bold rounded-sm" style={{ backgroundColor: '#22C55E', color: 'white' }}>FDA</span>
                  <span className="text-[10px] font-medium tracking-wide" style={{ color: '#9CA3AF' }}>CLEARED</span>
                </div>
                <div className="text-2xl font-semibold mb-3 relative" style={{ color: '#242422' }}>
                  2012
                  <div className="hidden lg:block absolute left-1/2 -translate-x-1/2 top-full mt-1 w-2 h-2 rounded-full bg-white border-2" style={{ borderColor: '#E5E7EB' }}></div>
                </div>
                <div className="text-xs" style={{ color: '#6B7280', lineHeight: '1.5' }}>
                  510K Clearance:<br />SphygmoCor XCEL
                </div>
              </div>
              
              {/* 2016 Oscar */}
              <div className="text-center relative">
                <div className="inline-flex items-center gap-2 mb-4">
                  <span className="px-3 py-1 text-xs font-bold rounded-sm" style={{ backgroundColor: '#22C55E', color: 'white' }}>FDA</span>
                  <span className="text-[10px] font-medium tracking-wide" style={{ color: '#9CA3AF' }}>CLEARED</span>
                </div>
                <div className="text-2xl font-semibold mb-3 relative" style={{ color: '#242422' }}>
                  2016
                  <div className="hidden lg:block absolute left-1/2 -translate-x-1/2 top-full mt-1 w-2 h-2 rounded-full bg-white border-2" style={{ borderColor: '#E5E7EB' }}></div>
                </div>
                <div className="text-xs" style={{ color: '#6B7280', lineHeight: '1.5' }}>
                  Oscar 2 ABPM with<br />SphygmoCor
                </div>
              </div>
              
              {/* 2016 AMA */}
              <div className="text-center relative">
                <div className="inline-flex items-center gap-2 mb-4">
                  <span className="px-3 py-1 text-xs font-bold rounded-sm flex items-center gap-1" style={{ backgroundColor: '#4B5563', color: 'white' }}>
                    AMA
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                  </span>
                  <span className="text-[10px] font-medium tracking-wide invisible">CLEARED</span>
                </div>
                <div className="text-2xl font-semibold mb-3 relative" style={{ color: '#242422' }}>
                  2016
                  <div className="hidden lg:block absolute left-1/2 -translate-x-1/2 top-full mt-1 w-2 h-2 rounded-full bg-white border-2" style={{ borderColor: '#E5E7EB' }}></div>
                </div>
                <div className="text-xs" style={{ color: '#6B7280', lineHeight: '1.5' }}>
                  CPT Code<br />Approval
                </div>
              </div>
              
              {/* 2023 */}
              <div className="text-center relative">
                <div className="inline-flex items-center gap-2 mb-4">
                  <span className="px-3 py-1 text-xs font-bold rounded-sm" style={{ backgroundColor: '#22C55E', color: 'white' }}>FDA</span>
                  <span className="text-[10px] font-medium tracking-wide" style={{ color: '#9CA3AF' }}>CLEARED</span>
                </div>
                <div className="text-2xl font-semibold mb-3 relative" style={{ color: '#242422' }}>
                  2023
                  <div className="hidden lg:block absolute left-1/2 -translate-x-1/2 top-full mt-1 w-2 h-2 rounded-full bg-white border-2" style={{ borderColor: '#E5E7EB' }}></div>
                </div>
                <div className="text-xs" style={{ color: '#6B7280', lineHeight: '1.5' }}>
                  CONNEQT Pulse
                </div>
              </div>
            </div>
          </div>
          
          {/* Footnote */}
          <p className="text-xs mt-8" style={{ color: '#9CA3AF' }}>
            †SphygmoCor technology.
          </p>
        </div>
      </section>

      {/* CONNEQT Health Footer */}
      <footer style={{ 
        backgroundColor: '#F5F0E8', 
        fontFamily: 'Montserrat, -apple-system, BlinkMacSystemFont, sans-serif'
      }}>
        {/* Main Footer Content */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 text-center">
          {/* CONNEQT Health Logo */}
          <div className="mb-8">
            <a 
              href="https://conneqthealth.com" 
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block"
              data-testid="footer-logo"
            >
              <div style={{ letterSpacing: '0.3em', fontSize: '24px', fontWeight: '400', color: '#242422' }}>
                CONNEQT<span style={{ fontSize: '10px', verticalAlign: 'super' }}>®</span>
              </div>
              <div style={{ letterSpacing: '0.4em', fontSize: '12px', fontWeight: '300', color: '#6B7280', marginTop: '2px' }}>
                Health
              </div>
            </a>
          </div>

          {/* Purple CTA Button */}
          <a
            href="https://conneqthealth.com/#newsletter"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-8 py-3 rounded-[5px] text-sm font-medium transition-all duration-200 hover:opacity-90 mb-10"
            style={{ backgroundColor: '#AF87FF', color: '#FFFFFF', textDecoration: 'none' }}
            data-testid="footer-newsletter-button"
          >
            Sign Up for Insights & Early Offers
          </a>

          {/* Navigation Links - Row 1 */}
          <div className="flex justify-center gap-x-4 gap-y-2 mb-4 flex-wrap">
            <a href="https://conneqthealth.com/why-conneqt/" target="_blank" rel="noopener noreferrer" className="text-xs sm:text-sm transition-colors duration-200 whitespace-nowrap" style={{ color: '#4B5563', textDecoration: 'none' }} onMouseEnter={(e) => (e.target as HTMLElement).style.color = '#AF87FF'} onMouseLeave={(e) => (e.target as HTMLElement).style.color = '#4B5563'}>Why CONNEQT</a>
            <span className="text-gray-400">•</span>
            <a href="https://conneqthealth.com/how-it-works/" target="_blank" rel="noopener noreferrer" className="text-xs sm:text-sm transition-colors duration-200 whitespace-nowrap" style={{ color: '#4B5563', textDecoration: 'none' }} onMouseEnter={(e) => (e.target as HTMLElement).style.color = '#AF87FF'} onMouseLeave={(e) => (e.target as HTMLElement).style.color = '#4B5563'}>How it Works</a>
            <span className="text-gray-400">•</span>
            <a href="https://conneqthealth.com/onboarding/" target="_blank" rel="noopener noreferrer" className="text-xs sm:text-sm transition-colors duration-200 whitespace-nowrap" style={{ color: '#4B5563', textDecoration: 'none' }} onMouseEnter={(e) => (e.target as HTMLElement).style.color = '#AF87FF'} onMouseLeave={(e) => (e.target as HTMLElement).style.color = '#4B5563'}>Onboarding</a>
            <span className="text-gray-400">•</span>
            <a href="https://conneqthealth.com/insights/" target="_blank" rel="noopener noreferrer" className="text-xs sm:text-sm transition-colors duration-200 whitespace-nowrap" style={{ color: '#4B5563', textDecoration: 'none' }} onMouseEnter={(e) => (e.target as HTMLElement).style.color = '#AF87FF'} onMouseLeave={(e) => (e.target as HTMLElement).style.color = '#4B5563'}>Insights</a>
            <span className="text-gray-400">•</span>
            <a href="https://conneqthealth.com/in-the-news/" target="_blank" rel="noopener noreferrer" className="text-xs sm:text-sm transition-colors duration-200 whitespace-nowrap" style={{ color: '#4B5563', textDecoration: 'none' }} onMouseEnter={(e) => (e.target as HTMLElement).style.color = '#AF87FF'} onMouseLeave={(e) => (e.target as HTMLElement).style.color = '#4B5563'}>In the News</a>
            <span className="text-gray-400">•</span>
            <a href="https://conneqthealth.com/support/" target="_blank" rel="noopener noreferrer" className="text-xs sm:text-sm transition-colors duration-200 whitespace-nowrap" style={{ color: '#4B5563', textDecoration: 'none' }} onMouseEnter={(e) => (e.target as HTMLElement).style.color = '#AF87FF'} onMouseLeave={(e) => (e.target as HTMLElement).style.color = '#4B5563'}>Support</a>
            <span className="text-gray-400">•</span>
            <a href="https://conneqthealth.com/join-us/" target="_blank" rel="noopener noreferrer" className="text-xs sm:text-sm transition-colors duration-200 whitespace-nowrap" style={{ color: '#4B5563', textDecoration: 'none' }} onMouseEnter={(e) => (e.target as HTMLElement).style.color = '#AF87FF'} onMouseLeave={(e) => (e.target as HTMLElement).style.color = '#4B5563'}>Join Us</a>
            <span className="text-gray-400">•</span>
            <a href="https://conneqthealth.com/corporate-investors/" target="_blank" rel="noopener noreferrer" className="text-xs sm:text-sm transition-colors duration-200 whitespace-nowrap" style={{ color: '#4B5563', textDecoration: 'none' }} onMouseEnter={(e) => (e.target as HTMLElement).style.color = '#AF87FF'} onMouseLeave={(e) => (e.target as HTMLElement).style.color = '#4B5563'}>Corporate & Investors</a>
          </div>

          {/* Navigation Links - Row 2 */}
          <div className="flex justify-center gap-x-4 gap-y-2 mb-10 flex-wrap">
            <a href="https://conneqthealth.com/affiliate-program/" target="_blank" rel="noopener noreferrer" className="text-xs sm:text-sm transition-colors duration-200 whitespace-nowrap" style={{ color: '#4B5563', textDecoration: 'none' }} onMouseEnter={(e) => (e.target as HTMLElement).style.color = '#AF87FF'} onMouseLeave={(e) => (e.target as HTMLElement).style.color = '#4B5563'}>Affiliate Program</a>
            <span className="text-gray-400">•</span>
            <a href="https://conneqthealth.com/privacy-policy/" target="_blank" rel="noopener noreferrer" className="text-xs sm:text-sm transition-colors duration-200 whitespace-nowrap" style={{ color: '#4B5563', textDecoration: 'none' }} onMouseEnter={(e) => (e.target as HTMLElement).style.color = '#AF87FF'} onMouseLeave={(e) => (e.target as HTMLElement).style.color = '#4B5563'}>Privacy Policy</a>
            <span className="text-gray-400">•</span>
            <a href="https://conneqthealth.com/editorial-guidelines/" target="_blank" rel="noopener noreferrer" className="text-xs sm:text-sm transition-colors duration-200 whitespace-nowrap" style={{ color: '#4B5563', textDecoration: 'none' }} onMouseEnter={(e) => (e.target as HTMLElement).style.color = '#AF87FF'} onMouseLeave={(e) => (e.target as HTMLElement).style.color = '#4B5563'}>Editorial Guidelines</a>
          </div>

          {/* Social Media Icons */}
          <div className="flex justify-center gap-4 mb-10">
            <a 
              href="https://twitter.com/conneqthealth" 
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-[5px] flex items-center justify-center transition-all duration-200"
              style={{ border: '1px solid #D1D5DB', color: '#4B5563', backgroundColor: 'transparent' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#AF87FF';
                e.currentTarget.style.color = '#AF87FF';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#D1D5DB';
                e.currentTarget.style.color = '#4B5563';
              }}
              data-testid="footer-social-twitter"
              aria-label="X (Twitter)"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
            <a 
              href="https://www.instagram.com/conneqthealth/" 
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-[5px] flex items-center justify-center transition-all duration-200"
              style={{ border: '1px solid #D1D5DB', color: '#4B5563', backgroundColor: 'transparent' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#AF87FF';
                e.currentTarget.style.color = '#AF87FF';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#D1D5DB';
                e.currentTarget.style.color = '#4B5563';
              }}
              data-testid="footer-social-instagram"
              aria-label="Instagram"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
            </a>
            <a 
              href="https://www.linkedin.com/company/conneqthealth/" 
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-[5px] flex items-center justify-center transition-all duration-200"
              style={{ border: '1px solid #D1D5DB', color: '#4B5563', backgroundColor: 'transparent' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#AF87FF';
                e.currentTarget.style.color = '#AF87FF';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#D1D5DB';
                e.currentTarget.style.color = '#4B5563';
              }}
              data-testid="footer-social-linkedin"
              aria-label="LinkedIn"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
            </a>
          </div>

          {/* Partner Logos */}
          <div className="mb-8">
            <div className="flex flex-wrap justify-center items-center gap-10 sm:gap-16 mb-6">
              {/* DTRA Logo */}
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-center justify-center">
                  <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none">
                    <path d="M4 8L16 4L28 8L16 12L4 8Z" fill="#6B7280"/>
                    <path d="M4 16L16 12L28 16L16 20L4 16Z" fill="#9CA3AF"/>
                    <path d="M4 24L16 20L28 24L16 28L4 24Z" fill="#D1D5DB"/>
                  </svg>
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold" style={{ color: '#4B5563' }}>DTRA</div>
                  <div className="text-[8px] leading-tight" style={{ color: '#9CA3AF' }}>DECENTRALIZED TRIALS<br/>RESEARCH ALLIANCE</div>
                </div>
              </div>
              
              {/* AHA Logo */}
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#E5E7EB' }}>
                  <svg className="w-5 h-5" fill="#6B7280" viewBox="0 0 24 24">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                  </svg>
                </div>
                <div className="text-left">
                  <div className="text-[9px] leading-tight" style={{ color: '#6B7280' }}>American Heart Association.</div>
                  <div className="text-[10px] font-semibold" style={{ color: '#4B5563' }}>Center for Health</div>
                  <div className="text-[10px] font-semibold" style={{ color: '#4B5563' }}>Technology & Innovation</div>
                </div>
              </div>
              
              {/* AdvaMed Logo */}
              <div className="flex items-center gap-2">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="#DC2626"/>
                  <path d="M2 17L12 22L22 17" stroke="#DC2626" strokeWidth="2"/>
                  <path d="M2 12L12 17L22 12" stroke="#DC2626" strokeWidth="2"/>
                </svg>
                <div className="text-left">
                  <div className="text-sm font-bold" style={{ color: '#4B5563' }}>AdvaMed</div>
                  <div className="text-[8px] leading-tight" style={{ color: '#9CA3AF' }}>Advanced Medical Technology Association</div>
                </div>
              </div>
            </div>
            <p className="text-xs" style={{ color: '#9CA3AF' }}>
              CONNEQT is pleased to be a member of these esteemed professional organizations.
            </p>
          </div>

          {/* Copyright */}
          <div className="border-t pt-6" style={{ borderColor: '#E5E7EB' }}>
            <p className="text-xs" style={{ color: '#9CA3AF', lineHeight: '1.6' }}>
              Copyright © {new Date().getFullYear()} CONNEQT Health. All Rights Reserved. CONNEQT and the CONNEQT logo are either registered trademarks or trademarks of CONNEQT Health in the United States and/or other countries.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}