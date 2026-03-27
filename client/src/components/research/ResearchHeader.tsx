import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getResearchAreaDisplayName } from "@shared/schema";

type SortOption = "newest" | "oldest" | "most-cited" | "trending" | "relevance";

interface ResearchHeaderProps {
  inputValue: string;
  sortBy: SortOption;
  selectedResearchArea: string | null;
  selectedVenue: string | null;
  selectedYear: number | null;
  debouncedSearchQuery: string;
  smoothPos: { x: number; y: number };
  bannerRef: React.RefObject<HTMLDivElement>;
  contentAreaRef: React.RefObject<HTMLDivElement>;
  onInputChange: (value: string) => void;
  onSortChange: (value: SortOption) => void;
  onClearFilter: (filterType: 'researchArea' | 'venue' | 'year') => void;
  onClearAllFilters: () => void;
}

export function ResearchBanner({ smoothPos, bannerRef }: { smoothPos: { x: number; y: number }; bannerRef: React.RefObject<HTMLDivElement> }) {
  return (
    <div className="text-center mb-4 sm:mb-6 md:mb-8 px-2 sm:px-4">
      <div
        ref={bannerRef}
        className="inline-block px-6 sm:px-10 md:px-16 py-6 sm:py-8 md:py-10 rounded-lg banner-glow-pulse research-banner"
        style={{
          background: `
            radial-gradient(
              ellipse 150% 150% at ${smoothPos.x}% ${smoothPos.y}%,
              rgba(175, 135, 255, 0.09) 0%,
              rgba(200, 175, 255, 0.05) 30%,
              rgba(225, 215, 255, 0.025) 50%,
              rgba(246, 246, 246, 1) 80%
            )
          `
        }}
        data-testid="publications-banner"
      >
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-light mb-3 sm:mb-4 research-main-title" data-testid="main-title">
          Publications
        </h1>
        <p className="text-sm sm:text-base md:text-lg px-2 sm:px-4 md:px-6 text-center w-full research-subtitle">
          Browse our comprehensive collection of peer-reviewed research spanning decades of our SphygmoCor technology in practice worldwide.
        </p>
      </div>
    </div>
  );
}

export function ResearchSearchControls({
  inputValue,
  sortBy,
  debouncedSearchQuery,
  onInputChange,
  onSortChange,
}: Pick<ResearchHeaderProps, 'inputValue' | 'sortBy' | 'onInputChange' | 'onSortChange'> & { debouncedSearchQuery?: string }) {
  const handleReset = () => {
    onInputChange("");
  };

  return (
    <div className="mb-6 sm:mb-10 md:mb-12">
      <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row items-stretch sm:items-center mb-6">
        <div className="relative flex-1 research-font-family">
          <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none pl-3 sm:pl-4">
            <Search className="h-4 w-4 sm:h-5 sm:w-5 research-search-icon" />
          </div>
          <input
            type="text"
            placeholder="Search publications"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            className={`w-full rounded-[5px] apple-transition apple-focus-ring py-2 sm:py-3 text-sm sm:text-base research-search-input ${inputValue ? 'research-search-input-with-clear' : 'research-search-input-no-clear'}`}
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
              <X className="h-4 w-4 sm:h-5 sm:w-5 apple-transition research-clear-icon" />
            </button>
          )}
        </div>

        <div className="w-full sm:w-48 flex-shrink-0">
          <Select value={sortBy} onValueChange={(value: SortOption) => onSortChange(value)}>
            <SelectTrigger
              className="w-full rounded-[5px] transition-all duration-200 ease-in-out py-2 sm:py-3 text-sm sm:text-base research-sort-dropdown"
              data-testid="sort-dropdown"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {debouncedSearchQuery && (
                <SelectItem value="relevance" data-testid="sort-relevance">Relevance</SelectItem>
              )}
              <SelectItem value="newest" data-testid="sort-newest">Newest</SelectItem>
              <SelectItem value="oldest" data-testid="sort-oldest">Oldest</SelectItem>
              <SelectItem value="most-cited" data-testid="sort-most-cited">Most Cited</SelectItem>
              <SelectItem value="trending" data-testid="sort-trending">Trending</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

export function ActiveFilterChips({
  selectedResearchArea,
  selectedVenue,
  selectedYear,
  debouncedSearchQuery,
  onInputChange,
  onClearFilter,
  onClearAllFilters,
}: Pick<ResearchHeaderProps, 'selectedResearchArea' | 'selectedVenue' | 'selectedYear' | 'debouncedSearchQuery' | 'onInputChange' | 'onClearFilter' | 'onClearAllFilters'>) {
  if (!selectedResearchArea && !selectedVenue && !selectedYear && !debouncedSearchQuery) {
    return null;
  }

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-medium research-filter-label">Active filters:</span>
        <button
          onClick={onClearAllFilters}
          className="text-sm transition-colors research-clear-all-link"
          data-testid="clear-all-filters"
        >
          Clear all
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {debouncedSearchQuery && (
          <div
            className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full transition-colors text-xs sm:text-sm research-filter-chip"
            data-testid="filter-chip-search"
          >
            <span>Search: {debouncedSearchQuery}</span>
            <button
              onClick={() => onInputChange('')}
              className="hover:opacity-70 transition-opacity"
              data-testid="clear-search-filter"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        {selectedResearchArea && (
          <div
            className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full transition-colors text-xs sm:text-sm research-filter-chip"
            data-testid="filter-chip-research-area"
          >
            <span>Research Area: {getResearchAreaDisplayName(selectedResearchArea)}</span>
            <button
              onClick={() => onClearFilter('researchArea')}
              className="hover:opacity-70 transition-opacity"
              data-testid="clear-research-area-filter"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        {selectedVenue && (
          <div
            className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full transition-colors text-xs sm:text-sm research-filter-chip"
            data-testid="filter-chip-venue"
          >
            <span>Journal: {selectedVenue}</span>
            <button
              onClick={() => onClearFilter('venue')}
              className="hover:opacity-70 transition-opacity"
              data-testid="clear-venue-filter"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        {selectedYear && (
          <div
            className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full transition-colors text-xs sm:text-sm research-filter-chip"
            data-testid="filter-chip-year"
          >
            <span>Year: {selectedYear}</span>
            <button
              onClick={() => onClearFilter('year')}
              className="hover:opacity-70 transition-opacity"
              data-testid="clear-year-filter"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function useMouseTracking(bannerRef: React.RefObject<HTMLDivElement>, contentAreaRef: React.RefObject<HTMLDivElement>) {
  const [isTrackingMouse, setIsTrackingMouse] = useState(false);
  const [animationsReady, setAnimationsReady] = useState(false);
  const targetPosRef = useRef({ x: 50, y: 50 });
  const [smoothPos, setSmoothPos] = useState({ x: 50, y: 50 });
  const TRACKING_BUFFER = 50;

  useEffect(() => {
    const timer = setTimeout(() => setAnimationsReady(true), 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!animationsReady) return;

    let animationFrame: number;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = (Date.now() - startTime) / 1000;

      if (!isTrackingMouse) {
        const idleX = Math.sin(elapsed * 0.3) * 15 + Math.sin(elapsed * 0.7) * 8;
        const idleY = Math.cos(elapsed * 0.4) * 12 + Math.cos(elapsed * 0.6) * 6;
        targetPosRef.current = { x: 50 + idleX, y: 50 + idleY };
      }

      setSmoothPos(prev => ({
        x: prev.x + (targetPosRef.current.x - prev.x) * 0.06,
        y: prev.y + (targetPosRef.current.y - prev.y) * 0.06
      }));

      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [isTrackingMouse, animationsReady]);

  useEffect(() => {
    if (!animationsReady) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!bannerRef.current || !contentAreaRef.current) {
        setIsTrackingMouse(false);
        return;
      }

      const contentRect = contentAreaRef.current.getBoundingClientRect();

      const isInContentArea =
        e.clientX >= contentRect.left - TRACKING_BUFFER &&
        e.clientX <= contentRect.right + TRACKING_BUFFER &&
        e.clientY >= contentRect.top - TRACKING_BUFFER &&
        e.clientY <= contentRect.bottom + TRACKING_BUFFER;

      if (isInContentArea) {
        setIsTrackingMouse(true);

        const bannerRect = bannerRef.current.getBoundingClientRect();
        const x = ((e.clientX - bannerRect.left) / bannerRect.width) * 100;
        const y = ((e.clientY - bannerRect.top) / bannerRect.height) * 100;

        const clampedX = Math.max(-300, Math.min(400, x));
        const clampedY = Math.max(-300, Math.min(400, y));
        targetPosRef.current = { x: clampedX, y: clampedY };
      } else {
        setIsTrackingMouse(false);
      }
    };

    window.addEventListener('mousemove', handleWindowMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
    };
  }, [animationsReady]);

  return { smoothPos };
}
