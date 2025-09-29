import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getFeaturedPublications } from "@/services/pubmed";
import type { Publication } from "@shared/schema";

export default function FeaturedResearch() {
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
          <Skeleton className="h-64 w-full rounded-2xl" />
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
          <div className="bg-card border border-border rounded-2xl p-8">
            <p className="text-center text-muted-foreground">No featured publications available yet.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section style={{ paddingTop: '64px', paddingBottom: '64px', backgroundColor: '#FFFFFF', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      <div className="max-w-[980px] mx-auto px-6">
        <div className="text-center" style={{ marginBottom: '48px' }}>
          <h2 style={{ fontSize: '32px', fontWeight: '600', color: '#1D1D1F', marginBottom: '16px', lineHeight: '1.2' }}>Featured Research</h2>
          <p style={{ fontSize: '16px', color: '#6E6E73', lineHeight: '1.4' }}>Latest breakthrough studies using SphygmoCor technology</p>
        </div>
        
        <div className="rounded-xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E5E7', padding: '32px', marginBottom: '32px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)' }}>
          <div className="flex flex-col lg:flex-row items-start gap-8">
            <div className="flex-1">
              <div className="flex items-center gap-2" style={{ marginBottom: '16px' }}>
                {featuredArticle.categories?.map((category: string, index: number) => (
                  <span key={index} className="inline-flex items-center rounded-full" style={{ paddingLeft: '12px', paddingRight: '12px', paddingTop: '4px', paddingBottom: '4px', fontSize: '12px', fontWeight: '400', color: '#007AFF', backgroundColor: '#F0F7FF', border: '1px solid #007AFF20' }} data-testid={`category-badge-${index}`}>
                    {category}
                  </span>
                ))}
                <span style={{ fontSize: '14px', color: '#6E6E73' }} data-testid="publication-date">
                  {new Date(featuredArticle.publicationDate).toLocaleDateString()}
                </span>
              </div>
              <h3 style={{ fontSize: '24px', fontWeight: '600', color: '#1D1D1F', marginBottom: '16px', lineHeight: '1.25' }} data-testid="featured-title">
                {featuredArticle.title}
              </h3>
              <p style={{ fontSize: '16px', color: '#6E6E73', marginBottom: '24px', lineHeight: '1.5' }} data-testid="featured-abstract">
                {featuredArticle.abstract?.substring(0, 300)}...
              </p>
              <div className="flex items-center justify-between">
                <div>
                  <p style={{ fontSize: '14px', fontWeight: '500', color: '#1D1D1F' }} data-testid="featured-authors">
                    {featuredArticle.authors}
                  </p>
                  <p style={{ fontSize: '14px', color: '#6E6E73' }} data-testid="featured-journal">
                    {featuredArticle.journal}
                  </p>
                </div>
                <button
                  onClick={() => window.open(featuredArticle.pubmedUrl || featuredArticle.doi, '_blank')}
                  className="inline-flex items-center justify-center rounded-xl transition-all duration-200"
                  style={{
                    paddingLeft: '20px',
                    paddingRight: '20px',
                    paddingTop: '10px',
                    paddingBottom: '10px',
                    fontSize: '16px',
                    fontWeight: '500',
                    color: '#FFFFFF',
                    backgroundColor: '#007AFF',
                    border: 'none',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#0056CC';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#007AFF';
                  }}
                  data-testid="read-paper-button"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Read Paper
                </button>
              </div>
            </div>
            <div className="lg:w-80">
              <img 
                src="https://images.unsplash.com/photo-1559757148-5c350d0d3c56?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600" 
                alt="Scientific cardiovascular research data visualization" 
                className="rounded-xl shadow-lg w-full h-auto"
                data-testid="featured-image"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
