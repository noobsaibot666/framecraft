import { describe, it, expect } from "vitest";
import { databaseError, isSchemaMigrationError } from "./dbErrors";

describe("databaseError", () => {
  it("formats Error instances with operation prefix", () => {
    const e = databaseError("getReferences", new Error("disk full"));
    expect(e.message).toBe("getReferences: Error: disk full");
  });

  it("formats string errors with operation prefix", () => {
    const e = databaseError("createRecord", "UNIQUE constraint failed");
    expect(e.message).toBe("createRecord: UNIQUE constraint failed");
  });

  it("formats object errors", () => {
    const e = databaseError("deleteRow", { code: 14, message: "unable to open database" });
    expect(e.message).toContain("deleteRow:");
  });

  it("returns an Error instance", () => {
    expect(databaseError("op", "fail")).toBeInstanceOf(Error);
  });
});

describe("isSchemaMigrationError", () => {
  it("matches missing column messages", () => {
    expect(isSchemaMigrationError("table projects has no column named campaign_id")).toBe(true);
    expect(isSchemaMigrationError("no such column: campaign_id")).toBe(true);
  });

  it("matches missing table messages", () => {
    expect(isSchemaMigrationError("no such table: creative_directions")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isSchemaMigrationError("No Such Table: foo")).toBe(true);
    expect(isSchemaMigrationError("Table x Has No Column Named y")).toBe(true);
  });

  it("does not match unrelated DB errors", () => {
    expect(isSchemaMigrationError("UNIQUE constraint failed")).toBe(false);
    expect(isSchemaMigrationError("disk I/O error")).toBe(false);
    expect(isSchemaMigrationError(new Error("permission denied"))).toBe(false);
  });
});
