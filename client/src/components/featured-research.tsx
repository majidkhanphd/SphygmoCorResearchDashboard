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
    <section className="py-16 bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-4">Featured Research</h2>
          <p className="text-muted-foreground">Latest breakthrough studies using SphygmoCor technology</p>
        </div>
        
        <div className="bg-card border border-border rounded-2xl p-8 mb-8">
          <div className="flex flex-col lg:flex-row items-start gap-8">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-4">
                {featuredArticle.categories?.map((category: string, index: number) => (
                  <Badge key={index} variant="secondary" data-testid={`category-badge-${index}`}>
                    {category}
                  </Badge>
                ))}
                <span className="text-sm text-muted-foreground" data-testid="publication-date">
                  {new Date(featuredArticle.publicationDate).toLocaleDateString()}
                </span>
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-4" data-testid="featured-title">
                {featuredArticle.title}
              </h3>
              <p className="text-muted-foreground mb-6" data-testid="featured-abstract">
                {featuredArticle.abstract?.substring(0, 300)}...
              </p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground" data-testid="featured-authors">
                    {featuredArticle.authors}
                  </p>
                  <p className="text-sm text-muted-foreground" data-testid="featured-journal">
                    {featuredArticle.journal}
                  </p>
                </div>
                <Button 
                  variant="default"
                  onClick={() => window.open(featuredArticle.pubmedUrl || featuredArticle.doi, '_blank')}
                  data-testid="read-paper-button"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Read Paper
                </Button>
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
