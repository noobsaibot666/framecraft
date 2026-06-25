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

export async function createLibraryPackage(
  baseDir: string,
  fs: LibraryFileSystem,
  createdAt?: string
): Promise<CreateLibraryPackageResult> {
  const paths = resolveLibraryPaths(baseDir);
  await fs.mkdir(paths.baseDir);
  await fs.mkdir(paths.resultsDir);
  await fs.mkdir(paths.referencesDir);
  await fs.mkdir(paths.backupsDir);
  await fs.mkdir(paths.locksDir);
  await fs.writeTextFile(`${paths.baseDir}library.json`, JSON.stringify(buildLibraryMetadata(createdAt), null, 2));
  if (!(await fs.exists(paths.dbPath))) await fs.writeTextFile(paths.dbPath, "");
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
  const target = (await createLibraryPackage(input.targetBaseDir, input.fs, input.createdAt)).paths;
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

export function listRelativeMediaFilenames(paths: string[], baseDir: string): string[] {
  const base = normalizeDir(baseDir);
  return paths
    .filter((path) => path.startsWith(base))
    .map((path) => path.slice(base.length))
    .filter(Boolean);
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

async function ensureParentDirs(baseDir: string, relativePath: string, fs: LibraryFileSystem): Promise<void> {
  const parts = relativePath.split("/").slice(0, -1);
  let cursor = baseDir;
  for (const part of parts) {
    cursor = `${cursor}${part}/`;
    await fs.mkdir(cursor);
  }
}
