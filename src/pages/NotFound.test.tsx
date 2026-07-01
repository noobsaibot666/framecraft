import { describe, expect, it } from "vitest";
import * as module from "./NotFound";

// DOM renderer not available in this test suite — test module contract only.

describe("NotFound module", () => {
  it("exports a NotFound function", () => {
    expect(typeof module.NotFound).toBe("function");
  });

  it("NotFound component has a display name or is named", () => {
    expect(module.NotFound.name).toBe("NotFound");
  });
});
