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
  
  const headerPattern = /^([A-Z][A-Za-z\s&-]*(?:\s+AND\s+[A-Z][A-Za-z\s&-]*)?)\s*[:.\-–]\s*/i;
  const match = content.match(headerPattern);
  
  if (match) {
    const foundLabel = match[1].toLowerCase().replace(/[^a-z0-9\s]/g, '');
    if (foundLabel === normalizedExpected || 
        foundLabel.includes(normalizedExpected) || 
        normalizedExpected.includes(foundLabel) ||
        foundLabel.split(/\s+/).some(word => normalizedExpected.includes(word))) {
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

export const formatAbstract = (abstract: string): JSX.Element[] => {
  const sanitized = sanitizeText(abstract);
  
  if (!sanitized || sanitized.trim().length === 0) {
    return [<span key="empty">No abstract available.</span>];
  }
  
  const sectionPattern = /(?:^|[.!?]\s+|\n\s*)([A-Z][A-Za-z\s&-]{2,40}(?:\s+AND\s+[A-Z][A-Za-z\s&-]+)?)\s*[:]\s*/g;
  
  const detectedSections: DetectedSection[] = [];
  let match;
  
  while ((match = sectionPattern.exec(sanitized)) !== null) {
    const fullMatch = match[0];
    const label = match[1].trim();
    const headerStart = match.index;
    const contentStart = headerStart + fullMatch.length;
    
    const words = label.split(/\s+/);
    const looksLikeHeader = 
      words.length <= 6 &&
      label.length <= 50 &&
      !/^\d/.test(label) &&
      !label.includes('=') &&
      !label.includes('%') &&
      !/\d{4}/.test(label);
    
    if (!looksLikeHeader) continue;
    
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
    return [<span key="unstructured">{sanitized}</span>];
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
