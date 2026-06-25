import { deleteReferenceFiles, readImageAsDataUrl, saveReferenceImage } from "./fileStore";
import { getFramecraftDb } from "./dbConnection";
import { getActiveSharedIngestStatus, getLibrarySettingsState } from "./librarySettings";

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
  validateActiveLibrary: () => Promise<string>;
  validateSharedLibrary: () => Promise<string>;
}

export function validateRequiredTables(tables: readonly string[]): { ok: boolean; missing: string[] } {
  const set = new Set(tables);
  const missing = REQUIRED_RELEASE_TABLES.filter((table) => !set.has(table));
  return { ok: missing.length === 0, missing };
}

async function listSqliteTables(): Promise<string[]> {
  const db = await getFramecraftDb();
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

async function validateActiveLibraryPackage(): Promise<string> {
  const state = await getLibrarySettingsState();
  if (!state.validation) return "Using local app-data library.";
  if (!state.validation.ok) throw new Error(state.validation.errors.join(", "));
  return "Active portable library package is valid.";
}

async function validateSharedLibraryStructure(): Promise<string> {
  const state = await getLibrarySettingsState();
  if (state.selection.mode !== "portable") return "Using local app-data library.";
  if (state.validation && !state.validation.ok) throw new Error(state.validation.errors.join(", "));
  const status = await getActiveSharedIngestStatus();
  return `Shared folders ready. Pending ${status?.pending ?? 0}, failed ${status?.failed ?? 0}.`;
}

const defaultDeps: ReleaseDiagnosticDeps = {
  isTauri: isTauriRuntime,
  listTables: listSqliteTables,
  testFileStore: testReferenceFileStore,
  testDialogPlugin: testDialogPluginImport,
  validateActiveLibrary: validateActiveLibraryPackage,
  validateSharedLibrary: validateSharedLibraryStructure,
};

async function check(label: string, id: string, fn: () => Promise<string>): Promise<DiagnosticCheck> {
  try {
    return { id, label, status: "pass", message: await fn() };
  } catch (error) {
    return { id, label, status: "fail", message: formatDiagnosticError(error) };
  }
}

function formatDiagnosticError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Diagnostic failed.";
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

  checks.push(await check("Active library", "active-library", deps.validateActiveLibrary));

  checks.push(await check("Shared library", "shared-library", deps.validateSharedLibrary));

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
