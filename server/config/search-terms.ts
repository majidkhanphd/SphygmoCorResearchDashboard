// Configurable PubMed search terms for SphygmoCor research
// Update these terms as needed to refine publication searches

export const PUBMED_SEARCH_TERMS = [
  // Search all fields (matches PMC website default search behavior)
  'sphygmocor',
];

// PMC-specific search terms (for PMC database queries)
export const PMC_SEARCH_TERMS = [
  // Search all fields without restriction to match website results
  'sphygmocor',
];

// Maximum results per search term - set high to get all 2900+ articles
export const MAX_RESULTS_PER_TERM = 5000;
