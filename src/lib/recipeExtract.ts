export type RecipeSlotKind = "placeholder" | "parameter";

export interface ExtractedRecipeSlot {
  kind: RecipeSlotKind;
  label: string;
  placeholder: string;
  required: boolean;
  token: string;
  start: number;
  end: number;
  template: string;
  flag?: "--ar" | "--v" | "--sref";
}

const PARAMETER_LABELS: Record<NonNullable<ExtractedRecipeSlot["flag"]>, string> = {
  "--ar": "Aspect Ratio",
  "--v": "Version",
  "--sref": "Style Reference",
};

export function slotKey(slot: Pick<ExtractedRecipeSlot, "label">): string {
  return slot.label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "slot";
}

export function extractSlots(promptText: string): ExtractedRecipeSlot[] {
  const slots: ExtractedRecipeSlot[] = [];

  for (const match of promptText.matchAll(/\[([^\[\]]+)\]/g)) {
    const token = match[0];
    const start = match.index ?? 0;
    if (isParameterValue(promptText, start)) continue;

    const rawLabel = match[1].trim();
    const required = !rawLabel.endsWith("?");
    const label = required ? rawLabel : rawLabel.slice(0, -1).trim();
    slots.push({
      kind: "placeholder",
      label,
      placeholder: label,
      required,
      token,
      start,
      end: start + token.length,
      template: promptText,
    });
  }

  for (const match of promptText.matchAll(/(^|\s)(--ar|--v|--sref)\s+([^\s]+)/g)) {
    const prefix = match[1] ?? "";
    const flag = match[2] as NonNullable<ExtractedRecipeSlot["flag"]>;
    const value = match[3];
    const bracketLabel = parseBracketValue(value);
    const start = (match.index ?? 0) + prefix.length;
    const token = `${flag} ${value}`;
    slots.push({
      kind: "parameter",
      label: bracketLabel?.label ?? PARAMETER_LABELS[flag],
      placeholder: value,
      required: bracketLabel ? bracketLabel.required : flag !== "--sref",
      token,
      start,
      end: start + token.length,
      template: promptText,
      flag,
    });
  }

  return slots.sort((a, b) => a.start - b.start);
}

function isParameterValue(promptText: string, start: number): boolean {
  return /(?:^|\s)(?:--ar|--v|--sref)\s+$/.test(promptText.slice(0, start));
}

function parseBracketValue(value: string): { label: string; required: boolean } | null {
  const match = value.match(/^\[([^\[\]]+)\]$/);
  if (!match) return null;
  const rawLabel = match[1].trim();
  const required = !rawLabel.endsWith("?");
  return {
    label: required ? rawLabel : rawLabel.slice(0, -1).trim(),
    required,
  };
}

export function reconstructPrompt(
  slots: ExtractedRecipeSlot[],
  values: Record<string, string | undefined>
): string {
  if (slots.length === 0) return "";

  const template = slots[0].template;
  let cursor = 0;
  let output = "";

  for (const slot of [...slots].sort((a, b) => a.start - b.start)) {
    output += template.slice(cursor, slot.start);
    const value = (values[slotKey(slot)] ?? "").trim();

    if (value) {
      output += slot.kind === "parameter" && slot.flag ? `${slot.flag} ${value}` : value;
    } else if (slot.required) {
      output += slot.token;
    }

    cursor = slot.end;
  }

  output += template.slice(cursor);
  return cleanupPrompt(output);
}

function cleanupPrompt(prompt: string): string {
  return prompt
    .replace(/\s+,/g, ",")
    .replace(/,\s*,+/g, ",")
    .replace(/,\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
