/**
 * Journal normalization and parent-child grouping system
 * 
 * This file defines:
 * 1. Normalization rules to handle journal name variations
 * 2. Parent-child relationships for journal families
 * 
 * Updated: Comprehensive standardization including case normalization,
 * colon spacing, location qualifier removal, and new parent groups.
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
  // ============================================================
  // PLOS VARIATIONS (standardize to PLOS capitalization)
  // ============================================================
  "plos one": "PLOS ONE",
  "plos computational biology": "PLOS Computational Biology",
  "plos medicine": "PLOS Medicine",
  
  // ============================================================
  // HYPERTENSION FAMILY
  // ============================================================
  "hypertension (dallas, tex. : 1979)": "Hypertension",
  "hypertension (dallas, texas : 1979)": "Hypertension",
  "hypertension research : official journal of the japanese society of hypertension": "Hypertension Research",
  "journal of hypertension": "Journal of Hypertension",
  "journal of human hypertension": "Journal of Human Hypertension",
  "american journal of hypertension": "American Journal of Hypertension",
  
  // ============================================================
  // CIRCULATION FAMILY - Normalize variations
  // ============================================================
  "circulation research": "Circulation Research",
  "circulation. heart failure": "Circulation: Heart Failure",
  "circulation. cardiovascular imaging": "Circulation: Cardiovascular Imaging",
  "circulation. cardiovascular quality and outcomes": "Circulation: Cardiovascular Quality and Outcomes",
  
  // ============================================================
  // CASE NORMALIZATION - Journals with multiple case variations
  // ============================================================
  "american heart journal": "American Heart Journal",
  "american journal of nephrology": "American Journal of Nephrology",
  "annals of biomedical engineering": "Annals of Biomedical Engineering",
  "annals of the rheumatic diseases": "Annals of the Rheumatic Diseases",
  "blood pressure monitoring": "Blood Pressure Monitoring",
  "clinical obesity": "Clinical Obesity",
  "diabetes, obesity & metabolism": "Diabetes, Obesity & Metabolism",
  "european journal of applied physiology": "European Journal of Applied Physiology",
  "european journal of clinical nutrition": "European Journal of Clinical Nutrition",
  "european journal of heart failure": "European Journal of Heart Failure",
  "experimental physiology": "Experimental Physiology",
  "internal medicine journal": "Internal Medicine Journal",
  "international journal of cardiology": "International Journal of Cardiology",
  "international journal of obesity (2005)": "International Journal of Obesity",
  "journal of internal medicine": "Journal of Internal Medicine",
  "journal of occupational and environmental medicine": "Journal of Occupational and Environmental Medicine",
  "journal of psychosomatic research": "Journal of Psychosomatic Research",
  "medicine and science in sports and exercise": "Medicine and Science in Sports and Exercise",
  "pediatric diabetes": "Pediatric Diabetes",
  "pediatric research": "Pediatric Research",
  "physiological measurement": "Physiological Measurement",
  "the british journal of nutrition": "The British Journal of Nutrition",
  "the canadian journal of cardiology": "The Canadian Journal of Cardiology",
  "the journal of clinical endocrinology and metabolism": "The Journal of Clinical Endocrinology and Metabolism",
  "the journal of pediatrics": "The Journal of Pediatrics",
  "the journal of physiology": "The Journal of Physiology",
  "acta diabetologica": "Acta Diabetologica",
  
  // ============================================================
  // LOCATION QUALIFIER REMOVAL
  // ============================================================
  "pediatric nephrology (berlin, germany)": "Pediatric Nephrology",
  "echocardiography (mount kisco, n.y.)": "Echocardiography",
  "vascular medicine (london, england)": "Vascular Medicine",
  "microcirculation (new york, n.y. : 1994)": "Microcirculation",
  "obesity (silver spring, md.)": "Obesity",
  "menopause (new york, n.y.)": "Menopause",
  "rheumatology (oxford, england)": "Rheumatology",
  "clinical science (london, england : 1979)": "Clinical Science",
  "aids (london, england)": "AIDS",
  "nutrition (burbank, los angeles county, calif.)": "Nutrition",
  "nutrition research (new york, n.y.)": "Nutrition Research",
  "sensors (basel, switzerland)": "Sensors",
  "experimental biology and medicine (maywood, n.j.)": "Experimental Biology and Medicine",
  "medical devices (auckland, n.z.)": "Medical Devices",
  "journal of applied physiology (bethesda, md. : 1985)": "Journal of Applied Physiology",
  
  // ============================================================
  // COLON SPACING NORMALIZATION (standardize " : " to ": ")
  // ============================================================
  "clinical journal of the american society of nephrology : cjasn": "Clinical Journal of the American Society of Nephrology",
  "journal of the american society of nephrology : jasn": "Journal of the American Society of Nephrology",
  "journal of alzheimer's disease : jad": "Journal of Alzheimer's Disease",
  "journal of clinical sleep medicine : jcsm : official publication of the american academy of sleep medicine": "Journal of Clinical Sleep Medicine",
  "archives of medical science : ams": "Archives of Medical Science",
  "autonomic neuroscience : basic & clinical": "Autonomic Neuroscience",
  "asaio journal (american society for artificial internal organs : 1992)": "ASAIO Journal",
  "biologics : targets & therapy": "Biologics: Targets & Therapy",
  "clinical autonomic research : official journal of the clinical autonomic research society": "Clinical Autonomic Research",
  "clinical pharmacology : advances and applications": "Clinical Pharmacology: Advances and Applications",
  "diabetes & vascular disease research : official journal of the international society of diabetes and vascular disease": "Diabetes & Vascular Disease Research",
  "electrolytes & blood pressure : e & bp": "Electrolytes & Blood Pressure",
  "evidence-based complementary and alternative medicine : ecam": "Evidence-Based Complementary and Alternative Medicine",
  "health psychology : official journal of the division of health psychology, american psychological association": "Health Psychology",
  "immunity & ageing : i & a": "Immunity & Ageing",
  "international journal of psychophysiology : official journal of the international organization of psychophysiology": "International Journal of Psychophysiology",
  "journal of clinical and diagnostic research : jcdr": "Journal of Clinical and Diagnostic Research",
  "journal of geriatric cardiology : jgc": "Journal of Geriatric Cardiology",
  "journal of pediatric endocrinology & metabolism : jpem": "Journal of Pediatric Endocrinology & Metabolism",
  "journal of psychiatry & neuroscience : jpn": "Journal of Psychiatry & Neuroscience",
  "journal of renal nutrition : the official journal of the council on renal nutrition of the national kidney foundation": "Journal of Renal Nutrition",
  "journal of the american association for laboratory animal science : jaalas": "Journal of the American Association for Laboratory Animal Science",
  "journal of the american society of echocardiography : official publication of the american society of echocardiography": "Journal of the American Society of Echocardiography",
  "journal of the american society of hypertension : jash": "Journal of the American Society of Hypertension",
  "journal of the peripheral nervous system : jpns": "Journal of the Peripheral Nervous System",
  "journal of visualized experiments : jove": "Journal of Visualized Experiments",
  "medical science monitor : international medical journal of experimental and clinical research": "Medical Science Monitor",
  "neuroimage : clinical": "NeuroImage: Clinical",
  "nitric oxide : biology and chemistry": "Nitric Oxide",
  "peritoneal dialysis international : journal of the international society for peritoneal dialysis": "Peritoneal Dialysis International",
  "the international journal of angiology : official publication of the international college of angiology, inc": "The International Journal of Angiology",
  "the journal of physiological sciences : jps": "The Journal of Physiological Sciences",
  "twin research and human genetics : the official journal of the international society for twin studies": "Twin Research and Human Genetics",
  
  // ============================================================
  // AMERICAN JOURNAL OF PHYSIOLOGY FAMILY
  // ============================================================
  "american journal of physiology. heart and circulatory physiology": "American Journal of Physiology - Heart and Circulatory Physiology",
  "american journal of physiology. renal physiology": "American Journal of Physiology - Renal Physiology",
  "american journal of physiology. regulatory, integrative and comparative physiology": "American Journal of Physiology - Regulatory, Integrative and Comparative Physiology",
  "american journal of physiology. cell physiology": "American Journal of Physiology - Cell Physiology",
  "american journal of physiology. endocrinology and metabolism": "American Journal of Physiology - Endocrinology and Metabolism",
  
  // ============================================================
  // OTHER VARIATIONS
  // ============================================================
  "american journal of kidney diseases : the official journal of the national kidney foundation": "American Journal of Kidney Diseases",
  "american journal of human biology : the official journal of the human biology council": "American Journal of Human Biology",
  "arthritis & rheumatology (hoboken, n.j.)": "Arthritis & Rheumatology",
  "arteriosclerosis, thrombosis, and vascular biology": "Arteriosclerosis, Thrombosis, and Vascular Biology",
  
  // ============================================================
  // JACC FAMILY - Normalize variations
  // ============================================================
  "jacc. cardiovascular imaging": "JACC: Cardiovascular Imaging",
  "jacc. heart failure": "JACC: Heart Failure",
  "jacc: basic to translational science": "JACC: Basic to Translational Science",
  "jacc: advances": "JACC: Advances",
  
  // ============================================================
  // EUROPEAN HEART JOURNAL FAMILY
  // ============================================================
  "european heart journal. digital health": "European Heart Journal - Digital Health",
  
  // ============================================================
  // ALZHEIMER'S FAMILY - Normalize colon spacing
  // ============================================================
  "alzheimer's & dementia : diagnosis, assessment & disease monitoring": "Alzheimer's & Dementia: Diagnosis, Assessment & Disease Monitoring",
  "alzheimer's & dementia : translational research & clinical interventions": "Alzheimer's & Dementia: Translational Research & Clinical Interventions",
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
      "Open Heart",
      "Heart Asia",
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
      "Frontiers in Pediatrics",
      "Frontiers in Pharmacology",
      "Frontiers in Immunology",
      "Frontiers in Nutrition",
      "Frontiers in Human Neuroscience",
      "Frontiers in Sports and Active Living",
      "Frontiers in Aging",
      "Frontiers in Nephrology",
      "Frontiers in Genetics",
      "Frontiers in Cellular and Infection Microbiology",
      "Frontiers in Clinical Diabetes and Healthcare",
      "Frontiers in Artificial Intelligence",
      "Frontiers in Molecular Biosciences",
      "Frontiers in Psychology",
    ],
  },
  {
    parent: "Alzheimer's & Dementia",
    children: [
      "Alzheimer's & Dementia: Diagnosis, Assessment & Disease Monitoring",
      "Alzheimer's & Dementia: Translational Research & Clinical Interventions",
    ],
  },
  {
    parent: "Circulation",
    children: [
      "Circulation Research",
      "Circulation: Heart Failure",
      "Circulation: Cardiovascular Imaging",
      "Circulation: Cardiovascular Quality and Outcomes",
    ],
  },
  {
    parent: "JACC",
    children: [
      "JACC: Advances",
      "JACC: Basic to Translational Science",
      "JACC: Cardiovascular Imaging",
      "JACC: Heart Failure",
    ],
  },
  {
    parent: "European Heart Journal",
    children: [
      "European Heart Journal - Digital Health",
      "European Heart Journal Open",
    ],
  },
  {
    parent: "ASN Journals",
    children: [
      "Journal of the American Society of Nephrology",
      "Clinical Journal of the American Society of Nephrology",
    ],
  },
  {
    parent: "PLOS",
    children: [
      "PLOS ONE",
      "PLOS Computational Biology",
      "PLOS Medicine",
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
    if (group.parent === normalized) {
      return group;
    }
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
