import { deleteReferenceFiles, readImageAsDataUrl, saveReferenceImage } from "./fileStore";

const isTauriRuntime = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const REQUIRED_RELEASE_TABLES = [
  "prompts",
  "results",
  "references",
  "recipes",
  "projects",
  "project_references",
  "project_results",
  "project_deliverables",
  "assistant_threads",
  "assistant_messages",
  "generation_queue",
] as const;

export type DiagnosticStatus = "pass" | "fail" | "skip";

export interface DiagnosticCheck {
  id: string;
  label: string;
  status: DiagnosticStatus;
  message: string;
}

export interface DiagnosticResult {
  generatedAt: string;
  checks: DiagnosticCheck[];
}

export interface ReleaseDiagnosticDeps {
  isTauri: () => boolean;
  listTables: () => Promise<readonly string[]>;
  testFileStore: () => Promise<void>;
  testDialogPlugin: () => Promise<void>;
}

export function validateRequiredTables(tables: readonly string[]): { ok: boolean; missing: string[] } {
  const set = new Set(tables);
  const missing = REQUIRED_RELEASE_TABLES.filter((table) => !set.has(table));
  return { ok: missing.length === 0, missing };
}

async function listSqliteTables(): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SqlPlugin: any = await import("@tauri-apps/plugin-sql");
  const db = await SqlPlugin.default.load("sqlite:framecraft.db");
  const rows = await db.select("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name") as { name: string }[];
  return rows.map((row) => row.name);
}

async function testReferenceFileStore(): Promise<void> {
  const id = `diagnostic_${Date.now()}`;
  const pixel = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
  const saved = await saveReferenceImage(id, pixel);
  const dataUrl = await readImageAsDataUrl(saved.filePath);
  if (!dataUrl.startsWith("data:image/")) throw new Error("Saved image could not be read back.");
  await deleteReferenceFiles(id);
}

async function testDialogPluginImport(): Promise<void> {
  await import("@tauri-apps/plugin-dialog");
}

const defaultDeps: ReleaseDiagnosticDeps = {
  isTauri: isTauriRuntime,
  listTables: listSqliteTables,
  testFileStore: testReferenceFileStore,
  testDialogPlugin: testDialogPluginImport,
};

async function check(label: string, id: string, fn: () => Promise<string>): Promise<DiagnosticCheck> {
  try {
    return { id, label, status: "pass", message: await fn() };
  } catch (error) {
    return { id, label, status: "fail", message: error instanceof Error ? error.message : "Diagnostic failed." };
  }
}

export async function runReleaseDiagnostics(deps: ReleaseDiagnosticDeps = defaultDeps): Promise<DiagnosticResult> {
  const checks: DiagnosticCheck[] = [];
  const tauri = deps.isTauri();
  checks.push({
    id: "tauri-runtime",
    label: "Tauri runtime",
    status: tauri ? "pass" : "skip",
    message: tauri ? "Running in packaged/native runtime." : "Browser/dev runtime; native plugin checks skipped.",
  });

  if (!tauri) {
    return { generatedAt: new Date().toISOString(), checks };
  }

  checks.push(await check("SQLite schema", "sqlite-schema", async () => {
    const result = validateRequiredTables(await deps.listTables());
    if (!result.ok) throw new Error(`Missing tables: ${result.missing.join(", ")}`);
    return "Required release tables are present.";
  }));

  checks.push(await check("File store", "file-store", async () => {
    await deps.testFileStore();
    return "Reference file write/read/delete succeeded.";
  }));

  checks.push(await check("Dialog plugin", "dialog-plugin", async () => {
    await deps.testDialogPlugin();
    return "Native dialog plugin is importable.";
  }));

  return { generatedAt: new Date().toISOString(), checks };
}

export function formatDiagnosticSummary(result: DiagnosticResult): string {
  const passed = result.checks.filter((check) => check.status === "pass").length;
  const failed = result.checks.filter((check) => check.status === "fail").length;
  const skipped = result.checks.filter((check) => check.status === "skip").length;
  return [
    `${passed} passed`,
    failed ? `${failed} failed` : "",
    skipped ? `${skipped} skipped` : "",
  ].filter(Boolean).join(", ");
}
