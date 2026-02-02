import OpenAI from "openai";
import { db } from "../db";
import { publications } from "@shared/schema";
import { sql } from "drizzle-orm";
import { JOURNAL_GROUPS, JOURNAL_NORMALIZATIONS } from "@shared/journal-mappings";

const openai = new OpenAI();

async function analyzeJournals() {
  console.log("Fetching all unique journal names from database...\n");
  
  const results = await db
    .select({
      journal: publications.journal,
      count: sql<number>`count(*)::int`,
    })
    .from(publications)
    .where(sql`${publications.journal} IS NOT NULL`)
    .groupBy(publications.journal)
    .orderBy(sql`count(*) DESC`);
  
  console.log(`Found ${results.length} unique journal names\n`);
  
  const journalList = results.map(r => `${r.journal} (${r.count})`).join("\n");
  
  const existingGroups = JOURNAL_GROUPS.map(g => 
    `Parent: ${g.parent}\n  Children: ${g.children.join(", ")}`
  ).join("\n\n");
  
  const existingNormalizations = Object.entries(JOURNAL_NORMALIZATIONS)
    .map(([from, to]) => `"${from}" → "${to}"`)
    .join("\n");

  console.log("Analyzing with OpenAI GPT-4o...\n");
  
  const prompt = `You are a scientific journal expert. Analyze this list of journal names from a cardiovascular research database and identify standardization issues.

CURRENT JOURNAL NAMES (with publication counts):
${journalList}

EXISTING PARENT-CHILD GROUPS:
${existingGroups}

EXISTING NORMALIZATIONS:
${existingNormalizations}

Please analyze and provide a comprehensive report with the following sections:

## 1. CASE/FORMAT DUPLICATES
List journals that appear multiple times with different casing or formatting. Format as:
- "Variant 1" (count) + "Variant 2" (count) → Canonical: "Preferred Name"

## 2. COLON SPACING ISSUES
List journals with inconsistent colon spacing (e.g., " : " vs ": " vs ":"). These should be standardized to ": " (colon followed by single space).
- "Name with : space" → "Name: corrected"

## 3. LOCATION QUALIFIER VARIATIONS
List journals with location qualifiers like "(Dallas, Tex. : 1979)" or "(London, England)" that should normalize to cleaner names.
- "Journal (City, State : Year)" → "Journal"

## 4. MISSING FROM EXISTING PARENT GROUPS
List journals that should be added to existing parent groups (BMJ, BMC, Frontiers, American Journal of Physiology, Alzheimer's & Dementia):
- Parent: [name]
  - Missing child: [journal name] (count)

## 5. NEW PARENT GROUPS TO CREATE
Identify journal families that should have their own parent group:
- Suggested Parent: [name]
  - Children: [list of journals with counts]

Consider these publisher families:
- Circulation (AHA journals)
- JACC (American College of Cardiology)
- European Heart Journal family
- Journal of the American Society of Nephrology family
- Any other families with 3+ related journals

## 6. ABBREVIATION INCONSISTENCIES
List journals using abbreviations vs full names:
- "JASN" vs "Journal of the American Society of Nephrology"

## 7. SUMMARY STATISTICS
- Total duplicates found
- Total journals that should be grouped
- Estimated reduction in filter count after standardization

Be thorough and include ALL instances you find. This is for a production system.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 8000,
  });

  const analysis = response.choices[0].message.content;
  
  console.log("=".repeat(80));
  console.log("JOURNAL STANDARDIZATION ANALYSIS REPORT");
  console.log("=".repeat(80));
  console.log(analysis);
  console.log("\n" + "=".repeat(80));
  
  return analysis;
}

analyzeJournals()
  .then(() => {
    console.log("\nAnalysis complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error analyzing journals:", error);
    process.exit(1);
  });
