import { motion } from "framer-motion";
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from "lucide-react";
import { CollapsibleSection } from "@/components/collapsible-section";
import { getResearchAreaDisplayName, RESEARCH_AREA_DISPLAY_NAMES } from "@shared/schema";
import { isParentJournal } from "@shared/journal-mappings";
import { CATEGORY_COLORS } from "./research-constants";
import type { FilterCounts } from "./research-types";

interface ResearchSidebarProps {
  selectedResearchArea: string | null;
  selectedVenue: string | null;
  selectedYear: number | null;
  showAllAreas: boolean;
  showAllVenues: boolean;
  showAllYears: boolean;
  expandedParentJournals: Set<string>;
  publicationsHeight: number | null;
  filterCounts: FilterCounts;
  backendFilterCounts: {
    categories: Record<string, number>;
    venues: Record<string, number>;
    childJournalCounts: Record<string, Record<string, number>>;
    years: Record<number, number>;
  };
  onResearchAreaChange: (area: string | null) => void;
  onVenueChange: (venue: string | null) => void;
  onYearChange: (year: number | null) => void;
  onToggleShowAllAreas: () => void;
  onToggleShowAllVenues: () => void;
  onToggleShowAllYears: () => void;
  onToggleParentJournal: (parent: string) => void;
  onCollapseSidebar: () => void;
}

export function ResearchSidebar({
  selectedResearchArea,
  selectedVenue,
  selectedYear,
  showAllAreas,
  showAllVenues,
  showAllYears,
  expandedParentJournals,
  publicationsHeight,
  filterCounts,
  backendFilterCounts,
  onResearchAreaChange,
  onVenueChange,
  onYearChange,
  onToggleShowAllAreas,
  onToggleShowAllVenues,
  onToggleShowAllYears,
  onToggleParentJournal,
  onCollapseSidebar,
}: ResearchSidebarProps) {
  const researchAreas = Object.entries(RESEARCH_AREA_DISPLAY_NAMES).sort((a, b) => {
    const countA = filterCounts.areas[a[0]] || 0;
    const countB = filterCounts.areas[b[0]] || 0;
    return countB - countA;
  });
  const initialAreas = researchAreas.slice(0, 5);
  const hiddenAreas = researchAreas.slice(5);

  const currentYear = new Date().getFullYear();
  const availableYears = Array.from(
    { length: currentYear - 2000 + 1 },
    (_, i) => currentYear - i
  );
  const initialYears = availableYears.slice(0, 5);
  const hiddenYears = availableYears.slice(5);

  const totalYearCount = Object.values(filterCounts.years).reduce((sum, count) => sum + (count as number), 0);

  const getParentTotalCount = (journal: string) => {
    return backendFilterCounts.venues[journal] || 0;
  };

  const getSortedChildJournals = (parentJournal: string) => {
    const childCounts = backendFilterCounts.childJournalCounts[parentJournal] || {};
    return Object.entries(childCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  };

  const venues = Object.keys(backendFilterCounts.venues).sort((a, b) => {
    const countA = getParentTotalCount(a);
    const countB = getParentTotalCount(b);
    return countB - countA;
  });
  const initialVenues = venues.slice(0, 10);
  const hiddenVenues = venues.slice(10);

  const renderVenueItem = (venue: string) => {
    const count = filterCounts.venues[venue] || 0;
    const hasChildren = isParentJournal(venue);
    const isExpanded = expandedParentJournals.has(venue);
    const sortedChildren = hasChildren ? getSortedChildJournals(venue) : [];
    const parentTotal = hasChildren ? getParentTotalCount(venue) : count;

    return (
      <div key={venue}>
        <div className="flex items-center">
          {hasChildren && (
            <motion.button
              onClick={(e) => {
                e.stopPropagation();
                onToggleParentJournal(venue);
              }}
              className="flex-shrink-0 mr-1 apple-transition apple-focus-ring research-sidebar-item"
              aria-label={isExpanded ? `Collapse ${venue}` : `Expand ${venue}`}
              data-testid={`toggle-journal-${venue.replace(/\s+/g, '-').toLowerCase()}`}
              animate={{ rotate: isExpanded ? 90 : 0 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
            >
              <ChevronRight className="h-3 w-3" />
            </motion.button>
          )}
          <button
            onClick={() => onVenueChange(venue)}
            className={`block text-sm w-full text-left py-2 sm:py-1 px-1 sm:px-0 apple-transition apple-focus-ring break-words ${
              selectedVenue === venue
                ? "font-medium research-sidebar-item-selected"
                : "hover:opacity-80 research-sidebar-item"
            } ${!hasChildren ? 'ml-4' : ''}`}
            data-testid={`venue-${venue.replace(/\s+/g, '-').toLowerCase()}`}
            aria-pressed={selectedVenue === venue}
            aria-label={`Filter by ${venue}${parentTotal > 0 ? ` (${parentTotal} publications)` : ''}`}
          >
            {venue} {parentTotal > 0 && `(${parentTotal})`}
          </button>
        </div>

        {hasChildren && (
          <CollapsibleSection isExpanded={isExpanded}>
            <div className="space-y-1">
              {sortedChildren.map(({ name: childJournal, count: childCount }) => (
                <button
                  key={childJournal}
                  onClick={() => onVenueChange(childJournal)}
                  className={`block text-sm text-left py-2 sm:py-1 pl-6 sm:pl-8 pr-2 apple-transition apple-focus-ring break-words ${
                    selectedVenue === childJournal
                      ? "font-medium research-sidebar-child-item-selected"
                      : "hover:opacity-80 research-sidebar-child-item"
                  }`}
                  data-testid={`venue-child-${childJournal.replace(/\s+/g, '-').toLowerCase()}`}
                  aria-pressed={selectedVenue === childJournal}
                  aria-label={`Filter by ${childJournal}${childCount > 0 ? ` (${childCount} publications)` : ''}`}
                >
                  {childJournal} {childCount > 0 && <span className="text-[#6e6e73] dark:text-gray-400">({childCount})</span>}
                </button>
              ))}
            </div>
          </CollapsibleSection>
        )}
      </div>
    );
  };

  return (
    <aside className="min-w-0 pr-2 relative research-sidebar" style={{ maxHeight: publicationsHeight ? `${publicationsHeight}px` : 'none' }} role="complementary" aria-label="Research filters">
      <div className="flex justify-end mb-2">
        <button
          onClick={onCollapseSidebar}
          className="p-1.5 rounded hover:bg-gray-100 transition-colors duration-200"
          aria-label="Collapse sidebar"
          data-testid="collapse-sidebar-button"
          title="Collapse sidebar"
        >
          <ChevronLeft className="h-4 w-4 research-collapse-btn-icon" />
        </button>
      </div>

      <section className="mb-10 min-w-0 research-sidebar-section" role="group" aria-labelledby="research-areas-heading">
        <div className="mb-3 min-w-0">
          <span className="text-xs font-medium tracking-wider uppercase break-words research-sidebar-section-header">RESEARCH AREAS</span>
        </div>
        <h3 id="research-areas-heading" className="text-base font-medium italic mb-4 min-w-0 break-words research-sidebar-section-title">Research areas</h3>
        {selectedResearchArea && (
          <button
            onClick={() => onResearchAreaChange(null)}
            className="text-sm mb-3 apple-transition apple-focus-ring break-words research-sidebar-clear-btn"
            data-testid="clear-research-areas"
            aria-label="Clear research area filter"
          >
            Clear all
          </button>
        )}
        <div className="space-y-1 min-w-0">
          <button
            onClick={() => onResearchAreaChange(null)}
            className={`block text-sm w-full text-left py-1 apple-transition apple-focus-ring break-words ${
              !selectedResearchArea
                ? "font-medium research-sidebar-item-selected"
                : "hover:opacity-80 research-sidebar-item"
            }`}
            data-testid="area-all"
            aria-pressed={!selectedResearchArea}
          >
            All
          </button>
          {initialAreas.map(([slug, displayName]) => {
            const count = filterCounts.areas[slug] || 0;
            const categoryColor = CATEGORY_COLORS[slug];
            return (
              <button
                key={slug}
                onClick={() => onResearchAreaChange(slug)}
                className={`flex items-center text-sm w-full text-left py-1 apple-transition apple-focus-ring break-words ${
                  selectedResearchArea === slug
                    ? "font-medium research-sidebar-item-selected"
                    : "hover:opacity-80 research-sidebar-item"
                }`}
                data-testid={`area-${slug}`}
                aria-pressed={selectedResearchArea === slug}
                aria-label={`Filter by ${displayName}${count > 0 ? ` (${count} publications)` : ''}`}
              >
                {categoryColor && (
                  <span className="research-category-dot" style={{ color: categoryColor.text }}>●</span>
                )}
                <span>{displayName} {count > 0 && `(${count})`}</span>
              </button>
            );
          })}
          {hiddenAreas.length > 0 && (
            <>
              <CollapsibleSection isExpanded={showAllAreas}>
                <div className="space-y-1">
                  {hiddenAreas.map(([slug, displayName]) => {
                    const count = filterCounts.areas[slug] || 0;
                    const categoryColor = CATEGORY_COLORS[slug];
                    return (
                      <button
                        key={slug}
                        onClick={() => onResearchAreaChange(slug)}
                        className={`flex items-center text-sm w-full text-left py-1 apple-transition apple-focus-ring break-words ${
                          selectedResearchArea === slug
                            ? "font-medium research-sidebar-item-selected"
                            : "hover:opacity-80 research-sidebar-item"
                        }`}
                        data-testid={`area-${slug}`}
                        aria-pressed={selectedResearchArea === slug}
                        aria-label={`Filter by ${displayName}${count > 0 ? ` (${count} publications)` : ''}`}
                      >
                        {categoryColor && (
                          <span className="research-category-dot" style={{ color: categoryColor.text }}>●</span>
                        )}
                        <span>{displayName} {count > 0 && `(${count})`}</span>
                      </button>
                    );
                  })}
                </div>
              </CollapsibleSection>
              <button
                onClick={onToggleShowAllAreas}
                className="flex items-center text-sm py-1 apple-transition apple-focus-ring research-sidebar-toggle-btn"
                data-testid="toggle-areas"
                aria-expanded={showAllAreas}
                aria-label={showAllAreas ? "Show fewer research areas" : "Show more research areas"}
              >
                {showAllAreas ? (
                  <>Less <ChevronUp className="ml-1 h-4 w-4" /></>
                ) : (
                  <>More <ChevronDown className="ml-1 h-4 w-4" /></>
                )}
              </button>
            </>
          )}
        </div>
      </section>

      <div className="h-px mb-10 research-sidebar-separator"></div>

      <section className="mb-10 min-w-0 research-sidebar-section" role="group" aria-labelledby="years-heading">
        <div className="mb-3 min-w-0">
          <span className="text-xs font-medium tracking-wider uppercase break-words research-sidebar-section-header">YEARS</span>
        </div>
        <h3 id="years-heading" className="text-base font-medium italic mb-4 min-w-0 break-words research-sidebar-section-title">Years</h3>
        {selectedYear && (
          <button
            onClick={() => onYearChange(null)}
            className="text-sm mb-3 apple-transition apple-focus-ring break-words research-sidebar-clear-btn"
            data-testid="clear-years"
            aria-label="Clear year filter"
          >
            Clear all
          </button>
        )}
        <div className="space-y-1 min-w-0">
          <button
            onClick={() => onYearChange(null)}
            className={`block text-sm w-full text-left py-1 apple-transition apple-focus-ring break-words ${
              !selectedYear
                ? "font-medium research-sidebar-item-selected"
                : "hover:opacity-80 research-sidebar-item"
            }`}
            data-testid="year-all"
            aria-pressed={!selectedYear}
          >
            All years {totalYearCount > 0 && `(${totalYearCount})`}
          </button>
          {initialYears.map((year) => {
            const count = filterCounts.years[year] || 0;
            return (
              <button
                key={year}
                onClick={() => onYearChange(year)}
                className={`block text-sm w-full text-left py-1 apple-transition apple-focus-ring break-words ${
                  selectedYear === year
                    ? "font-medium research-sidebar-item-selected"
                    : "hover:opacity-80 research-sidebar-item"
                }`}
                data-testid={`year-${year}`}
                aria-pressed={selectedYear === year}
                aria-label={`Filter by ${year}${count > 0 ? ` (${count} publications)` : ''}`}
              >
                {year} {count > 0 && `(${count})`}
              </button>
            );
          })}
          {hiddenYears.length > 0 && (
            <>
              <CollapsibleSection isExpanded={showAllYears}>
                <div className="space-y-1">
                  {hiddenYears.map((year) => {
                    const count = filterCounts.years[year] || 0;
                    return (
                      <button
                        key={year}
                        onClick={() => onYearChange(year)}
                        className={`block text-sm w-full text-left py-1 apple-transition apple-focus-ring break-words ${
                          selectedYear === year
                            ? "font-medium research-sidebar-item-selected"
                            : "hover:opacity-80 research-sidebar-item"
                        }`}
                        data-testid={`year-${year}`}
                        aria-pressed={selectedYear === year}
                        aria-label={`Filter by ${year}${count > 0 ? ` (${count} publications)` : ''}`}
                      >
                        {year} {count > 0 && `(${count})`}
                      </button>
                    );
                  })}
                </div>
              </CollapsibleSection>
              <button
                onClick={onToggleShowAllYears}
                className="flex items-center text-sm py-1 apple-transition apple-focus-ring research-sidebar-toggle-btn"
                data-testid="toggle-years"
                aria-expanded={showAllYears}
                aria-label={showAllYears ? "Show fewer years" : "Show more years"}
              >
                {showAllYears ? (
                  <>Less <ChevronUp className="ml-1 h-4 w-4" /></>
                ) : (
                  <>More <ChevronDown className="ml-1 h-4 w-4" /></>
                )}
              </button>
            </>
          )}
        </div>
      </section>

      <div className="h-px mb-10 research-sidebar-separator"></div>

      <section className="min-w-0 overflow-y-auto sidebar-scrollbar research-sidebar-journals" role="group" aria-labelledby="venues-heading">
        <div className="mb-3 min-w-0">
          <span className="text-xs font-medium tracking-wider uppercase break-words research-sidebar-section-header">JOURNALS</span>
        </div>
        <h3 id="venues-heading" className="text-base font-medium italic mb-4 min-w-0 break-words research-sidebar-section-title">Journals</h3>
        {selectedVenue && (
          <button
            onClick={() => onVenueChange(null)}
            className="text-sm mb-3 apple-transition apple-focus-ring break-words research-sidebar-clear-btn"
            data-testid="clear-venues"
            aria-label="Clear journal filter"
          >
            Clear all
          </button>
        )}
        <div className="space-y-1 min-w-0 relative research-journals-container">
          <button
            onClick={() => onVenueChange(null)}
            className={`block text-sm w-full text-left py-1 apple-transition apple-focus-ring break-words ${
              !selectedVenue
                ? "font-medium research-sidebar-item-selected"
                : "hover:opacity-80 research-sidebar-item"
            }`}
            data-testid="venue-all"
            aria-pressed={!selectedVenue}
          >
            All Journals
          </button>
          {initialVenues.map(renderVenueItem)}
          {hiddenVenues.length > 0 && (
            <CollapsibleSection isExpanded={showAllVenues}>
              <div className="space-y-1">
                {hiddenVenues.map(renderVenueItem)}
              </div>
            </CollapsibleSection>
          )}
        </div>
        {hiddenVenues.length > 0 && (
          <div className={`research-journals-footer ${showAllVenues ? 'research-journals-footer-expanded' : 'research-journals-footer-collapsed'}`}>
            <button
              onClick={onToggleShowAllVenues}
              className="flex items-center text-sm py-1 apple-transition apple-focus-ring research-sidebar-toggle-btn"
              data-testid="toggle-venues"
              aria-expanded={showAllVenues}
              aria-label={showAllVenues ? "Show fewer journals" : "Show more journals"}
            >
              {showAllVenues ? (
                <>Less <ChevronUp className="ml-1 h-4 w-4" /></>
              ) : (
                <>More <ChevronDown className="ml-1 h-4 w-4" /></>
              )}
            </button>
          </div>
        )}
      </section>
    </aside>
  );
}
