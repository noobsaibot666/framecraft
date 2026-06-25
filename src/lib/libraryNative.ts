import type {
  CopyLibraryPackageResult,
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

export async function migrateAppDataToLibraryNative(input: {
  sourceBaseDir: string;
  targetBaseDir: string;
  resultFiles: string[];
  referenceFiles: string[];
}): Promise<MigrateAppDataResult> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<MigrateAppDataResult>("migrate_app_data_to_library_native", input);
}

export async function copyLibraryPackageNative(input: {
  sourceBaseDir: string;
  targetBaseDir: string;
  resultFiles: string[];
  referenceFiles: string[];
}): Promise<CopyLibraryPackageResult> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<CopyLibraryPackageResult>("copy_library_package_native", input);
}

export async function backupLibraryPackageNative(input: {
  sourceBaseDir: string;
  resultFiles: string[];
  referenceFiles: string[];
}): Promise<CopyLibraryPackageResult> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<CopyLibraryPackageResult>("backup_library_package_native", input);
}
