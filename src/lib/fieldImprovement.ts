import { chatComplete } from "./aiClient";
import type { AIModel } from "./aiConfig";

export async function improveProjectField(opts: {
  fieldName: string;
  currentValue: string;
  projectTitle: string;
  context?: string;
  model: AIModel;
}): Promise<string> {
  const { fieldName, currentValue, projectTitle, context, model } = opts;

  const systemPrompt = `You are a senior creative strategist helping improve project briefs and production documentation for AI image/video generation work. Return ONLY the improved text — no preamble, no explanation, no quotes, no markdown. Preserve the original intent; make it sharper, clearer, and more actionable.`;

  const contextLine = context?.trim() ? `\nProject context: ${context.trim()}` : "";
  const userMessage = `Project: ${projectTitle}${contextLine}\n\nImprove this ${fieldName}:\n${currentValue.trim()}`;

  const text = await chatComplete(model, { system: systemPrompt, user: userMessage, maxTokens: 512 });
  return text.trim() || currentValue;
}
