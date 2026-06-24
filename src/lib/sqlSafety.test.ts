/// <reference types="node" />

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SQL_SOURCE_FILES = [
  "src/lib/references.ts",
  "src/lib/projects.ts",
  "src/lib/deliverables.ts",
  "src/lib/recommendations.ts",
  "src/lib/exportReport.ts",
  "src/lib/assistant.ts",
];

describe("runtime SQL safety", () => {
  it("quotes the reserved references table name in runtime SQL", () => {
    const violations = SQL_SOURCE_FILES.flatMap((file) => {
      const source = readFileSync(resolve(process.cwd(), file), "utf8");
      return [...source.matchAll(/\b(FROM|JOIN|INTO|UPDATE|DELETE FROM)\s+references\b/gi)]
        .map((match) => `${file}:${lineNumber(source, match.index ?? 0)} ${match[0]}`);
    });

    expect(violations).toEqual([]);
  });
});

function lineNumber(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}
