import Navigation from "@/components/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function About() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-light tracking-tight text-foreground mb-4">
            About CardiEx Research
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Advancing cardiovascular health through innovative research and cutting-edge technology.
          </p>
        </div>

        <section className="mb-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-2xl font-light text-foreground mb-6">Our Mission</h2>
              <p className="text-muted-foreground mb-6">
                CardiEx Research is dedicated to transforming cardiovascular medicine through advanced 
                research and innovative diagnostic technologies. We focus on early detection, prevention, 
                and personalized treatment approaches that improve patient outcomes globally.
              </p>
              <p className="text-muted-foreground">
                Our work with SphygmoCor technology enables precise measurement of arterial stiffness 
                and central blood pressure, providing insights that traditional methods cannot achieve.
              </p>
            </div>
            <div className="bg-muted/30 rounded-2xl p-8 text-center">
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <div className="text-3xl font-light text-foreground mb-2" data-testid="research-years">15+</div>
                  <div className="text-sm text-muted-foreground">Years of Research</div>
                </div>
                <div>
                  <div className="text-3xl font-light text-foreground mb-2" data-testid="publications-count">200+</div>
                  <div className="text-sm text-muted-foreground">Publications</div>
                </div>
                <div>
                  <div className="text-3xl font-light text-foreground mb-2" data-testid="patients-studied">50K+</div>
                  <div className="text-sm text-muted-foreground">Patients Studied</div>
                </div>
                <div>
                  <div className="text-3xl font-light text-foreground mb-2" data-testid="global-partners">25+</div>
                  <div className="text-sm text-muted-foreground">Global Partners</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-20">
          <h2 className="text-2xl font-light text-foreground mb-8 text-center">Research Areas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-medium">Early Vascular Aging</CardTitle>
                <CardDescription>
                  Understanding premature arterial stiffening and its cardiovascular implications
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-medium">Heart Failure</CardTitle>
                <CardDescription>
                  Novel diagnostic approaches and therapeutic targets for heart failure prevention
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-medium">Hypertension</CardTitle>
                <CardDescription>
                  Advanced blood pressure monitoring and personalized treatment strategies
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-medium">Metabolic Health</CardTitle>
                <CardDescription>
                  Investigating the intersection of metabolism and cardiovascular disease
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-medium">Digital Health</CardTitle>
                <CardDescription>
                  Technology-enabled monitoring and intervention for cardiovascular wellness
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-medium">Population Studies</CardTitle>
                <CardDescription>
                  Large-scale epidemiological research for public health insights
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-light text-foreground mb-8 text-center">Technology Platform</h2>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-lg font-medium text-foreground mb-4">SphygmoCor Technology</h3>
                  <p className="text-muted-foreground mb-4">
                    Our research platform leverages the gold standard in non-invasive cardiovascular 
                    assessment technology, providing unparalleled insights into arterial function 
                    and cardiovascular risk.
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li>• Pulse wave velocity measurement</li>
                    <li>• Central blood pressure analysis</li>
                    <li>• Arterial stiffness assessment</li>
                    <li>• Augmentation index calculation</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-foreground mb-4">Research Infrastructure</h3>
                  <p className="text-muted-foreground mb-4">
                    State-of-the-art data management and analysis capabilities enable comprehensive 
                    studies and accelerate discovery of new cardiovascular biomarkers.
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li>• Cloud-based data platform</li>
                    <li>• Machine learning analytics</li>
                    <li>• Real-time monitoring systems</li>
                    <li>• Global research network</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}