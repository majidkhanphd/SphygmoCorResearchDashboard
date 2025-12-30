// Configurable PubMed search terms for SphygmoCor research
// Update these terms as needed to refine publication searches

export const PUBMED_SEARCH_TERMS = [
  // Both exact match and wildcard for comprehensive coverage
  // Exact match (how PMC web search does it)
  '"sphygmocor"[body]',
  // Wildcard for variations (sphygmocor, sphygmocors, etc.)
  'sphygmocor*[body]',
];

// Maximum results per search term - set high to get all 2900+ articles
export const MAX_RESULTS_PER_TERM = 5000;
