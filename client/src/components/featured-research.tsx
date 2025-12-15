import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getFeaturedPublications } from "@/services/pubmed";
import type { Publication } from "@shared/schema";

export default function FeaturedResearch() {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const { data: featuredPublications, isLoading } = useQuery({
    queryKey: ["/api/publications/featured"],
    queryFn: getFeaturedPublications,
  });

  if (isLoading) {
    return (
      <section className="py-16 bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Skeleton className="h-8 w-64 mx-auto mb-4" />
            <Skeleton className="h-4 w-96 mx-auto" />
          </div>
          <Skeleton className="h-64 w-full rounded-[5px]" />
        </div>
      </section>
    );
  }

  const featuredArticle = featuredPublications?.[0];

  if (!featuredArticle) {
    return (
      <section className="py-16 bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">Featured Research</h2>
            <p className="text-muted-foreground">Latest breakthrough studies using SphygmoCor technology</p>
          </div>
          <div className="bg-card border border-border rounded-[5px] p-8">
            <p className="text-center text-muted-foreground">No featured publications available yet.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section style={{ paddingTop: '64px', paddingBottom: '64px', backgroundColor: '#FFFFFF', fontFamily: 'Montserrat, -apple-system, BlinkMacSystemFont, sans-serif' }}>
      <div className="max-w-[980px] mx-auto px-6">
        <div className="text-center" style={{ marginBottom: '48px' }}>
          <h2 style={{ fontSize: '32px', fontWeight: '600', color: '#1D1D1F', marginBottom: '16px', lineHeight: '1.2' }}>Featured Research</h2>
          <p style={{ fontSize: '16px', color: '#6E6E73', lineHeight: '1.4' }}>Latest breakthrough studies using SphygmoCor technology</p>
        </div>
        
        <div className="rounded-[5px]" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E5E7', padding: '32px', marginBottom: '32px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)' }}>
          <div className="flex flex-col lg:flex-row items-start gap-8">
            <div className="flex-1">
              <div className="flex items-center gap-2" style={{ marginBottom: '16px' }}>
                {featuredArticle.categories?.map((category: string, index: number) => (
                  <span key={index} className="inline-flex items-center rounded-full" style={{ paddingLeft: '12px', paddingRight: '12px', paddingTop: '4px', paddingBottom: '4px', fontSize: '12px', fontWeight: '400', color: '#AF87FF', backgroundColor: '#F5F0FF', border: '1px solid #AF87FF20' }} data-testid={`category-badge-${index}`}>
                    {category}
                  </span>
                ))}
                <span style={{ fontSize: '14px', color: '#6E6E73' }} data-testid="publication-date">
                  {new Date(featuredArticle.publicationDate).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <h3 style={{ fontSize: '24px', fontWeight: '600', color: '#1D1D1F', marginBottom: '16px', lineHeight: '1.25', flex: 1 }} data-testid="featured-title">
                  {featuredArticle.title}
                </h3>
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="inline-flex items-center justify-center rounded-lg transition-all duration-200 flex-shrink-0"
                  style={{
                    padding: '8px',
                    color: '#AF87FF',
                    backgroundColor: 'transparent',
                    border: '1px solid #E5E5E7',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#F5F5F7';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  aria-label={isExpanded ? "Collapse abstract" : "Expand abstract"}
                  data-testid="toggle-abstract-button"
                >
                  {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </button>
              </div>
              {isExpanded && featuredArticle.abstract && (
                <p style={{ fontSize: '16px', color: '#6E6E73', marginBottom: '24px', lineHeight: '1.5' }} data-testid="featured-abstract">
                  {featuredArticle.abstract}
                </p>
              )}
              <div>
                <p style={{ fontSize: '14px', fontWeight: '500', color: '#1D1D1F', marginBottom: '4px' }} data-testid="featured-authors">
                  {featuredArticle.authors}
                </p>
                <p style={{ fontSize: '14px', color: '#6E6E73' }} data-testid="featured-journal">
                  {featuredArticle.journal} • {new Date(featuredArticle.publicationDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
                  {featuredArticle.doi && (
                    <>
                      {' • '}
                      <a 
                        href={featuredArticle.doi} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center hover:underline"
                        style={{ color: '#AF87FF' }}
                        data-testid="featured-doi-link"
                      >
                        DOI
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="lg:w-80">
              <img 
                src="https://images.unsplash.com/photo-1559757148-5c350d0d3c56?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600" 
                alt="Scientific cardiovascular research data visualization" 
                className="rounded-[5px] shadow-lg w-full h-auto"
                data-testid="featured-image"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
