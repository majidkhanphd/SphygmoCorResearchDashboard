import Navigation from "@/components/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function About() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="max-w-[980px] mx-auto px-6" style={{ paddingTop: '64px', paddingBottom: '64px', fontFamily: 'Montserrat, -apple-system, BlinkMacSystemFont, sans-serif' }}>
        <div className="text-center" style={{ marginBottom: '64px' }}>
          <h1 style={{ fontSize: '48px', fontWeight: '300', letterSpacing: '-0.02em', color: '#1D1D1F', marginBottom: '16px', lineHeight: '1.1' }}>
            About CardiEx Research
          </h1>
          <p style={{ fontSize: '18px', color: '#6E6E73', maxWidth: '640px', margin: '0 auto', lineHeight: '1.4' }}>
            Advancing cardiovascular health through innovative research and cutting-edge technology.
          </p>
        </div>

        <section style={{ marginBottom: '80px' }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 style={{ fontSize: '28px', fontWeight: '300', color: '#1D1D1F', marginBottom: '24px', lineHeight: '1.2' }}>Our Mission</h2>
              <p style={{ color: '#6E6E73', marginBottom: '24px', fontSize: '16px', lineHeight: '1.5' }}>
                CardiEx Research is dedicated to transforming cardiovascular medicine through advanced 
                research and innovative diagnostic technologies. We focus on early detection, prevention, 
                and personalized treatment approaches that improve patient outcomes globally.
              </p>
              <p style={{ color: '#6E6E73', fontSize: '16px', lineHeight: '1.5' }}>
                Our work with SphygmoCor technology enables precise measurement of arterial stiffness 
                and central blood pressure, providing insights that traditional methods cannot achieve.
              </p>
            </div>
            <div className="rounded-[5px] text-center" style={{ backgroundColor: '#F6F6F6', padding: '32px' }}>
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <div style={{ fontSize: '32px', fontWeight: '300', color: '#1D1D1F', marginBottom: '8px', lineHeight: '1.2' }} data-testid="research-years">15+</div>
                  <div style={{ fontSize: '14px', color: '#6E6E73' }}>Years of Research</div>
                </div>
                <div>
                  <div style={{ fontSize: '32px', fontWeight: '300', color: '#1D1D1F', marginBottom: '8px', lineHeight: '1.2' }} data-testid="publications-count">200+</div>
                  <div style={{ fontSize: '14px', color: '#6E6E73' }}>Publications</div>
                </div>
                <div>
                  <div style={{ fontSize: '32px', fontWeight: '300', color: '#1D1D1F', marginBottom: '8px', lineHeight: '1.2' }} data-testid="patients-studied">50K+</div>
                  <div style={{ fontSize: '14px', color: '#6E6E73' }}>Patients Studied</div>
                </div>
                <div>
                  <div style={{ fontSize: '32px', fontWeight: '300', color: '#1D1D1F', marginBottom: '8px', lineHeight: '1.2' }} data-testid="global-partners">25+</div>
                  <div style={{ fontSize: '14px', color: '#6E6E73' }}>Global Partners</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section style={{ marginBottom: '80px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: '300', color: '#1D1D1F', marginBottom: '32px', textAlign: 'center', lineHeight: '1.2' }}>Research Areas</h2>
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
          <h2 style={{ fontSize: '28px', fontWeight: '300', color: '#1D1D1F', marginBottom: '32px', textAlign: 'center', lineHeight: '1.2' }}>Technology Platform</h2>
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