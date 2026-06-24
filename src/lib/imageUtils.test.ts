import { describe, expect, it } from "vitest";
import { fileToDataUrl } from "./imageUtils";

describe("fileToDataUrl", () => {
  it("serializes a File into a persistent data URL", async () => {
    const file = new File(["hello"], "result.txt", { type: "text/plain" });

    await expect(fileToDataUrl(file)).resolves.toBe("data:text/plain;base64,aGVsbG8=");
  });
});
