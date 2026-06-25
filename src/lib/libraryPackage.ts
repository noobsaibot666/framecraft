import {
  buildLibraryMetadata,
  normalizeDir,
  resolveLibraryPaths,
  type LibraryPaths,
} from "./libraryConfig";

export interface LibraryFileSystem {
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
  writeTextFile(path: string, contents: string): Promise<void>;
  readTextFile(path: string): Promise<string>;
  copyFile(from: string, to: string): Promise<void>;
}

export interface LibraryValidationResult {
  ok: boolean;
  errors: string[];
}

export interface CreateLibraryPackageResult {
  paths: LibraryPaths;
}

export interface CreateLibraryPackageOptions {
  createEmptyDb?: boolean;
}

export interface MigrateAppDataInput {
  sourceBaseDir: string;
  targetBaseDir: string;
  resultFiles: string[];
  referenceFiles: string[];
  fs: LibraryFileSystem;
  createdAt?: string;
}

export interface MigrateAppDataResult {
  paths: LibraryPaths;
  copiedFiles: string[];
}

export interface CopyLibraryPackageInput {
  sourceBaseDir: string;
  targetBaseDir: string;
  resultFiles: string[];
  referenceFiles: string[];
  fs: LibraryFileSystem;
}

export interface CopyLibraryPackageResult {
  paths: LibraryPaths;
  copiedFiles: string[];
  validation: LibraryValidationResult;
}

export interface BackupLibraryPackageInput {
  sourceBaseDir: string;
  resultFiles: string[];
  referenceFiles: string[];
  fs: LibraryFileSystem;
  createdAt?: string;
}

export interface PortableMediaPathRewrite {
  table: "results" | "references";
  column: "file_path" | "thumbnail_path" | "file_data" | "thumbnail_data";
  sourcePrefix: string;
  targetPrefix: string;
}

export async function createLibraryPackage(
  baseDir: string,
  fs: LibraryFileSystem,
  createdAt?: string,
  options: CreateLibraryPackageOptions = {}
): Promise<CreateLibraryPackageResult> {
  const paths = resolveLibraryPaths(baseDir);
  await fs.mkdir(paths.baseDir);
  await fs.mkdir(paths.resultsDir);
  await fs.mkdir(paths.referencesDir);
  await fs.mkdir(paths.backupsDir);
  await fs.mkdir(paths.locksDir);
  await fs.mkdir(paths.inboxDir);
  await fs.mkdir(paths.stagingDir);
  await fs.mkdir(paths.syncDir);
  await fs.mkdir(paths.appliedDir);
  await fs.mkdir(paths.failedDir);
  await fs.writeTextFile(`${paths.baseDir}library.json`, JSON.stringify(buildLibraryMetadata(createdAt), null, 2));
  if (options.createEmptyDb !== false && !(await fs.exists(paths.dbPath))) await fs.writeTextFile(paths.dbPath, "");
  return { paths };
}

export async function validateLibraryPackage(
  baseDir: string,
  fs: LibraryFileSystem
): Promise<LibraryValidationResult> {
  const paths = resolveLibraryPaths(baseDir);
  const errors: string[] = [];
  const metadataPath = `${paths.baseDir}library.json`;

  if (!(await fs.exists(metadataPath))) errors.push("Missing library.json");
  if (!(await fs.exists(paths.dbPath))) errors.push("Missing framecraft.db");
  if (!(await fs.exists(paths.resultsDir))) errors.push("Missing results directory");
  if (!(await fs.exists(paths.referencesDir))) errors.push("Missing references directory");
  if (!(await fs.exists(paths.locksDir))) errors.push("Missing locks directory");
  if (!(await fs.exists(paths.inboxDir))) errors.push("Missing inbox directory");
  if (!(await fs.exists(paths.stagingDir))) errors.push("Missing staging directory");
  if (!(await fs.exists(paths.appliedDir))) errors.push("Missing sync applied directory");
  if (!(await fs.exists(paths.failedDir))) errors.push("Missing sync failed directory");

  if (await fs.exists(metadataPath)) {
    try {
      const raw = await fs.readTextFile(metadataPath);
      const metadata = JSON.parse(raw) as Record<string, unknown>;
      if (
        metadata.format_version !== 1 ||
        metadata.db_filename !== "framecraft.db" ||
        metadata.results_dir !== "results" ||
        metadata.references_dir !== "references"
      ) {
        errors.push("Invalid library metadata");
      }
    } catch {
      errors.push("Invalid library metadata");
    }
  }

  return { ok: errors.length === 0, errors };
}

export async function migrateAppDataToLibrary(input: MigrateAppDataInput): Promise<MigrateAppDataResult> {
  const source = resolveLibraryPaths(input.sourceBaseDir);
  const target = (await createLibraryPackage(input.targetBaseDir, input.fs, input.createdAt, { createEmptyDb: false })).paths;
  const copiedFiles: string[] = [];

  await input.fs.copyFile(source.dbPath, target.dbPath);
  copiedFiles.push(target.dbPath);

  for (const filename of input.resultFiles) {
    assertSafeRelativeMediaPath(filename);
    const from = `${source.resultsDir}${filename}`;
    const to = `${target.resultsDir}${filename}`;
    await ensureParentDirs(target.resultsDir, filename, input.fs);
    await input.fs.copyFile(from, to);
    copiedFiles.push(to);
  }

  for (const filename of input.referenceFiles) {
    assertSafeRelativeMediaPath(filename);
    const from = `${source.referencesDir}${filename}`;
    const to = `${target.referencesDir}${filename}`;
    await ensureParentDirs(target.referencesDir, filename, input.fs);
    await input.fs.copyFile(from, to);
    copiedFiles.push(to);
  }

  return { paths: target, copiedFiles };
}

export async function copyLibraryPackage(input: CopyLibraryPackageInput): Promise<CopyLibraryPackageResult> {
  const source = resolveLibraryPaths(input.sourceBaseDir);
  const target = resolveLibraryPaths(input.targetBaseDir);
  const copiedFiles: string[] = [];

  await input.fs.mkdir(target.baseDir);
  await input.fs.mkdir(target.resultsDir);
  await input.fs.mkdir(target.referencesDir);
  await input.fs.mkdir(target.backupsDir);
  await input.fs.mkdir(target.locksDir);
  await input.fs.mkdir(target.inboxDir);
  await input.fs.mkdir(target.stagingDir);
  await input.fs.mkdir(target.syncDir);
  await input.fs.mkdir(target.appliedDir);
  await input.fs.mkdir(target.failedDir);

  await input.fs.copyFile(`${source.baseDir}library.json`, `${target.baseDir}library.json`);
  copiedFiles.push(`${target.baseDir}library.json`);
  await input.fs.copyFile(source.dbPath, target.dbPath);
  copiedFiles.push(target.dbPath);

  await copyMediaFiles(input.resultFiles, source.resultsDir, target.resultsDir, input.fs, copiedFiles);
  await copyMediaFiles(input.referenceFiles, source.referencesDir, target.referencesDir, input.fs, copiedFiles);

  const validation = await validateLibraryPackage(target.baseDir, input.fs);
  if (!validation.ok) throw new Error(`Invalid library copy: ${validation.errors.join(", ")}`);

  return { paths: target, copiedFiles, validation };
}

export async function backupLibraryPackage(input: BackupLibraryPackageInput): Promise<CopyLibraryPackageResult> {
  const source = resolveLibraryPaths(input.sourceBaseDir);
  const stamp = safeTimestamp(input.createdAt ?? new Date().toISOString());
  return copyLibraryPackage({
    sourceBaseDir: input.sourceBaseDir,
    targetBaseDir: `${source.backupsDir}framecraft-backup-${stamp}.framecraftlib`,
    resultFiles: input.resultFiles,
    referenceFiles: input.referenceFiles,
    fs: input.fs,
  });
}

export function listRelativeMediaFilenames(paths: string[], baseDir: string): string[] {
  const base = normalizeDir(baseDir);
  return paths
    .filter((path) => path.startsWith(base))
    .map((path) => path.slice(base.length))
    .filter(Boolean);
}

export function buildPortableMediaPathRewrites(input: {
  sourceBaseDir: string;
  targetBaseDir: string;
}): PortableMediaPathRewrite[] {
  const source = resolveLibraryPaths(input.sourceBaseDir);
  const target = resolveLibraryPaths(input.targetBaseDir);
  return [
    {
      table: "results",
      column: "file_path",
      sourcePrefix: source.resultsDir,
      targetPrefix: target.resultsDir,
    },
    {
      table: "results",
      column: "thumbnail_path",
      sourcePrefix: source.resultsDir,
      targetPrefix: target.resultsDir,
    },
    {
      table: "references",
      column: "file_data",
      sourcePrefix: source.referencesDir,
      targetPrefix: target.referencesDir,
    },
    {
      table: "references",
      column: "thumbnail_data",
      sourcePrefix: source.referencesDir,
      targetPrefix: target.referencesDir,
    },
  ];
}

function assertSafeRelativeMediaPath(path: string): void {
  const parts = path.split("/");
  if (
    path.startsWith("/") ||
    path.includes("\\") ||
    parts.some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new Error(`Unsafe library media path: ${path}`);
  }
}

async function copyMediaFiles(
  filenames: string[],
  sourceDir: string,
  targetDir: string,
  fs: LibraryFileSystem,
  copiedFiles: string[]
): Promise<void> {
  for (const filename of filenames) {
    assertSafeRelativeMediaPath(filename);
    const to = `${targetDir}${filename}`;
    await ensureParentDirs(targetDir, filename, fs);
    await fs.copyFile(`${sourceDir}${filename}`, to);
    copiedFiles.push(to);
  }
}

async function ensureParentDirs(baseDir: string, relativePath: string, fs: LibraryFileSystem): Promise<void> {
  const parts = relativePath.split("/").slice(0, -1);
  let cursor = baseDir;
  for (const part of parts) {
    cursor = `${cursor}${part}/`;
    await fs.mkdir(cursor);
  }
}

function safeTimestamp(value: string): string {
  return value.replace(/[:.]/g, "-");
}
