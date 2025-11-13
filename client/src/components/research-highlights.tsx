import FeaturedResearch from "@/components/featured-research";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ResearchHighlights() {
  return (
    <section 
      className="w-full bg-background py-12 sm:py-16"
      data-testid="research-highlights-section"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section heading */}
        <div className="text-center mb-10">
          <h2 
            className="text-4xl sm:text-5xl font-light tracking-tight text-foreground mb-4"
            data-testid="highlights-heading"
          >
            Research Highlights
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Breakthrough discoveries and significant findings from our cardiovascular research programs.
          </p>
        </div>

        {/* Featured Research - reuse existing component */}
        <div className="mb-12">
          <FeaturedResearch />
        </div>

        {/* Recent Breakthroughs */}
        <div>
          <h3 className="text-3xl font-light text-foreground mb-8 text-center">
            Recent Breakthroughs
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-0 shadow-sm hover:shadow-md apple-transition">
              <CardHeader>
                <CardTitle className="text-lg font-medium" data-testid="highlight-early-detection">
                  Early Detection Advances
                </CardTitle>
                <CardDescription data-testid="text-highlight-description-early-detection">
                  Novel biomarkers for cardiovascular risk assessment using SphygmoCor technology
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground" data-testid="text-highlight-content-early-detection">
                  Our latest research has identified new patterns in arterial stiffness that can predict 
                  cardiovascular events up to 10 years before traditional methods.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm hover:shadow-md apple-transition">
              <CardHeader>
                <CardTitle className="text-lg font-medium" data-testid="highlight-precision-medicine">
                  Precision Medicine Protocols
                </CardTitle>
                <CardDescription data-testid="text-highlight-description-precision-medicine">
                  Personalized treatment approaches based on vascular phenotyping
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground" data-testid="text-highlight-content-precision-medicine">
                  Development of individualized risk scores that integrate multiple vascular 
                  parameters for optimized therapeutic interventions.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
