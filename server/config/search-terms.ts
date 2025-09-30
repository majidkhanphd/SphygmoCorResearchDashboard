// Configurable PubMed search terms for SphygmoCor research
// Update these terms as needed to refine publication searches

export const PUBMED_SEARCH_TERMS = [
  // Main combined query for SphygmoCor-specific publications
  '("sphygmoCor XCEL" OR "sphygmoCor CVMS" OR "Atcor medical" OR cardiex OR "oscar 2")',
  
  // Additional specific device/technology terms can be added here in the future
  // Example: '"SphygmoCor" AND "pulse wave analysis"',
];

// Maximum results per search term (can be adjusted for monthly syncs)
export const MAX_RESULTS_PER_TERM = 100;
