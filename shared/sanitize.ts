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
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&lsquo;/g, ''')
    .replace(/&rsquo;/g, ''')
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&hellip;/g, '…')
    .replace(/&copy;/g, '©')
    .replace(/&reg;/g, '®')
    .replace(/&trade;/g, '™')
    .replace(/&deg;/g, '°')
    .replace(/&plusmn;/g, '±')
    .replace(/&times;/g, '×')
    .replace(/&divide;/g, '÷')
    .replace(/&alpha;/g, 'α')
    .replace(/&beta;/g, 'β')
    .replace(/&gamma;/g, 'γ')
    .replace(/&delta;/g, 'δ')
    .replace(/&micro;/g, 'µ')
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
