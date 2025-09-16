import Navigation from "@/components/navigation";
import FeaturedResearch from "@/components/featured-research";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Highlights() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-light tracking-tight text-foreground mb-4">
            Research Highlights
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Breakthrough discoveries and significant findings from our cardiovascular research programs.
          </p>
        </div>

        <FeaturedResearch />

        <section className="mt-20">
          <h2 className="text-2xl font-light text-foreground mb-8 text-center">Recent Breakthroughs</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-medium" data-testid="highlight-early-detection">
                  Early Detection Advances
                </CardTitle>
                <CardDescription>
                  Novel biomarkers for cardiovascular risk assessment using SphygmoCor technology
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Our latest research has identified new patterns in arterial stiffness that can predict 
                  cardiovascular events up to 10 years before traditional methods.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-medium" data-testid="highlight-precision-medicine">
                  Precision Medicine Protocols
                </CardTitle>
                <CardDescription>
                  Personalized treatment approaches based on vascular phenotyping
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Development of individualized risk scores that integrate multiple vascular 
                  parameters for optimized therapeutic interventions.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}