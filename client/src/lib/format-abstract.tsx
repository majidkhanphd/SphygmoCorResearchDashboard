import { sanitizeText } from "@shared/sanitize";

export const ABSTRACT_SECTION_HEADERS = [
  'Background',
  'Introduction',
  'Purpose',
  'Objective',
  'Objectives',
  'Aim',
  'Aims',
  'Rationale',
  'Context',
  'Methods',
  'Method',
  'Methodology',
  'Design',
  'Study Design',
  'Materials',
  'Patients',
  'Participants',
  'Subjects',
  'Setting',
  'Measurements',
  'Interventions',
  'Results',
  'Findings',
  'Outcomes',
  'Main Results',
  'Key Results',
  'Conclusions',
  'Conclusion',
  'Discussion',
  'Interpretation',
  'Clinical Implications',
  'Significance',
  'Trial Registration',
];

interface ParsedSection {
  header: string;
  content: string;
  position: number;
}

export const formatAbstract = (abstract: string): JSX.Element[] => {
  const sanitized = sanitizeText(abstract);
  
  if (!sanitized || sanitized.trim().length === 0) {
    return [<span key="empty">No abstract available.</span>];
  }
  
  const foundSections: ParsedSection[] = [];
  
  for (const header of ABSTRACT_SECTION_HEADERS) {
    const escapedHeader = header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const boundaryPattern = new RegExp(
      `(?:^|[.!?]\\s+|\\n\\s*)${escapedHeader}\\s*[:–\\-]\\s*`,
      'gi'
    );
    
    let match;
    while ((match = boundaryPattern.exec(sanitized)) !== null) {
      const headerStart = match.index;
      const headerMatch = match[0];
      const contentStart = headerStart + headerMatch.length;
      
      const existsAtPosition = foundSections.some(
        s => Math.abs(s.position - headerStart) < 5
      );
      
      if (!existsAtPosition) {
        foundSections.push({
          header: header,
          content: '',
          position: contentStart,
        });
      }
    }
  }
  
  if (foundSections.length < 2) {
    return [<span key="unstructured">{sanitized}</span>];
  }
  
  foundSections.sort((a, b) => a.position - b.position);
  
  for (let i = 0; i < foundSections.length; i++) {
    const startPos = foundSections[i].position;
    const endPos = i < foundSections.length - 1 
      ? sanitized.lastIndexOf(foundSections[i + 1].header, foundSections[i + 1].position)
      : sanitized.length;
    
    let content = sanitized.substring(startPos, endPos).trim();
    
    content = content.replace(/[.!?]\s*$/, '').trim();
    if (content) content += '.';
    
    foundSections[i].content = content;
  }
  
  const firstSectionStart = foundSections.length > 0 
    ? sanitized.indexOf(foundSections[0].header)
    : sanitized.length;
  const preamble = sanitized.substring(0, firstSectionStart).trim();
  
  const elements: JSX.Element[] = [];
  
  if (preamble && preamble.length > 20) {
    elements.push(
      <span key="preamble" className="block mb-3">
        {preamble}
      </span>
    );
  }
  
  foundSections.forEach((section, index) => {
    if (section.content.length > 0) {
      elements.push(
        <span key={`section-${index}`} className="block mt-3 first:mt-0">
          <span style={{ fontWeight: '600', color: '#1D1D1F' }}>{section.header}:</span>{' '}
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
