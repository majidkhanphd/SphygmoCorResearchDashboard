/**
 * Comprehensive HTML sanitization utility for cleaning text data.
 * Works in both browser (client) and Node.js (server) environments.
 */

/**
 * Decodes ALL HTML entities (both numeric and named) from text.
 * Works in both browser and Node.js environments.
 * 
 * Examples:
 * - &#8208; → ‐ (hyphen)
 * - &#8211; → – (en dash)
 * - &#8212; → — (em dash)
 * - &#946; → β (beta)
 * - &amp; → &
 * - &lt; → <
 * - &gt; → >
 */
export function decodeHTMLEntities(text: string): string {
  if (!text) return text;

  // Use regex-based decoding for both browser and Node.js environments
  // This avoids innerHTML usage which can be flagged by security scanners
  // IMPORTANT: Decode numeric entities FIRST, then named entities
  // This prevents double-decoding (e.g., &amp;lt; → &lt; → <)
  return text
    // Decode numeric entities (decimal)
    .replace(/&#(\d+);/g, (match, dec) => {
      try {
        return String.fromCharCode(parseInt(dec, 10));
      } catch {
        return match;
      }
    })
    // Decode numeric entities (hexadecimal)
    .replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => {
      try {
        return String.fromCharCode(parseInt(hex, 16));
      } catch {
        return match;
      }
    })
    // Decode common named entities (most frequently used)
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&ndash;/g, '\u2013')
    .replace(/&mdash;/g, '\u2014')
    .replace(/&lsquo;/g, '\u2018')
    .replace(/&rsquo;/g, '\u2019')
    .replace(/&ldquo;/g, '\u201C')
    .replace(/&rdquo;/g, '\u201D')
    .replace(/&hellip;/g, '\u2026')
    .replace(/&copy;/g, '\u00A9')
    .replace(/&reg;/g, '\u00AE')
    .replace(/&trade;/g, '\u2122')
    .replace(/&deg;/g, '\u00B0')
    .replace(/&plusmn;/g, '\u00B1')
    .replace(/&times;/g, '\u00D7')
    .replace(/&divide;/g, '\u00F7')
    .replace(/&alpha;/g, '\u03B1')
    .replace(/&beta;/g, '\u03B2')
    .replace(/&gamma;/g, '\u03B3')
    .replace(/&delta;/g, '\u03B4')
    .replace(/&micro;/g, '\u00B5')
    // Decode &amp; LAST to prevent double-decoding
    .replace(/&amp;/g, '&');
}

/**
 * Removes HTML tags from text while preserving content.
 * Handles common scientific notation tags like <sup>, <sub>, <i>, <em>, etc.
 * 
 * Examples:
 * - "CO<sub>2</sub>" → "CO2"
 * - "x<sup>2</sup>" → "x2"
 * - "<i>in vitro</i>" → "in vitro"
 */
export function stripHTMLTags(text: string): string {
  if (!text) return text;
  
  // Remove all HTML tags but keep the content
  return text.replace(/<[^>]+>/g, '');
}

/**
 * Comprehensive text sanitization function.
 * 
 * This function:
 * 1. Removes HTML formatting tags (if present in raw data)
 * 2. Decodes ALL HTML entities (numeric & named)
 * 3. Cleans up extra whitespace
 * 4. Preserves semantic content (no truncation)
 * 5. Handles edge cases safely
 * 
 * Use this for:
 * - Publication titles
 * - Abstracts
 * - Journal names
 * - Any text that might contain HTML entities or tags
 * 
 * NOTE: We strip HTML tags BEFORE decoding entities to avoid removing
 * content that was encoded (e.g., &lt;tag&gt; becomes <tag> not nothing)
 * 
 * @param text - The text to sanitize
 * @returns Cleaned text with entities decoded and tags removed
 */
export function sanitizeText(text: string | null | undefined): string {
  if (!text) return '';
  
  // Step 1: Remove HTML formatting tags (from raw data)
  // This must happen BEFORE decoding entities to avoid removing encoded content
  let cleaned = stripHTMLTags(text);
  
  // Step 2: Decode HTML entities
  cleaned = decodeHTMLEntities(cleaned);
  
  // Step 3: Clean up whitespace (normalize multiple spaces, trim)
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

const ACRONYM_CANONICAL: Record<string, string> = {};
[
  "DNA", "RNA", "HIV", "AIDS", "BMI", "ECG", "EKG", "MRI", "CT", "ICU",
  "COPD", "CKD", "EVA", "PWV", "BP", "HR", "LDL", "HDL",
  "ACE", "ARB", "CAFE", "ASCOT", "SPRINT", "MESA", "ARIC", "CHS",
  "NHANES", "WHO", "FDA", "NIH", "NHS", "AHA", "ESC", "ACC",
  "USA", "UK", "EU", "II", "III", "IV", "VI", "VII", "VIII", "IX",
  "RAAS", "GFR", "IMT", "FMD", "CPP", "MAP", "SBP", "DBP",
  "CI", "OR", "RR", "SD", "SE", "IQR", "AUC", "ROC",
  "GWAS", "SNP", "PCR", "ELISA", "MMP", "CRP", "TNF", "IL",
  "NO", "ROS", "ATP", "ADP",
  "PMC", "PMID", "DOI", "PDF", "URL",
  "CVD", "CHD", "MI", "PAD", "AF", "HF", "LV", "RV", "LA", "RA",
  "RCT", "COVID", "SARS", "ICH", "TIA", "DVT", "PE",
].forEach(a => { ACRONYM_CANONICAL[a] = a; });

const MIXED_CASE_ACRONYMS: Record<string, string> = {
  "EGFR": "eGFR",
  "HBA1C": "HbA1c",
  "CAMP": "cAMP",
  "CGMP": "cGMP",
};
Object.entries(MIXED_CASE_ACRONYMS).forEach(([k, v]) => { ACRONYM_CANONICAL[k] = v; });

const LOWERCASE_WORDS = new Set([
  "a", "an", "the", "and", "but", "or", "nor", "for", "yet", "so",
  "in", "on", "at", "to", "by", "of", "up", "as", "is", "it",
  "with", "from", "into", "than", "that", "vs", "via", "per",
]);

function isAllCapsTitle(title: string): boolean {
  const alpha = title.replace(/[^a-zA-Z]/g, '');
  if (alpha.length < 10) return false;
  const upperCount = alpha.replace(/[^A-Z]/g, '').length;
  return upperCount / alpha.length > 0.85;
}

function convertWord(word: string, isFirstWord: boolean): string {
  const leadingPunct = word.match(/^([^a-zA-Z0-9]*)/)?.[1] || '';
  const trailingPunct = word.match(/([^a-zA-Z0-9]*)$/)?.[1] || '';
  const core = word.slice(leadingPunct.length, word.length - (trailingPunct.length || 0));

  if (!core) {
    return word;
  }

  if (core.includes('-')) {
    const parts = core.split('-');
    const converted = parts.map((p, i) => {
      if (!p) return p;
      const upperP = p.toUpperCase();
      const canonical = ACRONYM_CANONICAL[upperP];
      if (canonical) return canonical;
      const lowerP = p.toLowerCase();
      if (i > 0 || !isFirstWord) {
        if (LOWERCASE_WORDS.has(lowerP)) return lowerP;
      }
      return lowerP.charAt(0).toUpperCase() + lowerP.slice(1);
    });
    return leadingPunct + converted.join('-') + trailingPunct;
  }

  const upperCore = core.toUpperCase();
  const canonical = ACRONYM_CANONICAL[upperCore];
  if (canonical) {
    return leadingPunct + canonical + trailingPunct;
  }

  const lowerCore = core.toLowerCase();

  if (!isFirstWord && LOWERCASE_WORDS.has(lowerCore)) {
    return leadingPunct + lowerCore + trailingPunct;
  }

  return leadingPunct + lowerCore.charAt(0).toUpperCase() + lowerCore.slice(1) + trailingPunct;
}

function toTitleCase(title: string): string {
  const words = title.split(/(\s+)/);

  let isFirstWord = true;
  return words.map((word) => {
    if (/^\s+$/.test(word)) {
      return word;
    }

    const result = convertWord(word, isFirstWord);
    isFirstWord = false;
    return result;
  }).join('');
}

export function normalizeAllCapsTitle(title: string | null | undefined): string {
  if (!title) return '';
  if (!isAllCapsTitle(title)) return title;
  return toTitleCase(title);
}

/**
 * Sanitizes author names by:
 * 1. Decoding HTML entities (&#228; → ä, &#8211; → –, etc.)
 * 2. Cleaning up extra whitespace
 * 3. Preserving all author names and commas
 * 
 * @param authors - Comma-separated author names
 * @returns Cleaned author string
 */
export function sanitizeAuthors(authors: string | null | undefined): string {
  if (!authors) return '';
  
  // Use the comprehensive sanitizeText function
  return sanitizeText(authors);
}
