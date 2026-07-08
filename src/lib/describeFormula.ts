import type { Provider } from "@/types";
import type { DescribeElements } from "@/lib/aiResultParsers";
import { getFormulaForProvider } from "@/lib/promptFormula";

export const FORMULA_STEP_NOT_INFERABLE = "— not inferable from a still image —";

// Maps each provider-formula step label (promptFormula.ts DEFAULT_FORMULAS) to
// the Image Description AI element it's built from. Steps with no entry are
// motion/temporal/audio concepts a single still image can't reveal (Shots,
// Duration, Continuity, …) and render as FORMULA_STEP_NOT_INFERABLE instead
// of asking the vision model to invent them. "Parameters" is handled
// separately from the image's real pixel dimensions, not from `elements`.
const STEP_TO_ELEMENT: Partial<Record<string, keyof DescribeElements>> = {
  "Subject": "subject",
  "Subject description": "subject",
  "Environment": "environment",
  "Scene": "environment",
  "Scene description": "environment",
  "World / Setting": "environment",
  "Place": "environment",
  "Composition": "composition",
  "Light": "light",
  "Material realism": "material_realism",
  "Mood": "mood",
  "Atmosphere": "mood",
  "Color grade / Mood": "mood",
  "Camera language": "camera_language",
  "Style": "style",
  "Image type": "image_type",
  "Intent": "intent",
  "Theme": "intent",
  "Action": "action",
  "Text / Graphics": "text_graphics",
  "References": "references",
  "Consistency": "consistency",
  "Quality tags": "quality_tags",
  "Exclusions": "exclusions",
  "Negative prompt": "exclusions",
  "Moment": "moment",
};

export interface FormulaRow {
  step: string;
  value: string;
}

/**
 * Reformat a reverse-engineered image description into the ordered success
 * formula for `provider` — the same step vocabulary as the prompt builder's
 * Formula panel (promptFormula.ts). Pure/client-side, so switching provider
 * in the builder updates the formula instantly without another vision call.
 */
export function buildFormulaRows(elements: DescribeElements, provider: Provider, aspectRatio?: string): FormulaRow[] {
  return getFormulaForProvider(provider).map((step) => {
    if (step === "Parameters") {
      return { step, value: aspectRatio ? `--ar ${aspectRatio}` : FORMULA_STEP_NOT_INFERABLE };
    }
    const key = STEP_TO_ELEMENT[step];
    const value = key ? elements[key]?.trim() : "";
    return { step, value: value || FORMULA_STEP_NOT_INFERABLE };
  });
}

/** Plain-text rendering of formula rows, ready to paste alongside a prompt. */
export function formatFormulaRows(rows: FormulaRow[]): string {
  return rows.map((row) => `${row.step.toUpperCase()}: ${row.value}`).join("\n");
}
