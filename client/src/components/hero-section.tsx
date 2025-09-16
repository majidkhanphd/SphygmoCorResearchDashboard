import { useState } from "react";
import { Download, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { searchPubMed } from "@/services/pubmed";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function HeroSection() {
  const [isImporting, setIsImporting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const pubmedImportMutation = useMutation({
    mutationFn: () => searchPubMed("SphygmoCor cardiovascular", 50),
    onSuccess: (data) => {
      toast({
        title: "Import Successful",
        description: data.message,
      });
      // Invalidate publications cache to refresh the data
      queryClient.invalidateQueries({ queryKey: ["/api/publications"] });
    },
    onError: (error) => {
      toast({
        title: "Import Failed",
        description: "Failed to import publications from PubMed. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handlePubMedImport = async () => {
    setIsImporting(true);
    pubmedImportMutation.mutate();
    setIsImporting(false);
  };

  return (
    <section className="bg-gradient-to-br from-primary/5 to-secondary/5 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6">
            SphygmoCor Research
            <span className="text-primary"> Publications</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            Explore over 2,400 peer-reviewed publications featuring SphygmoCor technology 
            from leading researchers worldwide advancing cardiovascular science.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={handlePubMedImport}
              disabled={isImporting || pubmedImportMutation.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              data-testid="pubmed-import-button"
            >
              <Download className="mr-2 h-4 w-4" />
              {isImporting || pubmedImportMutation.isPending ? "Importing..." : "PubMed Integration"}
            </Button>
            <Button 
              variant="outline"
              data-testid="analytics-button"
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              View Analytics
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
