import { describe, expect, it, vi } from "vitest";
import { executeAtomically, type AtomicStatement } from "./dbTransaction";

describe("executeAtomically", () => {
  const statements: AtomicStatement[] = [
    { operation: "execute", sql: "INSERT INTO notes(value) VALUES ($1)", bindValues: ["it's safe"] },
    { operation: "execute", sql: "UPDATE notes SET active = $1 WHERE value = $2", bindValues: [true, "it's safe"] },
  ];

  it("uses the native parameterized transaction API when available", async () => {
    const executeTransaction = vi.fn().mockResolvedValue([{ rowsAffected: 1 }, { rowsAffected: 1 }]);
    const result = await executeAtomically({ executeTransaction }, statements);
    expect(executeTransaction).toHaveBeenCalledWith(statements);
    expect(result).toEqual([{ rowsAffected: 1 }, { rowsAffected: 1 }]);
  });

  it.each([NaN, Infinity, {}, [], undefined, new Uint8Array([1]), () => 1])(
    "rejects invalid native bind value %j before calling the database",
    async (value) => {
      const executeTransaction = vi.fn();
      await expect(executeAtomically(
        { executeTransaction },
        [{ operation: "execute", sql: "INSERT INTO notes(value) VALUES ($1)", bindValues: [value] }]
      )).rejects.toThrow(/unsupported|finite/i);
      expect(executeTransaction).not.toHaveBeenCalled();
    }
  );

  it("fails clearly when the native transaction capability is missing", async () => {
    await expect(executeAtomically({}, statements)).rejects.toThrow(/native executeTransaction capability/i);
  });
});
