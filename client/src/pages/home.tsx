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
  
  // Get authoritative filter counts from the backend (same across all pages)
  const backendFilterCounts = data?.pages[0]?.filterCounts || {
    researchAreas: {},
    venues: {},
    years: {},
    categories: {}
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
          <span className="text-sm font-normal tracking-widest uppercase" style={{ color: '#6E6E73' }}>MACHINE LEARNING</span>
        </nav>
        
        {/* Main title - Apple's exact typography */}
        <h1 className="font-semibold leading-tight tracking-tight" style={{ fontSize: '80px', color: '#1D1D1F', marginBottom: '32px', lineHeight: '1.05' }} data-testid="main-title">
          Research
        </h1>
        
        {/* Hero description - Apple's exact content and styling */}
        <div className="max-w-4xl" style={{ marginBottom: '56px' }} data-testid="hero-description">
          <p className="leading-relaxed" style={{ fontSize: '22px', color: '#1D1D1F', marginBottom: '24px', lineHeight: '1.4' }}>
            We believe machine learning is a transformative technology that will shape the future of computing and improve lives around the world. Our Research and Engineering teams work together to advance the state of the art and move breakthrough technologies into Apple products used by millions of people.
          </p>
          <p className="leading-relaxed" style={{ fontSize: '22px', color: '#6E6E73', lineHeight: '1.4' }}>
            Our publications span machine learning and AI, computer vision, natural language processing, and more.
          </p>
        </div>
        
        {/* Search bar - Apple style */}
        <form onSubmit={handleSearch} style={{ marginBottom: '48px' }}>
          <div className="relative max-w-2xl" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif' }}>
            <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none" style={{ paddingLeft: '16px' }}>
              <Search className="h-5 w-5" style={{ color: '#6E6E73' }} />
            </div>
            <input
              type="text"
              placeholder="Search publications"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="w-full rounded-xl transition-all duration-200 ease-in-out"
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
                e.target.style.boxShadow = '0 0 0 3px rgba(0, 122, 255, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.backgroundColor = '#F6F6F6';
                e.target.style.borderColor = '#E5E5E7';
                e.target.style.boxShadow = 'none';
              }}
              data-testid="search-input"
            />
            {inputValue && (
              <button
                type="button"
                onClick={handleReset}
                className="absolute inset-y-0 right-0 flex items-center transition-colors duration-200"
                style={{ paddingRight: '16px' }}
                data-testid="reset-button"
              >
                <X 
                  className="h-5 w-5" 
                  style={{ color: '#6E6E73' }}
                  onMouseEnter={(e) => (e.target as HTMLElement).style.color = '#1D1D1F'}
                  onMouseLeave={(e) => (e.target as HTMLElement).style.color = '#6E6E73'}
                />
              </button>
            )}
          </div>
        </form>
        
        {/* Main content with sidebar and publications */}
        <div className="flex gap-16">
          {/* Left sidebar - Apple ML Research Style */}
          <div className="w-64 flex-shrink-0" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif' }}>
            {/* Research Areas Filter */}
            <div className="mb-10">
              {/* Uppercase caption */}
              <div className="mb-3">
                <span className="text-xs font-medium tracking-wider uppercase" style={{ color: '#6E6E73' }}>RESEARCH AREAS</span>
              </div>
              
              {/* Italic category label */}
              <h3 className="text-base font-medium italic mb-4" style={{ color: '#1D1D1F' }}>Research areas</h3>
              
              {/* Clear button */}
              {selectedResearchArea && (
                <button
                  onClick={() => handleResearchAreaChange(null)}
                  className="text-sm mb-3 transition-colors"
                  style={{ color: '#007AFF' }}
                  data-testid="clear-research-areas"
                >
                  Clear all
                </button>
              )}
              
              <div className="space-y-1">
                <button
                  onClick={() => handleResearchAreaChange(null)}
                  className={`block text-sm w-full text-left py-1 transition-colors ${
                    !selectedResearchArea 
                      ? "font-medium" 
                      : "hover:opacity-80"
                  }`}
                  style={{ color: !selectedResearchArea ? '#1D1D1F' : '#6E6E73' }}
                  data-testid="area-all"
                >
                  All
                </button>
                {visibleAreas.map(([slug, displayName]) => {
                  const count = filterCounts.areas[slug] || 0;
                  return (
                    <button
                      key={slug}
                      onClick={() => handleResearchAreaChange(slug)}
                      className={`block text-sm w-full text-left py-1 transition-colors ${
                        selectedResearchArea === slug
                          ? "font-medium"
                          : "hover:opacity-80"
                      }`}
                      style={{ color: selectedResearchArea === slug ? '#1D1D1F' : '#6E6E73' }}
                      data-testid={`area-${slug}`}
                    >
                      {displayName} {count > 0 && `(${count})`}
                    </button>
                  );
                })}
                {researchAreas.length > 5 && (
                  <button
                    onClick={() => setShowAllAreas(!showAllAreas)}
                    className="flex items-center text-sm py-1 transition-colors"
                    style={{ color: '#007AFF' }}
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
            
            {/* Thin separator */}
            <div className="h-px mb-10" style={{ backgroundColor: '#E5E5E7' }}></div>
            
            {/* Venues Filter */}
            <div className="mb-10">
              {/* Uppercase caption */}
              <div className="mb-3">
                <span className="text-xs font-medium tracking-wider uppercase" style={{ color: '#6E6E73' }}>VENUES</span>
              </div>
              
              {/* Italic category label */}
              <h3 className="text-base font-medium italic mb-4" style={{ color: '#1D1D1F' }}>Venues</h3>
              
              {/* Clear button */}
              {selectedVenue && (
                <button
                  onClick={() => handleVenueChange(null)}
                  className="text-sm mb-3 transition-colors"
                  style={{ color: '#007AFF' }}
                  data-testid="clear-venues"
                >
                  Clear all
                </button>
              )}
              
              <div className="space-y-1">
                <button
                  onClick={() => handleVenueChange(null)}
                  className={`block text-sm w-full text-left py-1 transition-colors ${
                    !selectedVenue
                      ? "font-medium"
                      : "hover:opacity-80"
                  }`}
                  style={{ color: !selectedVenue ? '#1D1D1F' : '#6E6E73' }}
                  data-testid="venue-all"
                >
                  All venues
                </button>
                {visibleVenues.map((venue) => {
                  const count = filterCounts.venues[venue] || 0;
                  return (
                    <button
                      key={venue}
                      onClick={() => handleVenueChange(venue)}
                      className={`block text-sm w-full text-left py-1 transition-colors ${
                        selectedVenue === venue
                          ? "font-medium"
                          : "hover:opacity-80"
                      }`}
                      style={{ color: selectedVenue === venue ? '#1D1D1F' : '#6E6E73' }}
                      data-testid={`venue-${venue.replace(/\s+/g, '-').toLowerCase()}`}
                    >
                      {venue} {count > 0 && `(${count})`}
                    </button>
                  );
                })}
                {venues.length > 5 && (
                  <button
                    onClick={() => setShowAllVenues(!showAllVenues)}
                    className="flex items-center text-sm py-1 transition-colors"
                    style={{ color: '#007AFF' }}
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
            
            {/* Thin separator */}
            <div className="h-px mb-10" style={{ backgroundColor: '#E5E5E7' }}></div>
            
            {/* Published Year Filter */}
            <div className="mb-10">
              {/* Uppercase caption */}
              <div className="mb-3">
                <span className="text-xs font-medium tracking-wider uppercase" style={{ color: '#6E6E73' }}>YEARS</span>
              </div>
              
              {/* Italic category label */}
              <h3 className="text-base font-medium italic mb-4" style={{ color: '#1D1D1F' }}>Years</h3>
              
              {/* Clear button */}
              {selectedYear && (
                <button
                  onClick={() => handleYearChange(null)}
                  className="text-sm mb-3 transition-colors"
                  style={{ color: '#007AFF' }}
                  data-testid="clear-years"
                >
                  Clear all
                </button>
              )}
              
              <div className="space-y-1">
                <button
                  onClick={() => handleYearChange(null)}
                  className={`block text-sm w-full text-left py-1 transition-colors ${
                    !selectedYear
                      ? "font-medium"
                      : "hover:opacity-80"
                  }`}
                  style={{ color: !selectedYear ? '#1D1D1F' : '#6E6E73' }}
                  data-testid="year-all"
                >
                  All years
                </button>
                {availableYears.map((year) => {
                  const count = filterCounts.years[year] || 0;
                  return (
                    <button
                      key={year}
                      onClick={() => handleYearChange(year)}
                      className={`block text-sm w-full text-left py-1 transition-colors ${
                        selectedYear === year
                          ? "font-medium"
                          : "hover:opacity-80"
                      }`}
                      style={{ color: selectedYear === year ? '#1D1D1F' : '#6E6E73' }}
                      data-testid={`year-${year}`}
                    >
                      {year} {count > 0 && `(${count})`}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          
          {/* Main content area - Apple typography */}
          <div className="flex-1" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif' }}>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                {allPublications?.map((publication: Publication) => {
                  const publicationYear = new Date(publication.publicationDate).getFullYear();
                  const displayArea = getResearchAreaDisplayName(publication.researchArea);
                  
                  return (
                    <article key={publication.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} data-testid={`publication-${publication.id}`}>
                      {/* Title - Apple typography */}
                      <h2 style={{ fontSize: '20px', fontWeight: '500', lineHeight: '1.25', color: '#1D1D1F', marginBottom: '4px' }}>
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
                      </h2>
                      
                      {/* Research area tags - Apple style */}
                      {displayArea && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '4px' }}>
                          <button
                            onClick={() => handleResearchAreaChange(publication.researchArea)}
                            className="inline-flex items-center rounded-full cursor-pointer transition-colors duration-200"
                            style={{
                              paddingLeft: '12px',
                              paddingRight: '12px',
                              paddingTop: '4px',
                              paddingBottom: '4px',
                              fontSize: '12px',
                              fontWeight: '400',
                              color: '#007AFF',
                              backgroundColor: '#F0F7FF',
                              border: '1px solid #007AFF20',
                              outline: 'none'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#E0F0FF';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#F0F7FF';
                            }}
                            data-testid="research-area-tag"
                          >
                            {displayArea}
                          </button>
                        </div>
                      )}
                      
                      {/* Venue and year - Apple secondary text */}
                      <p style={{ fontSize: '14px', fontWeight: '400', lineHeight: '1.4', color: '#6E6E73', marginBottom: '2px' }} data-testid="publication-venue">
                        {publication.journal}, {publicationYear}
                      </p>
                      
                      {/* Authors - Apple secondary text */}
                      <p style={{ fontSize: '14px', fontWeight: '400', lineHeight: '1.4', color: '#6E6E73' }} data-testid="publication-authors">
                        {publication.authors}
                      </p>
                    </article>
                  );
                })}
                
                {/* Load more button - Apple style */}
                {hasNextPage && (
                  <div style={{ paddingTop: '32px' }}>
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
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}