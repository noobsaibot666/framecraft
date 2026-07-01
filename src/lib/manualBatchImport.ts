import type { Provider } from "@/types";
import { analyzeImportedPromptLearning, buildImportLearningNotes } from "./importLearning";
import { importPromptTransfer, type PromptTransferV2 } from "./promptTransfer";

export interface ManualBatchItem {
  title: string;
  prompt_text: string;
  provider?: Provider;
  tags?: string[];
  notes?: string;
}

interface BuildOptions {
  id?: (index: number) => string;
  now?: () => string;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function buildManualPromptTransfer(
  items: ManualBatchItem[],
  options: BuildOptions = {}
): PromptTransferV2 {
  const id = options.id ?? (() => crypto.randomUUID().replace(/-/g, ""));
  const now = options.now ?? (() => new Date().toISOString());
  return {
    kind: "framecraft.prompt-transfer",
    version: 2,
    exported_at: now(),
    prompts: items.map((item, index) => {
      const learned = analyzeImportedPromptLearning(item.prompt_text);
      return {
        source_id: id(index),
        title: item.title,
        provider: item.provider ?? "midjourney",
        prompt_text: item.prompt_text,
        avoidance_text: learned.avoidanceText,
        tags: unique([...(item.tags ?? []), ...learned.tags]),
        notes: [item.notes, buildImportLearningNotes(undefined, learned)].filter(Boolean).join("\n") || undefined,
        rating: 0,
        ai_look_risk: 0,
        reuse_potential: 0,
        is_recipe: false,
        is_winner: false,
        is_failed: false,
      };
    }),
  };
}

export class ManualBatchImportError extends Error {
  readonly imported = 0;
  readonly cause?: unknown;
  constructor(message: string, readonly total: number, cause?: unknown) {
    super(message);
    this.name = "ManualBatchImportError";
    this.cause = cause;
  }
}

export async function runManualBatchImport(
  items: ManualBatchItem[],
  importer: (data: PromptTransferV2) => Promise<number> = importPromptTransfer
): Promise<{ imported: number; total: number }> {
  const transfer = buildManualPromptTransfer(items);
  try {
    const imported = await importer(transfer);
    return { imported, total: items.length };
  } catch (error) {
    throw new ManualBatchImportError(String(error instanceof Error ? error.message : error), items.length, error);
  }
}
