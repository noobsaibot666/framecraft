/// <reference types="node" />

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("page hook dependencies", () => {
  it("tracks the prompt ID in CraftPrompt duplicate detection", () => {
    const source = readSource("src/pages/CraftPrompt.tsx");

    expect(source).toContain(
      "}, [deferredAssembled, allPrompts.length, id, dismissedDuplicateIds]);"
    );
    expect(source).not.toContain(
      "// eslint-disable-next-line react-hooks/exhaustive-deps\n" +
      "  }, [deferredAssembled, allPrompts.length, id, dismissedDuplicateIds]);"
    );
  });

  it("memoizes CampaignDetail load and tracks it in the effect", () => {
    const source = readSource("src/pages/CampaignDetail.tsx");

    expect(source).toContain("const load = useCallback(async (cid: string) => {");
    expect(source).toContain(
      "useEffect(() => {\n" +
      "    if (id) load(id);\n" +
      "    return () => { loadGuard.current.invalidate(); };\n" +
      "  }, [id, load]);"
    );
  });
});
