import Navigation from "@/components/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Updates() {
  const updates = [
    {
      id: 1,
      title: "New AI-Powered Analysis Tools",
      description: "Machine learning algorithms for automated pulse wave analysis",
      date: "September 2025",
      type: "Technology",
      status: "Released"
    },
    {
      id: 2,
      title: "Global Cardiovascular Database",
      description: "Expanded dataset with 100,000+ patient records for research",
      date: "August 2025",
      type: "Data",
      status: "Updated"
    },
    {
      id: 3,
      title: "Mobile Health Integration",
      description: "Real-time monitoring capabilities for continuous assessment",
      date: "July 2025",
      type: "Platform",
      status: "Beta"
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Released": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "Updated": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "Beta": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-light tracking-tight text-foreground mb-4">
            Research Updates
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Stay informed about the latest developments, platform updates, and research milestones.
          </p>
        </div>

        <div className="space-y-6">
          {updates.map((update) => (
            <Card key={update.id} className="border-0 shadow-sm" data-testid={`update-${update.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg font-medium mb-2">
                      {update.title}
                    </CardTitle>
                    <CardDescription className="text-base">
                      {update.description}
                    </CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge className={getStatusColor(update.status)}>
                      {update.status}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {update.date}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {update.type}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <section className="mt-20 text-center">
          <h2 className="text-2xl font-light text-foreground mb-8">Development Roadmap</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-medium">Q4 2025</CardTitle>
                <CardDescription>Enhanced Analytics</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• Advanced signal processing</li>
                  <li>• Real-time reporting</li>
                  <li>• API improvements</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-medium">Q1 2026</CardTitle>
                <CardDescription>Platform Expansion</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• Multi-center studies</li>
                  <li>• Cloud infrastructure</li>
                  <li>• Mobile applications</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-medium">Q2 2026</CardTitle>
                <CardDescription>AI Integration</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• Predictive modeling</li>
                  <li>• Automated diagnosis</li>
                  <li>• Decision support</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}