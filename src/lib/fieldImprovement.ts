import { chatComplete } from "./aiClient";
import type { AIModel } from "./aiConfig";

export async function improveProjectField(opts: {
  fieldName: string;
  currentValue: string;
  projectTitle: string;
  context?: string;
  model: AIModel;
  /** What the user wants changed, enhanced, or fixed — steers the rewrite instead of a generic polish. */
  instruction?: string;
}): Promise<string> {
  const { fieldName, currentValue, projectTitle, context, model, instruction } = opts;

  const systemPrompt = `You are a senior creative strategist helping improve project briefs and production documentation for AI image/video generation work. Return ONLY the improved text — no preamble, no explanation, no quotes, no markdown. Preserve the original intent; make it sharper, clearer, and more actionable. If the user gives a specific instruction, prioritize it over general polish.`;

  const contextLine = context?.trim() ? `\nProject context: ${context.trim()}` : "";
  const instructionLine = instruction?.trim() ? `\nUser instruction: ${instruction.trim()}` : "";
  const userMessage = `Project: ${projectTitle}${contextLine}${instructionLine}\n\nImprove this ${fieldName}:\n${currentValue.trim()}`;

  const text = await chatComplete(model, { system: systemPrompt, user: userMessage, maxTokens: 512 });
  return text.trim() || currentValue;
}
