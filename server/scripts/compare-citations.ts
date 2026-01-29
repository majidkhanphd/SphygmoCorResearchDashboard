import { db } from "../db";
import { publications } from "@shared/schema";
import { isNotNull, sql } from "drizzle-orm";

const SAMPLE_SIZE = 50;

interface ComparisonResult {
  doi: string;
  title: string;
  openAlex: number | null;
  crossref: number | null;
  semanticScholar: number | null;
}

async function fetchOpenAlexCitation(doi: string): Promise<number | null> {
  try {
    const cleanDoi = doi.replace(/^https?:\/\/doi\.org\//i, "");
    const url = `https://api.openalex.org/works/doi:${encodeURIComponent(cleanDoi)}`;
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "CONNEQT-Health-Research/1.0 (mailto:research@conneqthealth.com)",
      },
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.cited_by_count ?? null;
  } catch (error) {
    return null;
  }
}

async function fetchCrossrefCitation(doi: string): Promise<number | null> {
  try {
    const cleanDoi = doi.replace(/^https?:\/\/doi\.org\//i, "");
    const url = `https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`;
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "CONNEQT-Health-Research/1.0 (mailto:research@conneqthealth.com)",
      },
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.message?.["is-referenced-by-count"] ?? null;
  } catch (error) {
    return null;
  }
}

async function fetchSemanticScholarCitation(doi: string): Promise<number | null> {
  try {
    const cleanDoi = doi.replace(/^https?:\/\/doi\.org\//i, "");
    const url = `https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(cleanDoi)}?fields=citationCount`;
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "CONNEQT-Health-Research/1.0",
      },
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.citationCount ?? null;
  } catch (error) {
    return null;
  }
}

async function runComparison() {
  console.log("=== Citation Count Comparison: OpenAlex vs Crossref vs Semantic Scholar ===\n");
  console.log("Note: Dimensions requires a paid API key, so we're comparing the free APIs.\n");
  
  const pubs = await db
    .select({ id: publications.id, doi: publications.doi, title: publications.title })
    .from(publications)
    .where(isNotNull(publications.doi))
    .orderBy(sql`RANDOM()`)
    .limit(SAMPLE_SIZE);

  console.log(`Found ${pubs.length} publications with DOIs. Testing sample...\n`);

  const results: ComparisonResult[] = [];
  let openAlexTotal = 0, crossrefTotal = 0, ssTotal = 0;
  let openAlexFound = 0, crossrefFound = 0, ssFound = 0;

  for (let i = 0; i < pubs.length; i++) {
    const pub = pubs[i];
    if (!pub.doi) continue;

    process.stdout.write(`\rProcessing ${i + 1}/${pubs.length}...`);

    const [openAlex, crossref, semanticScholar] = await Promise.all([
      fetchOpenAlexCitation(pub.doi),
      fetchCrossrefCitation(pub.doi),
      fetchSemanticScholarCitation(pub.doi),
    ]);

    const result: ComparisonResult = {
      doi: pub.doi,
      title: pub.title?.substring(0, 60) || "Unknown",
      openAlex,
      crossref,
      semanticScholar,
    };
    results.push(result);

    if (openAlex !== null) { openAlexTotal += openAlex; openAlexFound++; }
    if (crossref !== null) { crossrefTotal += crossref; crossrefFound++; }
    if (semanticScholar !== null) { ssTotal += semanticScholar; ssFound++; }

    await new Promise(resolve => setTimeout(resolve, 150));
  }

  console.log("\n\n=== SUMMARY ===\n");
  console.log(`Sample Size: ${pubs.length} publications with DOIs`);
  
  console.log(`\nCoverage (found citation data):`);
  console.log(`  OpenAlex:         ${openAlexFound}/${pubs.length} (${((openAlexFound / pubs.length) * 100).toFixed(1)}%)`);
  console.log(`  Crossref:         ${crossrefFound}/${pubs.length} (${((crossrefFound / pubs.length) * 100).toFixed(1)}%)`);
  console.log(`  Semantic Scholar: ${ssFound}/${pubs.length} (${((ssFound / pubs.length) * 100).toFixed(1)}%)`);
  
  console.log(`\nTotal Citations Found:`);
  console.log(`  OpenAlex:         ${openAlexTotal.toLocaleString()}`);
  console.log(`  Crossref:         ${crossrefTotal.toLocaleString()}`);
  console.log(`  Semantic Scholar: ${ssTotal.toLocaleString()}`);

  console.log(`\nAverage Citations per Publication (when found):`);
  console.log(`  OpenAlex:         ${openAlexFound > 0 ? (openAlexTotal / openAlexFound).toFixed(1) : 'N/A'}`);
  console.log(`  Crossref:         ${crossrefFound > 0 ? (crossrefTotal / crossrefFound).toFixed(1) : 'N/A'}`);
  console.log(`  Semantic Scholar: ${ssFound > 0 ? (ssTotal / ssFound).toFixed(1) : 'N/A'}`);

  console.log(`\n=== SAMPLE DETAILS (first 15) ===\n`);
  console.log("DOI".padEnd(35) + "OpenAlex".padStart(10) + "Crossref".padStart(10) + "SemScholar".padStart(12));
  console.log("-".repeat(67));
  
  for (const r of results.slice(0, 15)) {
    const oaStr = r.openAlex !== null ? r.openAlex.toString() : "N/A";
    const crStr = r.crossref !== null ? r.crossref.toString() : "N/A";
    const ssStr = r.semanticScholar !== null ? r.semanticScholar.toString() : "N/A";
    console.log(r.doi.substring(0, 33).padEnd(35) + oaStr.padStart(10) + crStr.padStart(10) + ssStr.padStart(12));
  }

  console.log("\n=== HEAD-TO-HEAD COMPARISON ===\n");
  
  const allThreeFound = results.filter(r => r.openAlex !== null && r.crossref !== null && r.semanticScholar !== null);
  console.log(`Publications with all 3 sources: ${allThreeFound.length}`);
  
  if (allThreeFound.length > 0) {
    let oaWins = 0, crWins = 0, ssWins = 0;
    for (const r of allThreeFound) {
      const max = Math.max(r.openAlex!, r.crossref!, r.semanticScholar!);
      if (r.openAlex === max) oaWins++;
      if (r.crossref === max) crWins++;
      if (r.semanticScholar === max) ssWins++;
    }
    console.log(`  OpenAlex highest:         ${oaWins} (${((oaWins / allThreeFound.length) * 100).toFixed(1)}%)`);
    console.log(`  Crossref highest:         ${crWins} (${((crWins / allThreeFound.length) * 100).toFixed(1)}%)`);
    console.log(`  Semantic Scholar highest: ${ssWins} (${((ssWins / allThreeFound.length) * 100).toFixed(1)}%)`);
  }

  console.log("\n=== RECOMMENDATION ===\n");
  
  const scores = [
    { name: "OpenAlex", coverage: openAlexFound, total: openAlexTotal },
    { name: "Crossref", coverage: crossrefFound, total: crossrefTotal },
    { name: "Semantic Scholar", coverage: ssFound, total: ssTotal },
  ];
  
  const bestCoverage = scores.reduce((a, b) => a.coverage > b.coverage ? a : b);
  const bestTotal = scores.reduce((a, b) => a.total > b.total ? a : b);
  
  console.log(`Best Coverage: ${bestCoverage.name} (${bestCoverage.coverage}/${pubs.length})`);
  console.log(`Highest Total Citations: ${bestTotal.name} (${bestTotal.total.toLocaleString()})`);
  
  if (bestCoverage.name === bestTotal.name) {
    console.log(`\nRECOMMENDATION: Use ${bestCoverage.name} - best in both coverage and citation counts.`);
  } else {
    console.log(`\nRECOMMENDATION: Consider ${bestTotal.name} for higher counts, or ${bestCoverage.name} for better coverage.`);
  }
}

runComparison()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
