import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getFeaturedPublications } from "@/services/pubmed";
import type { Publication } from "@shared/schema";
import { getResearchAreaDisplayName } from "@shared/schema";
import { sanitizeAuthors } from "@/utils/sanitizeAuthors";

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
  if (category === 'ckd') return 'CKD';
  if (category === 'copd') return 'COPD';
  if (category === 'eva') return 'EVA';
  
  const displayName = getResearchAreaDisplayName(category);
  if (!displayName) return category.replace('-', ' ');
  
  return displayName;
};

export default function FeaturedCarousel() {
  const { data: featuredPublications, isLoading } = useQuery({
    queryKey: ["/api/publications/featured"],
    queryFn: getFeaturedPublications,
  });

  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    loop: false,
    skipSnaps: false,
    dragFree: false,
  });

  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  if (isLoading) {
    return (
      <section className="w-full bg-background py-8 sm:py-10" data-testid="featured-carousel-section">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Skeleton className="h-10 w-64 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Skeleton className="h-80 w-full rounded-xl" />
            <Skeleton className="h-80 w-full rounded-xl" />
            <Skeleton className="h-80 w-full rounded-xl" />
          </div>
        </div>
      </section>
    );
  }

  if (!featuredPublications || featuredPublications.length === 0) {
    return null;
  }

  return (
    <section 
      className="w-full bg-background py-8 sm:py-10" 
      data-testid="featured-carousel-section"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <h2 
            className="text-4xl sm:text-5xl font-light tracking-tight text-foreground"
            data-testid="featured-heading"
          >
            Featured Research
          </h2>
          
          {featuredPublications.length > 1 && (
            <div className="hidden lg:flex items-center gap-2">
              <button
                onClick={scrollPrev}
                disabled={!canScrollPrev}
                className="inline-flex items-center justify-center rounded-full w-10 h-10 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: canScrollPrev ? '#F5F5F7' : '#F5F5F7',
                  color: '#1D1D1F',
                  border: '1px solid #E5E5E7',
                }}
                data-testid="carousel-prev-button"
                aria-label="Previous"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={scrollNext}
                disabled={!canScrollNext}
                className="inline-flex items-center justify-center rounded-full w-10 h-10 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: canScrollNext ? '#F5F5F7' : '#F5F5F7',
                  color: '#1D1D1F',
                  border: '1px solid #E5E5E7',
                }}
                data-testid="carousel-next-button"
                aria-label="Next"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>

        <div className="relative">
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex gap-6">
              {featuredPublications.map((publication: Publication, index: number) => (
                <div
                  key={publication.id}
                  className="flex-[0_0_100%] md:flex-[0_0_calc(50%-12px)] lg:flex-[0_0_calc(33.333%-16px)] min-w-0"
                  data-testid={`featured-card-${index}`}
                >
                  <div 
                    className="rounded-xl h-full flex flex-col"
                    style={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E5E5E7',
                      padding: '24px',
                      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                      transition: 'box-shadow 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)';
                    }}
                  >
                    <div className="flex flex-wrap items-center gap-1 mb-3">
                      {publication.categories?.map((category: string, catIndex: number) => {
                        const colors = CATEGORY_COLORS[category] || { text: '#6E6E73' };
                        const displayName = getBadgeDisplayName(category);
                        return (
                          <span key={catIndex} className="inline-flex items-center">
                            <span
                              style={{
                                fontSize: '12px',
                                fontWeight: '500',
                                color: colors.text,
                              }}
                              data-testid={`card-category-${index}-${catIndex}`}
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

                    <h3
                      className="line-clamp-2 mb-2"
                      style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        color: '#1D1D1F',
                        lineHeight: '1.3',
                      }}
                      data-testid={`card-title-${index}`}
                    >
                      {sanitizeAuthors(publication.title)}
                    </h3>

                    <p
                      className="mb-2"
                      style={{
                        fontSize: '13px',
                        fontWeight: '500',
                        color: '#6E6E73',
                      }}
                      data-testid={`card-journal-${index}`}
                    >
                      {sanitizeAuthors(publication.journal)}, {new Date(publication.publicationDate).getFullYear()}
                    </p>

                    <p
                      className="line-clamp-2 mb-3 flex-grow"
                      style={{
                        fontSize: '13px',
                        color: '#6E6E73',
                        lineHeight: '1.5',
                      }}
                      data-testid={`card-authors-${index}`}
                    >
                      {sanitizeAuthors(publication.authors || '')}
                    </p>

                    <button
                      onClick={() => window.open(publication.pubmedUrl || publication.doi || '', '_blank')}
                      className="inline-flex items-center justify-center rounded-lg transition-all duration-200 mt-4 w-full"
                      style={{
                        paddingTop: '10px',
                        paddingBottom: '10px',
                        fontSize: '14px',
                        fontWeight: '400',
                        color: '#007AFF',
                        background: 'linear-gradient(135deg, rgba(0, 122, 255, 0.08) 0%, rgba(0, 122, 255, 0.12) 100%)',
                        border: '1px solid rgba(0, 122, 255, 0.2)',
                        outline: 'none',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0, 122, 255, 0.12) 0%, rgba(0, 122, 255, 0.16) 100%)';
                        e.currentTarget.style.borderColor = 'rgba(0, 122, 255, 0.3)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0, 122, 255, 0.08) 0%, rgba(0, 122, 255, 0.12) 100%)';
                        e.currentTarget.style.borderColor = 'rgba(0, 122, 255, 0.2)';
                      }}
                      data-testid={`card-read-button-${index}`}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Read Paper
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {featuredPublications.length > 1 && (
            <div className="flex lg:hidden items-center justify-center gap-2 mt-6">
              <button
                onClick={scrollPrev}
                disabled={!canScrollPrev}
                className="inline-flex items-center justify-center rounded-full w-10 h-10 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: '#F5F5F7',
                  color: '#1D1D1F',
                  border: '1px solid #E5E5E7',
                }}
                data-testid="carousel-prev-button-mobile"
                aria-label="Previous"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={scrollNext}
                disabled={!canScrollNext}
                className="inline-flex items-center justify-center rounded-full w-10 h-10 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: '#F5F5F7',
                  color: '#1D1D1F',
                  border: '1px solid #E5E5E7',
                }}
                data-testid="carousel-next-button-mobile"
                aria-label="Next"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
