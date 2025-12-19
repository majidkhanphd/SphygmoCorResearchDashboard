import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { useCallback, useEffect, useState, forwardRef } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { getFeaturedPublications } from "@/services/pubmed";
import type { Publication } from "@shared/schema";
import { getResearchAreaDisplayName } from "@shared/schema";
import { sanitizeText } from "@shared/sanitize";

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

const ABSTRACT_SECTION_HEADERS = [
  'Background',
  'Objective',
  'Objectives', 
  'Study Objective',
  'Study Objectives',
  'Aim',
  'Aims',
  'Purpose',
  'Introduction',
  'Methods',
  'Method',
  'Materials and Methods',
  'Study Design',
  'Design',
  'Patients',
  'Participants',
  'Subjects',
  'Setting',
  'Measurements',
  'Interventions',
  'Results',
  'Findings',
  'Outcomes',
  'Main Results',
  'Key Results',
  'Conclusions',
  'Conclusion',
  'Discussion',
  'Interpretation',
  'Clinical Implications',
  'Significance',
  'Trial Registration',
];

interface ParsedSection {
  header: string;
  content: string;
  position: number;
}

const formatAbstract = (abstract: string): JSX.Element[] => {
  const sanitized = sanitizeText(abstract);
  
  if (!sanitized || sanitized.trim().length === 0) {
    return [<span key="empty">No abstract available.</span>];
  }
  
  const foundSections: ParsedSection[] = [];
  
  for (const header of ABSTRACT_SECTION_HEADERS) {
    const escapedHeader = header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const boundaryPattern = new RegExp(
      `(?:^|[.!?]\\s+|\\n\\s*)${escapedHeader}\\s*[:–\\-]\\s*`,
      'gi'
    );
    
    let match;
    while ((match = boundaryPattern.exec(sanitized)) !== null) {
      const headerStart = match.index;
      const headerMatch = match[0];
      const contentStart = headerStart + headerMatch.length;
      
      const existsAtPosition = foundSections.some(
        s => Math.abs(s.position - headerStart) < 5
      );
      
      if (!existsAtPosition) {
        foundSections.push({
          header: header,
          content: '',
          position: contentStart,
        });
      }
    }
  }
  
  if (foundSections.length < 2) {
    return [<span key="unstructured">{sanitized}</span>];
  }
  
  foundSections.sort((a, b) => a.position - b.position);
  
  for (let i = 0; i < foundSections.length; i++) {
    const startPos = foundSections[i].position;
    const endPos = i < foundSections.length - 1 
      ? sanitized.lastIndexOf(foundSections[i + 1].header, foundSections[i + 1].position)
      : sanitized.length;
    
    let content = sanitized.substring(startPos, endPos).trim();
    
    content = content.replace(/[.!?]\s*$/, '').trim();
    if (content) content += '.';
    
    foundSections[i].content = content;
  }
  
  const firstSectionStart = foundSections.length > 0 
    ? sanitized.indexOf(foundSections[0].header)
    : sanitized.length;
  const preamble = sanitized.substring(0, firstSectionStart).trim();
  
  const elements: JSX.Element[] = [];
  
  if (preamble && preamble.length > 20) {
    elements.push(
      <span key="preamble" className="block mb-3">
        {preamble}
      </span>
    );
  }
  
  foundSections.forEach((section, index) => {
    if (section.content.length > 0) {
      elements.push(
        <span key={`section-${index}`} className="block mt-3 first:mt-0">
          <span style={{ fontWeight: '600', color: '#1D1D1F' }}>{section.header}:</span>{' '}
          <span>{section.content}</span>
        </span>
      );
    }
  });
  
  if (elements.length === 0) {
    return [<span key="fallback">{sanitized}</span>];
  }
  
  return elements;
};

const FeaturedCarousel = forwardRef<HTMLElement>(function FeaturedCarousel(_, ref) {
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
  const [areAbstractsExpanded, setAreAbstractsExpanded] = useState(false);

  const toggleExpand = () => {
    setAreAbstractsExpanded(prev => !prev);
  };

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
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Skeleton className="h-10 w-64 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Skeleton className="h-80 w-full rounded-[5px]" />
            <Skeleton className="h-80 w-full rounded-[5px]" />
            <Skeleton className="h-80 w-full rounded-[5px]" />
          </div>
        </div>
      </section>
    );
  }

  if (!featuredPublications || featuredPublications.length === 0) {
    return null;
  }

  return (
    <motion.section 
      ref={ref}
      className="w-full bg-background py-8 sm:py-10" 
      data-testid="featured-carousel-section"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          className="relative text-center mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <h2 
            className="text-2xl sm:text-3xl font-light tracking-tight text-foreground"
            data-testid="featured-heading"
          >
            Featured Research Enabled by SphygmoCor Technology
          </h2>
          
          {featuredPublications.length > 1 && (
            <div className="hidden lg:flex items-center gap-2 absolute top-1/2 right-0 -translate-y-1/2 z-10">
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
        </motion.div>

        <div className="relative">
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex gap-6">
              {featuredPublications.map((publication: Publication, index: number) => (
                <motion.div
                  key={publication.id}
                  className="flex-[0_0_100%] md:flex-[0_0_calc(50%-12px)] lg:flex-[0_0_calc(33.333%-16px)] min-w-0"
                  data-testid={`featured-card-${index}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ 
                    duration: 0.5,
                    delay: index * 0.1,
                    ease: [0.25, 0.46, 0.45, 0.94]
                  }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                >
                  <motion.div 
                    className="rounded-[5px] h-full flex flex-col"
                    style={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E5E5E7',
                      padding: '16px',
                      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                    }}
                    whileHover={{ 
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                      transition: { duration: 0.2 }
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
                      className="mb-2"
                      style={{
                        fontSize: '13px',
                        fontWeight: '600',
                        color: '#1D1D1F',
                        lineHeight: '1.3',
                      }}
                      data-testid={`card-title-${index}`}
                    >
                      {sanitizeText(publication.title)}
                    </h3>

                    <p
                      className="mb-2"
                      style={{
                        fontSize: '11px',
                        fontWeight: '500',
                        color: '#6E6E73',
                      }}
                      data-testid={`card-authors-${index}`}
                    >
                      {sanitizeText(publication.authors || '')}
                    </p>

                    <p
                      className="mb-2"
                      style={{
                        fontSize: '11px',
                        color: '#6E6E73',
                      }}
                      data-testid={`card-journal-${index}`}
                    >
                      {sanitizeText(publication.journal)} • {new Date(publication.publicationDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
                      {publication.doi && (
                        <>
                          {' • '}
                          <a 
                            href={publication.doi} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center hover:underline"
                            style={{ color: '#AF87FF' }}
                            data-testid={`card-doi-link-${index}`}
                          >
                            DOI
                            <ExternalLink className="ml-1 h-3 w-3" />
                          </a>
                        </>
                      )}
                    </p>

                    <AnimatePresence>
                      {areAbstractsExpanded && publication.abstract && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          <div
                            className="mb-3 pt-2"
                            style={{
                              fontSize: '12px',
                              color: '#6E6E73',
                              lineHeight: '1.6',
                            }}
                            data-testid={`card-abstract-${index}`}
                          >
                            {formatAbstract(publication.abstract)}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <button
                      onClick={toggleExpand}
                      className="inline-flex items-center justify-center rounded-lg transition-all duration-200 w-full"
                      style={{
                        padding: '8px',
                        color: '#AF87FF',
                        backgroundColor: 'transparent',
                        border: '1px solid #E5E5E7',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: '500'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#F5F5F7';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      aria-label={areAbstractsExpanded ? "Collapse abstracts" : "Expand abstracts"}
                      data-testid={`toggle-abstract-button-${index}`}
                    >
                      {areAbstractsExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </motion.div>
                </motion.div>
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
    </motion.section>
  );
});

export default FeaturedCarousel;
