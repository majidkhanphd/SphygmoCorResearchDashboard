import { Bookmark, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Publication } from "@shared/schema";

interface PublicationCardProps {
  publication: Publication;
}

const categoryColors: Record<string, string> = {
  "Chronic Kidney Disease (CKD)": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "Chronic Obstructive Pulmonary Disease (COPD)": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  "Early Vascular Aging (EVA)": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  "Heart Failure": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  "Hypertension": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  "Longevity": "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  "Maternal Health": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  "Men's Health": "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  "Metabolic Health": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  "Neuroscience": "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  "Women's Health": "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
};

export default function PublicationCard({ publication }: PublicationCardProps) {
  const handleViewPaper = () => {
    const url = publication.pubmedUrl || publication.doi;
    if (url) {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-all hover:-translate-y-1" data-testid={`publication-card-${publication.id}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex gap-2 flex-wrap">
          {publication.categories?.map((category, index) => (
            <Badge 
              key={index} 
              variant="secondary"
              className={categoryColors[category] || "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"}
              data-testid={`category-${index}`}
            >
              {category}
            </Badge>
          ))}
        </div>
        <span className="text-sm text-muted-foreground whitespace-nowrap" data-testid="publication-date">
          {new Date(publication.publicationDate).toLocaleDateString()}
        </span>
      </div>
      
      <h3 className="text-xl font-semibold text-foreground mb-3 hover:text-primary cursor-pointer" data-testid="publication-title">
        {publication.title}
      </h3>
      
      <p className="text-muted-foreground mb-4 line-clamp-3" data-testid="publication-abstract">
        {publication.abstract || "No abstract available."}
      </p>
      
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground truncate" data-testid="publication-authors">
            {publication.authors}
          </p>
          <p className="text-sm text-muted-foreground truncate" data-testid="publication-journal">
            {publication.journal}
          </p>
          {publication.citationCount && publication.citationCount > 0 && (
            <p className="text-xs text-muted-foreground mt-1" data-testid="citation-count">
              {publication.citationCount} citations
            </p>
          )}
        </div>
        
        <div className="flex gap-2 ml-4">
          <Button 
            variant="outline" 
            size="sm"
            data-testid="save-button"
          >
            <Bookmark className="h-4 w-4 mr-1" />
            Save
          </Button>
          <Button 
            size="sm"
            onClick={handleViewPaper}
            disabled={!publication.pubmedUrl && !publication.doi}
            data-testid="view-button"
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            View
          </Button>
        </div>
      </div>
    </div>
  );
}
