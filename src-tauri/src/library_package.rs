use crate::portable_sqlite::open_portable_database;
use rusqlite::{
    backup::Backup,
    params_from_iter,
    types::{Value, ValueRef},
    Connection, OpenFlags, OptionalExtension,
};
use serde::Serialize;
use std::{
    collections::{BTreeMap, HashMap, HashSet},
    fs,
    path::{Component, Path, PathBuf},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryPathsDto {
    base_dir: String,
    db_path: String,
    results_dir: String,
    references_dir: String,
    backups_dir: String,
    locks_dir: String,
    inbox_dir: String,
    staging_dir: String,
    sync_dir: String,
    applied_dir: String,
    failed_dir: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateLibraryPackageResult {
    paths: LibraryPathsDto,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryValidationResult {
    ok: bool,
    errors: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrateAppDataResult {
    paths: LibraryPathsDto,
    copied_files: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CopyLibraryPackageResult {
    paths: LibraryPathsDto,
    copied_files: Vec<String>,
    validation: LibraryValidationResult,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryMergeReport {
    source_base_dir: String,
    target_base_dir: String,
    prompts: MergeTableReport,
    results: MergeTableReport,
    references: MergeTableReport,
    tables: BTreeMap<String, MergeTableReport>,
    manifest_version: u8,
    id_remaps: Vec<MergeIdRemap>,
    errors: Vec<String>,
}

#[derive(Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MergeTableReport {
    imported: u32,
    skipped_duplicates: u32,
    excluded: u32,
    remapped: u32,
    failed: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MergeIdRemap {
    table: String,
    source_id: String,
    target_id: String,
    reason: String,
}

#[derive(Serialize)]
struct LibraryMetadata {
    format_version: u8,
    created_at: String,
    db_filename: &'static str,
    results_dir: &'static str,
    references_dir: &'static str,
}

#[tauri::command(rename_all = "camelCase")]
pub fn create_library_package_native(
    base_dir: String,
) -> Result<CreateLibraryPackageResult, String> {
    create_library_package(&base_dir, true).map(|paths| CreateLibraryPackageResult { paths })
}

#[tauri::command(rename_all = "camelCase")]
pub fn validate_library_package_native(
    base_dir: String,
) -> Result<LibraryValidationResult, String> {
    Ok(validate_library_package(&base_dir))
}

#[tauri::command(rename_all = "camelCase")]
pub fn inspect_library_package_native(base_dir: String) -> Result<LibraryValidationResult, String> {
    Ok(inspect_library_package(&base_dir))
}

#[tauri::command(rename_all = "camelCase")]
pub fn repair_library_database_schema_native(
    base_dir: String,
) -> Result<LibraryValidationResult, String> {
    repair_library_database_schema(&base_dir)
}

#[tauri::command(rename_all = "camelCase")]
pub fn migrate_app_data_to_library_native(
    source_base_dir: String,
    target_base_dir: String,
) -> Result<MigrateAppDataResult, String> {
    let (target, copied_files, _) =
        publish_library_snapshot(&source_base_dir, &target_base_dir, SnapshotMetadata::Create)?;

    Ok(MigrateAppDataResult {
        paths: target,
        copied_files,
    })
}

#[tauri::command(rename_all = "camelCase")]
pub fn copy_library_package_native(
    source_base_dir: String,
    target_base_dir: String,
) -> Result<CopyLibraryPackageResult, String> {
    copy_library_package(&source_base_dir, &target_base_dir)
}

#[tauri::command(rename_all = "camelCase")]
pub fn backup_library_package_native(
    source_base_dir: String,
) -> Result<CopyLibraryPackageResult, String> {
    let source = resolve_library_paths(&source_base_dir);
    let target = format!(
        "{}framecraft-backup-{}.framecraftlib",
        source.backups_dir,
        timestamp_slug()
    );
    copy_library_package(&source_base_dir, &target)
}

#[tauri::command(rename_all = "camelCase")]
pub fn merge_library_package_native(
    source_base_dir: String,
    target_base_dir: String,
) -> Result<LibraryMergeReport, String> {
    merge_library_package(&source_base_dir, &target_base_dir)
}

fn copy_library_package(
    source_base_dir: &str,
    target_base_dir: &str,
) -> Result<CopyLibraryPackageResult, String> {
    let (target, copied_files, validation) =
        publish_library_snapshot(source_base_dir, target_base_dir, SnapshotMetadata::Copy)?;

    Ok(CopyLibraryPackageResult {
        paths: target,
        copied_files,
        validation,
    })
}

#[derive(Clone, Copy)]
enum SnapshotMetadata {
    Copy,
    Create,
}

type BeforePublishHook = dyn Fn(&Path, &Path) -> Result<(), String>;

fn publish_library_snapshot(
    source_base_dir: &str,
    target_base_dir: &str,
    metadata_mode: SnapshotMetadata,
) -> Result<(LibraryPathsDto, Vec<String>, LibraryValidationResult), String> {
    publish_library_snapshot_with_hooks(
        source_base_dir,
        target_base_dir,
        metadata_mode,
        None,
        &cleanup_staging_directory,
    )
}

fn publish_library_snapshot_with_hooks(
    source_base_dir: &str,
    target_base_dir: &str,
    metadata_mode: SnapshotMetadata,
    before_publish: Option<&BeforePublishHook>,
    cleanup: &dyn Fn(&Path) -> std::io::Result<()>,
) -> Result<(LibraryPathsDto, Vec<String>, LibraryValidationResult), String> {
    let source = resolve_library_paths(source_base_dir);
    let published = resolve_library_paths(target_base_dir);
    let target_path = PathBuf::from(target_base_dir);
    if path_is_occupied(&target_path)? {
        return Err(format!(
            "Library destination already exists: {}",
            target_path.display()
        ));
    }
    let parent = target_path.parent().ok_or_else(|| {
        format!(
            "Library destination has no parent directory: {}",
            target_path.display()
        )
    })?;
    fs::create_dir_all(parent).map_err(format_io_error)?;
    let staging_path = reserve_staging_sibling(parent)?;

    let build_result = (|| {
        let staging = resolve_library_paths(staging_path.to_str().ok_or_else(|| {
            format!(
                "Library staging path is not valid UTF-8: {}",
                staging_path.display()
            )
        })?);
        create_package_dirs(&staging)?;
        let mut copied_relative_paths = Vec::new();

        match metadata_mode {
            SnapshotMetadata::Copy => {
                copy_snapshot_file(
                    &Path::new(&source.base_dir).join("library.json"),
                    &Path::new(&staging.base_dir).join("library.json"),
                    Path::new("library.json"),
                    &mut copied_relative_paths,
                )?;
            }
            SnapshotMetadata::Create => {
                write_metadata(&staging)?;
                copied_relative_paths.push(PathBuf::from("library.json"));
            }
        }

        snapshot_sqlite_database(Path::new(&source.db_path), Path::new(&staging.db_path))?;
        copied_relative_paths.push(PathBuf::from("framecraft.db"));
        rewrite_snapshot_media_paths(&staging.db_path, &source, &published)?;

        for directory in ["results", "references", "inbox", "staging"] {
            copy_snapshot_tree(
                &Path::new(&source.base_dir).join(directory),
                &Path::new(&staging.base_dir).join(directory),
                Path::new(directory),
                &staging_path,
                &mut copied_relative_paths,
            )?;
        }
        for directory in ["sync/applied", "sync/failed"] {
            copy_snapshot_tree(
                &Path::new(&source.base_dir).join(directory),
                &Path::new(&staging.base_dir).join(directory),
                Path::new(directory),
                &staging_path,
                &mut copied_relative_paths,
            )?;
        }

        let validation = validate_library_package(&staging.base_dir);
        if !validation.ok {
            return Err(format!(
                "Invalid library copy: {}",
                validation.errors.join(", ")
            ));
        }
        if let Some(before_publish) = before_publish {
            before_publish(&staging_path, &target_path)?;
        }
        rename_directory_no_replace(&staging_path, &target_path).map_err(|error| {
            if error.kind() == std::io::ErrorKind::AlreadyExists {
                format!(
                    "Library destination already exists: {}",
                    target_path.display()
                )
            } else {
                format_io_error(error)
            }
        })?;

        let copied_files = copied_relative_paths
            .into_iter()
            .map(|relative| {
                Path::new(&published.base_dir)
                    .join(relative)
                    .to_string_lossy()
                    .to_string()
            })
            .collect();
        Ok((published, copied_files, validation))
    })();

    match build_result {
        Ok(result) => Ok(result),
        Err(original_error) => match cleanup(&staging_path) {
            Ok(()) => Err(original_error),
            Err(cleanup_error) => Err(format!(
                "{original_error}; staging cleanup also failed for {}: {cleanup_error}",
                staging_path.display()
            )),
        },
    }
}

fn rewrite_snapshot_media_paths(
    db_path: &str,
    source: &LibraryPathsDto,
    target: &LibraryPathsDto,
) -> Result<(), String> {
    let mut connection = Connection::open(db_path).map_err(|error| error.to_string())?;
    let transaction = connection
        .transaction()
        .map_err(|error| error.to_string())?;
    for (table, column, source_prefix, target_prefix) in [
        (
            "results",
            "file_path",
            &source.results_dir,
            &target.results_dir,
        ),
        (
            "results",
            "thumbnail_path",
            &source.results_dir,
            &target.results_dir,
        ),
        (
            "\"references\"",
            "file_data",
            &source.references_dir,
            &target.references_dir,
        ),
        (
            "\"references\"",
            "thumbnail_data",
            &source.references_dir,
            &target.references_dir,
        ),
    ] {
        transaction
            .execute(
                &format!(
                    "UPDATE {table}
                     SET {column} = ?1 || substr({column}, length(?2) + 1)
                     WHERE {column} IS NOT NULL
                       AND substr({column}, 1, length(?2)) = ?2"
                ),
                (target_prefix, source_prefix),
            )
            .map_err(|error| error.to_string())?;
    }
    transaction.commit().map_err(|error| error.to_string())
}

fn reserve_staging_sibling(parent: &Path) -> Result<PathBuf, String> {
    reserve_staging_sibling_with_nonce(parent, &timestamp_slug())
}

fn reserve_staging_sibling_with_nonce(parent: &Path, nonce: &str) -> Result<PathBuf, String> {
    for attempt in 0..100_u8 {
        let candidate = parent.join(format!(".framecraft-staging-{nonce}-{attempt}"));
        match fs::create_dir(&candidate) {
            Ok(()) => return Ok(candidate),
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(format_io_error(error)),
        }
    }
    Err(format!(
        "Could not allocate a library staging directory beside {}",
        parent.display()
    ))
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn path_to_c_string(path: &Path) -> std::io::Result<std::ffi::CString> {
    use std::os::unix::ffi::OsStrExt;

    std::ffi::CString::new(path.as_os_str().as_bytes()).map_err(|_| {
        std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            format!("Path contains an interior NUL byte: {}", path.display()),
        )
    })
}

#[cfg(target_os = "macos")]
fn rename_directory_no_replace(source: &Path, target: &Path) -> std::io::Result<()> {
    let source = path_to_c_string(source)?;
    let target = path_to_c_string(target)?;
    // SAFETY: Both pointers come from live CStrings and remain valid for the call.
    let result = unsafe { libc::renamex_np(source.as_ptr(), target.as_ptr(), libc::RENAME_EXCL) };
    if result == 0 {
        Ok(())
    } else {
        Err(std::io::Error::last_os_error())
    }
}

#[cfg(target_os = "linux")]
fn rename_directory_no_replace(source: &Path, target: &Path) -> std::io::Result<()> {
    let source = path_to_c_string(source)?;
    let target = path_to_c_string(target)?;
    // SAFETY: Both pointers come from live CStrings and remain valid for the call.
    let result = unsafe {
        libc::renameat2(
            libc::AT_FDCWD,
            source.as_ptr(),
            libc::AT_FDCWD,
            target.as_ptr(),
            libc::RENAME_NOREPLACE,
        )
    };
    if result == 0 {
        Ok(())
    } else {
        Err(std::io::Error::last_os_error())
    }
}

#[cfg(target_os = "windows")]
fn rename_directory_no_replace(source: &Path, target: &Path) -> std::io::Result<()> {
    fs::rename(source, target)
}

#[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
fn rename_directory_no_replace(_source: &Path, _target: &Path) -> std::io::Result<()> {
    Err(std::io::Error::new(
        std::io::ErrorKind::Unsupported,
        "Atomic no-replace directory publication is unsupported on this platform",
    ))
}

fn cleanup_staging_directory(path: &Path) -> std::io::Result<()> {
    match fs::remove_dir_all(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(first_error) => {
            make_cleanup_tree_writable(path)?;
            fs::remove_dir_all(path).map_err(|retry_error| {
                std::io::Error::new(
                    retry_error.kind(),
                    format!(
                        "initial cleanup failed: {first_error}; retry after repairing permissions failed: {retry_error}"
                    ),
                )
            })
        }
    }
}

fn rename_file_no_replace(source: &Path, target: &Path) -> std::io::Result<()> {
    rename_directory_no_replace(source, target)
}

fn make_cleanup_tree_writable(path: &Path) -> std::io::Result<()> {
    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(error),
    };
    if metadata.file_type().is_symlink() {
        return Ok(());
    }
    set_cleanup_permissions(path, &metadata)?;
    if metadata.is_dir() {
        for entry in fs::read_dir(path)? {
            make_cleanup_tree_writable(&entry?.path())?;
        }
    }
    Ok(())
}

#[cfg(unix)]
fn set_cleanup_permissions(path: &Path, metadata: &fs::Metadata) -> std::io::Result<()> {
    use std::os::unix::fs::PermissionsExt;

    let required = if metadata.is_dir() { 0o700 } else { 0o600 };
    let mut permissions = metadata.permissions();
    permissions.set_mode(permissions.mode() | required);
    fs::set_permissions(path, permissions)
}

#[cfg(not(unix))]
fn set_cleanup_permissions(path: &Path, metadata: &fs::Metadata) -> std::io::Result<()> {
    let mut permissions = metadata.permissions();
    permissions.set_readonly(false);
    fs::set_permissions(path, permissions)
}

fn snapshot_sqlite_database(source: &Path, target: &Path) -> Result<(), String> {
    ensure_regular_source_file(source)?;
    let source = Connection::open_with_flags(
        source,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_FULL_MUTEX,
    )
    .map_err(|error| error.to_string())?;
    source
        .busy_timeout(Duration::from_secs(10))
        .map_err(|error| error.to_string())?;
    let mut target = Connection::open(target).map_err(|error| error.to_string())?;
    {
        let backup = Backup::new(&source, &mut target).map_err(|error| error.to_string())?;
        backup
            .run_to_completion(100, Duration::from_millis(10), None)
            .map_err(|error| error.to_string())?;
    }
    target
        .pragma_update(None, "journal_mode", "DELETE")
        .map_err(|error| error.to_string())
}

fn copy_snapshot_tree(
    source: &Path,
    target: &Path,
    relative: &Path,
    excluded_path: &Path,
    copied_relative_paths: &mut Vec<PathBuf>,
) -> Result<(), String> {
    let source_metadata = match fs::symlink_metadata(source) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(format_io_error(error)),
    };
    ensure_managed_entry_type(source, &source_metadata, true)?;
    fs::create_dir_all(target).map_err(format_io_error)?;
    for entry in fs::read_dir(source).map_err(format_io_error)? {
        let entry = entry.map_err(format_io_error)?;
        let source_path = entry.path();
        if source_path == excluded_path {
            continue;
        }
        let target_path = target.join(entry.file_name());
        let relative_path = relative.join(entry.file_name());
        let file_type = entry.file_type().map_err(format_io_error)?;
        if file_type.is_symlink() {
            return Err(format!(
                "Unsupported managed entry type: symlink ({})",
                source_path.display()
            ));
        } else if file_type.is_dir() {
            copy_snapshot_tree(
                &source_path,
                &target_path,
                &relative_path,
                excluded_path,
                copied_relative_paths,
            )?;
        } else if file_type.is_file() {
            copy_snapshot_file(
                &source_path,
                &target_path,
                &relative_path,
                copied_relative_paths,
            )?;
        } else {
            return Err(format!(
                "Unsupported managed entry type: special file ({})",
                source_path.display()
            ));
        }
    }
    Ok(())
}

fn copy_snapshot_file(
    source: &Path,
    target: &Path,
    relative: &Path,
    copied_relative_paths: &mut Vec<PathBuf>,
) -> Result<(), String> {
    ensure_regular_source_file(source)?;
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(format_io_error)?;
    }
    fs::copy(source, target).map_err(|error| {
        format!(
            "Could not copy {} to {}: {error}",
            source.display(),
            target.display()
        )
    })?;
    copied_relative_paths.push(relative.to_path_buf());
    Ok(())
}

fn ensure_regular_source_file(path: &Path) -> Result<(), String> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("Could not inspect source file {}: {error}", path.display()))?;
    ensure_managed_entry_type(path, &metadata, false)
}

fn ensure_managed_entry_type(
    path: &Path,
    metadata: &fs::Metadata,
    expect_directory: bool,
) -> Result<(), String> {
    let file_type = metadata.file_type();
    if file_type.is_symlink() {
        return Err(format!(
            "Unsupported managed entry type: symlink ({})",
            path.display()
        ));
    }
    let expected_type = if expect_directory {
        file_type.is_dir()
    } else {
        file_type.is_file()
    };
    if !expected_type {
        return Err(format!(
            "Unsupported managed entry type: special file ({})",
            path.display()
        ));
    }
    Ok(())
}

fn path_is_occupied(path: &Path) -> Result<bool, String> {
    match fs::symlink_metadata(path) {
        Ok(_) => Ok(true),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(format_io_error(error)),
    }
}

const PROMPT_COLUMNS: [&str; 38] = [
    "id",
    "title",
    "description",
    "provider",
    "category",
    "use_case",
    "prompt_text",
    "avoidance_text",
    "aspect_ratio",
    "model_version",
    "camera",
    "lens",
    "lighting",
    "style_ref",
    "character_ref",
    "image_ref",
    "parameters",
    "tags",
    "rating",
    "ai_look_risk",
    "reuse_potential",
    "is_recipe",
    "is_winner",
    "is_failed",
    "failure_notes",
    "notes",
    "version",
    "parent_id",
    "created_at",
    "updated_at",
    "recipe_use_count",
    "best_use",
    "risk_notes",
    "source_url",
    "thumbnail_data",
    "builder_state",
    "thumbnail_result_id",
    "variant_label",
];

const MIGRATION_022_NANO_BANANA_TITLES: [&str; 4] = [
    "Nano Banana — Skin Texture Macro",
    "Nano Banana — Eye Detail Macro",
    "Nano Banana — Lip Texture Macro",
    "Nano Banana — Tongue Texture Macro",
];

const RESULT_COLUMNS: [&str; 17] = [
    "id",
    "prompt_id",
    "file_path",
    "thumbnail_path",
    "provider",
    "score_overall",
    "score_realism",
    "score_brand_fit",
    "score_composition",
    "score_lighting",
    "score_ai_risk",
    "reuse_potential",
    "is_winner",
    "is_failed",
    "artifacts",
    "notes",
    "created_at",
];

const REFERENCE_COLUMNS: [&str; 16] = [
    "id",
    "title",
    "description",
    "kind",
    "file_data",
    "thumbnail_data",
    "provider",
    "category",
    "source_url",
    "tags",
    "rating",
    "best_use",
    "risk_notes",
    "notes",
    "created_at",
    "updated_at",
];

const REQUIRED_RELEASE_TABLES: [&str; 32] = [
    "app_meta",
    "assistant_messages",
    "assistant_threads",
    "avoidance_patterns",
    "campaigns",
    "comparison_items",
    "comparison_sessions",
    "creative_directions",
    "deliverable_references",
    "direction_storyboards",
    "export_presets",
    "generation_queue",
    "inconsistency_events",
    "learned_formulas",
    "profiles",
    "project_deliverables",
    "project_prompts",
    "project_references",
    "project_results",
    "projects",
    "prompts",
    "prompt_references",
    "prompt_tokens",
    "recipes",
    "references",
    "result_references",
    "results",
    "shot_sequence",
    "srefs",
    "token_categories",
    "token_patterns",
    "tokens",
];

const REQUIRED_RELEASE_COLUMNS: [(&str, &[&str]); 5] = [
    (
        "comparison_sessions",
        &["comparison_type", "outcome_summary"],
    ),
    ("comparison_items", &["source_role"]),
    ("projects", &["campaign_id", "creative_strategy"]),
    ("generation_queue", &["is_pinned"]),
    (
        "prompts",
        &[
            "recipe_use_count",
            "best_use",
            "risk_notes",
            "source_url",
            "thumbnail_data",
            "builder_state",
            "thumbnail_result_id",
            "variant_label",
        ],
    ),
];

pub const MERGE_MANIFEST_VERSION: u8 = 1;

#[derive(Clone, Copy)]
enum MergeIdentity {
    Id(&'static [&'static [&'static str]]),
    Composite(&'static [&'static str]),
    TargetOwned(&'static [&'static str]),
}

const UNIQUE_TOKEN_CATEGORY: &[&[&str]] = &[&["name"]];
const UNIQUE_TOKEN_PATTERN: &[&[&str]] = &[&["token_a_id", "token_b_id"]];
const UNIQUE_COMPARISON_ITEM: &[&[&str]] = &[&["session_id", "result_id"]];
const UNIQUE_GENERATION_QUEUE: &[&[&str]] = &[&["prompt_id"]];

#[derive(Clone, Copy)]
struct MergeForeignKey {
    column: &'static str,
    table: &'static str,
}

#[derive(Clone, Copy)]
struct MergeTableSpec {
    table: &'static str,
    columns: &'static [&'static str],
    identity: MergeIdentity,
    foreign_keys: &'static [MergeForeignKey],
    media_columns: &'static [&'static str],
    user_only: bool,
}

const FK_PROJECT_CAMPAIGN: &[MergeForeignKey] = &[MergeForeignKey {
    column: "campaign_id",
    table: "campaigns",
}];
// parent_id is remapped in-pass (prompt ids are preallocated before planning).
// thumbnail_result_id points at results, which plan AFTER prompts — its map is
// empty when prompt rows are rewritten, so the value passes through verbatim.
// That is safe because a prompt's thumbnail override always references one of
// its own results, which merge with the same UUID unless the id collides with
// different content (practically impossible for cross-library UUIDs).
// Declaring the FK keeps the excluded-target Null policy and the sentinel
// coverage tests honest about the column being a reference.
const FK_PROMPT_PARENT: &[MergeForeignKey] = &[
    MergeForeignKey {
        column: "parent_id",
        table: "prompts",
    },
    MergeForeignKey {
        column: "thumbnail_result_id",
        table: "results",
    },
];
const FK_RESULT: &[MergeForeignKey] = &[MergeForeignKey {
    column: "prompt_id",
    table: "prompts",
}];
const FK_TOKEN: &[MergeForeignKey] = &[MergeForeignKey {
    column: "category_id",
    table: "token_categories",
}];
const FK_PROMPT_TOKEN: &[MergeForeignKey] = &[
    MergeForeignKey {
        column: "prompt_id",
        table: "prompts",
    },
    MergeForeignKey {
        column: "token_id",
        table: "tokens",
    },
];
const FK_PROJECT_PROMPT: &[MergeForeignKey] = &[
    MergeForeignKey {
        column: "project_id",
        table: "projects",
    },
    MergeForeignKey {
        column: "prompt_id",
        table: "prompts",
    },
];
const FK_PROJECT_RESULT: &[MergeForeignKey] = &[
    MergeForeignKey {
        column: "project_id",
        table: "projects",
    },
    MergeForeignKey {
        column: "result_id",
        table: "results",
    },
];
const FK_PROJECT_REFERENCE: &[MergeForeignKey] = &[
    MergeForeignKey {
        column: "project_id",
        table: "projects",
    },
    MergeForeignKey {
        column: "reference_id",
        table: "references",
    },
];
const FK_PROMPT_REFERENCE: &[MergeForeignKey] = &[
    MergeForeignKey {
        column: "prompt_id",
        table: "prompts",
    },
    MergeForeignKey {
        column: "reference_id",
        table: "references",
    },
];
const FK_RESULT_REFERENCE: &[MergeForeignKey] = &[
    MergeForeignKey {
        column: "result_id",
        table: "results",
    },
    MergeForeignKey {
        column: "reference_id",
        table: "references",
    },
];
const FK_COMPARISON_SESSION: &[MergeForeignKey] = &[MergeForeignKey {
    column: "project_id",
    table: "projects",
}];
const FK_COMPARISON_ITEM: &[MergeForeignKey] = &[
    MergeForeignKey {
        column: "session_id",
        table: "comparison_sessions",
    },
    MergeForeignKey {
        column: "result_id",
        table: "results",
    },
];
const FK_DELIVERABLE: &[MergeForeignKey] = &[
    MergeForeignKey {
        column: "project_id",
        table: "projects",
    },
    MergeForeignKey {
        column: "linked_prompt_id",
        table: "prompts",
    },
    MergeForeignKey {
        column: "linked_result_id",
        table: "results",
    },
];
const FK_DELIVERABLE_REFERENCE: &[MergeForeignKey] = &[
    MergeForeignKey {
        column: "deliverable_id",
        table: "project_deliverables",
    },
    MergeForeignKey {
        column: "reference_id",
        table: "references",
    },
];
const FK_THREAD: &[MergeForeignKey] = &[MergeForeignKey {
    column: "project_id",
    table: "projects",
}];
const FK_MESSAGE: &[MergeForeignKey] = &[MergeForeignKey {
    column: "thread_id",
    table: "assistant_threads",
}];
const FK_EXPORT: &[MergeForeignKey] = &[MergeForeignKey {
    column: "project_id",
    table: "projects",
}];
const FK_QUEUE: &[MergeForeignKey] = &[
    MergeForeignKey {
        column: "prompt_id",
        table: "prompts",
    },
    MergeForeignKey {
        column: "project_id",
        table: "projects",
    },
];
const FK_DIRECTION: &[MergeForeignKey] = &[MergeForeignKey {
    column: "project_id",
    table: "projects",
}];
const FK_SHOT: &[MergeForeignKey] = &[
    MergeForeignKey {
        column: "project_id",
        table: "projects",
    },
    MergeForeignKey {
        column: "prompt_id",
        table: "prompts",
    },
    MergeForeignKey {
        column: "result_id",
        table: "results",
    },
];
const FK_STORYBOARD: &[MergeForeignKey] = &[
    MergeForeignKey {
        column: "direction_id",
        table: "creative_directions",
    },
    MergeForeignKey {
        column: "project_id",
        table: "projects",
    },
    MergeForeignKey {
        column: "prompt_id",
        table: "prompts",
    },
];
const FK_INCONSISTENCY: &[MergeForeignKey] = &[MergeForeignKey {
    column: "prompt_id",
    table: "prompts",
}];
const FK_PATTERN: &[MergeForeignKey] = &[
    MergeForeignKey {
        column: "token_a_id",
        table: "tokens",
    },
    MergeForeignKey {
        column: "token_b_id",
        table: "tokens",
    },
];

const CAMPAIGN_COLUMNS: &[&str] = &[
    "id",
    "title",
    "client",
    "brief",
    "status",
    "created_at",
    "updated_at",
];
const PROJECT_COLUMNS: &[&str] = &[
    "id",
    "title",
    "client",
    "campaign",
    "status",
    "brief_text",
    "production_goal",
    "category",
    "tags",
    "notes",
    "created_at",
    "updated_at",
    "project_type",
    "intended_output",
    "image_needs",
    "video_needs",
    "aspect_ratios",
    "provider_targets",
    "visual_direction",
    "constraints",
    "creative_goals",
    "campaign_id",
    "creative_strategy",
];
const RECIPE_COLUMNS: &[&str] = &[
    "id",
    "title",
    "description",
    "category",
    "provider",
    "structure",
    "example_prompt",
    "tags",
    "use_count",
    "rating",
    "notes",
    "created_at",
    "updated_at",
];
const SREF_COLUMNS: &[&str] = &[
    "id",
    "code",
    "title",
    "description",
    "provider",
    "category",
    "best_use",
    "risk_notes",
    "example_path",
    "rating",
    "tags",
    "notes",
    "created_at",
    "updated_at",
];
const PROFILE_COLUMNS: &[&str] = &[
    "id",
    "code",
    "title",
    "description",
    "provider",
    "best_use",
    "risk_notes",
    "example_path",
    "rating",
    "tags",
    "notes",
    "created_at",
];
const AVOIDANCE_COLUMNS: &[&str] = &[
    "id",
    "artifact_type",
    "label",
    "category",
    "description",
    "correction_prompt",
    "severity",
    "provider",
    "is_builtin",
    "created_at",
];
const TOKEN_CATEGORY_COLUMNS: &[&str] = &["id", "name", "label", "description", "sort_order"];
const TOKEN_COLUMNS: &[&str] = &[
    "id",
    "text",
    "category_id",
    "provider",
    "use_count",
    "quality_score",
    "tags",
    "is_builtin",
    "created_at",
    "is_favorite",
];
const PROMPT_TOKEN_COLUMNS: &[&str] = &["id", "prompt_id", "token_id", "sort_order", "custom_text"];
const TOKEN_PATTERN_COLUMNS: &[&str] = &[
    "id",
    "token_a_id",
    "token_b_id",
    "co_occurrence_count",
    "avg_rating",
    "last_updated",
];
const PROJECT_PROMPT_COLUMNS: &[&str] = &["project_id", "prompt_id"];
const PROJECT_RESULT_COLUMNS: &[&str] = &["project_id", "result_id"];
const PROJECT_REFERENCE_COLUMNS: &[&str] = &["project_id", "reference_id"];
const PROMPT_REFERENCE_COLUMNS: &[&str] = &["prompt_id", "reference_id", "role"];
const RESULT_REFERENCE_COLUMNS: &[&str] = &["result_id", "reference_id", "role"];
const COMPARISON_SESSION_COLUMNS: &[&str] = &[
    "id",
    "title",
    "project_id",
    "notes",
    "created_at",
    "updated_at",
    "comparison_type",
    "outcome_summary",
];
const COMPARISON_ITEM_COLUMNS: &[&str] = &[
    "id",
    "session_id",
    "result_id",
    "position",
    "is_winner",
    "is_rejected",
    "notes",
    "created_at",
    "source_role",
];
const DELIVERABLE_COLUMNS: &[&str] = &[
    "id",
    "project_id",
    "title",
    "description",
    "status",
    "target_format",
    "aspect_ratio",
    "linked_prompt_id",
    "linked_result_id",
    "notes",
    "sort_order",
    "created_at",
    "updated_at",
];
const DELIVERABLE_REFERENCE_COLUMNS: &[&str] = &["deliverable_id", "reference_id"];
const THREAD_COLUMNS: &[&str] = &["id", "project_id", "title", "created_at", "updated_at"];
const MESSAGE_COLUMNS: &[&str] = &[
    "id",
    "thread_id",
    "role",
    "content",
    "citations",
    "created_at",
];
const EXPORT_COLUMNS: &[&str] = &[
    "id",
    "project_id",
    "format",
    "options",
    "created_at",
    "updated_at",
];
const QUEUE_COLUMNS: &[&str] = &[
    "id",
    "prompt_id",
    "project_id",
    "status",
    "sort_order",
    "result_path",
    "notes",
    "created_at",
    "updated_at",
    "is_pinned",
];
const DIRECTION_COLUMNS: &[&str] = &[
    "id",
    "project_id",
    "title",
    "campaign_idea",
    "rationale",
    "visual_aesthetic",
    "brand_connection",
    "product_message",
    "tone",
    "prompt_direction",
    "is_selected",
    "created_at",
    "updated_at",
];
const SHOT_COLUMNS: &[&str] = &[
    "id",
    "project_id",
    "sort_order",
    "shot_type",
    "label",
    "prompt_id",
    "result_id",
    "notes",
    "created_at",
];
const STORYBOARD_COLUMNS: &[&str] = &[
    "id",
    "direction_id",
    "project_id",
    "sort_order",
    "shot_label",
    "description",
    "is_approved",
    "prompt_id",
    "accent_index",
    "created_at",
    "updated_at",
];
const INCONSISTENCY_COLUMNS: &[&str] = &[
    "id",
    "rule_id",
    "rule_label",
    "suggestion",
    "prompt_id",
    "provider",
    "action",
    "created_at",
];
const APP_META_COLUMNS: &[&str] = &["key", "value", "updated_at"];
const LEARNED_FORMULA_COLUMNS: &[&str] = &["provider", "steps", "updated_at"];

const MERGE_MANIFEST: &[MergeTableSpec] = &[
    MergeTableSpec {
        table: "campaigns",
        columns: CAMPAIGN_COLUMNS,
        identity: MergeIdentity::Id(&[]),
        foreign_keys: &[],
        media_columns: &[],
        user_only: false,
    },
    MergeTableSpec {
        table: "prompts",
        columns: &PROMPT_COLUMNS,
        identity: MergeIdentity::Id(&[]),
        foreign_keys: FK_PROMPT_PARENT,
        media_columns: &[],
        user_only: false,
    },
    MergeTableSpec {
        table: "references",
        columns: &REFERENCE_COLUMNS,
        identity: MergeIdentity::Id(&[]),
        foreign_keys: &[],
        media_columns: &["file_data", "thumbnail_data"],
        user_only: false,
    },
    MergeTableSpec {
        table: "recipes",
        columns: RECIPE_COLUMNS,
        identity: MergeIdentity::Id(&[]),
        foreign_keys: &[],
        media_columns: &[],
        user_only: false,
    },
    MergeTableSpec {
        table: "srefs",
        columns: SREF_COLUMNS,
        identity: MergeIdentity::Id(&[]),
        foreign_keys: &[],
        media_columns: &[],
        user_only: false,
    },
    MergeTableSpec {
        table: "profiles",
        columns: PROFILE_COLUMNS,
        identity: MergeIdentity::Id(&[]),
        foreign_keys: &[],
        media_columns: &[],
        user_only: false,
    },
    MergeTableSpec {
        table: "avoidance_patterns",
        columns: AVOIDANCE_COLUMNS,
        identity: MergeIdentity::Id(&[]),
        foreign_keys: &[],
        media_columns: &[],
        user_only: true,
    },
    MergeTableSpec {
        table: "token_categories",
        columns: TOKEN_CATEGORY_COLUMNS,
        identity: MergeIdentity::Id(UNIQUE_TOKEN_CATEGORY),
        foreign_keys: &[],
        media_columns: &[],
        user_only: false,
    },
    MergeTableSpec {
        table: "tokens",
        columns: TOKEN_COLUMNS,
        identity: MergeIdentity::Id(&[]),
        foreign_keys: FK_TOKEN,
        media_columns: &[],
        user_only: true,
    },
    MergeTableSpec {
        table: "projects",
        columns: PROJECT_COLUMNS,
        identity: MergeIdentity::Id(&[]),
        foreign_keys: FK_PROJECT_CAMPAIGN,
        media_columns: &[],
        user_only: false,
    },
    MergeTableSpec {
        table: "results",
        columns: &RESULT_COLUMNS,
        identity: MergeIdentity::Id(&[]),
        foreign_keys: FK_RESULT,
        media_columns: &["file_path", "thumbnail_path"],
        user_only: false,
    },
    MergeTableSpec {
        table: "prompt_tokens",
        columns: PROMPT_TOKEN_COLUMNS,
        identity: MergeIdentity::Id(&[]),
        foreign_keys: FK_PROMPT_TOKEN,
        media_columns: &[],
        user_only: false,
    },
    MergeTableSpec {
        table: "token_patterns",
        columns: TOKEN_PATTERN_COLUMNS,
        identity: MergeIdentity::Id(UNIQUE_TOKEN_PATTERN),
        foreign_keys: FK_PATTERN,
        media_columns: &[],
        user_only: false,
    },
    MergeTableSpec {
        table: "project_prompts",
        columns: PROJECT_PROMPT_COLUMNS,
        identity: MergeIdentity::Composite(&["project_id", "prompt_id"]),
        foreign_keys: FK_PROJECT_PROMPT,
        media_columns: &[],
        user_only: false,
    },
    MergeTableSpec {
        table: "project_results",
        columns: PROJECT_RESULT_COLUMNS,
        identity: MergeIdentity::Composite(&["project_id", "result_id"]),
        foreign_keys: FK_PROJECT_RESULT,
        media_columns: &[],
        user_only: false,
    },
    MergeTableSpec {
        table: "project_references",
        columns: PROJECT_REFERENCE_COLUMNS,
        identity: MergeIdentity::Composite(&["project_id", "reference_id"]),
        foreign_keys: FK_PROJECT_REFERENCE,
        media_columns: &[],
        user_only: false,
    },
    MergeTableSpec {
        table: "prompt_references",
        columns: PROMPT_REFERENCE_COLUMNS,
        identity: MergeIdentity::Composite(&["prompt_id", "reference_id"]),
        foreign_keys: FK_PROMPT_REFERENCE,
        media_columns: &[],
        user_only: false,
    },
    MergeTableSpec {
        table: "result_references",
        columns: RESULT_REFERENCE_COLUMNS,
        identity: MergeIdentity::Composite(&["result_id", "reference_id"]),
        foreign_keys: FK_RESULT_REFERENCE,
        media_columns: &[],
        user_only: false,
    },
    MergeTableSpec {
        table: "comparison_sessions",
        columns: COMPARISON_SESSION_COLUMNS,
        identity: MergeIdentity::Id(&[]),
        foreign_keys: FK_COMPARISON_SESSION,
        media_columns: &[],
        user_only: false,
    },
    MergeTableSpec {
        table: "comparison_items",
        columns: COMPARISON_ITEM_COLUMNS,
        identity: MergeIdentity::Id(UNIQUE_COMPARISON_ITEM),
        foreign_keys: FK_COMPARISON_ITEM,
        media_columns: &[],
        user_only: false,
    },
    MergeTableSpec {
        table: "project_deliverables",
        columns: DELIVERABLE_COLUMNS,
        identity: MergeIdentity::Id(&[]),
        foreign_keys: FK_DELIVERABLE,
        media_columns: &[],
        user_only: false,
    },
    MergeTableSpec {
        table: "deliverable_references",
        columns: DELIVERABLE_REFERENCE_COLUMNS,
        identity: MergeIdentity::Composite(&["deliverable_id", "reference_id"]),
        foreign_keys: FK_DELIVERABLE_REFERENCE,
        media_columns: &[],
        user_only: false,
    },
    MergeTableSpec {
        table: "assistant_threads",
        columns: THREAD_COLUMNS,
        identity: MergeIdentity::Id(&[]),
        foreign_keys: FK_THREAD,
        media_columns: &[],
        user_only: false,
    },
    MergeTableSpec {
        table: "assistant_messages",
        columns: MESSAGE_COLUMNS,
        identity: MergeIdentity::Id(&[]),
        foreign_keys: FK_MESSAGE,
        media_columns: &[],
        user_only: false,
    },
    MergeTableSpec {
        table: "export_presets",
        columns: EXPORT_COLUMNS,
        identity: MergeIdentity::Id(&[]),
        foreign_keys: FK_EXPORT,
        media_columns: &[],
        user_only: false,
    },
    MergeTableSpec {
        table: "generation_queue",
        columns: QUEUE_COLUMNS,
        identity: MergeIdentity::Id(UNIQUE_GENERATION_QUEUE),
        foreign_keys: FK_QUEUE,
        media_columns: &[],
        user_only: false,
    },
    MergeTableSpec {
        table: "creative_directions",
        columns: DIRECTION_COLUMNS,
        identity: MergeIdentity::Id(&[]),
        foreign_keys: FK_DIRECTION,
        media_columns: &[],
        user_only: false,
    },
    MergeTableSpec {
        table: "shot_sequence",
        columns: SHOT_COLUMNS,
        identity: MergeIdentity::Id(&[]),
        foreign_keys: FK_SHOT,
        media_columns: &[],
        user_only: false,
    },
    MergeTableSpec {
        table: "direction_storyboards",
        columns: STORYBOARD_COLUMNS,
        identity: MergeIdentity::Id(&[]),
        foreign_keys: FK_STORYBOARD,
        media_columns: &[],
        user_only: false,
    },
    MergeTableSpec {
        table: "inconsistency_events",
        columns: INCONSISTENCY_COLUMNS,
        identity: MergeIdentity::Id(&[]),
        foreign_keys: FK_INCONSISTENCY,
        media_columns: &[],
        user_only: false,
    },
    MergeTableSpec {
        table: "learned_formulas",
        columns: LEARNED_FORMULA_COLUMNS,
        identity: MergeIdentity::TargetOwned(&["provider"]),
        foreign_keys: &[],
        media_columns: &[],
        user_only: false,
    },
    MergeTableSpec {
        table: "app_meta",
        columns: APP_META_COLUMNS,
        identity: MergeIdentity::TargetOwned(&["key"]),
        foreign_keys: &[],
        media_columns: &[],
        user_only: false,
    },
];

#[derive(Clone, Debug, PartialEq)]
struct TableRecord {
    values: Vec<Value>,
}

fn merge_library_package(
    source_base_dir: &str,
    target_base_dir: &str,
) -> Result<LibraryMergeReport, String> {
    merge_library_package_with_hooks(source_base_dir, target_base_dir, None, None)
}

type BeforeMergeMediaPublishHook<'a> = dyn Fn(&[StagedMedia]) -> Result<(), String> + 'a;

#[cfg(test)]
fn merge_library_package_with_media_publish_hook(
    source_base_dir: &str,
    target_base_dir: &str,
    before_media_publish: Option<&BeforeMergeMediaPublishHook<'_>>,
) -> Result<LibraryMergeReport, String> {
    merge_library_package_with_hooks(source_base_dir, target_base_dir, before_media_publish, None)
}

type BeforeMergeCommitHook<'a> = dyn Fn(&Connection) -> Result<(), String> + 'a;

fn merge_library_package_with_hooks(
    source_base_dir: &str,
    target_base_dir: &str,
    before_media_publish: Option<&BeforeMergeMediaPublishHook<'_>>,
    before_commit: Option<&BeforeMergeCommitHook<'_>>,
) -> Result<LibraryMergeReport, String> {
    let source = resolve_library_paths(source_base_dir);
    let target = resolve_library_paths(target_base_dir);
    if source.base_dir == target.base_dir {
        return Err("Source and target libraries must be different.".to_string());
    }
    assert_valid_library_for_merge("source", &source.base_dir)?;
    assert_valid_library_for_merge("target", &target.base_dir)?;

    let source_conn = open_portable_database(&source.db_path)?;
    let mut target_conn = open_portable_database(&target.db_path)?;
    validate_merge_manifest_schema(&source_conn, "source")?;
    validate_merge_manifest_schema(&target_conn, "target")?;
    let tables = MERGE_MANIFEST
        .iter()
        .map(|spec| (spec.table.to_string(), MergeTableReport::default()))
        .collect();
    let mut report = LibraryMergeReport {
        source_base_dir: source.base_dir.clone(),
        target_base_dir: target.base_dir.clone(),
        prompts: MergeTableReport::default(),
        results: MergeTableReport::default(),
        references: MergeTableReport::default(),
        tables,
        manifest_version: MERGE_MANIFEST_VERSION,
        id_remaps: Vec::new(),
        errors: Vec::new(),
    };
    merge_all_manifest_tables(
        &source_conn,
        &mut target_conn,
        &source,
        &target,
        &mut report,
        before_media_publish,
        before_commit,
    )?;
    report.prompts = report.tables["prompts"].clone();
    report.results = report.tables["results"].clone();
    report.references = report.tables["references"].clone();
    Ok(report)
}

#[derive(Clone)]
struct PlannedInsert {
    spec: MergeTableSpec,
    record: TableRecord,
    identity_values: Vec<Value>,
}

#[derive(Eq, Hash, PartialEq)]
struct PlannedLookupKey {
    table: &'static str,
    columns: Vec<&'static str>,
    values: MergeIdentityKey,
}

struct StagedMedia {
    staged: PathBuf,
    final_path: PathBuf,
}

#[derive(Default)]
struct StagedMediaState {
    reserved: HashSet<String>,
    files: Vec<StagedMedia>,
}

#[derive(Clone, Debug, Eq, Hash, PartialEq)]
enum MergeValueKey {
    Null,
    Integer(i64),
    Real(u64),
    Text(String),
    Blob(Vec<u8>),
}

type MergeIdentityKey = Vec<MergeValueKey>;
type ExcludedIdentities = HashMap<&'static str, HashSet<MergeIdentityKey>>;

fn merge_identity_key(values: &[Value]) -> MergeIdentityKey {
    values
        .iter()
        .map(|value| match value {
            Value::Null => MergeValueKey::Null,
            Value::Integer(value) => MergeValueKey::Integer(*value),
            Value::Real(value) => MergeValueKey::Real(value.to_bits()),
            Value::Text(value) => MergeValueKey::Text(value.clone()),
            Value::Blob(value) => MergeValueKey::Blob(value.clone()),
        })
        .collect()
}

fn planned_lookup_key(
    table: &'static str,
    columns: &[&'static str],
    values: &[Value],
) -> PlannedLookupKey {
    PlannedLookupKey {
        table,
        columns: columns.to_vec(),
        values: merge_identity_key(values),
    }
}

fn index_planned_insert(
    planned: &mut Vec<PlannedInsert>,
    planned_identities: &mut HashSet<PlannedLookupKey>,
    planned_unique: &mut HashMap<PlannedLookupKey, usize>,
    insert: PlannedInsert,
) -> Result<(), String> {
    let index = planned.len();
    let identity_columns = match insert.spec.identity {
        MergeIdentity::Id(_) => &["id"][..],
        MergeIdentity::Composite(keys) | MergeIdentity::TargetOwned(keys) => keys,
    };
    planned_identities.insert(planned_lookup_key(
        insert.spec.table,
        identity_columns,
        &insert.identity_values,
    ));
    if let MergeIdentity::Id(unique_keys) = insert.spec.identity {
        for keys in unique_keys {
            let values = key_values(insert.spec, &insert.record, keys)?;
            planned_unique.insert(planned_lookup_key(insert.spec.table, keys, &values), index);
        }
    }
    planned.push(insert);
    Ok(())
}

fn merge_all_manifest_tables(
    source_conn: &Connection,
    target_conn: &mut Connection,
    source: &LibraryPathsDto,
    target: &LibraryPathsDto,
    report: &mut LibraryMergeReport,
    before_media_publish: Option<&BeforeMergeMediaPublishHook<'_>>,
    before_commit: Option<&BeforeMergeCommitHook<'_>>,
) -> Result<(), String> {
    let staging_root =
        PathBuf::from(&target.staging_dir).join(format!("merge-{}", timestamp_slug()));
    fs::create_dir_all(&staging_root).map_err(format_io_error)?;
    let result = (|| {
        let mut maps: HashMap<&str, HashMap<String, String>> = HashMap::new();
        let mut excluded = ExcludedIdentities::new();
        map_builtin_seed_prompt_ids_for_plan(
            source_conn,
            target_conn,
            &mut maps,
            report,
            &mut excluded,
        )?;
        preallocate_prompt_ids(source_conn, target_conn, &mut maps, report)?;
        let mut planned: Vec<PlannedInsert> = Vec::new();
        let mut planned_identities: HashSet<PlannedLookupKey> = HashSet::new();
        let mut planned_unique: HashMap<PlannedLookupKey, usize> = HashMap::new();
        let mut media = StagedMediaState::default();

        for spec in MERGE_MANIFEST.iter().copied() {
            let rows = read_manifest_rows(source_conn, spec, &mut excluded)?;
            for source_row in rows {
                let mut row = source_row.clone();
                if !rewrite_manifest_foreign_keys(spec, &mut row, &maps, &excluded)? {
                    record_excluded_identity(&mut excluded, spec, &source_row)?;
                    report.tables.get_mut(spec.table).unwrap().excluded += 1;
                    continue;
                }
                validate_manifest_media_values(spec, &row, source)?;
                if let MergeIdentity::Id(unique_keys) = spec.identity {
                    let source_id =
                        value_as_string(&source_row.values[column_index(spec.columns, "id")?])?;
                    let mut unique_match = None;
                    for keys in unique_keys {
                        let values = key_values(spec, &row, keys)?;
                        if let Some(index) =
                            planned_unique.get(&planned_lookup_key(spec.table, keys, &values))
                        {
                            unique_match = Some(planned[*index].record.clone());
                            break;
                        }
                        if let Some(existing) =
                            read_manifest_by_keys(target_conn, spec, keys, &values)?
                        {
                            unique_match = Some(existing);
                            break;
                        }
                    }
                    if let Some(existing) = unique_match {
                        let target_id =
                            value_as_string(&existing.values[column_index(spec.columns, "id")?])?;
                        maps.entry(spec.table)
                            .or_default()
                            .insert(source_id.clone(), target_id.clone());
                        report
                            .tables
                            .get_mut(spec.table)
                            .unwrap()
                            .skipped_duplicates += 1;
                        if source_id != target_id {
                            report.id_remaps.push(MergeIdRemap {
                                table: spec.table.into(),
                                source_id,
                                target_id,
                                reason: "unique_key".into(),
                            });
                        }
                        continue;
                    }
                }
                match spec.identity {
                    MergeIdentity::Id(_) => {
                        let id_index = column_index(spec.columns, "id")?;
                        let source_id = value_as_string(&source_row.values[id_index])?;
                        if spec.table == "prompts" {
                            let target_id = maps["prompts"][&source_id].clone();
                            row.values[id_index] = Value::Text(target_id.clone());
                            if let Some(existing) = read_manifest_by_keys(
                                target_conn,
                                spec,
                                &["id"],
                                &[Value::Text(target_id.clone())],
                            )? {
                                if records_equivalent_for_merge(
                                    spec, &existing, &row, source, target,
                                )? {
                                    report
                                        .tables
                                        .get_mut(spec.table)
                                        .unwrap()
                                        .skipped_duplicates += 1;
                                    continue;
                                }
                            }
                            if source_id != target_id {
                                report.tables.get_mut(spec.table).unwrap().remapped += 1;
                            }
                            index_planned_insert(
                                &mut planned,
                                &mut planned_identities,
                                &mut planned_unique,
                                PlannedInsert {
                                    spec,
                                    record: row,
                                    identity_values: vec![Value::Text(target_id)],
                                },
                            )?;
                            report.tables.get_mut(spec.table).unwrap().imported += 1;
                            continue;
                        }
                        let same_id = read_manifest_by_keys(
                            target_conn,
                            spec,
                            &["id"],
                            &[Value::Text(source_id.clone())],
                        )?;
                        if let Some(existing) = same_id.as_ref() {
                            if records_equivalent_for_merge(spec, existing, &row, source, target)? {
                                maps.entry(spec.table).or_default().insert(
                                    source_id,
                                    value_as_string(&existing.values[id_index])?,
                                );
                                report
                                    .tables
                                    .get_mut(spec.table)
                                    .unwrap()
                                    .skipped_duplicates += 1;
                                continue;
                            }
                        }
                        if let Some(existing) =
                            find_equivalent_manifest_row(target_conn, spec, &row, source, target)?
                        {
                            let target_id = value_as_string(&existing.values[id_index])?;
                            maps.entry(spec.table)
                                .or_default()
                                .insert(source_id.clone(), target_id.clone());
                            report
                                .tables
                                .get_mut(spec.table)
                                .unwrap()
                                .skipped_duplicates += 1;
                            if source_id != target_id {
                                report.id_remaps.push(MergeIdRemap {
                                    table: spec.table.to_string(),
                                    source_id,
                                    target_id,
                                    reason: "existing_match".to_string(),
                                });
                            }
                            continue;
                        }
                        let target_id = if same_id.is_some() {
                            let id = generate_sqlite_id(target_conn)?;
                            row.values[id_index] = Value::Text(id.clone());
                            let table_report = report.tables.get_mut(spec.table).unwrap();
                            table_report.remapped += 1;
                            report.id_remaps.push(MergeIdRemap {
                                table: spec.table.to_string(),
                                source_id: source_id.clone(),
                                target_id: id.clone(),
                                reason: "id_collision".to_string(),
                            });
                            id
                        } else {
                            source_id.clone()
                        };
                        maps.entry(spec.table)
                            .or_default()
                            .insert(source_id, target_id.clone());
                        stage_manifest_media(
                            spec,
                            &mut row,
                            source,
                            target,
                            &staging_root,
                            &target_id,
                            &mut media,
                        )?;
                        index_planned_insert(
                            &mut planned,
                            &mut planned_identities,
                            &mut planned_unique,
                            PlannedInsert {
                                spec,
                                record: row,
                                identity_values: vec![Value::Text(target_id)],
                            },
                        )?;
                        report.tables.get_mut(spec.table).unwrap().imported += 1;
                    }
                    MergeIdentity::Composite(keys) => {
                        let values = key_values(spec, &row, keys)?;
                        if read_manifest_by_keys(target_conn, spec, keys, &values)?.is_some()
                            || planned_identities
                                .contains(&planned_lookup_key(spec.table, keys, &values))
                        {
                            report
                                .tables
                                .get_mut(spec.table)
                                .unwrap()
                                .skipped_duplicates += 1;
                        } else {
                            index_planned_insert(
                                &mut planned,
                                &mut planned_identities,
                                &mut planned_unique,
                                PlannedInsert {
                                    spec,
                                    record: row,
                                    identity_values: values,
                                },
                            )?;
                            report.tables.get_mut(spec.table).unwrap().imported += 1;
                        }
                    }
                    MergeIdentity::TargetOwned(keys) => {
                        let values = key_values(spec, &row, keys)?;
                        if read_manifest_by_keys(target_conn, spec, keys, &values)?.is_some() {
                            report
                                .tables
                                .get_mut(spec.table)
                                .unwrap()
                                .skipped_duplicates += 1;
                        } else {
                            index_planned_insert(
                                &mut planned,
                                &mut planned_identities,
                                &mut planned_unique,
                                PlannedInsert {
                                    spec,
                                    record: row,
                                    identity_values: values,
                                },
                            )?;
                            report.tables.get_mut(spec.table).unwrap().imported += 1;
                        }
                    }
                }
            }
        }

        let transaction = target_conn
            .transaction()
            .map_err(|error| error.to_string())?;
        for item in &planned {
            insert_manifest_record(&transaction, item.spec, &item.record)?;
        }
        let mut published = Vec::new();
        let publish_result = before_media_publish
            .map_or(Ok(()), |hook| hook(&media.files))
            .and_then(|()| publish_staged_media(&media.files, &mut published));
        if let Err(error) = publish_result {
            let mut errors = vec![error];
            if let Err(rollback_error) = transaction.rollback() {
                errors.push(format!("database rollback failed: {rollback_error}"));
            }
            errors.extend(cleanup_owned_merge_media(&media.files, &published));
            return Err(errors.join("; "));
        }
        if let Some(before_commit) = before_commit {
            if let Err(error) = before_commit(&transaction) {
                let mut errors = vec![error];
                if let Err(rollback_error) = transaction.rollback() {
                    errors.push(format!("database rollback failed: {rollback_error}"));
                }
                errors.extend(cleanup_owned_merge_media(&media.files, &published));
                return Err(errors.join("; "));
            }
        }
        if let Err(error) = transaction.commit() {
            let mut errors = vec![format!("database commit failed: {error}")];
            errors.extend(cleanup_owned_merge_media(&media.files, &published));
            return Err(errors.join("; "));
        }
        Ok(())
    })();
    match cleanup_staging_directory(&staging_root) {
        Ok(()) => result,
        Err(cleanup_error) => match result {
            Ok(()) => Err(format!(
                "merge staging cleanup failed for {}: {cleanup_error}",
                staging_root.display()
            )),
            Err(error) => Err(format!(
                "{error}; merge staging cleanup failed for {}: {cleanup_error}",
                staging_root.display()
            )),
        },
    }
}

fn cleanup_owned_merge_media(staged: &[StagedMedia], published: &[PathBuf]) -> Vec<String> {
    let mut errors = Vec::new();
    for path in published
        .iter()
        .chain(staged.iter().map(|media| &media.staged))
    {
        match fs::remove_file(path) {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => errors.push(format!(
                "owned media cleanup failed for {}: {error}",
                path.display()
            )),
        }
    }
    errors
}

fn map_builtin_seed_prompt_ids_for_plan(
    source: &Connection,
    target: &Connection,
    maps: &mut HashMap<&'static str, HashMap<String, String>>,
    report: &mut LibraryMergeReport,
    excluded: &mut ExcludedIdentities,
) -> Result<(), String> {
    for row in read_builtin_seed_prompt_records(source)? {
        let source_id = value_as_string(&row.values[0])?;
        excluded
            .entry("prompts")
            .or_default()
            .insert(merge_identity_key(&[Value::Text(source_id.clone())]));
        let title = value_as_string(&row.values[1])?;
        let target_id = target.query_row("SELECT id FROM prompts WHERE provider='nano_banana' AND title=?1 ORDER BY id LIMIT 1", [&title], |r| r.get::<_,String>(0)).optional().map_err(|e| e.to_string())?;
        if let Some(target_id) = target_id {
            maps.entry("prompts")
                .or_default()
                .insert(source_id.clone(), target_id.clone());
            if source_id != target_id {
                report.id_remaps.push(MergeIdRemap {
                    table: "prompts".into(),
                    source_id,
                    target_id,
                    reason: "builtin_seed".into(),
                });
            }
        }
    }
    Ok(())
}

fn preallocate_prompt_ids(
    source_conn: &Connection,
    target_conn: &Connection,
    maps: &mut HashMap<&'static str, HashMap<String, String>>,
    report: &mut LibraryMergeReport,
) -> Result<(), String> {
    let spec = *MERGE_MANIFEST
        .iter()
        .find(|spec| spec.table == "prompts")
        .unwrap();
    let mut ignored = HashMap::new();
    let rows = read_manifest_rows(source_conn, spec, &mut ignored)?;
    let mut collided_ids = std::collections::HashSet::new();
    for row in &rows {
        let source_id = value_as_string(&row.values[column_index(spec.columns, "id")?])?;
        let same = read_manifest_by_keys(
            target_conn,
            spec,
            &["id"],
            &[Value::Text(source_id.clone())],
        )?;
        if same.is_some() {
            collided_ids.insert(source_id.clone());
        }
        let target_id = if same.as_ref().is_some_and(|candidate| {
            records_equivalent_ignoring(spec, candidate, row, &["id", "parent_id"])
        }) {
            source_id.clone()
        } else if let Some(candidate) =
            find_equivalent_ignoring(target_conn, spec, row, &["id", "parent_id"])?
        {
            value_as_string(&candidate.values[column_index(spec.columns, "id")?])?
        } else if same.is_some() {
            generate_sqlite_id(target_conn)?
        } else {
            source_id.clone()
        };
        maps.entry("prompts")
            .or_default()
            .insert(source_id.clone(), target_id.clone());
    }

    let mut converged = false;
    for _ in 0..(rows.len().saturating_mul(2) + 2) {
        let mut changed = false;
        for source_row in &rows {
            let source_id = value_as_string(&source_row.values[column_index(spec.columns, "id")?])?;
            let current_id = maps["prompts"][&source_id].clone();
            let mut rewritten = source_row.clone();
            if let Value::Text(parent_id) =
                &source_row.values[column_index(spec.columns, "parent_id")?]
            {
                if let Some(target_parent) = maps["prompts"].get(parent_id) {
                    rewritten.values[column_index(spec.columns, "parent_id")?] =
                        Value::Text(target_parent.clone());
                }
            }
            rewritten.values[column_index(spec.columns, "id")?] = Value::Text(current_id.clone());
            let occupied = read_manifest_by_keys(
                target_conn,
                spec,
                &["id"],
                &[Value::Text(current_id.clone())],
            )?;
            let next_id = if occupied.as_ref().is_some_and(|candidate| {
                records_equivalent_ignoring(spec, candidate, &rewritten, &["id"])
            }) {
                current_id.clone()
            } else if let Some(candidate) =
                find_equivalent_ignoring(target_conn, spec, &rewritten, &["id"])?
            {
                value_as_string(&candidate.values[column_index(spec.columns, "id")?])?
            } else if occupied.is_some() {
                generate_sqlite_id(target_conn)?
            } else {
                current_id.clone()
            };
            if next_id != current_id {
                maps.entry("prompts")
                    .or_default()
                    .insert(source_id, next_id);
                changed = true;
            }
        }
        if !changed {
            converged = true;
            break;
        }
    }
    if !converged {
        return Err(
            "Unable to resolve cyclic prompt parent identities deterministically".to_string(),
        );
    }

    for row in &rows {
        let source_id = value_as_string(&row.values[column_index(spec.columns, "id")?])?;
        let target_id = maps["prompts"][&source_id].clone();
        if source_id != target_id {
            report.id_remaps.push(MergeIdRemap {
                table: "prompts".into(),
                source_id: source_id.clone(),
                target_id,
                reason: if collided_ids.contains(&source_id) {
                    "id_collision".into()
                } else {
                    "existing_match".into()
                },
            });
        }
    }
    Ok(())
}

fn records_equivalent_ignoring(
    spec: MergeTableSpec,
    left: &TableRecord,
    right: &TableRecord,
    ignored: &[&str],
) -> bool {
    spec.columns.iter().enumerate().all(|(index, column)| {
        ignored.contains(column) || left.values[index] == right.values[index]
    })
}

fn find_equivalent_ignoring(
    conn: &Connection,
    spec: MergeTableSpec,
    row: &TableRecord,
    ignored: &[&str],
) -> Result<Option<TableRecord>, String> {
    let compare = spec
        .columns
        .iter()
        .enumerate()
        .filter(|(_, column)| !ignored.contains(column))
        .collect::<Vec<_>>();
    let clause = compare
        .iter()
        .enumerate()
        .map(|(parameter, (_, column))| {
            format!("{} IS ?{}", quote_identifier(column), parameter + 1)
        })
        .collect::<Vec<_>>()
        .join(" AND ");
    let sql = format!(
        "SELECT {} FROM {} WHERE {clause} LIMIT 1",
        spec.columns
            .iter()
            .map(|column| quote_identifier(column))
            .collect::<Vec<_>>()
            .join(", "),
        quote_identifier(spec.table)
    );
    conn.query_row(
        &sql,
        params_from_iter(compare.iter().map(|(index, _)| &row.values[*index])),
        |candidate| record_from_row(candidate, spec.columns.len()),
    )
    .optional()
    .map_err(|e| e.to_string())
}

fn quote_identifier(value: &str) -> String {
    format!("\"{}\"", value.replace('"', "\"\""))
}

fn column_index(columns: &[&str], column: &str) -> Result<usize, String> {
    columns
        .iter()
        .position(|candidate| *candidate == column)
        .ok_or_else(|| format!("Merge manifest column {column} is missing"))
}

fn validate_merge_manifest_schema(conn: &Connection, label: &str) -> Result<(), String> {
    if label == "source" {
        let declared = MERGE_MANIFEST
            .iter()
            .map(|spec| spec.table)
            .collect::<std::collections::HashSet<_>>();
        let mut statement = conn
            .prepare(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
            )
            .map_err(|e| e.to_string())?;
        let tables = statement
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        for table in tables {
            if !declared.contains(table.as_str()) && table != "_sqlx_migrations" {
                return Err(format!(
                    "Invalid source library: unsupported source schema table {table}"
                ));
            }
        }
    }
    for spec in MERGE_MANIFEST {
        let sql = format!("PRAGMA table_info({})", quote_identifier(spec.table));
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let actual = stmt
            .query_map([], |row| row.get::<_, String>(1))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        if actual.is_empty() {
            return Err(format!(
                "Invalid {label} library: missing declared merge table {}",
                spec.table
            ));
        }
        for column in spec.columns {
            if !actual.iter().any(|candidate| candidate == column) {
                return Err(format!("Invalid {label} library: merge manifest v{MERGE_MANIFEST_VERSION} requires {}.{column}", spec.table));
            }
        }
        if label == "source" {
            for column in &actual {
                if !spec.columns.contains(&column.as_str()) {
                    return Err(format!(
                        "Invalid source library: unsupported source schema column {}.{column}",
                        spec.table
                    ));
                }
            }
        }
    }
    Ok(())
}

fn read_manifest_rows(
    conn: &Connection,
    spec: MergeTableSpec,
    excluded: &mut ExcludedIdentities,
) -> Result<Vec<TableRecord>, String> {
    let select = spec
        .columns
        .iter()
        .map(|c| quote_identifier(c))
        .collect::<Vec<_>>()
        .join(", ");
    let mut sql = format!("SELECT {select} FROM {}", quote_identifier(spec.table));
    if spec.table == "prompts" {
        sql.push_str(" WHERE NOT (COALESCE(provider,'')='nano_banana' AND title IN ('Nano Banana — Skin Texture Macro','Nano Banana — Eye Detail Macro','Nano Banana — Lip Texture Macro','Nano Banana — Tongue Texture Macro'))");
    } else if spec.user_only {
        sql.push_str(" WHERE COALESCE(is_builtin,0)=0");
        let id_index = column_index(spec.columns, "id")?;
        let all_sql = format!(
            "SELECT {select} FROM {} WHERE COALESCE(is_builtin,0)<>0",
            quote_identifier(spec.table)
        );
        for row in read_records_with_sql(conn, &all_sql, spec.columns.len())? {
            excluded
                .entry(spec.table)
                .or_default()
                .insert(merge_identity_key(&[Value::Text(value_as_string(
                    &row.values[id_index],
                )?)]));
        }
    }
    read_records_with_sql(conn, &sql, spec.columns.len())
}

fn rewrite_manifest_foreign_keys(
    spec: MergeTableSpec,
    row: &mut TableRecord,
    maps: &HashMap<&str, HashMap<String, String>>,
    excluded: &ExcludedIdentities,
) -> Result<bool, String> {
    for foreign_key in spec.foreign_keys {
        let index = column_index(spec.columns, foreign_key.column)?;
        let Value::Text(source_id) = &row.values[index] else {
            continue;
        };
        if let Some(target_id) = maps
            .get(foreign_key.table)
            .and_then(|map| map.get(source_id))
        {
            row.values[index] = Value::Text(target_id.clone());
        } else if excluded.get(foreign_key.table).is_some_and(|identities| {
            identities.contains(&merge_identity_key(&[Value::Text(source_id.clone())]))
        }) {
            match excluded_foreign_key_policy(spec.table, foreign_key.column) {
                ExcludedForeignKeyPolicy::Null => row.values[index] = Value::Null,
                ExcludedForeignKeyPolicy::Exclude => return Ok(false),
            }
        }
    }
    Ok(true)
}

#[derive(Clone, Copy)]
enum ExcludedForeignKeyPolicy {
    Null,
    Exclude,
}

fn excluded_foreign_key_policy(table: &str, column: &str) -> ExcludedForeignKeyPolicy {
    match (table, column) {
        ("prompts", "parent_id")
        | ("prompts", "thumbnail_result_id")
        | ("projects", "campaign_id")
        | ("comparison_sessions", "project_id")
        | ("project_deliverables", "linked_prompt_id")
        | ("project_deliverables", "linked_result_id")
        | ("generation_queue", "project_id")
        | ("shot_sequence", "prompt_id")
        | ("shot_sequence", "result_id")
        | ("direction_storyboards", "prompt_id")
        | ("inconsistency_events", "prompt_id") => ExcludedForeignKeyPolicy::Null,
        _ => ExcludedForeignKeyPolicy::Exclude,
    }
}

fn record_excluded_identity(
    excluded: &mut ExcludedIdentities,
    spec: MergeTableSpec,
    source_row: &TableRecord,
) -> Result<(), String> {
    let keys = match spec.identity {
        MergeIdentity::Id(_) => &["id"][..],
        MergeIdentity::Composite(keys) | MergeIdentity::TargetOwned(keys) => keys,
    };
    excluded
        .entry(spec.table)
        .or_default()
        .insert(merge_identity_key(&key_values(spec, source_row, keys)?));
    Ok(())
}

fn key_values(
    spec: MergeTableSpec,
    row: &TableRecord,
    keys: &[&str],
) -> Result<Vec<Value>, String> {
    keys.iter()
        .map(|key| column_index(spec.columns, key).map(|index| row.values[index].clone()))
        .collect()
}

fn read_manifest_by_keys(
    conn: &Connection,
    spec: MergeTableSpec,
    keys: &[&str],
    values: &[Value],
) -> Result<Option<TableRecord>, String> {
    let where_clause = keys
        .iter()
        .enumerate()
        .map(|(i, key)| format!("{} IS ?{}", quote_identifier(key), i + 1))
        .collect::<Vec<_>>()
        .join(" AND ");
    let sql = format!(
        "SELECT {} FROM {} WHERE {where_clause} LIMIT 1",
        spec.columns
            .iter()
            .map(|c| quote_identifier(c))
            .collect::<Vec<_>>()
            .join(", "),
        quote_identifier(spec.table)
    );
    conn.query_row(&sql, params_from_iter(values.iter()), |row| {
        record_from_row(row, spec.columns.len())
    })
    .optional()
    .map_err(|e| e.to_string())
}

fn records_equivalent_for_merge(
    spec: MergeTableSpec,
    left: &TableRecord,
    right: &TableRecord,
    source: &LibraryPathsDto,
    target: &LibraryPathsDto,
) -> Result<bool, String> {
    for (index, column) in spec.columns.iter().enumerate() {
        if *column == "id" {
            continue;
        }
        if spec.media_columns.contains(column) {
            if !media_values_equivalent(
                spec.table,
                &left.values[index],
                &right.values[index],
                source,
                target,
            )? {
                return Ok(false);
            }
        } else if left.values[index] != right.values[index] {
            return Ok(false);
        }
    }
    Ok(true)
}

fn media_values_equivalent(
    table: &str,
    target_value: &Value,
    source_value: &Value,
    source: &LibraryPathsDto,
    target: &LibraryPathsDto,
) -> Result<bool, String> {
    if target_value == source_value {
        return Ok(true);
    }
    let (Value::Text(target_path), Value::Text(source_path)) = (target_value, source_value) else {
        return Ok(false);
    };
    let Some((source_prefix, target_prefix, _)) = media_prefixes(table, source, target) else {
        return Ok(false);
    };
    if !source_path.starts_with(source_prefix) || !target_path.starts_with(target_prefix) {
        return Ok(false);
    }
    let source_relative = &source_path[source_prefix.len()..];
    let target_relative = &target_path[target_prefix.len()..];
    assert_safe_relative_media_path(source_relative)?;
    assert_safe_relative_media_path(target_relative)?;
    match (fs::read(source_path), fs::read(target_path)) {
        (Ok(source_bytes), Ok(target_bytes)) => Ok(source_bytes == target_bytes),
        _ => Ok(false),
    }
}

fn find_equivalent_manifest_row(
    conn: &Connection,
    spec: MergeTableSpec,
    row: &TableRecord,
    source: &LibraryPathsDto,
    target: &LibraryPathsDto,
) -> Result<Option<TableRecord>, String> {
    let compare = spec
        .columns
        .iter()
        .enumerate()
        .filter(|(_, column)| **column != "id" && !spec.media_columns.contains(column))
        .collect::<Vec<_>>();
    let where_clause = compare
        .iter()
        .enumerate()
        .map(|(parameter, (_, column))| {
            format!("{} IS ?{}", quote_identifier(column), parameter + 1)
        })
        .collect::<Vec<_>>()
        .join(" AND ");
    let sql = format!(
        "SELECT {} FROM {} WHERE {where_clause}",
        spec.columns
            .iter()
            .map(|c| quote_identifier(c))
            .collect::<Vec<_>>()
            .join(", "),
        quote_identifier(spec.table)
    );
    let values = compare.iter().map(|(index, _)| &row.values[*index]);
    let mut statement = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = statement
        .query_map(params_from_iter(values), |candidate| {
            record_from_row(candidate, spec.columns.len())
        })
        .map_err(|e| e.to_string())?;
    for candidate in rows {
        let candidate = candidate.map_err(|e| e.to_string())?;
        if records_equivalent_for_merge(spec, &candidate, row, source, target)? {
            return Ok(Some(candidate));
        }
    }
    Ok(None)
}

fn media_prefixes<'a>(
    table: &str,
    source: &'a LibraryPathsDto,
    target: &'a LibraryPathsDto,
) -> Option<(&'a str, &'a str, &'static str)> {
    match table {
        "results" => Some((&source.results_dir, &target.results_dir, "results")),
        "references" => Some((&source.references_dir, &target.references_dir, "references")),
        _ => None,
    }
}

fn stage_manifest_media(
    spec: MergeTableSpec,
    row: &mut TableRecord,
    source: &LibraryPathsDto,
    target: &LibraryPathsDto,
    staging_root: &Path,
    id_hint: &str,
    state: &mut StagedMediaState,
) -> Result<(), String> {
    let Some((source_prefix, target_prefix, kind)) = media_prefixes(spec.table, source, target)
    else {
        return Ok(());
    };
    for column in spec.media_columns {
        let index = column_index(spec.columns, column)?;
        let Value::Text(source_path) = &row.values[index] else {
            continue;
        };
        if is_recognized_direct_media_value(source_path) {
            continue;
        }
        if !source_path.starts_with(source_prefix) {
            return Err(format!(
                "Managed media path is outside the source {kind} directory: {source_path}"
            ));
        }
        let relative = source_path[source_prefix.len()..].to_string();
        assert_safe_relative_media_path(&relative)?;
        validate_managed_media_source(Path::new(source_prefix), &relative)?;
        let mut candidate = collision_safe_relative_path(&relative, target_prefix, id_hint)?;
        let mut counter = 2;
        while state.reserved.contains(&format!("{kind}/{candidate}")) {
            candidate = collision_safe_relative_path(
                &format!("{relative}-stage-{counter}"),
                target_prefix,
                id_hint,
            )?;
            counter += 1;
        }
        state.reserved.insert(format!("{kind}/{candidate}"));
        let staged_path = staging_root.join(kind).join(&candidate);
        if let Some(parent) = staged_path.parent() {
            fs::create_dir_all(parent).map_err(format_io_error)?;
        }
        fs::copy(source_path, &staged_path).map_err(format_io_error)?;
        let final_path = PathBuf::from(format!("{target_prefix}{candidate}"));
        row.values[index] = Value::Text(final_path.to_string_lossy().to_string());
        state.files.push(StagedMedia {
            staged: staged_path,
            final_path,
        });
    }
    Ok(())
}

fn validate_manifest_media_values(
    spec: MergeTableSpec,
    row: &TableRecord,
    source: &LibraryPathsDto,
) -> Result<(), String> {
    let Some((source_prefix, _, kind)) = media_prefixes(spec.table, source, source) else {
        return Ok(());
    };
    for column in spec.media_columns {
        let index = column_index(spec.columns, column)?;
        let Value::Text(source_path) = &row.values[index] else {
            continue;
        };
        if is_recognized_direct_media_value(source_path) {
            continue;
        }
        if !source_path.starts_with(source_prefix) {
            return Err(format!(
                "Managed media path is outside the source {kind} directory: {source_path}"
            ));
        }
        let relative = &source_path[source_prefix.len()..];
        assert_safe_relative_media_path(relative)?;
        validate_managed_media_source(Path::new(source_prefix), relative)?;
    }
    Ok(())
}

fn is_recognized_direct_media_value(value: &str) -> bool {
    ["data:", "https://", "http://"]
        .iter()
        .any(|prefix| value.starts_with(prefix))
}

fn validate_managed_media_source(root: &Path, relative: &str) -> Result<(), String> {
    // Remove a trailing separator: on Unix, lstat("symlink/") follows the link.
    let root = root.components().collect::<PathBuf>();
    let root_metadata = fs::symlink_metadata(&root).map_err(|error| {
        format!(
            "Could not inspect managed media root {}: {error}",
            root.display()
        )
    })?;
    if root_metadata.file_type().is_symlink() {
        return Err(format!(
            "Managed media root must not be a symlink: {}",
            root.display()
        ));
    }
    if !root_metadata.is_dir() {
        return Err(format!(
            "Managed media root is not a directory: {}",
            root.display()
        ));
    }
    let canonical_root = root.canonicalize().map_err(format_io_error)?;
    let mut current = root;
    for component in Path::new(relative).components() {
        current.push(component.as_os_str());
        let metadata = fs::symlink_metadata(&current).map_err(|error| {
            format!(
                "Could not inspect managed media component {}: {error}",
                current.display()
            )
        })?;
        if metadata.file_type().is_symlink() {
            return Err(format!(
                "Managed media path contains a symlink: {}",
                current.display()
            ));
        }
    }
    let metadata = fs::symlink_metadata(&current).map_err(format_io_error)?;
    if !metadata.is_file() {
        return Err(format!(
            "Managed media leaf is not a regular file: {}",
            current.display()
        ));
    }
    let canonical_file = current.canonicalize().map_err(format_io_error)?;
    if !canonical_file.starts_with(&canonical_root) {
        return Err(format!(
            "Managed media path escapes its source root: {}",
            current.display()
        ));
    }
    Ok(())
}

fn insert_manifest_record(
    conn: &Connection,
    spec: MergeTableSpec,
    record: &TableRecord,
) -> Result<(), String> {
    let placeholders = (1..=spec.columns.len())
        .map(|i| format!("?{i}"))
        .collect::<Vec<_>>()
        .join(", ");
    let sql = format!(
        "INSERT INTO {} ({}) VALUES ({placeholders})",
        quote_identifier(spec.table),
        spec.columns
            .iter()
            .map(|c| quote_identifier(c))
            .collect::<Vec<_>>()
            .join(", ")
    );
    conn.execute(&sql, params_from_iter(record.values.iter()))
        .map(|_| ())
        .map_err(|e| e.to_string())
}

fn publish_staged_media(
    staged: &[StagedMedia],
    published: &mut Vec<PathBuf>,
) -> Result<(), String> {
    for media in staged {
        if let Some(parent) = media.final_path.parent() {
            fs::create_dir_all(parent).map_err(format_io_error)?;
        }
        rename_file_no_replace(&media.staged, &media.final_path).map_err(format_io_error)?;
        published.push(media.final_path.clone());
    }
    Ok(())
}

fn assert_valid_library_for_merge(label: &str, base_dir: &str) -> Result<(), String> {
    let validation = validate_library_package(base_dir);
    if validation.ok {
        Ok(())
    } else {
        Err(format!(
            "Invalid {label} library: {}",
            validation.errors.join(", ")
        ))
    }
}

fn collision_safe_relative_path(
    relative: &str,
    target_prefix: &str,
    id_hint: &str,
) -> Result<String, String> {
    let original = Path::new(relative);
    let parent = original.parent().unwrap_or_else(|| Path::new(""));
    let stem = original
        .file_stem()
        .and_then(|value| value.to_str())
        .ok_or_else(|| format!("Invalid media filename: {relative}"))?;
    let extension = original.extension().and_then(|value| value.to_str());
    let safe_hint = safe_filename_component(id_hint);

    for index in 0..1000 {
        let candidate_name = if index == 0 {
            original
                .file_name()
                .and_then(|value| value.to_str())
                .ok_or_else(|| format!("Invalid media filename: {relative}"))?
                .to_string()
        } else {
            let suffix = if index == 1 {
                format!("-import-{safe_hint}")
            } else {
                format!("-import-{safe_hint}-{index}")
            };
            match extension {
                Some(extension) => format!("{stem}{suffix}.{extension}"),
                None => format!("{stem}{suffix}"),
            }
        };

        let candidate_relative = if parent.as_os_str().is_empty() {
            candidate_name
        } else {
            path_to_forward_slashes(parent.join(candidate_name))?
        };
        assert_safe_relative_media_path(&candidate_relative)?;
        if !Path::new(&format!("{target_prefix}{candidate_relative}")).exists() {
            return Ok(candidate_relative);
        }
    }

    Err(format!(
        "Unable to allocate collision-safe media path for {relative}"
    ))
}

fn path_to_forward_slashes(path: PathBuf) -> Result<String, String> {
    path.to_str()
        .map(|value| value.replace('\\', "/"))
        .ok_or_else(|| "Invalid media path encoding".to_string())
}

fn safe_filename_component(value: &str) -> String {
    let sanitized: String = value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
                character
            } else {
                '-'
            }
        })
        .collect();
    let trimmed = sanitized
        .trim_matches('-')
        .chars()
        .take(48)
        .collect::<String>();
    if trimmed.is_empty() {
        "item".to_string()
    } else {
        trimmed
    }
}

fn read_builtin_seed_prompt_records(
    conn: &rusqlite::Connection,
) -> Result<Vec<TableRecord>, String> {
    let sql = format!(
        "SELECT {} FROM prompts
         WHERE COALESCE(provider, '') = ?1
           AND title IN (?2, ?3, ?4, ?5)
         ORDER BY title, id",
        PROMPT_COLUMNS.join(", ")
    );
    let mut statement = conn.prepare(&sql).map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(
            params_from_iter(
                std::iter::once("nano_banana")
                    .chain(MIGRATION_022_NANO_BANANA_TITLES.iter().copied()),
            ),
            |row| record_from_row(row, PROMPT_COLUMNS.len()),
        )
        .map_err(|error| error.to_string())?;
    let mut records = Vec::new();
    for row in rows {
        records.push(row.map_err(|error| error.to_string())?);
    }
    Ok(records)
}

fn read_records_with_sql(
    conn: &rusqlite::Connection,
    sql: &str,
    column_count: usize,
) -> Result<Vec<TableRecord>, String> {
    let mut statement = conn.prepare(sql).map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| record_from_row(row, column_count))
        .map_err(|error| error.to_string())?;
    let mut records = Vec::new();
    for row in rows {
        records.push(row.map_err(|error| error.to_string())?);
    }
    Ok(records)
}

fn record_from_row(row: &rusqlite::Row<'_>, len: usize) -> rusqlite::Result<TableRecord> {
    let mut values = Vec::with_capacity(len);
    for index in 0..len {
        values.push(value_from_ref(row.get_ref(index)?));
    }
    Ok(TableRecord { values })
}

fn value_from_ref(value: ValueRef<'_>) -> Value {
    match value {
        ValueRef::Null => Value::Null,
        ValueRef::Integer(value) => Value::Integer(value),
        ValueRef::Real(value) => Value::Real(value),
        ValueRef::Text(value) => Value::Text(String::from_utf8_lossy(value).to_string()),
        ValueRef::Blob(value) => Value::Blob(value.to_vec()),
    }
}

fn value_as_string(value: &Value) -> Result<String, String> {
    match value {
        Value::Text(value) => Ok(value.clone()),
        _ => Err("Expected text ID while merging library table.".to_string()),
    }
}

fn generate_sqlite_id(conn: &rusqlite::Connection) -> Result<String, String> {
    conn.query_row("SELECT lower(hex(randomblob(16)))", [], |row| row.get(0))
        .map_err(|error| error.to_string())
}

fn create_library_package(
    base_dir: &str,
    create_empty_db: bool,
) -> Result<LibraryPathsDto, String> {
    let paths = resolve_library_paths(base_dir);
    create_package_dirs(&paths)?;
    write_metadata(&paths)?;
    if create_empty_db {
        let db_missing = !Path::new(&paths.db_path).exists();
        let db_empty = Path::new(&paths.db_path)
            .metadata()
            .map(|metadata| metadata.len() == 0)
            .unwrap_or(true);
        if db_missing {
            fs::write(&paths.db_path, []).map_err(format_io_error)?;
        }
        if db_missing || db_empty {
            initialize_portable_database(&paths.db_path)?;
        }
    }
    Ok(paths)
}

fn create_package_dirs(paths: &LibraryPathsDto) -> Result<(), String> {
    for path in [
        &paths.base_dir,
        &paths.results_dir,
        &paths.references_dir,
        &paths.backups_dir,
        &paths.locks_dir,
        &paths.inbox_dir,
        &paths.staging_dir,
        &paths.sync_dir,
        &paths.applied_dir,
        &paths.failed_dir,
    ] {
        fs::create_dir_all(path).map_err(format_io_error)?;
    }
    Ok(())
}

fn write_metadata(paths: &LibraryPathsDto) -> Result<(), String> {
    let metadata = LibraryMetadata {
        format_version: 1,
        created_at: timestamp_slug(),
        db_filename: "framecraft.db",
        results_dir: "results",
        references_dir: "references",
    };
    let raw = serde_json::to_string_pretty(&metadata).map_err(|error| error.to_string())?;
    fs::write(format!("{}library.json", paths.base_dir), raw).map_err(format_io_error)
}

fn inspect_library_package(base_dir: &str) -> LibraryValidationResult {
    let paths = resolve_library_paths(base_dir);
    let mut errors = Vec::new();
    let metadata_path = format!("{}library.json", paths.base_dir);

    if !Path::new(&metadata_path).exists() {
        errors.push("Missing library.json".to_string());
    }
    if !Path::new(&paths.db_path).exists() {
        errors.push("Missing framecraft.db".to_string());
    }
    if !Path::new(&paths.results_dir).exists() {
        errors.push("Missing results directory".to_string());
    }
    if !Path::new(&paths.references_dir).exists() {
        errors.push("Missing references directory".to_string());
    }
    if !Path::new(&paths.locks_dir).exists() {
        errors.push("Missing locks directory".to_string());
    }
    if !Path::new(&paths.inbox_dir).exists() {
        errors.push("Missing inbox directory".to_string());
    }
    if !Path::new(&paths.staging_dir).exists() {
        errors.push("Missing staging directory".to_string());
    }
    if !Path::new(&paths.applied_dir).exists() {
        errors.push("Missing sync applied directory".to_string());
    }
    if !Path::new(&paths.failed_dir).exists() {
        errors.push("Missing sync failed directory".to_string());
    }

    if Path::new(&metadata_path).exists() {
        match fs::read_to_string(&metadata_path)
            .ok()
            .and_then(|raw| serde_json::from_str::<serde_json::Value>(&raw).ok())
        {
            Some(metadata)
                if metadata
                    .get("format_version")
                    .and_then(|value| value.as_u64())
                    == Some(1)
                    && metadata.get("db_filename").and_then(|value| value.as_str())
                        == Some("framecraft.db")
                    && metadata.get("results_dir").and_then(|value| value.as_str())
                        == Some("results")
                    && metadata
                        .get("references_dir")
                        .and_then(|value| value.as_str())
                        == Some("references") => {}
            _ => errors.push("Invalid library metadata".to_string()),
        }
    }

    LibraryValidationResult {
        ok: errors.is_empty(),
        errors,
    }
}

fn validate_library_package(base_dir: &str) -> LibraryValidationResult {
    let paths = resolve_library_paths(base_dir);
    let mut validation = inspect_library_package(base_dir);
    if Path::new(&paths.db_path).exists() {
        match has_required_database_schema(&paths.db_path) {
            Ok(true) => {}
            Ok(false) => validation
                .errors
                .push("Missing database schema".to_string()),
            Err(error) => validation.errors.push(error),
        }
    }
    validation.ok = validation.errors.is_empty();
    validation
}

fn repair_library_database_schema(base_dir: &str) -> Result<LibraryValidationResult, String> {
    let paths = resolve_library_paths(base_dir);
    create_package_dirs(&paths)?;
    let metadata_path = format!("{}library.json", paths.base_dir);
    if !Path::new(&metadata_path).exists() {
        write_metadata(&paths)?;
    }

    let db_exists = Path::new(&paths.db_path).exists();
    if !db_exists {
        fs::write(&paths.db_path, []).map_err(format_io_error)?;
        initialize_portable_database(&paths.db_path)?;
        return Ok(validate_library_package(&paths.base_dir));
    }

    if has_required_database_schema(&paths.db_path)? {
        return Ok(validate_library_package(&paths.base_dir));
    }

    if has_previous_release_schema(&paths.db_path)? {
        upgrade_supported_release_schema(&paths.db_path)?;
        return Ok(validate_library_package(&paths.base_dir));
    }

    let user_tables = database_user_tables(&paths.db_path)?;
    if !user_tables.is_empty() {
        return Err(format!(
            "Database schema is incomplete and contains existing tables ({}). Use Backup/Open Backup or migrate from a known-good library.",
            user_tables.join(", ")
        ));
    }

    initialize_portable_database(&paths.db_path)?;
    Ok(validate_library_package(&paths.base_dir))
}

fn initialize_portable_database(db_path: &str) -> Result<(), String> {
    let conn = open_portable_database(db_path)?;
    for sql in migration_sql() {
        conn.execute_batch(sql).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn database_user_tables(db_path: &str) -> Result<Vec<String>, String> {
    let conn = open_portable_database(db_path)?;
    let mut statement = conn
        .prepare(
            "SELECT name FROM sqlite_master
             WHERE type = 'table'
               AND name NOT LIKE 'sqlite_%'
             ORDER BY name",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|error| error.to_string())?;

    let mut tables = Vec::new();
    for row in rows {
        tables.push(row.map_err(|error| error.to_string())?);
    }
    Ok(tables)
}

fn has_required_database_schema(db_path: &str) -> Result<bool, String> {
    let conn = open_portable_database(db_path)?;
    for table in REQUIRED_RELEASE_TABLES {
        if !connection_table_exists(&conn, table) {
            return Ok(false);
        }
    }
    for (table, columns) in REQUIRED_RELEASE_COLUMNS {
        for column in columns {
            if !connection_column_exists(&conn, table, column)? {
                return Ok(false);
            }
        }
    }
    Ok(true)
}

fn has_previous_release_schema(db_path: &str) -> Result<bool, String> {
    let conn = open_portable_database(db_path)?;
    Ok(REQUIRED_RELEASE_TABLES
        .iter()
        .filter(|table| {
            !matches!(
                **table,
                "campaigns" | "creative_directions" | "shot_sequence" | "inconsistency_events"
                    | "direction_storyboards" | "learned_formulas"
            )
        })
        .all(|table| connection_table_exists(&conn, table)))
}

fn connection_table_exists(conn: &rusqlite::Connection, table: &str) -> bool {
    conn.query_row(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?1 LIMIT 1",
        [table],
        |_| Ok(()),
    )
    .is_ok()
}

fn connection_column_exists(
    conn: &rusqlite::Connection,
    table: &str,
    column: &str,
) -> Result<bool, String> {
    let mut statement = conn
        .prepare(&format!("PRAGMA table_info({table})"))
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| error.to_string())?;
    for row in rows {
        if row.map_err(|error| error.to_string())? == column {
            return Ok(true);
        }
    }
    Ok(false)
}

fn upgrade_supported_release_schema(db_path: &str) -> Result<(), String> {
    let mut conn = open_portable_database(db_path)?;
    let tx = conn.transaction().map_err(|error| error.to_string())?;

    tx.execute_batch(include_str!("../migrations/016_creative_directions.sql"))
        .map_err(|error| error.to_string())?;
    tx.execute_batch(include_str!("../migrations/017_shot_sequence.sql"))
        .map_err(|error| error.to_string())?;
    tx.execute_batch(
        "CREATE TABLE IF NOT EXISTS campaigns (
           id         TEXT PRIMARY KEY NOT NULL,
           title      TEXT NOT NULL,
           client     TEXT,
           brief      TEXT,
           status     TEXT NOT NULL DEFAULT 'active',
           created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
           updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
         );
         CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);",
    )
    .map_err(|error| error.to_string())?;

    add_column_if_missing(
        &tx,
        "comparison_sessions",
        "comparison_type",
        "ALTER TABLE comparison_sessions ADD COLUMN comparison_type TEXT NOT NULL DEFAULT 'result_result';",
    )?;
    add_column_if_missing(
        &tx,
        "comparison_sessions",
        "outcome_summary",
        "ALTER TABLE comparison_sessions ADD COLUMN outcome_summary TEXT;",
    )?;
    add_column_if_missing(
        &tx,
        "comparison_items",
        "source_role",
        "ALTER TABLE comparison_items ADD COLUMN source_role TEXT NOT NULL DEFAULT 'result';",
    )?;
    add_column_if_missing(
        &tx,
        "projects",
        "campaign_id",
        "ALTER TABLE projects ADD COLUMN campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL;",
    )?;
    add_column_if_missing(
        &tx,
        "generation_queue",
        "is_pinned",
        "ALTER TABLE generation_queue ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0;",
    )?;
    add_column_if_missing(
        &tx,
        "prompts",
        "recipe_use_count",
        "ALTER TABLE prompts ADD COLUMN recipe_use_count INTEGER NOT NULL DEFAULT 0;",
    )?;
    add_column_if_missing(
        &tx,
        "prompts",
        "best_use",
        "ALTER TABLE prompts ADD COLUMN best_use TEXT;",
    )?;
    add_column_if_missing(
        &tx,
        "prompts",
        "risk_notes",
        "ALTER TABLE prompts ADD COLUMN risk_notes TEXT;",
    )?;
    add_column_if_missing(
        &tx,
        "prompts",
        "source_url",
        "ALTER TABLE prompts ADD COLUMN source_url TEXT;",
    )?;
    add_column_if_missing(
        &tx,
        "prompts",
        "thumbnail_data",
        "ALTER TABLE prompts ADD COLUMN thumbnail_data TEXT;",
    )?;
    add_column_if_missing(
        &tx,
        "prompts",
        "builder_state",
        "ALTER TABLE prompts ADD COLUMN builder_state TEXT;",
    )?;
    add_column_if_missing(
        &tx,
        "prompts",
        "thumbnail_result_id",
        "ALTER TABLE prompts ADD COLUMN thumbnail_result_id TEXT REFERENCES results(id) ON DELETE SET NULL;",
    )?;
    add_column_if_missing(
        &tx,
        "prompts",
        "variant_label",
        "ALTER TABLE prompts ADD COLUMN variant_label TEXT;",
    )?;
    add_column_if_missing(
        &tx,
        "projects",
        "creative_strategy",
        "ALTER TABLE projects ADD COLUMN creative_strategy TEXT;",
    )?;

    tx.execute_batch(
        "CREATE TABLE IF NOT EXISTS inconsistency_events (
           id         TEXT PRIMARY KEY NOT NULL,
           rule_id    TEXT NOT NULL,
           rule_label TEXT NOT NULL,
           suggestion TEXT,
           prompt_id  TEXT REFERENCES prompts(id) ON DELETE SET NULL,
           provider   TEXT,
           action     TEXT NOT NULL DEFAULT 'warned',
           created_at TEXT NOT NULL
         );
         CREATE INDEX IF NOT EXISTS idx_inconsistency_events_rule ON inconsistency_events(rule_id);",
    )
    .map_err(|error| error.to_string())?;

    tx.execute_batch(include_str!("../migrations/030_direction_storyboards.sql"))
        .map_err(|error| error.to_string())?;

    tx.execute_batch(
        "CREATE TABLE IF NOT EXISTS learned_formulas (
           provider   TEXT PRIMARY KEY NOT NULL,
           steps      TEXT NOT NULL,
           updated_at TEXT NOT NULL
         );",
    )
    .map_err(|error| error.to_string())?;

    tx.execute_batch(
        "CREATE INDEX IF NOT EXISTS idx_projects_campaign ON projects(campaign_id);
         CREATE INDEX IF NOT EXISTS idx_generation_queue_pinned ON generation_queue(is_pinned);
         CREATE INDEX IF NOT EXISTS idx_prompts_recipe_use
           ON prompts(recipe_use_count) WHERE is_recipe = 1;",
    )
    .map_err(|error| error.to_string())?;

    let built_in_count: i64 = tx
        .query_row(
            "SELECT COUNT(*) FROM prompts WHERE title IN (?1, ?2, ?3, ?4)",
            params_from_iter(MIGRATION_022_NANO_BANANA_TITLES.iter()),
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    if built_in_count == 0 {
        tx.execute_batch(include_str!("../migrations/022_nano_banana_library.sql"))
            .map_err(|error| error.to_string())?;
    }

    tx.commit().map_err(|error| error.to_string())?;
    if !has_required_database_schema(db_path)? {
        return Err(
            "Database schema upgrade did not produce the required release schema.".to_string(),
        );
    }
    Ok(())
}

fn add_column_if_missing(
    conn: &rusqlite::Connection,
    table: &str,
    column: &str,
    alter_sql: &str,
) -> Result<(), String> {
    if !connection_column_exists(conn, table, column)? {
        conn.execute_batch(alter_sql)
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn migration_sql() -> [&'static str; 32] {
    [
        include_str!("../migrations/001_initial.sql"),
        include_str!("../migrations/002_tokens.sql"),
        include_str!("../migrations/003_meta.sql"),
        include_str!("../migrations/004_token_seeds.sql"),
        include_str!("../migrations/005_notion_library.sql"),
        include_str!("../migrations/006_avoidance_seed.sql"),
        include_str!("../migrations/007_token_patterns.sql"),
        include_str!("../migrations/008_token_favorite.sql"),
        include_str!("../migrations/009_references.sql"),
        include_str!("../migrations/010_projects.sql"),
        include_str!("../migrations/011_v4_workflow.sql"),
        include_str!("../migrations/012_deliverable_align.sql"),
        include_str!("../migrations/013_generation_queue.sql"),
        include_str!("../migrations/014_project_setup_metadata.sql"),
        include_str!("../migrations/015_comparison_workflow.sql"),
        include_str!("../migrations/016_creative_directions.sql"),
        include_str!("../migrations/017_shot_sequence.sql"),
        include_str!("../migrations/018_campaigns.sql"),
        include_str!("../migrations/019_queue_pin.sql"),
        include_str!("../migrations/020_recipe_use_count.sql"),
        include_str!("../migrations/021_prompt_analysis_fields.sql"),
        include_str!("../migrations/022_nano_banana_library.sql"),
        include_str!("../migrations/023_prompt_thumbnail.sql"),
        include_str!("../migrations/024_remove_seeded_recipes.sql"),
        include_str!("../migrations/025_prompt_builder_state.sql"),
        include_str!("../migrations/026_prompt_thumbnail_override.sql"),
        include_str!("../migrations/027_prompt_variant_label.sql"),
        include_str!("../migrations/028_inconsistency_events.sql"),
        include_str!("../migrations/029_color_grade_category.sql"),
        include_str!("../migrations/030_direction_storyboards.sql"),
        include_str!("../migrations/031_creative_strategy.sql"),
        include_str!("../migrations/035_learned_formulas.sql"),
    ]
}

fn assert_safe_relative_media_path(path: &str) -> Result<(), String> {
    let parsed = Path::new(path);
    let invalid_component = parsed.components().any(|component| {
        matches!(
            component,
            Component::RootDir | Component::Prefix(_) | Component::ParentDir | Component::CurDir
        )
    });
    if path.is_empty() || path.contains('\\') || invalid_component {
        Err(format!("Unsafe library media path: {path}"))
    } else {
        Ok(())
    }
}

fn resolve_library_paths(base_dir: &str) -> LibraryPathsDto {
    let base = normalize_dir(base_dir);
    LibraryPathsDto {
        db_path: format!("{base}framecraft.db"),
        results_dir: format!("{base}results/"),
        references_dir: format!("{base}references/"),
        backups_dir: format!("{base}backups/"),
        locks_dir: format!("{base}locks/"),
        inbox_dir: format!("{base}inbox/"),
        staging_dir: format!("{base}staging/"),
        sync_dir: format!("{base}sync/"),
        applied_dir: format!("{base}sync/applied/"),
        failed_dir: format!("{base}sync/failed/"),
        base_dir: base,
    }
}

fn normalize_dir(path: &str) -> String {
    let normalized = path.replace('\\', "/");
    if normalized.ends_with('/') {
        normalized
    } else {
        format!("{normalized}/")
    }
}

fn timestamp_slug() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    format!("{nanos}")
}

fn format_io_error(error: std::io::Error) -> String {
    error.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{env, fs, path::PathBuf};

    #[test]
    fn copies_committed_wal_rows_while_source_writer_remains_open() {
        let root = test_root("copy-wal-snapshot");
        let source = root.join("Source.framecraftlib");
        let target = root.join("Target.framecraftlib");
        let source_paths = create_library_package(source.to_str().unwrap(), true).unwrap();
        let writer = open_portable_database(&source_paths.db_path).unwrap();
        writer.pragma_update(None, "journal_mode", "WAL").unwrap();
        writer
            .execute_batch(
                "CREATE TABLE snapshot_probe (value TEXT NOT NULL);
                 INSERT INTO snapshot_probe (value) VALUES ('committed-in-wal');",
            )
            .unwrap();

        copy_library_package(source.to_str().unwrap(), target.to_str().unwrap()).unwrap();

        let snapshot =
            open_portable_database(target.join("framecraft.db").to_str().unwrap()).unwrap();
        let value: String = snapshot
            .query_row("SELECT value FROM snapshot_probe", [], |row| row.get(0))
            .unwrap();
        assert_eq!(value, "committed-in-wal");
        assert_eq!(fs::read_dir(target.join("backups")).unwrap().count(), 0);

        drop(snapshot);
        drop(writer);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    // Audit doc 05 §9 — migration 005 used to seed ~29 personal SREF codes
    // and ~29 personal Profile codes into every newly created library
    // unconditionally, contradicting "new library starts empty" for SREFs
    // and Profiles specifically. Tokens are intentional starter content and
    // must remain seeded.
    fn fresh_library_has_no_seeded_srefs_or_profiles_but_keeps_starter_tokens() {
        let root = test_root("fresh-library-no-sref-profile-seed");
        let library = root.join("Fresh.framecraftlib");
        let paths = create_library_package(library.to_str().unwrap(), true).unwrap();
        let conn = open_portable_database(&paths.db_path).unwrap();

        let sref_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM srefs", [], |row| row.get(0))
            .unwrap();
        let profile_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM profiles", [], |row| row.get(0))
            .unwrap();
        let token_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM tokens", [], |row| row.get(0))
            .unwrap();

        assert_eq!(sref_count, 0, "fresh library must not inherit seeded SREFs");
        assert_eq!(profile_count, 0, "fresh library must not inherit seeded Profiles");
        assert!(token_count > 0, "fresh library should still get starter token vocabulary");

        drop(conn);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn metadata_copy_failure_leaves_no_destination_or_staging_sibling() {
        let root = test_root("copy-metadata-failure");
        let source = root.join("Source.framecraftlib");
        let target = root.join("Target.framecraftlib");
        create_library_package(source.to_str().unwrap(), true).unwrap();
        fs::remove_file(source.join("library.json")).unwrap();

        assert!(copy_library_package(source.to_str().unwrap(), target.to_str().unwrap()).is_err());
        assert!(!target.exists());
        assert_no_staging_sibling(&root);
        let _ = fs::remove_dir_all(root);
    }

    #[cfg(unix)]
    #[test]
    fn media_copy_failure_leaves_no_destination_or_staging_sibling() {
        use std::os::unix::fs::symlink;

        let root = test_root("copy-media-failure");
        let source = root.join("Source.framecraftlib");
        let target = root.join("Target.framecraftlib");
        create_library_package(source.to_str().unwrap(), true).unwrap();
        symlink(
            source.join("results/missing.png"),
            source.join("results/broken.png"),
        )
        .unwrap();

        let error = copy_library_package(source.to_str().unwrap(), target.to_str().unwrap())
            .err()
            .expect("broken symlink must be rejected");

        assert!(
            error.contains("Unsupported managed entry type: symlink"),
            "{error}"
        );
        assert!(!target.exists());
        assert_no_staging_sibling(&root);
        let _ = fs::remove_dir_all(root);
    }

    #[cfg(unix)]
    #[test]
    fn rejects_file_symlink_without_copying_external_content() {
        use std::os::unix::fs::symlink;

        let root = test_root("copy-external-file-symlink");
        let source = root.join("Source.framecraftlib");
        let target = root.join("Target.framecraftlib");
        let sensitive = root.join("sensitive.txt");
        create_library_package(source.to_str().unwrap(), true).unwrap();
        fs::write(&sensitive, "external sensitive content").unwrap();
        symlink(&sensitive, source.join("results/leak.txt")).unwrap();

        let error = copy_library_package(source.to_str().unwrap(), target.to_str().unwrap())
            .err()
            .expect("file symlink must be rejected");

        assert!(
            error.contains("Unsupported managed entry type: symlink"),
            "{error}"
        );
        assert!(!target.exists());
        assert_no_staging_sibling(&root);
        assert_eq!(
            fs::read_to_string(sensitive).unwrap(),
            "external sensitive content"
        );
        let _ = fs::remove_dir_all(root);
    }

    #[cfg(unix)]
    #[test]
    fn rejects_directory_symlink_and_cleans_staging() {
        use std::os::unix::fs::symlink;

        let root = test_root("copy-external-directory-symlink");
        let source = root.join("Source.framecraftlib");
        let target = root.join("Target.framecraftlib");
        let external = root.join("external-directory");
        create_library_package(source.to_str().unwrap(), true).unwrap();
        fs::create_dir_all(&external).unwrap();
        fs::write(external.join("sensitive.txt"), "external directory content").unwrap();
        symlink(&external, source.join("references/external")).unwrap();

        let error = copy_library_package(source.to_str().unwrap(), target.to_str().unwrap())
            .err()
            .expect("directory symlink must be rejected");

        assert!(
            error.contains("Unsupported managed entry type: symlink"),
            "{error}"
        );
        assert!(!target.exists());
        assert_no_staging_sibling(&root);
        let _ = fs::remove_dir_all(root);
    }

    #[cfg(unix)]
    #[test]
    fn dangling_destination_symlink_counts_as_occupied() {
        use std::os::unix::fs::symlink;

        let root = test_root("copy-dangling-destination-symlink");
        let source = root.join("Source.framecraftlib");
        let target = root.join("Target.framecraftlib");
        create_library_package(source.to_str().unwrap(), true).unwrap();
        symlink(root.join("missing-destination"), &target).unwrap();

        let error = copy_library_package(source.to_str().unwrap(), target.to_str().unwrap())
            .err()
            .expect("dangling destination symlink must be occupied");

        assert!(error.contains("already exists"), "{error}");
        assert!(fs::symlink_metadata(&target)
            .unwrap()
            .file_type()
            .is_symlink());
        assert_no_staging_sibling(&root);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn staging_reservation_retries_an_existing_candidate_atomically() {
        let root = test_root("staging-reservation-collision");
        let first = root.join(".framecraft-staging-fixed-0");
        fs::create_dir(&first).unwrap();

        let reserved = reserve_staging_sibling_with_nonce(&root, "fixed").unwrap();

        assert_eq!(reserved, root.join(".framecraft-staging-fixed-1"));
        assert!(reserved.is_dir());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn destination_created_immediately_before_publish_is_not_replaced() {
        let root = test_root("publish-race");
        let source = root.join("Source.framecraftlib");
        let target = root.join("Target.framecraftlib");
        create_library_package(source.to_str().unwrap(), true).unwrap();
        let create_competing_target =
            |_: &Path, target: &Path| fs::create_dir(target).map_err(format_io_error);

        let error = publish_library_snapshot_with_hooks(
            source.to_str().unwrap(),
            target.to_str().unwrap(),
            SnapshotMetadata::Copy,
            Some(&create_competing_target),
            &cleanup_staging_directory,
        )
        .err()
        .expect("no-replace publication must reject a competing destination");

        assert!(error.contains("already exists"), "{error}");
        assert_eq!(fs::read_dir(&target).unwrap().count(), 0);
        assert_no_staging_sibling(&root);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn cleanup_failure_is_reported_alongside_the_original_error() {
        use std::{cell::RefCell, io};

        let root = test_root("cleanup-failure-reporting");
        let source = root.join("Source.framecraftlib");
        let target = root.join("Target.framecraftlib");
        create_library_package(source.to_str().unwrap(), true).unwrap();
        fs::remove_file(source.join("library.json")).unwrap();
        let leaked_path = RefCell::new(None::<PathBuf>);
        let fail_cleanup = |path: &Path| {
            leaked_path.replace(Some(path.to_path_buf()));
            Err(io::Error::new(
                io::ErrorKind::PermissionDenied,
                "injected cleanup denial",
            ))
        };

        let error = publish_library_snapshot_with_hooks(
            source.to_str().unwrap(),
            target.to_str().unwrap(),
            SnapshotMetadata::Copy,
            None,
            &fail_cleanup,
        )
        .err()
        .expect("metadata and cleanup failures must be returned");

        assert!(error.contains("library.json"), "{error}");
        assert!(error.contains("cleanup"), "{error}");
        assert!(error.contains("injected cleanup denial"), "{error}");
        let leaked_path = leaked_path.into_inner().expect("cleanup path was captured");
        assert!(leaked_path.is_dir());
        cleanup_staging_directory(&leaked_path).unwrap();
        let _ = fs::remove_dir_all(root);
    }

    #[cfg(unix)]
    #[test]
    fn cleanup_repairs_read_only_staging_content_before_retrying() {
        use std::os::unix::fs::PermissionsExt;

        let root = test_root("cleanup-read-only");
        let staging = root.join(".framecraft-staging-read-only");
        let locked = staging.join("locked");
        let file = locked.join("file.txt");
        fs::create_dir_all(&locked).unwrap();
        fs::write(&file, "locked").unwrap();
        fs::set_permissions(&file, fs::Permissions::from_mode(0o400)).unwrap();
        fs::set_permissions(&locked, fs::Permissions::from_mode(0o500)).unwrap();

        cleanup_staging_directory(&staging).unwrap();

        assert!(!staging.exists());
        let _ = fs::remove_dir_all(root);
    }

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    #[test]
    fn rejects_special_files_in_managed_trees() {
        use std::{ffi::CString, os::unix::ffi::OsStrExt};

        let root = test_root("copy-special-file");
        let source = root.join("Source.framecraftlib");
        let target = root.join("Target.framecraftlib");
        create_library_package(source.to_str().unwrap(), true).unwrap();
        let fifo_path = source.join("inbox/local.fifo");
        let fifo_path_c = CString::new(fifo_path.as_os_str().as_bytes()).unwrap();
        // SAFETY: The CString is NUL-terminated and remains live for the call.
        assert_eq!(unsafe { libc::mkfifo(fifo_path_c.as_ptr(), 0o600) }, 0);

        let error = copy_library_package(source.to_str().unwrap(), target.to_str().unwrap())
            .err()
            .expect("special files must be rejected");

        assert!(
            error.contains("Unsupported managed entry type: special file"),
            "{error}"
        );
        assert!(!target.exists());
        assert_no_staging_sibling(&root);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn full_copy_discovers_managed_trees_and_excludes_runtime_state() {
        let root = test_root("copy-managed-trees");
        let source = root.join("Source.framecraftlib");
        let target = root.join("Target.framecraftlib");
        create_library_package(source.to_str().unwrap(), true).unwrap();
        for (relative, contents) in [
            ("results/nested/result.png", "result"),
            ("references/nested/reference.png", "reference"),
            ("inbox/job.json", "inbox"),
            ("staging/pending.json", "staging"),
            ("sync/root.json", "excluded sync root"),
            ("sync/other/skip.json", "excluded sync subtree"),
            ("sync/applied/done.json", "applied"),
            ("sync/failed/failed.json", "failed"),
            ("locks/stale.lock", "stale lock"),
            ("backups/recursive.framecraftlib/marker", "old backup"),
        ] {
            let path = source.join(relative);
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(path, contents).unwrap();
        }

        copy_library_package(source.to_str().unwrap(), target.to_str().unwrap()).unwrap();

        for relative in [
            "results/nested/result.png",
            "references/nested/reference.png",
            "inbox/job.json",
            "staging/pending.json",
            "sync/applied/done.json",
            "sync/failed/failed.json",
        ] {
            assert!(target.join(relative).is_file(), "missing {relative}");
        }
        assert!(target.join("locks").is_dir());
        assert!(target.join("backups").is_dir());
        assert!(!target.join("locks/stale.lock").exists());
        assert!(!target
            .join("backups/recursive.framecraftlib/marker")
            .exists());
        assert!(!target.join("sync/root.json").exists());
        assert!(!target.join("sync/other/skip.json").exists());

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn copy_rewrites_only_source_managed_media_prefixes_before_publication() {
        let root = test_root("copy-rewrite-media-paths");
        let source = root.join("Source.framecraftlib");
        let target = root.join("Target.framecraftlib");
        let source_paths = create_library_package(source.to_str().unwrap(), true).unwrap();
        insert_prompt(
            &source_paths.db_path,
            "prompt-rewrite",
            "Rewrite media paths",
        );
        insert_result(
            &source_paths.db_path,
            "managed-result",
            "prompt-rewrite",
            Some(&format!("{}nested/result.png", source_paths.results_dir)),
            Some(&format!("{}nested/thumb.png", source_paths.results_dir)),
        );
        insert_result(
            &source_paths.db_path,
            "external-result",
            "prompt-rewrite",
            Some("https://example.com/result.png"),
            Some("/outside/results/thumb.png"),
        );
        insert_reference(
            &source_paths.db_path,
            "managed-reference",
            "Managed reference",
            Some(&format!(
                "{}nested/reference.png",
                source_paths.references_dir
            )),
            Some(&format!("{}nested/thumb.png", source_paths.references_dir)),
        );
        insert_reference(
            &source_paths.db_path,
            "external-reference",
            "External reference",
            Some("data:image/png;base64,abc"),
            Some("https://example.com/reference.png"),
        );

        copy_library_package(source.to_str().unwrap(), target.to_str().unwrap()).unwrap();

        let target_paths = resolve_library_paths(target.to_str().unwrap());
        assert_eq!(
            result_paths(&target_paths.db_path, "managed-result").unwrap(),
            (
                "prompt-rewrite".to_string(),
                Some(format!("{}nested/result.png", target_paths.results_dir)),
                Some(format!("{}nested/thumb.png", target_paths.results_dir)),
            )
        );
        assert_eq!(
            result_paths(&target_paths.db_path, "external-result").unwrap(),
            (
                "prompt-rewrite".to_string(),
                Some("https://example.com/result.png".to_string()),
                Some("/outside/results/thumb.png".to_string()),
            )
        );
        assert_eq!(
            reference_paths(&target_paths.db_path, "managed-reference").unwrap(),
            (
                "Managed reference".to_string(),
                Some(format!(
                    "{}nested/reference.png",
                    target_paths.references_dir
                )),
                Some(format!("{}nested/thumb.png", target_paths.references_dir)),
            )
        );
        assert_eq!(
            reference_paths(&target_paths.db_path, "external-reference").unwrap(),
            (
                "External reference".to_string(),
                Some("data:image/png;base64,abc".to_string()),
                Some("https://example.com/reference.png".to_string()),
            )
        );

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn media_path_rewrite_failure_leaves_no_destination_or_staging_sibling() {
        let root = test_root("copy-rewrite-failure");
        let source = root.join("Source.framecraftlib");
        let target = root.join("Target.framecraftlib");
        let source_paths = create_library_package(source.to_str().unwrap(), true).unwrap();
        insert_prompt(
            &source_paths.db_path,
            "prompt-rewrite-failure",
            "Rewrite failure",
        );
        insert_result(
            &source_paths.db_path,
            "rewrite-failure-result",
            "prompt-rewrite-failure",
            Some(&format!("{}result.png", source_paths.results_dir)),
            None,
        );
        let connection = rusqlite::Connection::open(&source_paths.db_path).unwrap();
        connection
            .execute_batch(
                "CREATE TRIGGER reject_result_media_rewrite
                 BEFORE UPDATE OF file_path ON results
                 BEGIN
                   SELECT RAISE(ABORT, 'rewrite rejected');
                 END;",
            )
            .unwrap();
        drop(connection);

        let error = copy_library_package(source.to_str().unwrap(), target.to_str().unwrap())
            .err()
            .expect("media path rewrite must fail");

        assert!(error.contains("rewrite rejected"), "{error}");
        assert!(!target.exists());
        assert_no_staging_sibling(&root);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn copy_rejects_an_existing_destination_without_modifying_it() {
        let root = test_root("copy-existing-target");
        let source = root.join("Source.framecraftlib");
        let target = root.join("Target.framecraftlib");
        create_library_package(source.to_str().unwrap(), true).unwrap();
        fs::create_dir_all(&target).unwrap();
        fs::write(target.join("keep.txt"), "untouched").unwrap();

        let error = copy_library_package(source.to_str().unwrap(), target.to_str().unwrap())
            .err()
            .expect("existing destination must be rejected");

        assert!(error.contains("already exists"), "{error}");
        assert_eq!(
            fs::read_to_string(target.join("keep.txt")).unwrap(),
            "untouched"
        );
        assert_no_staging_sibling(&root);
        let _ = fs::remove_dir_all(root);
    }

    fn assert_no_staging_sibling(parent: &Path) {
        let leaked = fs::read_dir(parent)
            .unwrap()
            .filter_map(Result::ok)
            .any(|entry| {
                entry
                    .file_name()
                    .to_string_lossy()
                    .starts_with(".framecraft-staging-")
            });
        assert!(!leaked, "staging directory leaked beside destination");
    }

    #[test]
    fn creates_and_validates_package_under_downloads_like_path() {
        let root = test_root("create");
        let package = root.join("Untitled.framecraftlib");

        let result = create_library_package(package.to_str().unwrap(), true).unwrap();
        let validation = validate_library_package(&result.base_dir);

        assert!(validation.ok, "{:?}", validation.errors);
        assert!(Path::new(&result.results_dir).is_dir());
        assert!(Path::new(&result.references_dir).is_dir());
        assert!(package.join("inbox").is_dir());
        assert!(package.join("staging").is_dir());
        assert!(package.join("sync/applied").is_dir());
        assert!(package.join("sync/failed").is_dir());
        assert!(sqlite_table_exists(&result.db_path, "prompts"));

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn created_package_includes_project_setup_metadata_columns() {
        let root = test_root("create-project-setup-metadata");
        let package = root.join("ProjectSetup.framecraftlib");

        let result = create_library_package(package.to_str().unwrap(), true).unwrap();

        for column in [
            "project_type",
            "intended_output",
            "image_needs",
            "video_needs",
            "aspect_ratios",
            "provider_targets",
            "visual_direction",
            "constraints",
            "creative_goals",
        ] {
            assert!(
                sqlite_column_exists(&result.db_path, "projects", column),
                "missing projects.{column}"
            );
        }

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn created_package_includes_recent_workflow_schema() {
        let root = test_root("create-recent-workflow-schema");
        let package = root.join("RecentWorkflow.framecraftlib");

        let result = create_library_package(package.to_str().unwrap(), true).unwrap();

        assert!(sqlite_column_exists(
            &result.db_path,
            "comparison_sessions",
            "comparison_type"
        ));
        assert!(sqlite_column_exists(
            &result.db_path,
            "comparison_items",
            "source_role"
        ));
        assert!(sqlite_table_exists(&result.db_path, "creative_directions"));
        assert!(sqlite_table_exists(&result.db_path, "shot_sequence"));

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn migrates_without_precreating_destination_db() {
        let root = test_root("migrate");
        let source = root.join("source");
        let target = root.join("target.framecraftlib");
        fs::create_dir_all(source.join("results/campaign")).unwrap();
        fs::create_dir_all(source.join("references")).unwrap();
        fs::write(source.join("framecraft.db"), []).unwrap();
        initialize_portable_database(source.join("framecraft.db").to_str().unwrap()).unwrap();
        fs::write(source.join("results/campaign/a.png"), "image").unwrap();

        let result = migrate_app_data_to_library_native(
            source.to_str().unwrap().to_string(),
            target.to_str().unwrap().to_string(),
        )
        .unwrap();

        assert!(sqlite_table_exists(
            target.join("framecraft.db").to_str().unwrap(),
            "prompts"
        ));
        assert_eq!(
            fs::read_to_string(target.join("results/campaign/a.png")).unwrap(),
            "image"
        );
        assert!(result
            .copied_files
            .iter()
            .any(|path| path.ends_with("framecraft.db")));

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn validation_rejects_empty_database_without_schema() {
        let root = test_root("empty-schema");
        let package = root.join("Broken.framecraftlib");
        fs::create_dir_all(package.join("results")).unwrap();
        fs::create_dir_all(package.join("references")).unwrap();
        fs::write(
            package.join("library.json"),
            r#"{"format_version":1,"db_filename":"framecraft.db","results_dir":"results","references_dir":"references"}"#,
        )
        .unwrap();
        fs::write(package.join("framecraft.db"), []).unwrap();

        let validation = validate_library_package(package.to_str().unwrap());

        assert!(!validation.ok);
        assert!(validation
            .errors
            .contains(&"Missing database schema".to_string()));
        assert!(validation
            .errors
            .contains(&"Missing inbox directory".to_string()));
        assert!(validation
            .errors
            .contains(&"Missing staging directory".to_string()));
        assert!(validation
            .errors
            .contains(&"Missing locks directory".to_string()));
        assert!(validation
            .errors
            .contains(&"Missing sync applied directory".to_string()));
        assert!(validation
            .errors
            .contains(&"Missing sync failed directory".to_string()));

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn structural_inspection_does_not_require_or_mutate_database_schema() {
        let root = test_root("inspect-structure-only");
        let package = root.join("StructureOnly.framecraftlib");
        let paths = create_library_package(package.to_str().unwrap(), false).unwrap();
        fs::write(&paths.db_path, []).unwrap();

        let inspection = inspect_library_package(&paths.base_dir);
        let validation = validate_library_package(&paths.base_dir);

        assert!(inspection.ok, "{:?}", inspection.errors);
        assert!(!validation.ok);
        assert!(validation
            .errors
            .contains(&"Missing database schema".to_string()));
        assert_eq!(fs::metadata(&paths.db_path).unwrap().len(), 0);

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn repair_initializes_empty_database_schema() {
        let root = test_root("repair-empty-schema");
        let package = root.join("Repair.framecraftlib");
        fs::create_dir_all(package.join("results")).unwrap();
        fs::create_dir_all(package.join("references")).unwrap();
        fs::write(
            package.join("library.json"),
            r#"{"format_version":1,"db_filename":"framecraft.db","results_dir":"results","references_dir":"references"}"#,
        )
        .unwrap();
        fs::write(package.join("framecraft.db"), []).unwrap();

        let validation = repair_library_database_schema(package.to_str().unwrap()).unwrap();

        assert!(validation.ok, "{:?}", validation.errors);
        assert!(sqlite_table_exists(
            package.join("framecraft.db").to_str().unwrap(),
            "prompts"
        ));
        assert!(sqlite_table_exists(
            package.join("framecraft.db").to_str().unwrap(),
            "generation_queue"
        ));

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn repair_upgrades_supported_release_schema() {
        let root = test_root("repair-supported-release-schema");
        let package = root.join("SupportedRelease.framecraftlib");
        fs::create_dir_all(package.join("results")).unwrap();
        fs::create_dir_all(package.join("references")).unwrap();
        fs::write(
            package.join("library.json"),
            r#"{"format_version":1,"db_filename":"framecraft.db","results_dir":"results","references_dir":"references"}"#,
        )
        .unwrap();
        let db_path = package.join("framecraft.db");
        let conn = rusqlite::Connection::open(&db_path).unwrap();
        for sql in migration_sql().iter().take(14) {
            conn.execute_batch(sql).unwrap();
        }
        drop(conn);

        let validation = repair_library_database_schema(package.to_str().unwrap()).unwrap();

        assert!(validation.ok, "{:?}", validation.errors);
        assert!(sqlite_column_exists(
            db_path.to_str().unwrap(),
            "comparison_sessions",
            "comparison_type"
        ));
        assert!(sqlite_table_exists(
            db_path.to_str().unwrap(),
            "creative_directions"
        ));
        assert!(sqlite_table_exists(
            db_path.to_str().unwrap(),
            "shot_sequence"
        ));

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn repair_upgrades_every_supported_historical_release_schema() {
        for migration_count in [15, 18, 19, 20, 21, 22] {
            let root = test_root(&format!("repair-migration-{migration_count}"));
            let package = root.join(format!("Migration{migration_count}.framecraftlib"));
            let db_path = create_historical_package(&package, migration_count);

            let validation = repair_library_database_schema(package.to_str().unwrap()).unwrap();

            assert!(
                validation.ok,
                "migration {migration_count}: {:?}",
                validation.errors
            );
            for table in REQUIRED_RELEASE_TABLES {
                assert!(
                    sqlite_table_exists(db_path.to_str().unwrap(), table),
                    "migration {migration_count} missing table {table}"
                );
            }
            for (table, columns) in REQUIRED_RELEASE_COLUMNS {
                for column in columns {
                    assert!(
                        sqlite_column_exists(db_path.to_str().unwrap(), table, column),
                        "migration {migration_count} missing {table}.{column}"
                    );
                }
            }

            let second_validation =
                repair_library_database_schema(package.to_str().unwrap()).unwrap();
            assert!(
                second_validation.ok,
                "migration {migration_count} failed idempotent repair: {:?}",
                second_validation.errors
            );
            let _ = fs::remove_dir_all(root);
        }
    }

    #[test]
    fn repair_migration_22_schema_supports_prompt_source_and_thumbnail_data() {
        let root = test_root("repair-migration-22-prompt-media");
        let package = root.join("Migration22.framecraftlib");
        let db_path = create_historical_package(&package, 22);

        let validation = repair_library_database_schema(package.to_str().unwrap()).unwrap();
        assert!(validation.ok, "{:?}", validation.errors);

        let conn = rusqlite::Connection::open(&db_path).unwrap();
        conn.execute(
            "INSERT INTO prompts (
                id, title, provider, prompt_text, source_url, thumbnail_data, created_at, updated_at
             ) VALUES (
                'prompt-with-media', 'Prompt with media', 'nano_banana', 'test',
                'https://example.com/source', 'data:image/png;base64,dGVzdA==',
                '2026-06-30T00:00:00Z', '2026-06-30T00:00:00Z'
             )",
            [],
        )
        .unwrap();
        let media = conn
            .query_row(
                "SELECT source_url, thumbnail_data FROM prompts WHERE id = 'prompt-with-media'",
                [],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
            )
            .unwrap();
        assert_eq!(media.0, "https://example.com/source");
        assert_eq!(media.1, "data:image/png;base64,dGVzdA==");

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn repair_refuses_partial_database_schema() {
        let root = test_root("repair-partial-schema");
        let package = root.join("Partial.framecraftlib");
        fs::create_dir_all(package.join("results")).unwrap();
        fs::create_dir_all(package.join("references")).unwrap();
        fs::write(
            package.join("library.json"),
            r#"{"format_version":1,"db_filename":"framecraft.db","results_dir":"results","references_dir":"references"}"#,
        )
        .unwrap();
        let db_path = package.join("framecraft.db");
        let conn = rusqlite::Connection::open(&db_path).unwrap();
        conn.execute_batch("CREATE TABLE prompts (id TEXT PRIMARY KEY);")
            .unwrap();
        drop(conn);

        let error = match repair_library_database_schema(package.to_str().unwrap()) {
            Ok(validation) => panic!("repair unexpectedly succeeded: {:?}", validation.errors),
            Err(error) => error,
        };

        assert!(error.contains("Database schema is incomplete"));
        assert!(error.contains("prompts"));

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn validation_rejects_database_with_only_legacy_core_tables() {
        let root = test_root("validate-legacy-core-schema");
        let package = root.join("LegacyCore.framecraftlib");
        fs::create_dir_all(package.join("results")).unwrap();
        fs::create_dir_all(package.join("references")).unwrap();
        fs::write(
            package.join("library.json"),
            r#"{"format_version":1,"db_filename":"framecraft.db","results_dir":"results","references_dir":"references"}"#,
        )
        .unwrap();
        let db_path = package.join("framecraft.db");
        let conn = rusqlite::Connection::open(&db_path).unwrap();
        conn.execute_batch(
            "CREATE TABLE prompts (id TEXT PRIMARY KEY);
             CREATE TABLE results (id TEXT PRIMARY KEY);
             CREATE TABLE \"references\" (id TEXT PRIMARY KEY);",
        )
        .unwrap();
        drop(conn);

        let validation = validate_library_package(package.to_str().unwrap());

        assert!(!validation.ok);
        assert!(validation
            .errors
            .contains(&"Missing database schema".to_string()));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn validation_rejects_database_missing_project_prompt_table() {
        let root = test_root("validate-missing-project-prompts");
        let package = root.join("MissingProjectPrompts.framecraftlib");
        let paths = create_library_package(package.to_str().unwrap(), true).unwrap();
        let conn = rusqlite::Connection::open(&paths.db_path).unwrap();
        conn.execute("DROP TABLE project_prompts", []).unwrap();
        drop(conn);

        let validation = validate_library_package(package.to_str().unwrap());

        assert!(!validation.ok);
        assert!(validation
            .errors
            .contains(&"Missing database schema".to_string()));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn merge_imports_only_user_prompts_and_repeat_merge_adds_none() {
        let root = test_root("merge-prompt");
        let source = root.join("Source.framecraftlib");
        let target = root.join("Target.framecraftlib");
        let source_paths = create_library_package(source.to_str().unwrap(), true).unwrap();
        let target_paths = create_library_package(target.to_str().unwrap(), true).unwrap();
        insert_prompt(&source_paths.db_path, "prompt-a", "Source Prompt");
        insert_prompt_for_provider(
            &source_paths.db_path,
            "custom-nano-banana",
            "My Nano Banana Prompt",
            "nano_banana",
        );
        insert_prompt_for_provider(
            &source_paths.db_path,
            "other-provider-seed-title",
            MIGRATION_022_NANO_BANANA_TITLES[0],
            "midjourney",
        );
        for (index, title) in MIGRATION_022_NANO_BANANA_TITLES.iter().enumerate() {
            insert_prompt_for_provider(
                &source_paths.db_path,
                &format!("legacy-seed-{index}"),
                title,
                "nano_banana",
            );
        }
        let source_seed_ids = migration_022_seed_ids(&source_paths.db_path);
        assert_eq!(source_seed_ids.len(), 4);
        assert_migration_022_seed_singletons(&target_paths.db_path);

        let report =
            merge_library_package(source.to_str().unwrap(), target.to_str().unwrap()).unwrap();

        assert_eq!(report.prompts.imported, 3);
        assert_eq!(report.prompts.skipped_duplicates, 0);
        assert_eq!(report.prompts.remapped, 0);
        assert_eq!(user_prompt_count(&target_paths.db_path), 3);
        assert_eq!(
            prompt_title(&target_paths.db_path, "prompt-a").as_deref(),
            Some("Source Prompt")
        );
        assert_eq!(
            prompt_title(&target_paths.db_path, "custom-nano-banana").as_deref(),
            Some("My Nano Banana Prompt")
        );
        assert_eq!(
            prompt_title(&target_paths.db_path, "other-provider-seed-title").as_deref(),
            Some(MIGRATION_022_NANO_BANANA_TITLES[0])
        );
        assert!(source_seed_ids
            .iter()
            .all(|id| prompt_title(&target_paths.db_path, id).is_none()));
        assert_migration_022_seed_singletons(&target_paths.db_path);

        let repeat_report =
            merge_library_package(source.to_str().unwrap(), target.to_str().unwrap()).unwrap();

        assert_eq!(repeat_report.prompts.imported, 0);
        assert_eq!(repeat_report.prompts.skipped_duplicates, 3);
        assert_eq!(repeat_report.prompts.remapped, 0);
        assert_eq!(user_prompt_count(&target_paths.db_path), 3);
        assert_migration_022_seed_singletons(&target_paths.db_path);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn merge_maps_result_from_source_builtin_to_matching_target_builtin() {
        let root = test_root("merge-result-builtin-prompt");
        let source = root.join("Source.framecraftlib");
        let target = root.join("Target.framecraftlib");
        let source_paths = create_library_package(source.to_str().unwrap(), true).unwrap();
        let target_paths = create_library_package(target.to_str().unwrap(), true).unwrap();
        let title = MIGRATION_022_NANO_BANANA_TITLES[0];
        insert_prompt_for_provider(
            &source_paths.db_path,
            "legacy-source-seed",
            title,
            "nano_banana",
        );
        insert_prompt_for_provider(
            &target_paths.db_path,
            "legacy-target-seed",
            title,
            "nano_banana",
        );
        let source_prompt_id = migration_022_seed_id(&source_paths.db_path, title);
        let target_prompt_id = migration_022_seed_id(&target_paths.db_path, title);
        assert_ne!(source_prompt_id, target_prompt_id);
        insert_result(
            &source_paths.db_path,
            "builtin-prompt-result",
            &source_prompt_id,
            None,
            None,
        );

        let report =
            merge_library_package(source.to_str().unwrap(), target.to_str().unwrap()).unwrap();

        assert_eq!(report.prompts.imported, 0);
        assert_eq!(report.prompts.remapped, 0);
        assert_eq!(report.results.imported, 1);
        assert_eq!(
            result_prompt_id(&target_paths.db_path, "builtin-prompt-result").as_deref(),
            Some(target_prompt_id.as_str())
        );
        assert!(report.id_remaps.iter().any(|remap| {
            remap.table == "prompts"
                && remap.source_id == source_prompt_id
                && remap.target_id == target_prompt_id
                && remap.reason == "builtin_seed"
        }));
        assert_migration_022_seed_singletons(&target_paths.db_path);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn merge_skips_identical_prompt_id_duplicate() {
        let root = test_root("merge-identical-prompt");
        let source = root.join("Source.framecraftlib");
        let target = root.join("Target.framecraftlib");
        let source_paths = create_library_package(source.to_str().unwrap(), true).unwrap();
        let target_paths = create_library_package(target.to_str().unwrap(), true).unwrap();
        insert_prompt(&source_paths.db_path, "same-prompt", "Same Prompt");
        insert_prompt(&target_paths.db_path, "same-prompt", "Same Prompt");

        let report =
            merge_library_package(source.to_str().unwrap(), target.to_str().unwrap()).unwrap();

        assert_eq!(report.prompts.imported, 0);
        assert_eq!(report.prompts.skipped_duplicates, 1);
        assert_eq!(report.prompts.remapped, 0);
        assert_eq!(user_prompt_count(&target_paths.db_path), 1);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn merge_remaps_prompt_id_collision_with_different_content() {
        let root = test_root("merge-prompt-collision");
        let source = root.join("Source.framecraftlib");
        let target = root.join("Target.framecraftlib");
        let source_paths = create_library_package(source.to_str().unwrap(), true).unwrap();
        let target_paths = create_library_package(target.to_str().unwrap(), true).unwrap();
        insert_prompt(&source_paths.db_path, "shared-id", "Source Prompt");
        insert_prompt(&target_paths.db_path, "shared-id", "Target Prompt");

        let report =
            merge_library_package(source.to_str().unwrap(), target.to_str().unwrap()).unwrap();

        assert_eq!(report.prompts.imported, 1);
        assert_eq!(report.prompts.skipped_duplicates, 0);
        assert_eq!(report.prompts.remapped, 1);
        let collision_remap = report
            .id_remaps
            .iter()
            .find(|remap| remap.reason == "id_collision" && remap.source_id == "shared-id")
            .expect("missing user prompt collision remap");
        assert_eq!(collision_remap.table, "prompts");
        assert_ne!(collision_remap.target_id, "shared-id");
        assert_eq!(user_prompt_count(&target_paths.db_path), 2);
        assert_eq!(
            prompt_title(&target_paths.db_path, "shared-id").as_deref(),
            Some("Target Prompt")
        );
        assert_eq!(
            prompt_title(&target_paths.db_path, &collision_remap.target_id).as_deref(),
            Some("Source Prompt")
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn merge_imports_result_and_copies_media() {
        let root = test_root("merge-result-media");
        let source = root.join("Source.framecraftlib");
        let target = root.join("Target.framecraftlib");
        let source_paths = create_library_package(source.to_str().unwrap(), true).unwrap();
        let target_paths = create_library_package(target.to_str().unwrap(), true).unwrap();
        insert_prompt(&source_paths.db_path, "prompt-a", "Source Prompt");
        fs::create_dir_all(source.join("results/campaign")).unwrap();
        fs::write(source.join("results/campaign/a.png"), "image").unwrap();
        fs::write(source.join("results/campaign/a-thumb.png"), "thumb").unwrap();
        insert_result(
            &source_paths.db_path,
            "result-a",
            "prompt-a",
            Some(&format!("{}campaign/a.png", source_paths.results_dir)),
            Some(&format!("{}campaign/a-thumb.png", source_paths.results_dir)),
        );

        let report =
            merge_library_package(source.to_str().unwrap(), target.to_str().unwrap()).unwrap();

        assert_eq!(report.results.imported, 1);
        assert_eq!(report.results.skipped_duplicates, 0);
        assert_eq!(report.results.remapped, 0);
        assert_eq!(
            result_paths(&target_paths.db_path, "result-a"),
            Some((
                "prompt-a".to_string(),
                Some(format!("{}campaign/a.png", target_paths.results_dir)),
                Some(format!("{}campaign/a-thumb.png", target_paths.results_dir)),
            ))
        );
        assert_eq!(
            fs::read_to_string(target.join("results/campaign/a.png")).unwrap(),
            "image"
        );
        assert_eq!(
            fs::read_to_string(target.join("results/campaign/a-thumb.png")).unwrap(),
            "thumb"
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn merge_result_uses_remapped_prompt_id() {
        let root = test_root("merge-result-prompt-remap");
        let source = root.join("Source.framecraftlib");
        let target = root.join("Target.framecraftlib");
        let source_paths = create_library_package(source.to_str().unwrap(), true).unwrap();
        let target_paths = create_library_package(target.to_str().unwrap(), true).unwrap();
        insert_prompt(&source_paths.db_path, "shared-id", "Source Prompt");
        insert_prompt(&target_paths.db_path, "shared-id", "Target Prompt");
        insert_result(&source_paths.db_path, "result-a", "shared-id", None, None);

        let report =
            merge_library_package(source.to_str().unwrap(), target.to_str().unwrap()).unwrap();
        let remapped_prompt_id = report
            .id_remaps
            .iter()
            .find(|remap| remap.table == "prompts" && remap.source_id == "shared-id")
            .map(|remap| remap.target_id.clone())
            .unwrap();

        assert_eq!(report.results.imported, 1);
        assert_eq!(
            result_prompt_id(&target_paths.db_path, "result-a").as_deref(),
            Some(remapped_prompt_id.as_str())
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn merge_remaps_result_id_collision_with_different_content() {
        let root = test_root("merge-result-collision");
        let source = root.join("Source.framecraftlib");
        let target = root.join("Target.framecraftlib");
        let source_paths = create_library_package(source.to_str().unwrap(), true).unwrap();
        let target_paths = create_library_package(target.to_str().unwrap(), true).unwrap();
        insert_prompt(&source_paths.db_path, "prompt-a", "Source Prompt");
        insert_prompt(&target_paths.db_path, "prompt-a", "Source Prompt");
        insert_result(
            &source_paths.db_path,
            "shared-result",
            "prompt-a",
            None,
            None,
        );
        insert_result(
            &target_paths.db_path,
            "shared-result",
            "prompt-a",
            None,
            None,
        );
        let target_conn = rusqlite::Connection::open(&target_paths.db_path).unwrap();
        target_conn
            .execute(
                "UPDATE results SET notes = 'different target result' WHERE id = 'shared-result'",
                [],
            )
            .unwrap();

        let report =
            merge_library_package(source.to_str().unwrap(), target.to_str().unwrap()).unwrap();

        assert_eq!(report.results.imported, 1);
        assert_eq!(report.results.remapped, 1);
        let remap = report
            .id_remaps
            .iter()
            .find(|remap| remap.table == "results" && remap.source_id == "shared-result")
            .unwrap();
        assert_ne!(remap.target_id, "shared-result");
        assert_eq!(result_count(&target_paths.db_path), 2);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn merge_result_collision_does_not_overwrite_existing_target_media() {
        let root = test_root("merge-result-media-collision");
        let source = root.join("Source.framecraftlib");
        let target = root.join("Target.framecraftlib");
        let source_paths = create_library_package(source.to_str().unwrap(), true).unwrap();
        let target_paths = create_library_package(target.to_str().unwrap(), true).unwrap();
        insert_prompt(&source_paths.db_path, "prompt-a", "Source Prompt");
        insert_prompt(&target_paths.db_path, "prompt-a", "Source Prompt");
        fs::create_dir_all(source.join("results/campaign")).unwrap();
        fs::create_dir_all(target.join("results/campaign")).unwrap();
        fs::write(source.join("results/campaign/shared.png"), "source image").unwrap();
        fs::write(
            source.join("results/campaign/shared-thumb.png"),
            "source thumb",
        )
        .unwrap();
        fs::write(target.join("results/campaign/shared.png"), "target image").unwrap();
        fs::write(
            target.join("results/campaign/shared-thumb.png"),
            "target thumb",
        )
        .unwrap();
        insert_result(
            &source_paths.db_path,
            "shared-result",
            "prompt-a",
            Some(&format!("{}campaign/shared.png", source_paths.results_dir)),
            Some(&format!(
                "{}campaign/shared-thumb.png",
                source_paths.results_dir
            )),
        );
        insert_result(
            &target_paths.db_path,
            "shared-result",
            "prompt-a",
            Some(&format!("{}campaign/shared.png", target_paths.results_dir)),
            Some(&format!(
                "{}campaign/shared-thumb.png",
                target_paths.results_dir
            )),
        );
        let target_conn = rusqlite::Connection::open(&target_paths.db_path).unwrap();
        target_conn
            .execute(
                "UPDATE results SET notes = 'different target result' WHERE id = 'shared-result'",
                [],
            )
            .unwrap();

        let report =
            merge_library_package(source.to_str().unwrap(), target.to_str().unwrap()).unwrap();
        let remap = report
            .id_remaps
            .iter()
            .find(|remap| remap.table == "results" && remap.source_id == "shared-result")
            .unwrap();
        let (_, file_path, thumb_path) =
            result_paths(&target_paths.db_path, &remap.target_id).unwrap();

        assert_eq!(
            fs::read_to_string(target.join("results/campaign/shared.png")).unwrap(),
            "target image"
        );
        assert_eq!(
            fs::read_to_string(target.join("results/campaign/shared-thumb.png")).unwrap(),
            "target thumb"
        );
        let file_path = file_path.unwrap();
        let thumb_path = thumb_path.unwrap();
        assert_ne!(
            file_path,
            format!("{}campaign/shared.png", target_paths.results_dir)
        );
        assert_ne!(
            thumb_path,
            format!("{}campaign/shared-thumb.png", target_paths.results_dir)
        );
        assert_eq!(fs::read_to_string(&file_path).unwrap(), "source image");
        assert_eq!(fs::read_to_string(&thumb_path).unwrap(), "source thumb");
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn merge_imports_reference_and_copies_media() {
        let root = test_root("merge-reference-media");
        let source = root.join("Source.framecraftlib");
        let target = root.join("Target.framecraftlib");
        let source_paths = create_library_package(source.to_str().unwrap(), true).unwrap();
        let target_paths = create_library_package(target.to_str().unwrap(), true).unwrap();
        fs::create_dir_all(source.join("references/mood")).unwrap();
        fs::write(source.join("references/mood/ref.png"), "reference").unwrap();
        fs::write(source.join("references/mood/ref-thumb.png"), "thumb").unwrap();
        insert_reference(
            &source_paths.db_path,
            "ref-a",
            "Source Reference",
            Some(&format!("{}mood/ref.png", source_paths.references_dir)),
            Some(&format!(
                "{}mood/ref-thumb.png",
                source_paths.references_dir
            )),
        );

        let report =
            merge_library_package(source.to_str().unwrap(), target.to_str().unwrap()).unwrap();

        assert_eq!(report.references.imported, 1);
        assert_eq!(report.references.skipped_duplicates, 0);
        assert_eq!(report.references.remapped, 0);
        assert_eq!(
            reference_paths(&target_paths.db_path, "ref-a"),
            Some((
                "Source Reference".to_string(),
                Some(format!("{}mood/ref.png", target_paths.references_dir)),
                Some(format!("{}mood/ref-thumb.png", target_paths.references_dir)),
            ))
        );
        assert_eq!(
            fs::read_to_string(target.join("references/mood/ref.png")).unwrap(),
            "reference"
        );
        assert_eq!(
            fs::read_to_string(target.join("references/mood/ref-thumb.png")).unwrap(),
            "thumb"
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn merge_skips_identical_reference_id_duplicate() {
        let root = test_root("merge-reference-duplicate");
        let source = root.join("Source.framecraftlib");
        let target = root.join("Target.framecraftlib");
        let source_paths = create_library_package(source.to_str().unwrap(), true).unwrap();
        let target_paths = create_library_package(target.to_str().unwrap(), true).unwrap();
        insert_reference(
            &source_paths.db_path,
            "same-ref",
            "Same Reference",
            None,
            None,
        );
        insert_reference(
            &target_paths.db_path,
            "same-ref",
            "Same Reference",
            None,
            None,
        );

        let report =
            merge_library_package(source.to_str().unwrap(), target.to_str().unwrap()).unwrap();

        assert_eq!(report.references.imported, 0);
        assert_eq!(report.references.skipped_duplicates, 1);
        assert_eq!(reference_count(&target_paths.db_path), 1);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn merge_remaps_reference_id_collision_with_different_content() {
        let root = test_root("merge-reference-collision");
        let source = root.join("Source.framecraftlib");
        let target = root.join("Target.framecraftlib");
        let source_paths = create_library_package(source.to_str().unwrap(), true).unwrap();
        let target_paths = create_library_package(target.to_str().unwrap(), true).unwrap();
        insert_reference(
            &source_paths.db_path,
            "shared-ref",
            "Source Reference",
            None,
            None,
        );
        insert_reference(
            &target_paths.db_path,
            "shared-ref",
            "Target Reference",
            None,
            None,
        );

        let report =
            merge_library_package(source.to_str().unwrap(), target.to_str().unwrap()).unwrap();

        assert_eq!(report.references.imported, 1);
        assert_eq!(report.references.remapped, 1);
        let remap = report
            .id_remaps
            .iter()
            .find(|remap| remap.table == "references" && remap.source_id == "shared-ref")
            .unwrap();
        assert_ne!(remap.target_id, "shared-ref");
        assert_eq!(reference_count(&target_paths.db_path), 2);
        assert_eq!(
            reference_paths(&target_paths.db_path, &remap.target_id)
                .map(|row| row.0)
                .as_deref(),
            Some("Source Reference")
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn merge_reference_collision_does_not_overwrite_existing_target_media() {
        let root = test_root("merge-reference-media-collision");
        let source = root.join("Source.framecraftlib");
        let target = root.join("Target.framecraftlib");
        let source_paths = create_library_package(source.to_str().unwrap(), true).unwrap();
        let target_paths = create_library_package(target.to_str().unwrap(), true).unwrap();
        fs::create_dir_all(source.join("references/mood")).unwrap();
        fs::create_dir_all(target.join("references/mood")).unwrap();
        fs::write(source.join("references/mood/shared.png"), "source ref").unwrap();
        fs::write(
            source.join("references/mood/shared-thumb.png"),
            "source thumb",
        )
        .unwrap();
        fs::write(target.join("references/mood/shared.png"), "target ref").unwrap();
        fs::write(
            target.join("references/mood/shared-thumb.png"),
            "target thumb",
        )
        .unwrap();
        insert_reference(
            &source_paths.db_path,
            "shared-ref",
            "Source Reference",
            Some(&format!("{}mood/shared.png", source_paths.references_dir)),
            Some(&format!(
                "{}mood/shared-thumb.png",
                source_paths.references_dir
            )),
        );
        insert_reference(
            &target_paths.db_path,
            "shared-ref",
            "Target Reference",
            Some(&format!("{}mood/shared.png", target_paths.references_dir)),
            Some(&format!(
                "{}mood/shared-thumb.png",
                target_paths.references_dir
            )),
        );

        let report =
            merge_library_package(source.to_str().unwrap(), target.to_str().unwrap()).unwrap();
        let remap = report
            .id_remaps
            .iter()
            .find(|remap| remap.table == "references" && remap.source_id == "shared-ref")
            .unwrap();
        let (_, file_path, thumb_path) =
            reference_paths(&target_paths.db_path, &remap.target_id).unwrap();

        assert_eq!(
            fs::read_to_string(target.join("references/mood/shared.png")).unwrap(),
            "target ref"
        );
        assert_eq!(
            fs::read_to_string(target.join("references/mood/shared-thumb.png")).unwrap(),
            "target thumb"
        );
        let file_path = file_path.unwrap();
        let thumb_path = thumb_path.unwrap();
        assert_ne!(
            file_path,
            format!("{}mood/shared.png", target_paths.references_dir)
        );
        assert_ne!(
            thumb_path,
            format!("{}mood/shared-thumb.png", target_paths.references_dir)
        );
        assert_eq!(fs::read_to_string(&file_path).unwrap(), "source ref");
        assert_eq!(fs::read_to_string(&thumb_path).unwrap(), "source thumb");
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn rejects_unsafe_media_paths() {
        assert!(assert_safe_relative_media_path("../escape.png").is_err());
        assert!(assert_safe_relative_media_path("/escape.png").is_err());
        assert!(assert_safe_relative_media_path("nested\\escape.png").is_err());
    }

    #[test]
    fn merge_rejects_result_media_outside_managed_root_without_side_effects() {
        let root = test_root("merge-media-outside-root");
        let outside = root.join("secret.png");
        fs::write(&outside, "outside bytes").unwrap();
        assert_merge_rejects_media_path(&root, "outside", outside.to_str().unwrap());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn merge_rejects_result_media_relative_escape_without_side_effects() {
        let root = test_root("merge-media-relative-escape");
        let source = root.join("Source.framecraftlib");
        let escaped = source.join("outside.png");
        fs::create_dir_all(&source).unwrap();
        fs::write(&escaped, "outside bytes").unwrap();
        let path = source.join("results/../outside.png");
        assert_merge_rejects_media_path(&root, "relative-escape", path.to_str().unwrap());
        let _ = fs::remove_dir_all(root);
    }

    #[cfg(unix)]
    #[test]
    fn merge_rejects_symlinked_result_media_components_without_side_effects() {
        use std::os::unix::fs::symlink;

        for (label, broken, intermediate) in [
            ("leaf-symlink", false, false),
            ("broken-symlink", true, false),
            ("directory-symlink", false, true),
        ] {
            let root = test_root(label);
            let source = root.join("Source.framecraftlib");
            let external = root.join("external");
            fs::create_dir_all(&external).unwrap();
            fs::write(external.join("image.png"), "external bytes").unwrap();
            create_library_package(source.to_str().unwrap(), true).unwrap();
            let media_path = if intermediate {
                symlink(&external, source.join("results/link")).unwrap();
                source.join("results/link/image.png")
            } else {
                let destination = if broken {
                    external.join("missing.png")
                } else {
                    external.join("image.png")
                };
                let link = source.join("results/link.png");
                symlink(destination, &link).unwrap();
                link
            };
            assert_merge_rejects_media_path(&root, label, media_path.to_str().unwrap());
            let _ = fs::remove_dir_all(root);
        }
    }

    #[cfg(unix)]
    #[test]
    fn merge_rejects_symlinked_managed_media_roots_without_side_effects() {
        use std::os::unix::fs::symlink;

        for kind in ["results", "references"] {
            let root = test_root(&format!("merge-{kind}-root-symlink"));
            let source = root.join("Source.framecraftlib");
            let target = root.join("Target.framecraftlib");
            let source_paths = create_library_package(source.to_str().unwrap(), true).unwrap();
            let target_paths = create_library_package(target.to_str().unwrap(), true).unwrap();
            let external = root.join(format!("external-{kind}"));
            fs::create_dir_all(&external).unwrap();
            fs::write(external.join("image.png"), "external bytes").unwrap();
            fs::remove_dir(source.join(kind)).unwrap();
            symlink(&external, source.join(kind)).unwrap();
            let media_path = source.join(kind).join("image.png");
            if kind == "results" {
                insert_prompt(&source_paths.db_path, "root-link-prompt", "Root link");
                insert_result(
                    &source_paths.db_path,
                    "root-link-result",
                    "root-link-prompt",
                    Some(media_path.to_str().unwrap()),
                    None,
                );
            } else {
                insert_reference(
                    &source_paths.db_path,
                    "root-link-reference",
                    "Root link",
                    Some(media_path.to_str().unwrap()),
                    None,
                );
            }

            assert!(
                merge_library_package(source.to_str().unwrap(), target.to_str().unwrap()).is_err(),
                "{kind} root symlink must fail"
            );
            assert!(prompt_title(&target_paths.db_path, "root-link-prompt").is_none());
            assert!(result_paths(&target_paths.db_path, "root-link-result").is_none());
            assert!(reference_paths(&target_paths.db_path, "root-link-reference").is_none());
            assert!(fs::read_dir(target.join(kind)).unwrap().next().is_none());
            assert!(fs::read_dir(&target_paths.staging_dir)
                .unwrap()
                .next()
                .is_none());
            let _ = fs::remove_dir_all(root);
        }
    }

    #[test]
    fn merge_manifest_v1_declares_every_supported_user_table() {
        assert_eq!(MERGE_MANIFEST_VERSION, 1);
        let mut tables = MERGE_MANIFEST
            .iter()
            .map(|spec| spec.table)
            .collect::<Vec<_>>();
        tables.sort_unstable();
        let mut required = REQUIRED_RELEASE_TABLES.to_vec();
        required.sort_unstable();
        assert_eq!(tables, required);
        let prompts = MERGE_MANIFEST
            .iter()
            .find(|spec| spec.table == "prompts")
            .unwrap();
        assert!(prompts.columns.contains(&"builder_state"));
        assert!(MERGE_MANIFEST
            .iter()
            .find(|spec| spec.table == "results")
            .unwrap()
            .media_columns
            .contains(&"file_path"));
        assert!(MERGE_MANIFEST
            .iter()
            .find(|spec| spec.table == "references")
            .unwrap()
            .media_columns
            .contains(&"file_data"));
    }

    #[test]
    fn merge_manifest_preserves_complete_dependency_graph_and_is_idempotent() {
        let root = test_root("merge-complete-graph");
        let source = root.join("Source.framecraftlib");
        let target = root.join("Target.framecraftlib");
        let source_paths = create_library_package(source.to_str().unwrap(), true).unwrap();
        let target_paths = create_library_package(target.to_str().unwrap(), true).unwrap();
        let source_conn = Connection::open(&source_paths.db_path).unwrap();
        source_conn.execute_batch(
            "INSERT INTO campaigns(id,title,status) VALUES('c','Source campaign','active');
             INSERT INTO prompts(id,title,prompt_text,provider,is_recipe,recipe_use_count,best_use,risk_notes,source_url,thumbnail_data,builder_state) VALUES('p','Source prompt','body','midjourney',1,7,'best','risk','https://source','thumb','{\"mode\":\"tokens\"}');
             INSERT INTO \"references\"(id,title,kind,rating,created_at,updated_at) VALUES('r','Source ref','image',4,'t','t');
             INSERT INTO recipes(id,title,created_at,updated_at) VALUES('legacy-recipe','Legacy recipe','t','t');
             INSERT INTO srefs(id,code,title,created_at,updated_at) VALUES('sref','--sref 1','Sref','t','t');
             INSERT INTO profiles(id,code,title,created_at) VALUES('profile','--profile 1','Profile','t');
             INSERT INTO avoidance_patterns(id,artifact_type,label,category,is_builtin,created_at) VALUES('avoid','x','Avoid','texture',0,'t');
             INSERT INTO token_categories(id,name,label) VALUES('tc','custom-category','Custom');
             INSERT INTO tokens(id,text,category_id,is_builtin,created_at,is_favorite) VALUES('tok','custom token','tc',0,'t',1);
             INSERT INTO projects(id,title,status,created_at,updated_at,campaign_id,project_type,creative_goals) VALUES('proj','Source project','draft','t','t','c','campaign','goals');
             INSERT INTO results(id,prompt_id,provider,notes,created_at) VALUES('res','p','test','source result','t');
             INSERT INTO prompt_tokens(id,prompt_id,token_id,sort_order,custom_text) VALUES('pt','p','tok',3,'custom');
             INSERT INTO token_patterns(id,token_a_id,token_b_id,co_occurrence_count,last_updated) VALUES('pattern','tok','tok',9,'t');
             INSERT INTO project_prompts VALUES('proj','p');
             INSERT INTO project_results VALUES('proj','res');
             INSERT INTO project_references VALUES('proj','r');
             INSERT INTO prompt_references VALUES('p','r','character');
             INSERT INTO result_references VALUES('res','r','composition');
             INSERT INTO comparison_sessions(id,title,project_id,created_at,updated_at,comparison_type,outcome_summary) VALUES('session','Compare','proj','t','t','result_result','winner');
             INSERT INTO comparison_items(id,session_id,result_id,created_at,source_role) VALUES('item','session','res','t','candidate');
             INSERT INTO project_deliverables(id,project_id,title,status,linked_prompt_id,linked_result_id,created_at,updated_at) VALUES('deliverable','proj','Hero','planned','p','res','t','t');
             INSERT INTO deliverable_references VALUES('deliverable','r');
             INSERT INTO assistant_threads(id,project_id,title,created_at,updated_at) VALUES('thread','proj','Thread','t','t');
             INSERT INTO assistant_messages(id,thread_id,role,content,created_at) VALUES('message','thread','user','Hello','t');
             INSERT INTO export_presets(id,project_id,format,options,created_at,updated_at) VALUES('export','proj','json','{}','t','t');
             INSERT INTO generation_queue(id,prompt_id,project_id,status,created_at,updated_at,is_pinned) VALUES('queue','p','proj','pending','t','t',1);
             INSERT INTO creative_directions(id,project_id,title,created_at,updated_at) VALUES('direction','proj','Direction','t','t');
             INSERT INTO shot_sequence(id,project_id,prompt_id,result_id,created_at) VALUES('shot','proj','p','res','t');
             INSERT INTO direction_storyboards(id,direction_id,project_id,sort_order,shot_label,description,is_approved,prompt_id,accent_index,created_at,updated_at) VALUES('storyboard','direction','proj',1,'Shot 01','Source shot',1,'p',2,'t','t');
             INSERT INTO inconsistency_events(id,rule_id,rule_label,suggestion,prompt_id,provider,action,created_at) VALUES('event','rule','Source rule','fix it','p','midjourney','used','t');
             INSERT INTO learned_formulas(provider,steps,updated_at) VALUES('midjourney','[\"Subject\"]','t');
             UPDATE app_meta SET value='source-must-not-overwrite' WHERE key='schema_version';
             INSERT INTO app_meta(key,value,updated_at) VALUES('source_custom_setting','kept','t');"
        ).unwrap();
        populate_complete_graph_sentinels(&source_conn);
        assert_complete_graph_sentinel_coverage(&source_conn);
        let target_conn = Connection::open(&target_paths.db_path).unwrap();
        target_conn.execute_batch(
            "INSERT INTO campaigns(id,title,status) VALUES('c','Target campaign','active');
             INSERT INTO prompts(id,title,prompt_text,provider) VALUES('p','Target prompt','target','midjourney');
             INSERT INTO \"references\"(id,title,kind,created_at,updated_at) VALUES('r','Target ref','image','t','t');
             INSERT INTO recipes(id,title,created_at,updated_at) VALUES('legacy-recipe','Target recipe','t','t');
             INSERT INTO srefs(id,code,title,created_at,updated_at) VALUES('sref','--sref target','Target sref','t','t');
             INSERT INTO profiles(id,code,title,created_at) VALUES('profile','--profile target','Target profile','t');
             INSERT INTO avoidance_patterns(id,artifact_type,label,category,is_builtin,created_at) VALUES('avoid','target','Target avoid','texture',0,'t');
             INSERT INTO token_categories(id,name,label) VALUES('tc','target-category','Target');
             INSERT INTO tokens(id,text,category_id,is_builtin,created_at) VALUES('tok','target token','tc',0,'t');
             INSERT INTO projects(id,title,status,created_at,updated_at) VALUES('proj','Target project','draft','t','t');
             INSERT INTO results(id,prompt_id,notes,created_at) VALUES('res','p','target result','t');
             INSERT INTO prompt_tokens(id,prompt_id,token_id,sort_order,custom_text) VALUES('pt','p','tok',1,'target');
             INSERT INTO token_patterns(id,token_a_id,token_b_id,co_occurrence_count,last_updated) VALUES('pattern','tok','tok',1,'t');
             INSERT INTO project_prompts VALUES('proj','p');
             INSERT INTO project_results VALUES('proj','res');
             INSERT INTO project_references VALUES('proj','r');
             INSERT INTO prompt_references VALUES('p','r','target');
             INSERT INTO result_references VALUES('res','r','target');
             INSERT INTO comparison_sessions(id,title,project_id,created_at,updated_at) VALUES('session','Target compare','proj','t','t');
             INSERT INTO comparison_items(id,session_id,result_id,created_at) VALUES('item','session','res','t');
             INSERT INTO project_deliverables(id,project_id,title,status,linked_prompt_id,linked_result_id,created_at,updated_at) VALUES('deliverable','proj','Target hero','planned','p','res','t','t');
             INSERT INTO deliverable_references VALUES('deliverable','r');
             INSERT INTO assistant_threads(id,project_id,title,created_at,updated_at) VALUES('thread','proj','Target thread','t','t');
             INSERT INTO assistant_messages(id,thread_id,role,content,created_at) VALUES('message','thread','user','Target','t');
             INSERT INTO export_presets(id,project_id,format,options,created_at,updated_at) VALUES('export','proj','json','{}','t','t');
             INSERT INTO generation_queue(id,prompt_id,project_id,status,created_at,updated_at) VALUES('queue','p','proj','pending','t','t');
             INSERT INTO creative_directions(id,project_id,title,created_at,updated_at) VALUES('direction','proj','Target direction','t','t');
             INSERT INTO shot_sequence(id,project_id,prompt_id,result_id,created_at) VALUES('shot','proj','p','res','t');
             INSERT INTO direction_storyboards(id,direction_id,project_id,sort_order,shot_label,description,is_approved,prompt_id,accent_index,created_at,updated_at) VALUES('storyboard','direction','proj',9,'Shot 99','Target shot',0,'p',4,'t','t');
             INSERT INTO inconsistency_events(id,rule_id,rule_label,suggestion,prompt_id,provider,action,created_at) VALUES('event','rule','Target rule','ignore','p','kling','dismissed','t');"
        ).unwrap();
        drop(source_conn);
        drop(target_conn);

        let report =
            merge_library_package(source.to_str().unwrap(), target.to_str().unwrap()).unwrap();
        assert_eq!(report.manifest_version, 1);
        for table in REQUIRED_RELEASE_TABLES {
            assert!(
                report.tables.contains_key(table),
                "missing report for {table}"
            );
        }
        let remapped = |table: &str, source_id: &str| {
            report
                .id_remaps
                .iter()
                .find(|r| r.table == table && r.source_id == source_id)
                .map(|r| r.target_id.clone())
                .unwrap_or_else(|| source_id.to_string())
        };
        let merged_prompt = remapped("prompts", "p");
        let merged_project = remapped("projects", "proj");
        let merged_result = remapped("results", "res");
        let merged_campaign = remapped("campaigns", "c");
        let merged_category = remapped("token_categories", "tc");
        let merged_token = remapped("tokens", "tok");
        for spec in MERGE_MANIFEST {
            if let MergeIdentity::Id(_) = spec.identity {
                let (_, identity) = complete_graph_identity(spec.table);
                let source_id = value_as_string(&identity[0]).unwrap();
                assert_ne!(
                    remapped(spec.table, &source_id),
                    source_id,
                    "{} did not exercise a differing-ID collision",
                    spec.table
                );
            }
        }
        let conn = Connection::open(&target_paths.db_path).unwrap();
        assert_eq!(
            conn.query_row(
                "SELECT recipe_use_count FROM prompts WHERE id=?1",
                [&merged_prompt],
                |r| r.get::<_, i64>(0)
            )
            .unwrap(),
            7
        );
        assert_eq!(
            conn.query_row(
                "SELECT campaign_id FROM projects WHERE id=?1",
                [&merged_project],
                |r| r.get::<_, String>(0)
            )
            .unwrap(),
            merged_campaign
        );
        assert_eq!(
            conn.query_row(
                "SELECT prompt_id FROM results WHERE id=?1",
                [&merged_result],
                |r| r.get::<_, String>(0)
            )
            .unwrap(),
            merged_prompt
        );
        assert_eq!(
            conn.query_row(
                "SELECT category_id FROM tokens WHERE id=?1",
                [&merged_token],
                |r| r.get::<_, String>(0),
            )
            .unwrap(),
            merged_category
        );
        assert_eq!(
            conn.query_row(
                "SELECT COUNT(*) FROM project_results WHERE project_id=?1 AND result_id=?2",
                [&merged_project, &merged_result],
                |r| r.get::<_, i64>(0)
            )
            .unwrap(),
            1
        );
        assert_eq!(
            conn.query_row(
                "SELECT value FROM app_meta WHERE key='source_custom_setting'",
                [],
                |r| r.get::<_, String>(0)
            )
            .unwrap(),
            "sentinel-app_meta-value"
        );
        assert_ne!(
            conn.query_row(
                "SELECT value FROM app_meta WHERE key='schema_version'",
                [],
                |r| r.get::<_, String>(0)
            )
            .unwrap(),
            "source-must-not-overwrite"
        );
        drop(conn);
        assert_manifest_rows_preserved(&source_paths.db_path, &target_paths.db_path, &report);

        let repeat =
            merge_library_package(source.to_str().unwrap(), target.to_str().unwrap()).unwrap();
        assert_eq!(
            repeat
                .tables
                .values()
                .map(|table| table.imported)
                .sum::<u32>(),
            0
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn merge_db_failure_rolls_back_all_tables_and_staged_media() {
        let root = test_root("merge-db-rollback");
        let source = root.join("Source.framecraftlib");
        let target = root.join("Target.framecraftlib");
        let source_paths = create_library_package(source.to_str().unwrap(), true).unwrap();
        let target_paths = create_library_package(target.to_str().unwrap(), true).unwrap();
        insert_prompt(&source_paths.db_path, "new-prompt", "New prompt");
        fs::write(source.join("results/rollback.png"), "staged image").unwrap();
        insert_result(
            &source_paths.db_path,
            "rollback-result",
            "new-prompt",
            Some(&format!("{}rollback.png", source_paths.results_dir)),
            None,
        );
        let source_conn = Connection::open(&source_paths.db_path).unwrap();
        source_conn.execute_batch("INSERT INTO recipes(id,title,created_at,updated_at) VALUES('rollback-recipe','Rollback','t','t'); INSERT INTO projects(id,title,status,created_at,updated_at) VALUES('rollback-project','Project','draft','t','t'); INSERT INTO assistant_threads(id,project_id,title,created_at,updated_at) VALUES('rollback-thread','rollback-project','Thread','t','t'); PRAGMA ignore_check_constraints=ON; INSERT INTO assistant_messages(id,thread_id,role,content,created_at) VALUES('invalid-message','rollback-thread','invalid','bad','t'); PRAGMA ignore_check_constraints=OFF;").unwrap();
        insert_prompt(&target_paths.db_path, "new-prompt", "New prompt");
        drop(source_conn);

        assert!(merge_library_package(source.to_str().unwrap(), target.to_str().unwrap()).is_err());
        let conn = Connection::open(&target_paths.db_path).unwrap();
        assert_eq!(
            conn.query_row(
                "SELECT COUNT(*) FROM recipes WHERE id='rollback-recipe'",
                [],
                |row| row.get::<_, i64>(0)
            )
            .unwrap(),
            0
        );
        assert!(result_paths(&target_paths.db_path, "rollback-result").is_none());
        assert!(!target.join("results/rollback.png").exists());
        assert!(fs::read_dir(&target_paths.staging_dir)
            .unwrap()
            .next()
            .is_none());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn merge_media_stage_failure_leaves_no_target_rows_or_files() {
        let root = test_root("merge-media-stage-rollback");
        let source = root.join("Source.framecraftlib");
        let target = root.join("Target.framecraftlib");
        let source_paths = create_library_package(source.to_str().unwrap(), true).unwrap();
        let target_paths = create_library_package(target.to_str().unwrap(), true).unwrap();
        insert_prompt(&source_paths.db_path, "media-prompt", "Media prompt");
        insert_result(
            &source_paths.db_path,
            "missing-media",
            "media-prompt",
            Some(&format!("{}missing.png", source_paths.results_dir)),
            None,
        );

        assert!(merge_library_package(source.to_str().unwrap(), target.to_str().unwrap()).is_err());
        assert!(prompt_title(&target_paths.db_path, "media-prompt").is_none());
        assert!(result_paths(&target_paths.db_path, "missing-media").is_none());
        assert!(!target.join("results/missing.png").exists());
        assert!(fs::read_dir(&target_paths.staging_dir)
            .unwrap()
            .next()
            .is_none());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn merge_media_publish_failure_rolls_back_transaction_and_preserves_preexisting_rows() {
        let root = test_root("merge-media-publish-compensation");
        let source = root.join("Source.framecraftlib");
        let target = root.join("Target.framecraftlib");
        let source_paths = create_library_package(source.to_str().unwrap(), true).unwrap();
        let target_paths = create_library_package(target.to_str().unwrap(), true).unwrap();
        insert_prompt(&source_paths.db_path, "publish-prompt", "Publish prompt");
        insert_prompt(&target_paths.db_path, "preexisting-prompt", "Keep me");
        fs::create_dir_all(source.join("results/blocked")).unwrap();
        fs::write(source.join("results/good.png"), "first published image").unwrap();
        fs::write(
            source.join("results/blocked/thumb.png"),
            "second staged image",
        )
        .unwrap();
        fs::write(target.join("results/blocked"), "pre-existing target file").unwrap();
        insert_result(
            &source_paths.db_path,
            "publish-result",
            "publish-prompt",
            Some(&format!("{}good.png", source_paths.results_dir)),
            Some(&format!("{}blocked/thumb.png", source_paths.results_dir)),
        );

        assert!(merge_library_package(source.to_str().unwrap(), target.to_str().unwrap()).is_err());
        assert!(prompt_title(&target_paths.db_path, "publish-prompt").is_none());
        assert!(result_paths(&target_paths.db_path, "publish-result").is_none());
        assert_eq!(
            prompt_title(&target_paths.db_path, "preexisting-prompt").as_deref(),
            Some("Keep me")
        );
        assert!(!target.join("results/good.png").exists());
        assert_eq!(
            fs::read_to_string(target.join("results/blocked")).unwrap(),
            "pre-existing target file"
        );
        assert!(fs::read_dir(&target_paths.staging_dir)
            .unwrap()
            .next()
            .is_none());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn merge_media_publish_collision_preserves_race_created_destination() {
        let root = test_root("merge-media-publish-race");
        let staged_path = root.join("staging/image.png");
        let final_path = root.join("results/image.png");
        fs::create_dir_all(staged_path.parent().unwrap()).unwrap();
        fs::create_dir_all(final_path.parent().unwrap()).unwrap();
        fs::write(&staged_path, "staged source bytes").unwrap();

        // Simulate another writer winning the destination name after staging.
        fs::write(&final_path, "race winner bytes").unwrap();
        let mut published = Vec::new();
        let error = publish_staged_media(
            &[StagedMedia {
                staged: staged_path.clone(),
                final_path: final_path.clone(),
            }],
            &mut published,
        )
        .expect_err("publication must not replace a destination created after staging");

        assert!(!error.is_empty());
        assert!(published.is_empty());
        assert_eq!(
            fs::read_to_string(&final_path).unwrap(),
            "race winner bytes"
        );
        assert!(staged_path.exists());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn merge_publish_race_rolls_back_rows_and_removes_owned_files_only() {
        let root = test_root("merge-media-publish-race-compensation");
        let source = root.join("Source.framecraftlib");
        let target = root.join("Target.framecraftlib");
        let source_paths = create_library_package(source.to_str().unwrap(), true).unwrap();
        let target_paths = create_library_package(target.to_str().unwrap(), true).unwrap();
        insert_prompt(&source_paths.db_path, "race-prompt", "Race prompt");
        fs::write(source.join("results/owned.png"), "merge-owned bytes").unwrap();
        fs::write(source.join("results/race.png"), "staged race bytes").unwrap();
        insert_result(
            &source_paths.db_path,
            "race-result",
            "race-prompt",
            Some(&format!("{}owned.png", source_paths.results_dir)),
            Some(&format!("{}race.png", source_paths.results_dir)),
        );
        let create_race_destination = |staged: &[StagedMedia]| {
            assert_eq!(staged.len(), 2);
            assert!(
                prompt_title(&target_paths.db_path, "race-prompt").is_none(),
                "planned rows must remain invisible until media publication succeeds"
            );
            fs::write(&staged[1].final_path, "race winner bytes").map_err(format_io_error)
        };

        let error = merge_library_package_with_media_publish_hook(
            source.to_str().unwrap(),
            target.to_str().unwrap(),
            Some(&create_race_destination),
        )
        .err()
        .expect("the publish-time destination collision must fail the merge");

        assert!(!error.is_empty());
        assert!(prompt_title(&target_paths.db_path, "race-prompt").is_none());
        assert!(result_paths(&target_paths.db_path, "race-result").is_none());
        assert!(!target.join("results/owned.png").exists());
        assert_eq!(
            fs::read_to_string(target.join("results/race.png")).unwrap(),
            "race winner bytes"
        );
        assert!(fs::read_dir(&target_paths.staging_dir)
            .unwrap()
            .next()
            .is_none());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn merge_commit_failure_rolls_back_rows_and_removes_published_media() {
        let root = test_root("merge-commit-failure");
        let source = root.join("Source.framecraftlib");
        let target = root.join("Target.framecraftlib");
        let source_paths = create_library_package(source.to_str().unwrap(), true).unwrap();
        let target_paths = create_library_package(target.to_str().unwrap(), true).unwrap();
        insert_prompt(&source_paths.db_path, "commit-prompt", "Commit prompt");
        fs::write(source.join("results/commit.png"), "published bytes").unwrap();
        insert_result(
            &source_paths.db_path,
            "commit-result",
            "commit-prompt",
            Some(&format!("{}commit.png", source_paths.results_dir)),
            None,
        );
        let force_deferred_commit_failure = |connection: &Connection| {
            connection
                .execute_batch(
                    "PRAGMA defer_foreign_keys=ON;
                     INSERT INTO results(id,prompt_id,created_at)
                     VALUES('invalid-at-commit','missing-prompt','t');",
                )
                .map_err(|error| error.to_string())
        };

        let error = merge_library_package_with_hooks(
            source.to_str().unwrap(),
            target.to_str().unwrap(),
            None,
            Some(&force_deferred_commit_failure),
        )
        .err()
        .expect("deferred foreign-key violation must fail commit");

        assert!(error.contains("database commit failed"), "{error}");
        assert!(prompt_title(&target_paths.db_path, "commit-prompt").is_none());
        assert!(result_paths(&target_paths.db_path, "commit-result").is_none());
        assert!(!target.join("results/commit.png").exists());
        assert!(fs::read_dir(&target_paths.staging_dir)
            .unwrap()
            .next()
            .is_none());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn owned_media_cleanup_aggregates_failures_and_attempts_every_path() {
        let root = test_root("merge-cleanup-aggregation");
        let unremovable_as_file = root.join("directory");
        let removable = root.join("removable.png");
        fs::create_dir_all(&unremovable_as_file).unwrap();
        fs::write(&removable, "owned").unwrap();

        let errors =
            cleanup_owned_merge_media(&[], &[unremovable_as_file.clone(), removable.clone()]);

        assert_eq!(errors.len(), 1);
        assert!(errors[0].contains(unremovable_as_file.to_str().unwrap()));
        assert!(!removable.exists(), "cleanup must continue after an error");
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn merge_transitively_excludes_dependents_of_unmapped_builtin_seed() {
        let root = test_root("merge-transitive-seed-exclusion");
        let source = root.join("Source.framecraftlib");
        let target = root.join("Target.framecraftlib");
        let source_paths = create_library_package(source.to_str().unwrap(), true).unwrap();
        let target_paths = create_library_package(target.to_str().unwrap(), true).unwrap();
        let seed_title = MIGRATION_022_NANO_BANANA_TITLES[0];
        let source_seed_id = "legacy-seed";
        let source_conn = Connection::open(&source_paths.db_path).unwrap();
        source_conn
            .execute_batch(&format!(
                "INSERT INTO prompts(id,title,prompt_text,provider) VALUES('{source_seed_id}','{seed_title}','legacy seed','nano_banana');
                 INSERT INTO projects(id,title,status,created_at,updated_at) VALUES('source-project','Source project','draft','t','t');
                 INSERT INTO results(id,prompt_id,notes,created_at) VALUES('legacy-result','{source_seed_id}','must be excluded','t');
                 INSERT INTO project_results(project_id,result_id) VALUES('source-project','legacy-result');"
            ))
            .unwrap();

        let target_conn = Connection::open(&target_paths.db_path).unwrap();
        target_conn
            .execute_batch(
                "INSERT INTO prompts(id,title,prompt_text,provider) VALUES('ordinary-prompt','Ordinary','target','midjourney');
                 INSERT INTO results(id,prompt_id,notes,created_at) VALUES('legacy-result','ordinary-prompt','unrelated target row','t');",
            )
            .unwrap();
        drop(source_conn);
        drop(target_conn);

        let report =
            merge_library_package(source.to_str().unwrap(), target.to_str().unwrap()).unwrap();
        let conn = Connection::open(&target_paths.db_path).unwrap();
        assert_eq!(
            conn.query_row(
                "SELECT COUNT(*) FROM project_results WHERE result_id='legacy-result'",
                [],
                |row| row.get::<_, i64>(0),
            )
            .unwrap(),
            0,
            "a dependent must not attach to an unrelated target row reusing the excluded source id"
        );
        assert_eq!(
            conn.query_row(
                "SELECT notes FROM results WHERE id='legacy-result'",
                [],
                |row| row.get::<_, String>(0),
            )
            .unwrap(),
            "unrelated target row"
        );
        assert_eq!(report.tables["results"].excluded, 1);
        assert_eq!(report.tables["project_results"].excluded, 1);
        assert_eq!(report.tables["results"].skipped_duplicates, 0);
        assert_eq!(report.tables["project_results"].skipped_duplicates, 0);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn merge_media_only_differences_are_imported_and_repeat_is_idempotent() {
        let root = test_root("merge-media-identity");
        let source = root.join("Source.framecraftlib");
        let target = root.join("Target.framecraftlib");
        let source_paths = create_library_package(source.to_str().unwrap(), true).unwrap();
        let target_paths = create_library_package(target.to_str().unwrap(), true).unwrap();
        insert_prompt(&source_paths.db_path, "p", "Prompt");
        insert_prompt(&target_paths.db_path, "p", "Prompt");
        fs::write(source.join("results/source.png"), "source-result").unwrap();
        fs::write(target.join("results/target.png"), "target-result").unwrap();
        insert_result(
            &source_paths.db_path,
            "same-result",
            "p",
            Some(&format!("{}source.png", source_paths.results_dir)),
            None,
        );
        insert_result(
            &target_paths.db_path,
            "same-result",
            "p",
            Some(&format!("{}target.png", target_paths.results_dir)),
            None,
        );
        fs::write(source.join("references/source.png"), "source-reference").unwrap();
        fs::write(target.join("references/target.png"), "target-reference").unwrap();
        insert_reference(
            &source_paths.db_path,
            "same-reference",
            "Reference",
            Some(&format!("{}source.png", source_paths.references_dir)),
            None,
        );
        insert_reference(
            &target_paths.db_path,
            "same-reference",
            "Reference",
            Some(&format!("{}target.png", target_paths.references_dir)),
            None,
        );

        let report =
            merge_library_package(source.to_str().unwrap(), target.to_str().unwrap()).unwrap();
        assert_eq!(report.results.imported, 1);
        assert_eq!(report.references.imported, 1);
        let result_id = report
            .id_remaps
            .iter()
            .find(|r| r.table == "results" && r.source_id == "same-result")
            .unwrap()
            .target_id
            .clone();
        let reference_id = report
            .id_remaps
            .iter()
            .find(|r| r.table == "references" && r.source_id == "same-reference")
            .unwrap()
            .target_id
            .clone();
        assert_eq!(
            fs::read_to_string(
                result_paths(&target_paths.db_path, &result_id)
                    .unwrap()
                    .1
                    .unwrap()
            )
            .unwrap(),
            "source-result"
        );
        assert_eq!(
            fs::read_to_string(
                reference_paths(&target_paths.db_path, &reference_id)
                    .unwrap()
                    .1
                    .unwrap()
            )
            .unwrap(),
            "source-reference"
        );

        let repeat =
            merge_library_package(source.to_str().unwrap(), target.to_str().unwrap()).unwrap();
        assert_eq!(repeat.results.imported, 0);
        assert_eq!(repeat.references.imported, 0);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn merge_resolves_all_declared_unique_keys_without_aborting() {
        let root = test_root("merge-unique-keys");
        let source = root.join("Source.framecraftlib");
        let target = root.join("Target.framecraftlib");
        let source_paths = create_library_package(source.to_str().unwrap(), true).unwrap();
        let target_paths = create_library_package(target.to_str().unwrap(), true).unwrap();
        for paths in [&source_paths, &target_paths] {
            insert_prompt(&paths.db_path, "p", "Prompt");
        }
        let source_conn = Connection::open(&source_paths.db_path).unwrap();
        source_conn.execute_batch("INSERT INTO token_categories(id,name,label) VALUES('source-cat','semantic-name','Source'); INSERT INTO tokens(id,text,category_id,is_builtin,created_at) VALUES('source-token','token','source-cat',0,'t'); INSERT INTO token_patterns(id,token_a_id,token_b_id,co_occurrence_count,last_updated) VALUES('source-pattern','source-token','source-token',2,'t'); INSERT INTO results(id,prompt_id,created_at) VALUES('result','p','t'); INSERT INTO comparison_sessions(id,title,created_at,updated_at) VALUES('session','Session','t','t'); INSERT INTO comparison_items(id,session_id,result_id,notes,created_at) VALUES('source-item','session','result','source','t'); INSERT INTO generation_queue(id,prompt_id,status,notes,created_at,updated_at) VALUES('source-queue','p','pending','source','t','t');").unwrap();
        let target_conn = Connection::open(&target_paths.db_path).unwrap();
        target_conn.execute_batch("INSERT INTO token_categories(id,name,label) VALUES('target-cat','semantic-name','Target'); INSERT INTO tokens(id,text,category_id,is_builtin,created_at) VALUES('target-token','token','target-cat',0,'t'); INSERT INTO token_patterns(id,token_a_id,token_b_id,co_occurrence_count,last_updated) VALUES('target-pattern','target-token','target-token',8,'t'); INSERT INTO results(id,prompt_id,created_at) VALUES('result','p','t'); INSERT INTO comparison_sessions(id,title,created_at,updated_at) VALUES('session','Session','t','t'); INSERT INTO comparison_items(id,session_id,result_id,notes,created_at) VALUES('target-item','session','result','target','t'); INSERT INTO generation_queue(id,prompt_id,status,notes,created_at,updated_at) VALUES('target-queue','p','pending','target','t','t');").unwrap();
        drop(source_conn);
        drop(target_conn);

        let report =
            merge_library_package(source.to_str().unwrap(), target.to_str().unwrap()).unwrap();
        assert!(report
            .id_remaps
            .iter()
            .any(|r| r.table == "token_categories"
                && r.source_id == "source-cat"
                && r.target_id == "target-cat"));
        assert_eq!(report.tables["token_patterns"].skipped_duplicates, 1);
        assert_eq!(report.tables["comparison_items"].skipped_duplicates, 1);
        assert_eq!(report.tables["generation_queue"].skipped_duplicates, 1);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn merge_resolves_unique_keys_against_earlier_planned_rows_after_fk_collapse() {
        let root = test_root("merge-planned-unique");
        let source = root.join("Source.framecraftlib");
        let target = root.join("Target.framecraftlib");
        let source_paths = create_library_package(source.to_str().unwrap(), true).unwrap();
        let target_paths = create_library_package(target.to_str().unwrap(), true).unwrap();
        insert_prompt(&source_paths.db_path, "source-prompt-a", "Equivalent");
        insert_prompt(&source_paths.db_path, "source-prompt-b", "Equivalent");
        insert_prompt(&target_paths.db_path, "target-prompt", "Equivalent");
        let source_conn = Connection::open(&source_paths.db_path).unwrap();
        source_conn.execute_batch("INSERT INTO generation_queue(id,prompt_id,status,notes,created_at,updated_at) VALUES('queue-a','source-prompt-a','pending','first','t','t'); INSERT INTO generation_queue(id,prompt_id,status,notes,created_at,updated_at) VALUES('queue-b','source-prompt-b','pending','second','t','t');").unwrap();
        drop(source_conn);

        let report =
            merge_library_package(source.to_str().unwrap(), target.to_str().unwrap()).unwrap();
        assert_eq!(report.tables["generation_queue"].imported, 1);
        assert_eq!(report.tables["generation_queue"].skipped_duplicates, 1);
        let conn = Connection::open(&target_paths.db_path).unwrap();
        assert_eq!(
            conn.query_row(
                "SELECT COUNT(*) FROM generation_queue WHERE prompt_id='target-prompt'",
                [],
                |r| r.get::<_, i64>(0)
            )
            .unwrap(),
            1
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn merge_plans_thousands_of_join_rows_with_indexed_lookups() {
        let root = test_root("merge-scale-indexes");
        let source = root.join("Source.framecraftlib");
        let target = root.join("Target.framecraftlib");
        let source_paths = create_library_package(source.to_str().unwrap(), true).unwrap();
        create_library_package(target.to_str().unwrap(), true).unwrap();
        let mut source_conn = Connection::open(&source_paths.db_path).unwrap();
        let transaction = source_conn.transaction().unwrap();
        transaction
            .execute(
                "INSERT INTO projects(id,title,status,created_at,updated_at)
                 VALUES('scale-project','Scale','draft','t','t')",
                [],
            )
            .unwrap();
        for index in 0..2_000 {
            let prompt_id = format!("scale-prompt-{index}");
            transaction
                .execute(
                    "INSERT INTO prompts(id,title,prompt_text,provider)
                     VALUES(?1,?2,'body','midjourney')",
                    [&prompt_id, &format!("Prompt {index}")],
                )
                .unwrap();
            transaction
                .execute(
                    "INSERT INTO project_prompts(project_id,prompt_id)
                     VALUES('scale-project',?1)",
                    [&prompt_id],
                )
                .unwrap();
        }
        transaction.commit().unwrap();
        drop(source_conn);

        let started = std::time::Instant::now();
        let report =
            merge_library_package(source.to_str().unwrap(), target.to_str().unwrap()).unwrap();
        assert_eq!(report.tables["prompts"].imported, 2_000);
        assert_eq!(report.tables["project_prompts"].imported, 2_000);
        assert!(
            started.elapsed() < Duration::from_secs(30),
            "indexed merge planning exceeded generous scale bound: {:?}",
            started.elapsed()
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn merge_remaps_child_before_parent_independent_of_source_row_order() {
        let root = test_root("merge-prompt-parent-order");
        let source = root.join("Source.framecraftlib");
        let target = root.join("Target.framecraftlib");
        let source_paths = create_library_package(source.to_str().unwrap(), true).unwrap();
        let target_paths = create_library_package(target.to_str().unwrap(), true).unwrap();
        insert_prompt(&source_paths.db_path, "child", "Child");
        insert_prompt(&source_paths.db_path, "parent", "Source parent");
        Connection::open(&source_paths.db_path)
            .unwrap()
            .execute("UPDATE prompts SET parent_id='parent' WHERE id='child'", [])
            .unwrap();
        insert_prompt(&target_paths.db_path, "parent", "Target parent");

        let report =
            merge_library_package(source.to_str().unwrap(), target.to_str().unwrap()).unwrap();
        let parent = report
            .id_remaps
            .iter()
            .find(|r| r.table == "prompts" && r.source_id == "parent")
            .unwrap()
            .target_id
            .clone();
        assert_eq!(
            Connection::open(&target_paths.db_path)
                .unwrap()
                .query_row("SELECT parent_id FROM prompts WHERE id='child'", [], |r| {
                    r.get::<_, String>(0)
                })
                .unwrap(),
            parent
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn merge_reallocates_colliding_child_after_parent_sensitive_remap() {
        let root = test_root("merge-parent-sensitive-child");
        let source = root.join("Source.framecraftlib");
        let target = root.join("Target.framecraftlib");
        let source_paths = create_library_package(source.to_str().unwrap(), true).unwrap();
        let target_paths = create_library_package(target.to_str().unwrap(), true).unwrap();
        insert_prompt(&source_paths.db_path, "child", "Same child");
        insert_prompt(&source_paths.db_path, "parent", "Source parent");
        Connection::open(&source_paths.db_path)
            .unwrap()
            .execute("UPDATE prompts SET parent_id='parent' WHERE id='child'", [])
            .unwrap();
        insert_prompt(&target_paths.db_path, "child", "Same child");
        insert_prompt(&target_paths.db_path, "parent", "Target parent");
        Connection::open(&target_paths.db_path)
            .unwrap()
            .execute("UPDATE prompts SET parent_id='parent' WHERE id='child'", [])
            .unwrap();

        let report =
            merge_library_package(source.to_str().unwrap(), target.to_str().unwrap()).unwrap();
        let parent = report
            .id_remaps
            .iter()
            .find(|r| r.table == "prompts" && r.source_id == "parent")
            .unwrap()
            .target_id
            .clone();
        let child = report
            .id_remaps
            .iter()
            .find(|r| r.table == "prompts" && r.source_id == "child")
            .unwrap()
            .target_id
            .clone();
        assert_ne!(child, "child");
        assert_eq!(
            Connection::open(&target_paths.db_path)
                .unwrap()
                .query_row("SELECT parent_id FROM prompts WHERE id=?1", [&child], |r| r
                    .get::<_, String>(0))
                .unwrap(),
            parent
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn merge_remaps_prompt_parent_cycle_to_remapped_cycle() {
        let root = test_root("merge-prompt-parent-cycle");
        let source = root.join("Source.framecraftlib");
        let target = root.join("Target.framecraftlib");
        let source_paths = create_library_package(source.to_str().unwrap(), true).unwrap();
        let target_paths = create_library_package(target.to_str().unwrap(), true).unwrap();
        insert_prompt(&source_paths.db_path, "cycle-a", "Source A");
        insert_prompt(&source_paths.db_path, "cycle-b", "Source B");
        Connection::open(&source_paths.db_path)
            .unwrap()
            .execute_batch(
                "UPDATE prompts SET parent_id='cycle-b' WHERE id='cycle-a';
                 UPDATE prompts SET parent_id='cycle-a' WHERE id='cycle-b';",
            )
            .unwrap();
        insert_prompt(&target_paths.db_path, "cycle-a", "Target A");
        insert_prompt(&target_paths.db_path, "cycle-b", "Target B");

        let report =
            merge_library_package(source.to_str().unwrap(), target.to_str().unwrap()).unwrap();
        let remapped = |source_id: &str| {
            report
                .id_remaps
                .iter()
                .find(|r| r.table == "prompts" && r.source_id == source_id)
                .unwrap()
                .target_id
                .clone()
        };
        let a = remapped("cycle-a");
        let b = remapped("cycle-b");
        assert_ne!(a, "cycle-a");
        assert_ne!(b, "cycle-b");
        let conn = Connection::open(&target_paths.db_path).unwrap();
        assert_eq!(
            conn.query_row("SELECT parent_id FROM prompts WHERE id=?1", [&a], |r| {
                r.get::<_, String>(0)
            })
            .unwrap(),
            b
        );
        assert_eq!(
            conn.query_row("SELECT parent_id FROM prompts WHERE id=?1", [&b], |r| {
                r.get::<_, String>(0)
            })
            .unwrap(),
            a
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn merge_rejects_unknown_source_tables_and_columns() {
        for (label, sql) in [
            (
                "table",
                "CREATE TABLE future_user_data(id TEXT PRIMARY KEY)",
            ),
            ("column", "ALTER TABLE prompts ADD COLUMN future_field TEXT"),
        ] {
            let root = test_root(&format!("merge-unknown-{label}"));
            let source = root.join("Source.framecraftlib");
            let target = root.join("Target.framecraftlib");
            let source_paths = create_library_package(source.to_str().unwrap(), true).unwrap();
            create_library_package(target.to_str().unwrap(), true).unwrap();
            Connection::open(&source_paths.db_path)
                .unwrap()
                .execute_batch(sql)
                .unwrap();
            let error =
                match merge_library_package(source.to_str().unwrap(), target.to_str().unwrap()) {
                    Ok(_) => panic!("unknown schema was accepted"),
                    Err(error) => error,
                };
            assert!(error.contains("unsupported source schema"), "{error}");
            let _ = fs::remove_dir_all(root);
        }
    }

    fn test_root(label: &str) -> PathBuf {
        let root = env::temp_dir().join(format!(
            "framecraft-{label}-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        root
    }

    fn assert_merge_rejects_media_path(root: &Path, label: &str, media_path: &str) {
        let source = root.join("Source.framecraftlib");
        let target = root.join("Target.framecraftlib");
        let source_paths = if source.join("framecraft.db").exists() {
            resolve_library_paths(source.to_str().unwrap())
        } else {
            create_library_package(source.to_str().unwrap(), true).unwrap()
        };
        let target_paths = create_library_package(target.to_str().unwrap(), true).unwrap();
        insert_prompt(&source_paths.db_path, "unsafe-prompt", "Unsafe prompt");
        insert_result(
            &source_paths.db_path,
            "unsafe-result",
            "unsafe-prompt",
            Some(media_path),
            None,
        );

        assert!(
            merge_library_package(source.to_str().unwrap(), target.to_str().unwrap()).is_err(),
            "{label} media path must fail"
        );
        assert!(prompt_title(&target_paths.db_path, "unsafe-prompt").is_none());
        assert!(result_paths(&target_paths.db_path, "unsafe-result").is_none());
        assert!(fs::read_dir(&target_paths.results_dir)
            .unwrap()
            .next()
            .is_none());
        assert!(fs::read_dir(&target_paths.staging_dir)
            .unwrap()
            .next()
            .is_none());
    }

    fn assert_manifest_rows_preserved(
        source_db: &str,
        target_db: &str,
        report: &LibraryMergeReport,
    ) {
        let source = Connection::open(source_db).unwrap();
        let target = Connection::open(target_db).unwrap();
        let remapped = |table: &str, id: &str| {
            report
                .id_remaps
                .iter()
                .find(|entry| entry.table == table && entry.source_id == id)
                .map(|entry| entry.target_id.clone())
                .unwrap_or_else(|| id.to_string())
        };
        for spec in MERGE_MANIFEST.iter().copied() {
            let mut excluded = HashMap::new();
            for source_row in read_manifest_rows(&source, spec, &mut excluded).unwrap() {
                if spec.table == "app_meta" {
                    let key = value_as_string(&source_row.values[0]).unwrap();
                    if key != "source_custom_setting" {
                        continue;
                    }
                }
                let mut expected = source_row.clone();
                for foreign_key in spec.foreign_keys {
                    let index = column_index(spec.columns, foreign_key.column).unwrap();
                    if let Value::Text(id) = &expected.values[index] {
                        expected.values[index] = Value::Text(remapped(foreign_key.table, id));
                    }
                }
                let actual = match spec.identity {
                    MergeIdentity::Id(_) => {
                        let id_index = column_index(spec.columns, "id").unwrap();
                        let source_id = value_as_string(&source_row.values[id_index]).unwrap();
                        let target_id = remapped(spec.table, &source_id);
                        expected.values[id_index] = Value::Text(target_id.clone());
                        read_manifest_by_keys(&target, spec, &["id"], &[Value::Text(target_id)])
                            .unwrap()
                            .unwrap()
                    }
                    MergeIdentity::Composite(keys) | MergeIdentity::TargetOwned(keys) => {
                        let values = key_values(spec, &expected, keys).unwrap();
                        read_manifest_by_keys(&target, spec, keys, &values)
                            .unwrap()
                            .unwrap()
                    }
                };
                assert_eq!(
                    actual, expected,
                    "manifest field mismatch in {}",
                    spec.table
                );
            }
        }
    }

    fn complete_graph_identity(table: &str) -> (&'static [&'static str], Vec<Value>) {
        match table {
            "campaigns" => (&["id"], vec![Value::Text("c".into())]),
            "prompts" => (&["id"], vec![Value::Text("p".into())]),
            "references" => (&["id"], vec![Value::Text("r".into())]),
            "recipes" => (&["id"], vec![Value::Text("legacy-recipe".into())]),
            "srefs" => (&["id"], vec![Value::Text("sref".into())]),
            "profiles" => (&["id"], vec![Value::Text("profile".into())]),
            "avoidance_patterns" => (&["id"], vec![Value::Text("avoid".into())]),
            "token_categories" => (&["id"], vec![Value::Text("tc".into())]),
            "tokens" => (&["id"], vec![Value::Text("tok".into())]),
            "projects" => (&["id"], vec![Value::Text("proj".into())]),
            "results" => (&["id"], vec![Value::Text("res".into())]),
            "prompt_tokens" => (&["id"], vec![Value::Text("pt".into())]),
            "token_patterns" => (&["id"], vec![Value::Text("pattern".into())]),
            "project_prompts" => (
                &["project_id", "prompt_id"],
                vec![Value::Text("proj".into()), Value::Text("p".into())],
            ),
            "project_results" => (
                &["project_id", "result_id"],
                vec![Value::Text("proj".into()), Value::Text("res".into())],
            ),
            "project_references" => (
                &["project_id", "reference_id"],
                vec![Value::Text("proj".into()), Value::Text("r".into())],
            ),
            "prompt_references" => (
                &["prompt_id", "reference_id"],
                vec![Value::Text("p".into()), Value::Text("r".into())],
            ),
            "result_references" => (
                &["result_id", "reference_id"],
                vec![Value::Text("res".into()), Value::Text("r".into())],
            ),
            "comparison_sessions" => (&["id"], vec![Value::Text("session".into())]),
            "comparison_items" => (&["id"], vec![Value::Text("item".into())]),
            "project_deliverables" => (&["id"], vec![Value::Text("deliverable".into())]),
            "deliverable_references" => (
                &["deliverable_id", "reference_id"],
                vec![Value::Text("deliverable".into()), Value::Text("r".into())],
            ),
            "assistant_threads" => (&["id"], vec![Value::Text("thread".into())]),
            "assistant_messages" => (&["id"], vec![Value::Text("message".into())]),
            "export_presets" => (&["id"], vec![Value::Text("export".into())]),
            "generation_queue" => (&["id"], vec![Value::Text("queue".into())]),
            "creative_directions" => (&["id"], vec![Value::Text("direction".into())]),
            "shot_sequence" => (&["id"], vec![Value::Text("shot".into())]),
            "direction_storyboards" => (&["id"], vec![Value::Text("storyboard".into())]),
            "inconsistency_events" => (&["id"], vec![Value::Text("event".into())]),
            "learned_formulas" => (&["provider"], vec![Value::Text("midjourney".into())]),
            "app_meta" => (&["key"], vec![Value::Text("source_custom_setting".into())]),
            _ => panic!("missing complete graph identity for {table}"),
        }
    }

    fn sentinel_value(table: &str, column: &str) -> Value {
        if column == "is_builtin" {
            return Value::Integer(0);
        }
        if column.starts_with("is_") {
            return Value::Integer(1);
        }
        if matches!(
            column,
            "rating"
                | "use_count"
                | "sort_order"
                | "recipe_use_count"
                | "ai_look_risk"
                | "reuse_potential"
                | "version"
                | "score_overall"
                | "score_realism"
                | "score_brand_fit"
                | "score_composition"
                | "score_lighting"
                | "score_ai_risk"
                | "position"
                | "co_occurrence_count"
        ) {
            return Value::Integer(7);
        }
        if matches!(column, "quality_score" | "avg_rating") {
            return Value::Real(7.5);
        }
        if column == "status" {
            return Value::Text(
                match table {
                    "project_deliverables" => "final",
                    "generation_queue" => "done",
                    _ => "sentinel-status",
                }
                .into(),
            );
        }
        if column == "role" && table == "assistant_messages" {
            return Value::Text("assistant".into());
        }
        if column == "format" {
            return Value::Text("html".into());
        }
        if column == "severity" {
            return Value::Text("critical".into());
        }
        if matches!(
            column,
            "created_at" | "updated_at" | "last_updated" | "due_date"
        ) {
            return Value::Text("2099-01-02T03:04:05Z".into());
        }
        if column == "source_url" {
            return Value::Text("https://example.invalid/sentinel".into());
        }
        if matches!(
            column,
            "file_path" | "thumbnail_path" | "file_data" | "thumbnail_data"
        ) {
            return Value::Text("data:image/png;base64,c2VudGluZWw=".into());
        }
        if matches!(
            column,
            "tags"
                | "parameters"
                | "builder_state"
                | "options"
                | "citations"
                | "aspect_ratios"
                | "provider_targets"
                | "image_needs"
                | "video_needs"
                | "constraints"
        ) {
            return Value::Text("{\"sentinel\":true}".into());
        }
        Value::Text(format!("sentinel-{table}-{column}"))
    }

    fn populate_complete_graph_sentinels(conn: &Connection) {
        for spec in MERGE_MANIFEST.iter().copied() {
            let (keys, values) = complete_graph_identity(spec.table);
            let foreign_keys = spec
                .foreign_keys
                .iter()
                .map(|fk| fk.column)
                .collect::<Vec<_>>();
            for column in spec.columns {
                if keys.contains(column) || foreign_keys.contains(column) {
                    continue;
                }
                let clause = keys
                    .iter()
                    .enumerate()
                    .map(|(index, key)| format!("{}=?{}", quote_identifier(key), index + 2))
                    .collect::<Vec<_>>()
                    .join(" AND ");
                let sql = format!(
                    "UPDATE {} SET {}=?1 WHERE {clause}",
                    quote_identifier(spec.table),
                    quote_identifier(column)
                );
                let sentinel = sentinel_value(spec.table, column);
                assert_eq!(
                    conn.execute(
                        &sql,
                        params_from_iter(std::iter::once(&sentinel).chain(values.iter()))
                    )
                    .unwrap(),
                    1,
                    "missing fixture row for {}",
                    spec.table
                );
            }
        }
    }

    fn assert_complete_graph_sentinel_coverage(conn: &Connection) {
        for spec in MERGE_MANIFEST.iter().copied() {
            let (keys, values) = complete_graph_identity(spec.table);
            let row = read_manifest_by_keys(conn, spec, keys, &values)
                .unwrap()
                .unwrap();
            let foreign_keys = spec
                .foreign_keys
                .iter()
                .map(|fk| fk.column)
                .collect::<Vec<_>>();
            for (index, column) in spec.columns.iter().enumerate() {
                if keys.contains(column) || foreign_keys.contains(column) {
                    continue;
                }
                assert_eq!(
                    row.values[index],
                    sentinel_value(spec.table, column),
                    "complete graph fixture lacks non-default sentinel for {}.{column}",
                    spec.table
                );
            }
        }
    }

    fn create_historical_package(package: &Path, migration_count: usize) -> PathBuf {
        fs::create_dir_all(package).unwrap();
        let db_path = package.join("framecraft.db");
        let conn = rusqlite::Connection::open(&db_path).unwrap();
        for sql in migration_sql().iter().take(migration_count) {
            conn.execute_batch(sql).unwrap();
        }
        db_path
    }

    fn sqlite_table_exists(db_path: &str, table: &str) -> bool {
        let conn = rusqlite::Connection::open(db_path).unwrap();
        conn.query_row(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?1 LIMIT 1",
            [table],
            |_| Ok(()),
        )
        .is_ok()
    }

    fn sqlite_column_exists(db_path: &str, table: &str, column: &str) -> bool {
        let conn = rusqlite::Connection::open(db_path).unwrap();
        let mut statement = conn
            .prepare(&format!("PRAGMA table_info({table})"))
            .unwrap();
        let rows = statement
            .query_map([], |row| row.get::<_, String>(1))
            .unwrap();

        let exists = rows
            .into_iter()
            .any(|row| row.map(|name| name == column).unwrap_or(false));
        drop(statement);
        exists
    }

    fn insert_prompt(db_path: &str, id: &str, title: &str) {
        insert_prompt_for_provider(db_path, id, title, "midjourney");
    }

    fn insert_prompt_for_provider(db_path: &str, id: &str, title: &str, provider: &str) {
        let conn = rusqlite::Connection::open(db_path).unwrap();
        conn.execute(
            "INSERT INTO prompts (id, title, provider, prompt_text, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, '2026-06-26T00:00:00Z', '2026-06-26T00:00:00Z')",
            (id, title, provider, format!("Prompt text for {title}")),
        )
        .unwrap();
    }

    fn insert_result(
        db_path: &str,
        id: &str,
        prompt_id: &str,
        file_path: Option<&str>,
        thumbnail_path: Option<&str>,
    ) {
        let conn = rusqlite::Connection::open(db_path).unwrap();
        conn.execute(
            "INSERT INTO results (id, prompt_id, file_path, thumbnail_path, provider, notes, created_at)
             VALUES (?1, ?2, ?3, ?4, 'midjourney', 'source result', '2026-06-26T00:00:00Z')",
            (id, prompt_id, file_path, thumbnail_path),
        )
        .unwrap();
    }

    fn insert_reference(
        db_path: &str,
        id: &str,
        title: &str,
        file_data: Option<&str>,
        thumbnail_data: Option<&str>,
    ) {
        let conn = rusqlite::Connection::open(db_path).unwrap();
        conn.execute(
            "INSERT INTO \"references\" (id, title, kind, file_data, thumbnail_data, rating, created_at, updated_at)
             VALUES (?1, ?2, 'image', ?3, ?4, 0, '2026-06-26T00:00:00Z', '2026-06-26T00:00:00Z')",
            (id, title, file_data, thumbnail_data),
        )
        .unwrap();
    }

    fn prompt_title(db_path: &str, id: &str) -> Option<String> {
        let conn = rusqlite::Connection::open(db_path).unwrap();
        conn.query_row("SELECT title FROM prompts WHERE id = ?1", [id], |row| {
            row.get(0)
        })
        .ok()
    }

    fn migration_022_seed_ids(db_path: &str) -> Vec<String> {
        let conn = rusqlite::Connection::open(db_path).unwrap();
        let mut statement = conn
            .prepare(
                "SELECT id FROM prompts
                 WHERE provider = ?1 AND title IN (?2, ?3, ?4, ?5)
                 ORDER BY title",
            )
            .unwrap();
        statement
            .query_map(
                params_from_iter(
                    std::iter::once("nano_banana")
                        .chain(MIGRATION_022_NANO_BANANA_TITLES.iter().copied()),
                ),
                |row| row.get(0),
            )
            .unwrap()
            .map(Result::unwrap)
            .collect()
    }

    fn migration_022_seed_id(db_path: &str, title: &str) -> String {
        let conn = rusqlite::Connection::open(db_path).unwrap();
        conn.query_row(
            "SELECT id FROM prompts WHERE provider = 'nano_banana' AND title = ?1",
            [title],
            |row| row.get(0),
        )
        .unwrap()
    }

    fn assert_migration_022_seed_singletons(db_path: &str) {
        let conn = rusqlite::Connection::open(db_path).unwrap();
        let total: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM prompts
                 WHERE provider = ?1 AND title IN (?2, ?3, ?4, ?5)",
                params_from_iter(
                    std::iter::once("nano_banana")
                        .chain(MIGRATION_022_NANO_BANANA_TITLES.iter().copied()),
                ),
                |row| row.get(0),
            )
            .unwrap();
        assert!(
            total <= MIGRATION_022_NANO_BANANA_TITLES.len() as i64,
            "expected at most one legacy built-in prompt per title"
        );
        for title in MIGRATION_022_NANO_BANANA_TITLES {
            let count: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM prompts WHERE provider = 'nano_banana' AND title = ?1",
                    [title],
                    |row| row.get(0),
                )
                .unwrap();
            assert!(
                count <= 1,
                "expected at most one built-in prompt titled {title}"
            );
        }
    }

    fn user_prompt_count(db_path: &str) -> i64 {
        let conn = rusqlite::Connection::open(db_path).unwrap();
        conn.query_row(
            "SELECT COUNT(*) FROM prompts
             WHERE COALESCE(is_recipe, 0) = 0
               AND NOT (
                 COALESCE(provider, '') = ?1
                 AND title IN (?2, ?3, ?4, ?5)
               )",
            params_from_iter(
                std::iter::once("nano_banana")
                    .chain(MIGRATION_022_NANO_BANANA_TITLES.iter().copied()),
            ),
            |row| row.get(0),
        )
        .unwrap()
    }

    fn result_paths(db_path: &str, id: &str) -> Option<(String, Option<String>, Option<String>)> {
        let conn = rusqlite::Connection::open(db_path).unwrap();
        conn.query_row(
            "SELECT prompt_id, file_path, thumbnail_path FROM results WHERE id = ?1",
            [id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .ok()
    }

    fn result_prompt_id(db_path: &str, id: &str) -> Option<String> {
        result_paths(db_path, id).map(|row| row.0)
    }

    fn result_count(db_path: &str) -> i64 {
        let conn = rusqlite::Connection::open(db_path).unwrap();
        conn.query_row("SELECT COUNT(*) FROM results", [], |row| row.get(0))
            .unwrap()
    }

    fn reference_paths(
        db_path: &str,
        id: &str,
    ) -> Option<(String, Option<String>, Option<String>)> {
        let conn = rusqlite::Connection::open(db_path).unwrap();
        conn.query_row(
            "SELECT title, file_data, thumbnail_data FROM \"references\" WHERE id = ?1",
            [id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .ok()
    }

    fn reference_count(db_path: &str) -> i64 {
        let conn = rusqlite::Connection::open(db_path).unwrap();
        conn.query_row("SELECT COUNT(*) FROM \"references\"", [], |row| row.get(0))
            .unwrap()
    }
}
