import { fetchProviderJson, requireValidApiKey } from "./aiClient";
import { getApiKey, type AIModel } from "./aiConfig";

export async function improveProjectField(opts: {
  fieldName: string;
  currentValue: string;
  projectTitle: string;
  context?: string;
  model: AIModel;
}): Promise<string> {
  const { fieldName, currentValue, projectTitle, context, model } = opts;
  const apiKey = getApiKey(model.provider);
  requireValidApiKey(model.provider, apiKey);

  const systemPrompt = `You are a senior creative strategist helping improve project briefs and production documentation for AI image/video generation work. Return ONLY the improved text — no preamble, no explanation, no quotes, no markdown. Preserve the original intent; make it sharper, clearer, and more actionable.`;

  const contextLine = context?.trim() ? `\nProject context: ${context.trim()}` : "";
  const userMessage = `Project: ${projectTitle}${contextLine}\n\nImprove this ${fieldName}:\n${currentValue.trim()}`;

  if (model.provider === "anthropic") {
    const response = await fetchProviderJson<{ content: { type: string; text: string }[] }>(
      model.provider,
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: model.id,
          max_tokens: 512,
          system: systemPrompt,
          messages: [{ role: "user", content: userMessage }],
        }),
      }
    );
    return response.content.find((c) => c.type === "text")?.text?.trim() ?? currentValue;
  } else {
    const response = await fetchProviderJson<{ choices: { message: { content: string } }[] }>(
      model.provider,
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: model.id,
          max_tokens: 512,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
        }),
      }
    );
    return response.choices[0]?.message?.content?.trim() ?? currentValue;
  }
}
