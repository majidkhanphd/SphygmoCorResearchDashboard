/**
 * Journal normalization and parent-child grouping system
 * 
 * This file defines:
 * 1. Normalization rules to handle journal name variations
 * 2. Parent-child relationships for journal families
 */

export interface JournalGroup {
  parent: string;
  children: string[];
}

/**
 * Normalization map: maps various journal name variations to their canonical form
 * Key: variation (lowercase for case-insensitive matching)
 * Value: canonical journal name
 */
export const JOURNAL_NORMALIZATIONS: Record<string, string> = {
  // Hypertension family
  "hypertension (dallas, tex. : 1979)": "Hypertension",
  "hypertension (dallas, texas : 1979)": "Hypertension",
  "hypertension research : official journal of the japanese society of hypertension": "Hypertension Research",
  
  // PLoS variations
  "plos one": "PLOS ONE",
  
  // Case normalization - American Journal of Physiology
  "american journal of physiology. heart and circulatory physiology": "American Journal of Physiology - Heart and Circulatory Physiology",
  "american journal of physiology. renal physiology": "American Journal of Physiology - Renal Physiology",
  "american journal of physiology. regulatory, integrative and comparative physiology": "American Journal of Physiology - Regulatory, Integrative and Comparative Physiology",
  
  // Case normalization - common journals
  "american heart journal": "American Heart Journal",
  "american journal of hypertension": "American Journal of Hypertension",
  "journal of hypertension": "Journal of Hypertension",
  "annals of the rheumatic diseases": "Annals of the Rheumatic Diseases",
  "acta diabetologica": "Acta Diabetologica",
  "american journal of kidney diseases : the official journal of the national kidney foundation": "American Journal of Kidney Diseases",
  "american journal of nephrology": "American Journal of Nephrology",
  "annals of biomedical engineering": "Annals of Biomedical Engineering",
  
  // ASAIO variations
  "asaio journal (american society for artificial internal organs : 1992)": "ASAIO Journal",
  
  // AIDS variations
  "aids (london, england)": "AIDS",
  
  // Arthritis variations
  "arthritis & rheumatology (hoboken, n.j.)": "Arthritis & Rheumatology",
  
  // Arteriosclerosis variations
  "arteriosclerosis, thrombosis, and vascular biology": "Arteriosclerosis, Thrombosis, and Vascular Biology",
  
  // Autonomic neuroscience variations
  "autonomic neuroscience : basic & clinical": "Autonomic Neuroscience",
  
  // American journal of human biology variations
  "american journal of human biology : the official journal of the human biology council": "American Journal of Human Biology",
};

/**
 * Parent-child journal groupings
 * Defines journal families where a parent journal has multiple related publications
 */
export const JOURNAL_GROUPS: JournalGroup[] = [
  {
    parent: "BMJ",
    children: [
      "BMJ Open",
      "BMJ Case Reports",
      "BMJ Open Diabetes Research & Care",
      "BMJ Open Sport — Exercise Medicine",
      "BMJ Paediatrics Open",
      "BMJ Public Health",
    ],
  },
  {
    parent: "BMC",
    children: [
      "BMC Anesthesiology",
      "BMC Cancer",
      "BMC Cardiovascular Disorders",
      "BMC Complementary Medicine and Therapies",
      "BMC Complementary and Alternative Medicine",
      "BMC Endocrine Disorders",
      "BMC Geriatrics",
      "BMC Infectious Diseases",
      "BMC Medicine",
      "BMC Musculoskeletal Disorders",
      "BMC Nephrology",
      "BMC Neurology",
      "BMC Oral Health",
      "BMC Pediatrics",
      "BMC Pregnancy and Childbirth",
      "BMC Public Health",
      "BMC Pulmonary Medicine",
      "BMC Research Notes",
      "BMC Rheumatology",
      "BMC Sports Science, Medicine and Rehabilitation",
      "BMC Women's Health",
    ],
  },
  {
    parent: "American Journal of Physiology",
    children: [
      "American Journal of Physiology - Cell Physiology",
      "American Journal of Physiology - Endocrinology and Metabolism",
      "American Journal of Physiology - Heart and Circulatory Physiology",
      "American Journal of Physiology - Regulatory, Integrative and Comparative Physiology",
      "American Journal of Physiology - Renal Physiology",
    ],
  },
  {
    parent: "Frontiers",
    children: [
      "Frontiers in Cardiovascular Medicine",
      "Frontiers in Physiology",
      "Frontiers in Endocrinology",
      "Frontiers in Medicine",
      "Frontiers in Aging Neuroscience",
      "Frontiers in Neurology",
      "Frontiers in Public Health",
    ],
  },
  {
    parent: "Alzheimer's & Dementia",
    children: [
      "Alzheimer's & Dementia : Diagnosis, Assessment & Disease Monitoring",
      "Alzheimer's & Dementia : Translational Research & Clinical Interventions",
    ],
  },
];

/**
 * Normalize a journal name to its canonical form
 */
export function normalizeJournalName(journal: string): string {
  const lowercaseJournal = journal.toLowerCase().trim();
  return JOURNAL_NORMALIZATIONS[lowercaseJournal] || journal.trim();
}

/**
 * Find the parent journal group for a given journal name
 * Returns null if the journal is not part of any group
 */
export function findParentGroup(journalName: string): JournalGroup | null {
  const normalized = normalizeJournalName(journalName);
  
  for (const group of JOURNAL_GROUPS) {
    // Check if this is the parent journal itself
    if (group.parent === normalized) {
      return group;
    }
    // Check if this is a child journal
    if (group.children.includes(normalized)) {
      return group;
    }
  }
  
  return null;
}

/**
 * Check if a journal is a parent journal (has children)
 */
export function isParentJournal(journalName: string): boolean {
  const normalized = normalizeJournalName(journalName);
  return JOURNAL_GROUPS.some(group => group.parent === normalized);
}

/**
 * Get all child journals for a parent journal
 * Returns empty array if the journal is not a parent
 */
export function getChildJournals(parentName: string): string[] {
  const normalized = normalizeJournalName(parentName);
  const group = JOURNAL_GROUPS.find(g => g.parent === normalized);
  return group ? group.children : [];
}
