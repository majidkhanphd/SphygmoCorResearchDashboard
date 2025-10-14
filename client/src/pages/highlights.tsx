import Navigation from "@/components/navigation";
import FeaturedResearch from "@/components/featured-research";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Highlights() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8" style={{ paddingTop: '64px', paddingBottom: '64px', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif' }}>
        <div className="text-center" style={{ marginBottom: '64px' }}>
          <h1 style={{ fontSize: '48px', fontWeight: '300', letterSpacing: '-0.02em', color: '#1D1D1F', marginBottom: '16px', lineHeight: '1.1' }}>
            Research Highlights
          </h1>
          <p style={{ fontSize: '18px', color: '#6E6E73', maxWidth: '640px', margin: '0 auto', lineHeight: '1.4' }}>
            Breakthrough discoveries and significant findings from our cardiovascular research programs.
          </p>
        </div>

        <FeaturedResearch />

        <section style={{ marginTop: '80px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: '300', color: '#1D1D1F', marginBottom: '32px', textAlign: 'center', lineHeight: '1.2' }}>Recent Breakthroughs</h2>
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