import { describe, it, expect } from "vitest";
import { parseNanoBananaJson, stripCodeFence } from "./nanoBananaImport";

describe("stripCodeFence", () => {
  it("strips a ```json fenced block", () => {
    expect(stripCodeFence('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("strips a bare ``` fenced block", () => {
    expect(stripCodeFence('```\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("leaves unfenced JSON untouched", () => {
    expect(stripCodeFence('{"a":1}')).toBe('{"a":1}');
  });
});

describe("parseNanoBananaJson", () => {
  it("fails with a clear message on invalid JSON, not silently", () => {
    const result = parseNanoBananaJson("{not valid json");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Couldn't parse this as JSON");
  });

  it("fails with a clear message on empty input", () => {
    const result = parseNanoBananaJson("   ");
    expect(result.ok).toBe(false);
  });

  it("parses JSON wrapped in a markdown code fence (the common AI-chat paste case)", () => {
    const result = parseNanoBananaJson('```json\n{"prompt": "a bottle of perfume"}\n```');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.promptText).toBe("a bottle of perfume");
  });

  it("extracts from the flat/simple shape shown in the placeholder", () => {
    const result = parseNanoBananaJson(JSON.stringify({ prompt: "your prompt here", aspect_ratio: "1:1", model: "nano-banana-v1" }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.promptText).toBe("your prompt here");
      expect(result.data.aspectRatio).toBe("1:1");
    }
  });

  it("extracts from Framecraft's own deeply-nested export shape", () => {
    const exported = {
      model: "gemini-2.5-flash-image",
      priority: { primary: "macro shot of a watch face", secondary: "studio, side light" },
      subject: { main: "a luxury watch", attributes: { physical: "brushed steel" } },
      environment: { setting: "macro photography studio", lighting: { type: "artificial", direction: "side and slightly top" } },
      style: { camera: { angle: "extreme close-up", lens: "macro" }, mood: "clean, intimate, clinical realism" },
      technical: { aspect_ratio: "9:16" },
      constraints: { exclusions: ["text", "logos", "watermarks"] },
    };
    const result = parseNanoBananaJson(JSON.stringify(exported));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.promptText).toBe("macro shot of a watch face");
      expect(result.data.aspectRatio).toBe("9:16");
      expect(result.data.camera).toBe("extreme close-up");
      expect(result.data.lens).toBe("macro");
      expect(result.data.lighting).toBe("side and slightly top");
      expect(result.data.mood).toBe("clean, intimate, clinical realism");
      expect(result.data.avoidance).toBe("text, logos, watermarks");
    }
  });

  it("falls back to subject.main + environment.setting when no direct prompt field exists", () => {
    const result = parseNanoBananaJson(JSON.stringify({ subject: { main: "a red sports car" }, environment: { setting: "a rain-slicked street" } }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.promptText).toBe("a red sports car in a rain-slicked street");
  });

  it("falls back to subject.description when subject.main is absent", () => {
    const result = parseNanoBananaJson(JSON.stringify({ subject: { description: "a weathered leather satchel" } }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.promptText).toBe("a weathered leather satchel");
  });

  it("accepts a flat exclusions string as avoidance", () => {
    const result = parseNanoBananaJson(JSON.stringify({ prompt: "a lamp", exclusions: "no text, no watermark" }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.avoidance).toBe("no text, no watermark");
  });

  it("accepts flat top-level camera/lens/lighting/mood keys, not just the nested style.camera shape", () => {
    const result = parseNanoBananaJson(JSON.stringify({ prompt: "a chair", camera: "low angle", lens: "35mm", lighting: "backlit", mood: "moody" }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.camera).toBe("low angle");
      expect(result.data.lens).toBe("35mm");
      expect(result.data.lighting).toBe("backlit");
      expect(result.data.mood).toBe("moody");
    }
  });

  it("fails with a clear message when no recognizable prompt field is present", () => {
    const result = parseNanoBananaJson(JSON.stringify({ model: "nano-banana-v1", aspect_ratio: "1:1" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("No prompt text found");
  });

  it("does not leak a stringified lighting object when environment.lighting has no .direction", () => {
    const result = parseNanoBananaJson(JSON.stringify({ prompt: "a lamp", environment: { lighting: { type: "artificial" } } }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.lighting).toBeUndefined();
  });
});
