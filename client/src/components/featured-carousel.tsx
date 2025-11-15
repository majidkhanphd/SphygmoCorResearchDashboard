import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getFeaturedPublications } from "@/services/pubmed";
import type { Publication } from "@shared/schema";

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
          
          {featuredPublications.length > 3 && (
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
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      {publication.categories?.slice(0, 2).map((category: string, catIndex: number) => (
                        <span
                          key={catIndex}
                          className="inline-flex items-center rounded-full"
                          style={{
                            paddingLeft: '10px',
                            paddingRight: '10px',
                            paddingTop: '3px',
                            paddingBottom: '3px',
                            fontSize: '11px',
                            fontWeight: '400',
                            color: '#007AFF',
                            backgroundColor: '#F0F7FF',
                            border: '1px solid #007AFF20',
                          }}
                          data-testid={`card-category-${index}-${catIndex}`}
                        >
                          {category}
                        </span>
                      ))}
                    </div>

                    <h3
                      className="line-clamp-3 mb-3"
                      style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        color: '#1D1D1F',
                        lineHeight: '1.3',
                      }}
                      data-testid={`card-title-${index}`}
                    >
                      {publication.title}
                    </h3>

                    <p
                      className="line-clamp-3 mb-4 flex-grow"
                      style={{
                        fontSize: '14px',
                        color: '#6E6E73',
                        lineHeight: '1.5',
                      }}
                      data-testid={`card-abstract-${index}`}
                    >
                      {publication.abstract}
                    </p>

                    <div className="border-t pt-4" style={{ borderColor: '#E5E5E7' }}>
                      <p
                        className="mb-1 truncate"
                        style={{
                          fontSize: '13px',
                          fontWeight: '500',
                          color: '#1D1D1F',
                        }}
                        data-testid={`card-journal-${index}`}
                      >
                        {publication.journal}
                      </p>
                      <p
                        style={{
                          fontSize: '12px',
                          color: '#6E6E73',
                        }}
                        data-testid={`card-date-${index}`}
                      >
                        {new Date(publication.publicationDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>

                    <button
                      onClick={() => window.open(publication.pubmedUrl || publication.doi || '', '_blank')}
                      className="inline-flex items-center justify-center rounded-lg transition-all duration-200 mt-4 w-full"
                      style={{
                        paddingTop: '10px',
                        paddingBottom: '10px',
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#FFFFFF',
                        backgroundColor: '#007AFF',
                        border: 'none',
                        outline: 'none',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#0056CC';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#007AFF';
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
