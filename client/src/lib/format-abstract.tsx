import { sanitizeText } from "@shared/sanitize";

interface DetectedSection {
  label: string;
  displayLabel: string;
  headerStart: number;
  contentStart: number;
  content: string;
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function normalizeLabel(label: string): string {
  const cleaned = label.replace(/[:\s]+$/, '').trim();
  if (cleaned === cleaned.toUpperCase() && cleaned.length > 1) {
    return toTitleCase(cleaned);
  }
  return cleaned;
}

function stripLeadingDuplicateHeader(content: string, expectedLabel: string): string {
  const normalizedExpected = expectedLabel.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  
  // Much stricter pattern - only match short headers (1-4 words, max 30 chars) at the start
  // Avoid matching long sentences that happen to end with a colon/period
  const headerPattern = /^([A-Z][A-Za-z]{0,20}(?:\s+[A-Za-z]{1,15}){0,3})\s*[:]\s*/;
  const match = content.match(headerPattern);
  
  if (match && match[1].length <= 30) {
    const foundLabel = match[1].toLowerCase().replace(/[^a-z0-9\s]/g, '');
    // Only strip if it's a close match to the expected label
    if (foundLabel === normalizedExpected || 
        foundLabel.includes(normalizedExpected) || 
        normalizedExpected.includes(foundLabel)) {
      return content.substring(match[0].length).trim();
    }
  }
  
  return content;
}

function cleanSectionContent(content: string): string {
  let cleaned = content
    .replace(/^[:.\-–\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  cleaned = cleaned.replace(/[.!?,:;\-–]+$/, '').trim();
  
  if (cleaned.length > 0 && !/[.!?]$/.test(cleaned)) {
    cleaned += '.';
  }
  
  return cleaned;
}

// Known abstract section headers - only these should be detected as sections
const KNOWN_SECTION_HEADERS = new Set([
  'background', 'introduction', 'objective', 'objectives', 'aim', 'aims',
  'purpose', 'rationale', 'context', 'significance',
  'methods', 'methodology', 'materials', 'materials and methods', 'design',
  'study design', 'patients', 'participants', 'subjects', 'setting', 'procedures',
  'results', 'findings', 'outcomes', 'main results', 'key results',
  'conclusion', 'conclusions', 'discussion', 'summary', 'implications',
  'clinical implications', 'interpretation', 'limitations',
  'trial registration', 'registration', 'funding', 'acknowledgments',
  'what is known', 'what is new', 'what this adds', 'key points',
  'importance', 'observations', 'meaning', 'main outcome measures',
  'exposures', 'interventions', 'main outcomes', 'measurements'
]);

function isKnownSectionHeader(label: string): boolean {
  const normalized = label.toLowerCase().trim();
  if (KNOWN_SECTION_HEADERS.has(normalized)) return true;
  // Check for variations like "Background and Aims" or "Methods and Results"
  const parts = normalized.split(/\s+and\s+/);
  return parts.every(part => KNOWN_SECTION_HEADERS.has(part.trim()));
}

export const formatAbstract = (abstract: string): JSX.Element[] => {
  const sanitized = sanitizeText(abstract);
  
  if (!sanitized || sanitized.trim().length === 0) {
    return [<span key="empty">No abstract available.</span>];
  }
  
  // Stricter pattern - only match 1-3 word headers followed by colon
  const sectionPattern = /(?:^|[.!?]\s+|\n\s*)([A-Z][A-Za-z]{2,20}(?:\s+(?:and\s+)?[A-Za-z]{2,20}){0,3})\s*[:]\s*/gi;
  
  const detectedSections: DetectedSection[] = [];
  let match;
  
  while ((match = sectionPattern.exec(sanitized)) !== null) {
    const fullMatch = match[0];
    const label = match[1].trim();
    const headerStart = match.index;
    const contentStart = headerStart + fullMatch.length;
    
    // Only accept known section headers
    if (!isKnownSectionHeader(label)) continue;
    
    const tooClose = detectedSections.some(
      s => Math.abs(s.headerStart - headerStart) < 10
    );
    
    if (!tooClose) {
      detectedSections.push({
        label: label,
        displayLabel: normalizeLabel(label),
        headerStart: headerStart,
        contentStart: contentStart,
        content: '',
      });
    }
  }
  
  if (detectedSections.length < 2) {
    return [
      <span key="unstructured" className="block">
        <span style={{ fontWeight: '600', color: '#1D1D1F' }}>Abstract:</span>{' '}
        <span>{sanitized}</span>
      </span>
    ];
  }
  
  detectedSections.sort((a, b) => a.headerStart - b.headerStart);
  
  for (let i = 0; i < detectedSections.length; i++) {
    const startPos = detectedSections[i].contentStart;
    const endPos = i < detectedSections.length - 1 
      ? detectedSections[i + 1].headerStart
      : sanitized.length;
    
    let rawContent = sanitized.substring(startPos, endPos).trim();
    
    rawContent = stripLeadingDuplicateHeader(rawContent, detectedSections[i].displayLabel);
    
    detectedSections[i].content = cleanSectionContent(rawContent);
  }
  
  const firstSectionStart = detectedSections[0].headerStart;
  const preamble = sanitized.substring(0, firstSectionStart).trim()
    .replace(/[.!?,:;\s]+$/, '').trim();
  
  const elements: JSX.Element[] = [];
  
  if (preamble && preamble.length > 20) {
    elements.push(
      <span key="preamble" className="block mb-3">
        {preamble}
      </span>
    );
  }
  
  detectedSections.forEach((section, index) => {
    if (section.content.length > 0) {
      elements.push(
        <span key={`section-${index}`} className="block mt-3 first:mt-0">
          <span style={{ fontWeight: '600', color: '#1D1D1F' }}>{section.displayLabel}:</span>{' '}
          <span>{section.content}</span>
        </span>
      );
    }
  });
  
  if (elements.length === 0) {
    return [<span key="fallback">{sanitized}</span>];
  }
  
  return elements;
};
