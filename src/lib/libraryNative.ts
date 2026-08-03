import type {
  CopyLibraryPackageResult,
  LibraryMergeReport,
  LibraryValidationResult,
  MigrateAppDataResult,
} from "./libraryPackage";
import type { CreateLibraryPackageResult } from "./libraryPackage";

export async function createLibraryPackageNative(baseDir: string): Promise<CreateLibraryPackageResult> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<CreateLibraryPackageResult>("create_library_package_native", { baseDir });
}

export async function validateLibraryPackageNative(baseDir: string): Promise<LibraryValidationResult> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<LibraryValidationResult>("validate_library_package_native", { baseDir });
}

export async function inspectLibraryPackageNative(baseDir: string): Promise<LibraryValidationResult> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<LibraryValidationResult>("inspect_library_package_native", { baseDir });
}

export async function repairLibraryDatabaseSchemaNative(baseDir: string): Promise<LibraryValidationResult> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<LibraryValidationResult>("repair_library_database_schema_native", { baseDir });
}

export async function migrateAppDataToLibraryNative(input: {
  sourceBaseDir: string;
  targetBaseDir: string;
}): Promise<MigrateAppDataResult> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<MigrateAppDataResult>("migrate_app_data_to_library_native", input);
}

export async function copyLibraryPackageNative(input: {
  sourceBaseDir: string;
  targetBaseDir: string;
}): Promise<CopyLibraryPackageResult> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<CopyLibraryPackageResult>("copy_library_package_native", input);
}

export async function backupLibraryPackageNative(input: {
  sourceBaseDir: string;
}): Promise<CopyLibraryPackageResult> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<CopyLibraryPackageResult>("backup_library_package_native", input);
}

export async function mergeLibraryPackageNative(input: {
  sourceBaseDir: string;
  targetBaseDir: string;
}): Promise<LibraryMergeReport> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<LibraryMergeReport>("merge_library_package_native", input);
}

// Mac App Store build only (see src-tauri/src/library_bookmark.rs) — a
// security-scoped bookmark for a "portable" library folder so the sandbox
// grants access again on a later launch without a fresh folder-picker
// prompt. Both resolve to a no-op empty string on the direct-dist build
// and on non-macOS, so callers don't need to special-case the platform.
export async function createLibraryBookmarkNative(path: string): Promise<string> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("create_library_bookmark", { path });
}

export async function activateLibraryBookmarkNative(bookmark: string): Promise<string> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("activate_library_bookmark", { bookmark });
}
