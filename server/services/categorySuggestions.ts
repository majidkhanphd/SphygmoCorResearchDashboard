import OpenAI from "openai";
import { RESEARCH_AREAS, type SuggestedCategory } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `You are an expert research categorization system for cardiovascular and vascular health publications.

Your task is to analyze publication titles and abstracts and assign them to relevant research areas from this list:
1. Chronic Kidney Disease (CKD) - Studies on renal function, kidney disease, dialysis, nephropathy
2. Chronic Obstructive Pulmonary Disease (COPD) - Pulmonary disease, lung function, respiratory health
3. Early Vascular Aging (EVA) - Arterial stiffness, pulse wave velocity, vascular aging markers
4. Heart Failure - Cardiac failure, HFpEF, HFrEF, cardiac function
5. Hypertension - Blood pressure, hypertensive disease, BP management
6. Longevity - Aging studies, lifespan, elderly populations, aging biomarkers
7. Maternal Health - Pregnancy, prenatal, postnatal, maternal outcomes
8. Men's Health - Studies SPECIFICALLY focused on male populations, prostate, testosterone
9. Metabolic Health - Diabetes, glucose metabolism, insulin resistance, obesity
10. Neuroscience - Brain health, cognitive function, dementia, neurological outcomes
11. Women's Health - Studies SPECIFICALLY focused on female populations, menopause, estrogen

CRITICAL ANTI-OVER-TAGGING RULES:
- DO NOT assign "Women's Health" or "Men's Health" unless the study population is EXPLICITLY and PRIMARILY gender-specific
- A study mentioning "men and women" or "patients" should NOT get gender-specific tags
- Generic cardiovascular studies are NOT automatically women's or men's health
- A study must have MULTIPLE strong indicators to warrant a category
- Be conservative - it's better to assign fewer categories than to over-tag

Return a JSON object with this structure:
{
  "suggestions": [
    {
      "category": "Category Name",
      "confidence": 0.85,
      "reasoning": "Brief explanation"
    }
  ]
}

Rules:
- Only include categories with confidence >= 0.6
- Maximum 3 categories per publication
- Confidence must be between 0.0 and 1.0
- CRITICAL: Use the EXACT category names from the list above, including the acronyms in parentheses (e.g., "Early Vascular Aging (EVA)" not "Early Vascular Aging")
- The category field MUST match the format exactly: "Full Name (ACRONYM)" where applicable`;

/**
 * Generate ML-based category suggestions using OpenAI
 */
export async function generateMLSuggestions(
  title: string,
  abstract: string | null
): Promise<SuggestedCategory[]> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.warn("OpenAI API key not configured, skipping ML suggestions");
      return [];
    }

    const text = abstract ? `${title}\n\n${abstract}` : title;
    
    const response = await openai.chat.completions.create({
      model: "gpt-5-nano",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Analyze this publication and suggest categories:\n\n${text}` }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.warn("No response from OpenAI");
      return [];
    }

    const parsed = JSON.parse(content);
    const suggestions = parsed.suggestions || [];

    // Validate and filter suggestions
    return suggestions
      .filter((s: any) => 
        s.category && 
        typeof s.confidence === 'number' && 
        s.confidence >= 0.6 &&
        RESEARCH_AREAS.includes(s.category)
      )
      .slice(0, 3) // Max 3 categories
      .map((s: any) => ({
        category: s.category,
        confidence: s.confidence,
        source: 'ml' as const
      }));

  } catch (error: any) {
    console.error("Error generating ML suggestions:", error.message);
    return [];
  }
}

/**
 * Generate keyword-based category suggestions with improved anti-over-tagging
 */
export function generateKeywordSuggestions(
  title: string,
  abstract: string | null
): SuggestedCategory[] {
  const text = `${title} ${abstract || ''}`.toLowerCase();
  const suggestions: SuggestedCategory[] = [];

  // Enhanced keyword matching with weighted phrases and negative keywords
  const categoryRules = {
    "Chronic Kidney Disease (CKD)": {
      required: ["kidney", "renal", "ckd", "nephro", "dialysis", "egfr"],
      weighted: ["chronic kidney", "renal function", "kidney disease"],
      negative: []
    },
    "Chronic Obstructive Pulmonary Disease (COPD)": {
      required: ["copd", "pulmonary disease", "lung function", "respiratory"],
      weighted: ["chronic obstructive", "copd"],
      negative: []
    },
    "Early Vascular Aging (EVA)": {
      required: ["arterial stiffness", "pulse wave velocity", "pwv", "vascular aging", "augmentation index"],
      weighted: ["arterial stiffness", "pulse wave velocity", "early vascular aging"],
      negative: []
    },
    "Heart Failure": {
      required: ["heart failure", "cardiac failure", "hfpef", "hfref", "ejection fraction"],
      weighted: ["heart failure", "cardiac failure"],
      negative: []
    },
    "Hypertension": {
      required: ["hypertension", "blood pressure", "hypertensive", "antihypertensive"],
      weighted: ["hypertension", "blood pressure"],
      negative: []
    },
    "Longevity": {
      required: ["aging", "longevity", "elderly", "lifespan", "centenarian"],
      weighted: ["longevity", "healthy aging", "lifespan"],
      negative: []
    },
    "Maternal Health": {
      required: ["pregnancy", "pregnant", "maternal", "prenatal", "postnatal", "gestational"],
      weighted: ["pregnancy", "maternal health", "pregnant women"],
      negative: []
    },
    "Men's Health": {
      required: ["men only", "male participants", "prostate", "testosterone"],
      weighted: ["men's health", "male-specific"],
      negative: ["men and women", "both sexes", "mixed gender", "both genders"]
    },
    "Metabolic Health": {
      required: ["diabetes", "metabolic", "glucose", "insulin", "glycemic"],
      weighted: ["metabolic syndrome", "diabetes", "insulin resistance"],
      negative: []
    },
    "Neuroscience": {
      required: ["brain", "cognitive", "neurological", "dementia", "alzheimer", "cerebral"],
      weighted: ["cognitive function", "brain health", "dementia"],
      negative: []
    },
    "Women's Health": {
      required: ["women only", "female participants", "menopause", "estrogen", "postmenopausal women"],
      weighted: ["women's health", "female-specific"],
      negative: ["men and women", "both sexes", "mixed gender", "both genders"]
    }
  };

  for (const [category, rules] of Object.entries(categoryRules)) {
    // Check for negative keywords first
    const hasNegative = rules.negative.some(neg => text.includes(neg));
    if (hasNegative) continue;

    // Count matches
    const requiredMatches = rules.required.filter(kw => text.includes(kw)).length;
    const weightedMatches = rules.weighted.filter(kw => text.includes(kw)).length;

    if (requiredMatches === 0) continue;

    // Calculate confidence based on match strength
    let confidence = 0.6; // Base confidence (raised from 0.5 to ensure valid matches pass merge threshold)
    
    if (weightedMatches > 0) {
      confidence = 0.75; // Higher confidence for weighted matches
    }
    
    if (requiredMatches >= 2) {
      confidence = Math.min(0.9, confidence + 0.15); // Multiple keywords boost confidence
    }

    suggestions.push({
      category,
      confidence,
      source: 'keyword'
    });
  }

  return suggestions
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3); // Max 3 categories
}

/**
 * Merge ML and keyword suggestions, preferring ML when available
 */
export function mergeSuggestions(
  mlSuggestions: SuggestedCategory[],
  keywordSuggestions: SuggestedCategory[]
): SuggestedCategory[] {
  const merged = new Map<string, SuggestedCategory>();

  // Add ML suggestions first (higher priority)
  for (const suggestion of mlSuggestions) {
    merged.set(suggestion.category, suggestion);
  }

  // Add keyword suggestions if not already present
  for (const suggestion of keywordSuggestions) {
    if (!merged.has(suggestion.category)) {
      merged.set(suggestion.category, suggestion);
    }
  }

  // Sort by confidence and limit to top 3
  return Array.from(merged.values())
    .filter(s => s.confidence >= 0.55) // Minimum confidence threshold
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}

/**
 * Generate category suggestions for a publication
 * Uses ML if available, falls back to keywords
 */
export async function generateSuggestionsForPublication(
  title: string,
  abstract: string | null,
  useML: boolean = true
): Promise<SuggestedCategory[]> {
  const mlSuggestions = useML ? await generateMLSuggestions(title, abstract) : [];
  const keywordSuggestions = generateKeywordSuggestions(title, abstract);
  
  return mergeSuggestions(mlSuggestions, keywordSuggestions);
}
