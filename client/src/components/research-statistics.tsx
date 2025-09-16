import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublicationStats } from "@/services/pubmed";

export default function ResearchStatistics() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["/api/publications/stats"],
    queryFn: getPublicationStats,
  });

  if (isLoading) {
    return (
      <section className="py-16 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Skeleton className="h-8 w-64 mx-auto mb-4" />
            <Skeleton className="h-4 w-96 mx-auto" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="text-center">
                <Skeleton className="h-12 w-20 mx-auto mb-2" />
                <Skeleton className="h-4 w-16 mx-auto" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-4">Research Impact</h2>
          <p className="text-muted-foreground">SphygmoCor technology driving cardiovascular research worldwide</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="text-center">
            <div className="text-4xl font-bold text-primary mb-2" data-testid="stat-publications">
              {stats?.totalPublications?.toLocaleString() || "2,400+"}
            </div>
            <div className="text-muted-foreground">Publications</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-primary mb-2" data-testid="stat-countries">
              {stats?.countriesCount || "150+"}
            </div>
            <div className="text-muted-foreground">Countries</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-primary mb-2" data-testid="stat-institutions">
              {stats?.institutionsCount || "500+"}
            </div>
            <div className="text-muted-foreground">Institutions</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-primary mb-2" data-testid="stat-citations">
              {stats?.totalCitations?.toLocaleString() || "50,000+"}
            </div>
            <div className="text-muted-foreground">Citations</div>
          </div>
        </div>
      </div>
    </section>
  );
}
