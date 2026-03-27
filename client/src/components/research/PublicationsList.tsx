import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, ExternalLink, Star } from "lucide-react";
import type { Publication } from "@shared/schema";
import { normalizeCategoryToSlug } from "@shared/schema";
import { sanitizeText } from "@shared/sanitize";
import { formatAbstract } from "@/lib/format-abstract";
import { CATEGORY_COLORS, getBadgeDisplayName } from "./research-constants";

interface PublicationsListProps {
  publications: Publication[];
  expandedPublicationIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onCollapseAbstract: (id: string) => void;
}

function PublicationItem({
  publication,
  index,
  isExpanded,
  onToggleExpand,
  onCollapseAbstract,
}: {
  publication: Publication;
  index: number;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onCollapseAbstract: (id: string) => void;
}) {
  const publicationYear = new Date(publication.publicationDate).getFullYear();
  const formattedAuthors = sanitizeText(publication.authors);

  return (
    <motion.div
      key={publication.id}
      data-testid={`publication-${publication.id}`}
      className="min-w-0 py-4 sm:py-5 md:py-6 research-publication-item"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{
        duration: 0.2,
        delay: Math.min(index * 0.02, 0.2),
        ease: "easeOut"
      }}
    >
      <div className="min-w-0 break-words research-publication-content">
        {publication.categories && publication.categories.length > 0 && (
          <div className="research-category-badges">
            {publication.categories.map((category: string, catIndex: number) => {
              const categorySlug = normalizeCategoryToSlug(category) || category;
              const colors = CATEGORY_COLORS[categorySlug] || { text: '#6E6E73' };
              const displayName = getBadgeDisplayName(category);
              return (
                <span key={categorySlug} style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <span
                    className="research-category-badge-text"
                    style={{ color: colors.text }}
                    data-testid={`category-badge-${categorySlug}`}
                  >
                    {displayName}
                  </span>
                  {catIndex < (publication.categories?.length || 0) - 1 && (
                    <span className="research-category-separator">—</span>
                  )}
                </span>
              );
            })}
          </div>
        )}

        <h3 className="text-lg sm:text-xl font-semibold mb-2 research-publication-title">
          <button
            onClick={(e) => {
              e.preventDefault();
              if (isExpanded) {
                const url = publication.pubmedUrl || (publication.doi ? `https://doi.org/${publication.doi}` : null);
                if (url) {
                  window.open(url, '_blank', 'noopener,noreferrer');
                }
              } else {
                onToggleExpand(publication.id);
              }
            }}
            className="text-left transition-colors duration-200 research-publication-link cursor-pointer hover:text-[#AF87FF] inline-flex items-start gap-2"
            data-testid="publication-title-link"
          >
            <span className="flex-shrink-0 mt-1">
              {isExpanded ? (
                <ExternalLink className="h-4 w-4 text-[#AF87FF]" />
              ) : (
                <ChevronDown className="h-4 w-4 text-[#6E6E73]" />
              )}
            </span>
            <span>{sanitizeText(publication.title)}</span>
          </button>
        </h3>

        <div className="research-citation-metadata">
          <span data-testid="publication-venue">
            <em>{sanitizeText(publication.journal)}</em>, {publicationYear}
          </span>

          {publication.doi && (
            <a
              href={`https://doi.org/${publication.doi}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 rounded transition-colors duration-200 research-doi-badge"
              data-testid="doi-badge"
            >
              DOI
              <ExternalLink className="h-3 w-3" />
            </a>
          )}

          {publication.citationCount !== null && publication.citationCount > 0 && (
            <span
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
              style={{ backgroundColor: '#F5F5F7', color: '#1D1D1F' }}
              data-testid="citation-count"
            >
              Citations: {publication.citationCount.toLocaleString()}
            </span>
          )}

          {publication.isFeatured === 1 && (
            <span
              className="inline-flex items-center gap-1 px-2 py-1 rounded research-featured-badge"
              data-testid="featured-badge"
            >
              <Star className="h-3 w-3" fill="#FFD60A" stroke="#FFD60A" />
              Featured
            </span>
          )}
        </div>

        <div className="research-authors" data-testid="publication-authors">
          {formattedAuthors}
        </div>

        <AnimatePresence>
          {isExpanded && publication.abstract && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="overflow-hidden"
            >
              <div
                className="mb-3 pt-2"
                style={{
                  fontSize: '12px',
                  color: '#6E6E73',
                  lineHeight: '1.6',
                }}
                data-testid={`abstract-${publication.id}`}
              >
                {formatAbstract(publication.abstract)}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCollapseAbstract(publication.id);
                }}
                className="mt-3 text-sm text-[#AF87FF] hover:text-[#9B6FFF] transition-colors flex items-center gap-1"
                data-testid={`collapse-abstract-${publication.id}`}
              >
                <ChevronUp className="h-4 w-4" />
                Collapse abstract
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export function PublicationsList({
  publications,
  expandedPublicationIds,
  onToggleExpand,
  onCollapseAbstract,
}: PublicationsListProps) {
  return (
    <div
      className="min-w-0 research-publications-list"
      data-testid="publications-list"
    >
      <AnimatePresence>
        {publications.map((publication: Publication, index) => (
          <PublicationItem
            key={publication.id}
            publication={publication}
            index={index}
            isExpanded={expandedPublicationIds.has(publication.id)}
            onToggleExpand={onToggleExpand}
            onCollapseAbstract={onCollapseAbstract}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
