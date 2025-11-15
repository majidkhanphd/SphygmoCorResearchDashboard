/**
 * Decodes HTML entities in author names
 * Handles numeric entities (&#8211;) and named entities (&amp;)
 */
export function decodeHTMLEntities(text: string): string {
  const textArea = document.createElement('textarea');
  textArea.innerHTML = text;
  return textArea.value;
}

/**
 * Sanitizes author names by:
 * 1. Decoding HTML entities (&#228; → ä, &#8211; → –, etc.)
 * 2. Cleaning up extra whitespace
 * 3. Preserving all author names
 */
export function sanitizeAuthors(authors: string): string {
  if (!authors) return '';
  
  // Decode HTML entities
  const decoded = decodeHTMLEntities(authors);
  
  // Clean up extra whitespace but preserve commas
  const cleaned = decoded.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}
