import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import FeaturedCarousel from "@/components/featured-carousel";
import { ChevronRight } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { searchPublications } from "@/services/pubmed";
import type { Publication } from "@shared/schema";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { PaginationControls } from "@/components/pagination-controls";
import { PublicationsListSkeleton } from "@/components/research-skeletons";
import { ResearchSidebar } from "@/components/research/ResearchSidebar";
import { ResearchBanner, ResearchSearchControls, ActiveFilterChips, useMouseTracking } from "@/components/research/ResearchHeader";
import { PublicationsList } from "@/components/research/PublicationsList";

export default function Home() {
  const [inputValue, setInputValue] = useState("");
  const debouncedSearchQuery = useDebounce(inputValue, 400);
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "most-cited" | "trending">("newest");
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
    return typeof window !== 'undefined' && window.innerWidth < 768 ? 40 : 18;
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return typeof window !== 'undefined' && window.innerWidth < 640;
  });
  const [isMobileScreen, setIsMobileScreen] = useState(() => {
    return typeof window !== 'undefined' && window.innerWidth < 640;
  });
  const [expandedPublicationIds, setExpandedPublicationIds] = useState<Set<string>>(new Set());
  const [isPublicationsSectionVisible, setIsPublicationsSectionVisible] = useState(false);
  const [publicationsHeight, setPublicationsHeight] = useState<number | null>(null);
  const [sidebarDefaultSize, setSidebarDefaultSize] = useState(() => {
    return typeof window !== 'undefined' && window.innerWidth < 768 ? 36 : 16;
  });
  const [sidebarMinSize, setSidebarMinSize] = useState(() => {
    return typeof window !== 'undefined' && window.innerWidth < 768 ? 25 : 16;
  });

  const [initialSidebarCollapsed] = useState(() => {
    return typeof window !== 'undefined' && window.innerWidth < 640;
  });

  const bannerRef = useRef<HTMLDivElement>(null);
  const contentAreaRef = useRef<HTMLDivElement>(null);
  const { smoothPos } = useMouseTracking(bannerRef, contentAreaRef);

  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      const isSmall = window.innerWidth < 640;
      setSidebarDefaultSize(isMobile ? 36 : 16);
      setSidebarMinSize(isMobile ? 25 : 16);
      setIsMobileScreen(isSmall);
      setLastExpandedSize(prev => {
        if (isMobile) return Math.max(prev, 25);
        return Math.max(16, Math.min(prev, 40));
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useLayoutEffect(() => {
    if (initialSidebarCollapsed && sidebarPanelRef.current) {
      sidebarPanelRef.current.collapse();
      setIsSidebarCollapsed(true);
    }
  }, [initialSidebarCollapsed]);

  useEffect(() => {
    setCurrentPage(1);
    setExpandedPublicationIds(new Set());
  }, [debouncedSearchQuery, selectedResearchArea, selectedVenue, selectedYear, sortBy]);

  useEffect(() => {
    setCurrentPage(1);
    setExpandedPublicationIds(new Set());
    localStorage.setItem('publicationsPerPage', perPage.toString());
  }, [perPage]);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/publications/search", {
      query: debouncedSearchQuery || undefined,
      categories: selectedResearchArea ? [selectedResearchArea] : undefined,
      venue: selectedVenue || undefined,
      year: selectedYear || undefined,
      sortBy,
      limit: perPage,
      offset: (currentPage - 1) * perPage
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

  const clearFilter = (filterType: 'researchArea' | 'venue' | 'year') => {
    switch (filterType) {
      case 'researchArea': setSelectedResearchArea(null); break;
      case 'venue': setSelectedVenue(null); break;
      case 'year': setSelectedYear(null); break;
    }
  };

  const clearAllFilters = () => {
    setSelectedResearchArea(null);
    setSelectedVenue(null);
    setSelectedYear(null);
    setInputValue("");
  };

  const toggleParentJournal = (parentJournal: string) => {
    setExpandedParentJournals(prev => {
      const next = new Set(prev);
      if (next.has(parentJournal)) next.delete(parentJournal);
      else next.add(parentJournal);
      return next;
    });
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setExpandedPublicationIds(new Set());
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handlePanelLayout = (sizes: number[]) => {
    const currentSidebarSize = sizes[0];
    setSidebarSize(currentSidebarSize);
    const actuallyCollapsed = sidebarPanelRef.current?.isCollapsed() ?? false;
    const isAtCollapsedSize = currentSidebarSize <= 1;
    const shouldBeCollapsed = actuallyCollapsed || isAtCollapsedSize;
    if (shouldBeCollapsed !== isSidebarCollapsed) setIsSidebarCollapsed(shouldBeCollapsed);
    if (!shouldBeCollapsed && currentSidebarSize > 16) setLastExpandedSize(currentSidebarSize);
  };

  const handleCollapseSidebar = () => {
    sidebarPanelRef.current?.collapse();
    setIsSidebarCollapsed(true);
  };

  const handleExpandSidebar = () => {
    const targetSize = Math.max(lastExpandedSize, sidebarMinSize, sidebarDefaultSize);
    sidebarPanelRef.current?.resize(targetSize);
    setIsSidebarCollapsed(false);
  };

  const handleToggleExpand = (id: string) => {
    setExpandedPublicationIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const handleCollapseAbstract = (id: string) => {
    setExpandedPublicationIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const allPublications = data?.publications || [];
  const backendFilterCounts = data?.filterCounts || { categories: {}, venues: {}, childJournalCounts: {}, years: {} };
  const filterCounts = { areas: backendFilterCounts.categories, venues: backendFilterCounts.venues, years: backendFilterCounts.years };
  const totalResults = data?.total || 0;

  useEffect(() => {
    const updateHeight = () => {
      if (resultsRef.current) {
        const rect = resultsRef.current.getBoundingClientRect();
        setPublicationsHeight(rect.height);
      }
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    const observer = new ResizeObserver(updateHeight);
    if (resultsRef.current) observer.observe(resultsRef.current);
    return () => { window.removeEventListener('resize', updateHeight); observer.disconnect(); };
  }, [allPublications, perPage, currentPage]);

  useEffect(() => {
    const intersectionObserver = new IntersectionObserver(
      ([entry]) => setIsPublicationsSectionVisible(entry.isIntersecting),
      { threshold: 0.1 }
    );
    if (resultsRef.current) intersectionObserver.observe(resultsRef.current);
    return () => intersectionObserver.disconnect();
  }, []);

  return (
    <div className="bg-background research-page">
      <div ref={contentAreaRef}>
        <FeaturedCarousel />

        <div className="w-full py-1 sm:py-2 md:py-2">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 research-font-family">

        <ResearchBanner smoothPos={smoothPos} bannerRef={bannerRef} />

        <div className="text-center mb-6 sm:mb-8">
          <p className="text-xs sm:text-sm research-last-updated" data-testid="last-updated">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <ResearchSearchControls
          inputValue={inputValue}
          sortBy={sortBy}
          onInputChange={setInputValue}
          onSortChange={setSortBy}
        />

        <ActiveFilterChips
          selectedResearchArea={selectedResearchArea}
          selectedVenue={selectedVenue}
          selectedYear={selectedYear}
          debouncedSearchQuery={debouncedSearchQuery}
          onInputChange={setInputValue}
          onClearFilter={clearFilter}
          onClearAllFilters={clearAllFilters}
        />

        <ResizablePanelGroup direction="horizontal" className="w-full" style={{ alignItems: 'flex-start' }} onLayout={handlePanelLayout}>
          <ResizablePanel
            ref={sidebarPanelRef}
            defaultSize={initialSidebarCollapsed ? 3 : sidebarDefaultSize}
            minSize={sidebarMinSize}
            maxSize={isMobileScreen ? 30 : 25}
            collapsible={true}
            collapsedSize={3}
            className="transition-all duration-200 ease-in-out"
          >
            {isSidebarCollapsed && (
              <div className="h-full flex items-start justify-center pt-2 flex-shrink-0">
                <button
                  onClick={handleExpandSidebar}
                  className="p-1.5 rounded hover:bg-gray-100 transition-colors duration-200 flex-shrink-0 research-expand-btn-container"
                  aria-label="Expand sidebar"
                  data-testid="expand-sidebar-button"
                  title="Expand sidebar"
                >
                  <ChevronRight className="h-4 w-4 research-expand-btn-icon" />
                </button>
              </div>
            )}

            <div className={`${isSidebarCollapsed ? 'hidden' : 'block'}`}>
              <ResearchSidebar
                selectedResearchArea={selectedResearchArea}
                selectedVenue={selectedVenue}
                selectedYear={selectedYear}
                showAllAreas={showAllAreas}
                showAllVenues={showAllVenues}
                showAllYears={showAllYears}
                expandedParentJournals={expandedParentJournals}
                publicationsHeight={publicationsHeight}
                filterCounts={filterCounts}
                backendFilterCounts={backendFilterCounts}
                onResearchAreaChange={setSelectedResearchArea}
                onVenueChange={setSelectedVenue}
                onYearChange={setSelectedYear}
                onToggleShowAllAreas={() => setShowAllAreas(!showAllAreas)}
                onToggleShowAllVenues={() => setShowAllVenues(!showAllVenues)}
                onToggleShowAllYears={() => setShowAllYears(!showAllYears)}
                onToggleParentJournal={toggleParentJournal}
                onCollapseSidebar={handleCollapseSidebar}
              />
            </div>
          </ResizablePanel>

          <ResizableHandle className="group relative flex items-center justify-center research-resizable-handle">
            <div className="absolute h-full w-[2px] rounded-full group-hover:bg-[#AF87FF] transition-colors duration-200 research-resizable-grip" />
          </ResizableHandle>

          <ResizablePanel defaultSize={72}>
            <section
              ref={resultsRef}
              className="flex-1 min-w-0 pl-4 sm:pl-6 md:pl-8 research-publications-section"
              id="publications-section"
              role="main"
              aria-label="Publications list"
            >
              {isLoading ? (
                <PublicationsListSkeleton count={perPage > 10 ? 10 : perPage} />
              ) : allPublications?.length === 0 ? (
                <div className="py-8 sm:py-10 md:py-12">
                  <p className="text-base sm:text-lg mb-2 research-empty-primary">
                    No publications found matching your criteria.
                  </p>
                  <p className="text-sm sm:text-base research-empty-secondary">
                    Try adjusting your filters or search terms.
                  </p>
                </div>
              ) : (
                <PublicationsList
                  publications={allPublications}
                  expandedPublicationIds={expandedPublicationIds}
                  onToggleExpand={handleToggleExpand}
                  onCollapseAbstract={handleCollapseAbstract}
                />
              )}
            </section>
          </ResizablePanel>
        </ResizablePanelGroup>

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

        <AnimatePresence>
          {isSidebarCollapsed && isMobileScreen && isPublicationsSectionVisible && (
            <motion.button
              onClick={handleExpandSidebar}
              className="fixed z-50 shadow-lg hover:shadow-xl transition-all duration-200 rounded-full p-3 bg-white border-2 border-gray-200 hover:bg-gray-50 flex items-center justify-center research-floating-expand-btn"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              aria-label="Expand sidebar"
              data-testid="expand-sidebar-button"
            >
              <ChevronRight size={24} className="research-floating-expand-icon" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      </div>
      </div>
    </div>
  );
}
