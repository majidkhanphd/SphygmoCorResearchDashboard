export class CitationService {
  private baseUrl = "https://api.openalex.org";

  async getCitationCount(doi: string): Promise<number | null> {
    if (!doi) return null;

    try {
      const cleanDoi = doi.replace(/^https?:\/\/doi\.org\//i, "");
      const url = `${this.baseUrl}/works/doi:${encodeURIComponent(cleanDoi)}`;

      const response = await fetch(url, {
        headers: {
          "User-Agent": "CONNEQT-Health-Research/1.0 (mailto:research@conneqthealth.com)",
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        console.error(`OpenAlex API error: ${response.status}`);
        return null;
      }

      const data = await response.json();
      return data.cited_by_count ?? null;
    } catch (error) {
      console.error(`Error fetching citation count for DOI ${doi}:`, error);
      return null;
    }
  }

  async getCitationCountBatch(dois: string[]): Promise<Map<string, number>> {
    const results = new Map<string, number>();
    if (dois.length === 0) return results;

    const BATCH_SIZE = 50;
    
    for (let i = 0; i < dois.length; i += BATCH_SIZE) {
      const batch = dois.slice(i, i + BATCH_SIZE);
      const cleanDois = batch
        .filter(Boolean)
        .map(doi => doi.replace(/^https?:\/\/doi\.org\//i, ""));

      if (cleanDois.length === 0) continue;

      try {
        const filter = `doi:${cleanDois.join("|")}`;
        const url = `${this.baseUrl}/works?filter=${encodeURIComponent(filter)}&per-page=50&select=doi,cited_by_count`;

        const response = await fetch(url, {
          headers: {
            "User-Agent": "CONNEQT-Health-Research/1.0 (mailto:research@conneqthealth.com)",
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.results) {
            for (const work of data.results) {
              if (work.doi) {
                const normalizedDoi = work.doi.replace(/^https?:\/\/doi\.org\//i, "");
                results.set(normalizedDoi.toLowerCase(), work.cited_by_count ?? 0);
              }
            }
          }
        }

        if (i + BATCH_SIZE < dois.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(`Error fetching batch citation counts:`, error);
      }
    }

    return results;
  }
}

export const citationService = new CitationService();
