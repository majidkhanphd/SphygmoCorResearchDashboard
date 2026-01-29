import { db } from "../db";
import { publications } from "@shared/schema";
import { isNotNull, sql } from "drizzle-orm";

const SAMPLE_SIZE = 50;

interface ComparisonResult {
  doi: string;
  title: string;
  openAlex: number | null;
  crossref: number | null;
  difference: number | null;
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

async function runComparison() {
  console.log("=== Citation Count Comparison: OpenAlex vs Crossref ===\n");
  
  const pubs = await db
    .select({ id: publications.id, doi: publications.doi, title: publications.title })
    .from(publications)
    .where(isNotNull(publications.doi))
    .orderBy(sql`RANDOM()`)
    .limit(SAMPLE_SIZE);

  console.log(`Found ${pubs.length} publications with DOIs. Testing sample...\n`);

  const results: ComparisonResult[] = [];
  let openAlexTotal = 0;
  let crossrefTotal = 0;
  let openAlexFound = 0;
  let crossrefFound = 0;
  let openAlexHigher = 0;
  let crossrefHigher = 0;
  let equal = 0;

  for (let i = 0; i < pubs.length; i++) {
    const pub = pubs[i];
    if (!pub.doi) continue;

    process.stdout.write(`\rProcessing ${i + 1}/${pubs.length}...`);

    const [openAlex, crossref] = await Promise.all([
      fetchOpenAlexCitation(pub.doi),
      fetchCrossrefCitation(pub.doi),
    ]);

    const result: ComparisonResult = {
      doi: pub.doi,
      title: pub.title?.substring(0, 60) || "Unknown",
      openAlex,
      crossref,
      difference: openAlex !== null && crossref !== null ? crossref - openAlex : null,
    };
    results.push(result);

    if (openAlex !== null) {
      openAlexTotal += openAlex;
      openAlexFound++;
    }
    if (crossref !== null) {
      crossrefTotal += crossref;
      crossrefFound++;
    }
    if (openAlex !== null && crossref !== null) {
      if (crossref > openAlex) crossrefHigher++;
      else if (openAlex > crossref) openAlexHigher++;
      else equal++;
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log("\n\n=== SUMMARY ===\n");
  console.log(`Sample Size: ${pubs.length} publications with DOIs`);
  console.log(`\nCoverage:`);
  console.log(`  OpenAlex: ${openAlexFound}/${pubs.length} (${((openAlexFound / pubs.length) * 100).toFixed(1)}%)`);
  console.log(`  Crossref: ${crossrefFound}/${pubs.length} (${((crossrefFound / pubs.length) * 100).toFixed(1)}%)`);
  
  console.log(`\nTotal Citations Found:`);
  console.log(`  OpenAlex: ${openAlexTotal.toLocaleString()}`);
  console.log(`  Crossref: ${crossrefTotal.toLocaleString()}`);
  
  const bothFound = results.filter(r => r.openAlex !== null && r.crossref !== null).length;
  console.log(`\nWhen Both Found (${bothFound} publications):`);
  console.log(`  Crossref higher: ${crossrefHigher} (${((crossrefHigher / bothFound) * 100).toFixed(1)}%)`);
  console.log(`  OpenAlex higher: ${openAlexHigher} (${((openAlexHigher / bothFound) * 100).toFixed(1)}%)`);
  console.log(`  Equal: ${equal} (${((equal / bothFound) * 100).toFixed(1)}%)`);

  console.log(`\n=== SAMPLE DETAILS (first 15) ===\n`);
  console.log("DOI".padEnd(40) + "OpenAlex".padStart(10) + "Crossref".padStart(10) + "Diff".padStart(8));
  console.log("-".repeat(68));
  
  for (const r of results.slice(0, 15)) {
    const oaStr = r.openAlex !== null ? r.openAlex.toString() : "N/A";
    const crStr = r.crossref !== null ? r.crossref.toString() : "N/A";
    const diffStr = r.difference !== null ? (r.difference >= 0 ? `+${r.difference}` : r.difference.toString()) : "-";
    console.log(r.doi.substring(0, 38).padEnd(40) + oaStr.padStart(10) + crStr.padStart(10) + diffStr.padStart(8));
  }

  console.log("\n=== RECOMMENDATION ===\n");
  if (crossrefFound > openAlexFound) {
    console.log("Crossref has BETTER COVERAGE.");
  } else if (openAlexFound > crossrefFound) {
    console.log("OpenAlex has BETTER COVERAGE.");
  } else {
    console.log("Both have EQUAL COVERAGE.");
  }
  
  if (crossrefTotal > openAlexTotal) {
    console.log("Crossref reports MORE TOTAL CITATIONS.");
  } else if (openAlexTotal > crossrefTotal) {
    console.log("OpenAlex reports MORE TOTAL CITATIONS.");
  } else {
    console.log("Both report EQUAL TOTAL CITATIONS.");
  }
}

runComparison()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
