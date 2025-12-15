import type { Publication } from "@shared/schema";

interface PublicationCardProps {
  publication: Publication;
}

export default function PublicationCard({ publication }: PublicationCardProps) {
  const handleViewPaper = () => {
    const url = publication.pubmedUrl || publication.doi;
    if (url) {
      window.open(url, '_blank');
    }
  };

  const formatYear = (date: Date | string) => {
    return new Date(date).getFullYear();
  };

  // Create metadata line: Research Area • Journal • Year
  const metadata = [
    publication.categories && publication.categories[0],
    publication.journal,
    formatYear(publication.publicationDate)
  ].filter(Boolean).join(' • ');

  return (
    <article 
      className="publication-card bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 apple-fade-in group" 
      data-testid={`publication-card-${publication.id}`}
      role="article"
      aria-labelledby={`title-${publication.id}`}
      tabIndex={0}
    >
      {/* Title */}
      <h3 
        id={`title-${publication.id}`}
        className="text-lg font-semibold text-gray-900 dark:text-white mb-4 leading-tight group-hover:text-[#AF87FF] dark:group-hover:text-[#AF87FF] apple-transition" 
        data-testid="publication-title"
      >
        {publication.title}
      </h3>
      
      {/* Abstract */}
      <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-6 line-clamp-3" data-testid="publication-abstract">
        {publication.abstract || "No abstract available."}
      </p>
      
      {/* Metadata */}
      <div className="space-y-3">
        <p className="text-xs text-gray-500 dark:text-gray-500 font-medium uppercase tracking-wide" data-testid="publication-metadata">
          {metadata}
        </p>
        
        {/* Authors */}
        <p className="text-sm text-gray-700 dark:text-gray-300 truncate" data-testid="publication-authors" aria-label={`Authors: ${publication.authors}`}>
          {publication.authors}
        </p>
        
        {/* Citation count */}
        {publication.citationCount && publication.citationCount > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-500" data-testid="citation-count" aria-label={`${publication.citationCount} citations`}>
            {publication.citationCount} citations
          </p>
        )}
        
        {/* Read paper link */}
        {(publication.pubmedUrl || publication.doi) && (
          <button 
            onClick={handleViewPaper}
            className="text-[#AF87FF] dark:text-[#AF87FF] text-sm font-medium hover:opacity-80 apple-transition mt-4 inline-flex items-center group/link apple-focus-ring"
            data-testid="view-button"
            aria-label={`Read paper: ${publication.title}`}
          >
            Read paper
            <svg 
              className="ml-1 h-3 w-3 apple-transition group-hover/link:translate-x-0.5" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </button>
        )}
      </div>
    </article>
  );
}