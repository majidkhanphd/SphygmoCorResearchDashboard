import { normalizeJournalName, getChildJournals, isParentJournal } from "../../shared/journal-mappings";

console.log("=== Testing Normalizations ===\n");

const testCases: [string, string][] = [
  ["Journal of hypertension", "Journal of Hypertension"],
  ["PLOS ONE", "PLOS ONE"],
  ["PLoS ONE", "PLOS ONE"],
  ["Hypertension (Dallas, Tex. : 1979)", "Hypertension"],
  ["Pediatric nephrology (Berlin, Germany)", "Pediatric Nephrology"],
  ["Clinical Journal of the American Society of Nephrology : CJASN", "Clinical Journal of the American Society of Nephrology"],
  ["Circulation. Heart failure", "Circulation: Heart Failure"],
  ["JACC. Heart failure", "JACC: Heart Failure"],
  ["American journal of hypertension", "American Journal of Hypertension"],
];

let passed = 0;
let failed = 0;

for (const [input, expected] of testCases) {
  const result = normalizeJournalName(input);
  if (result === expected) {
    console.log(`✓ "${input}" → "${result}"`);
    passed++;
  } else {
    console.log(`✗ "${input}" → "${result}" (expected: "${expected}")`);
    failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed\n`);

console.log("=== Testing Parent Groups ===\n");

const parents = ["Frontiers", "Circulation", "JACC", "PLOS", "JASN (Nephrology)", "European Heart Journal"];
for (const p of parents) {
  const children = getChildJournals(p);
  const isParent = isParentJournal(p);
  console.log(`${p}: ${children.length} children (isParent: ${isParent})`);
  children.forEach(c => console.log(`  - ${c}`));
}

console.log("\n=== Summary ===");
console.log(`Total parent groups: ${parents.filter(p => isParentJournal(p)).length}`);
