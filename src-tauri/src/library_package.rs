use crate::portable_sqlite::open_portable_database;
use serde::Serialize;
use std::{
    fs,
    path::{Component, Path},
    time::{SystemTime, UNIX_EPOCH},
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
pub fn repair_library_database_schema_native(
    base_dir: String,
) -> Result<LibraryValidationResult, String> {
    repair_library_database_schema(&base_dir)
}

#[tauri::command(rename_all = "camelCase")]
pub fn migrate_app_data_to_library_native(
    source_base_dir: String,
    target_base_dir: String,
    result_files: Vec<String>,
    reference_files: Vec<String>,
) -> Result<MigrateAppDataResult, String> {
    let source = resolve_library_paths(&source_base_dir);
    let target = create_library_package(&target_base_dir, false)?;
    let mut copied_files = Vec::new();

    copy_file(&source.db_path, &target.db_path)?;
    copied_files.push(target.db_path.clone());
    copy_media_files(
        &result_files,
        &source.results_dir,
        &target.results_dir,
        &mut copied_files,
    )?;
    copy_media_files(
        &reference_files,
        &source.references_dir,
        &target.references_dir,
        &mut copied_files,
    )?;

    Ok(MigrateAppDataResult {
        paths: target,
        copied_files,
    })
}

#[tauri::command(rename_all = "camelCase")]
pub fn copy_library_package_native(
    source_base_dir: String,
    target_base_dir: String,
    result_files: Vec<String>,
    reference_files: Vec<String>,
) -> Result<CopyLibraryPackageResult, String> {
    copy_library_package(
        &source_base_dir,
        &target_base_dir,
        &result_files,
        &reference_files,
    )
}

#[tauri::command(rename_all = "camelCase")]
pub fn backup_library_package_native(
    source_base_dir: String,
    result_files: Vec<String>,
    reference_files: Vec<String>,
) -> Result<CopyLibraryPackageResult, String> {
    let source = resolve_library_paths(&source_base_dir);
    let target = format!(
        "{}framecraft-backup-{}.framecraftlib",
        source.backups_dir,
        timestamp_slug()
    );
    copy_library_package(&source_base_dir, &target, &result_files, &reference_files)
}

fn copy_library_package(
    source_base_dir: &str,
    target_base_dir: &str,
    result_files: &[String],
    reference_files: &[String],
) -> Result<CopyLibraryPackageResult, String> {
    let source = resolve_library_paths(source_base_dir);
    let target = resolve_library_paths(target_base_dir);
    let mut copied_files = Vec::new();

    create_package_dirs(&target)?;
    copy_file(
        &format!("{}library.json", source.base_dir),
        &format!("{}library.json", target.base_dir),
    )?;
    copied_files.push(format!("{}library.json", target.base_dir));
    copy_file(&source.db_path, &target.db_path)?;
    copied_files.push(target.db_path.clone());
    copy_media_files(
        result_files,
        &source.results_dir,
        &target.results_dir,
        &mut copied_files,
    )?;
    copy_media_files(
        reference_files,
        &source.references_dir,
        &target.references_dir,
        &mut copied_files,
    )?;

    let validation = validate_library_package(&target.base_dir);
    if !validation.ok {
        return Err(format!(
            "Invalid library copy: {}",
            validation.errors.join(", ")
        ));
    }

    Ok(CopyLibraryPackageResult {
        paths: target,
        copied_files,
        validation,
    })
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

fn validate_library_package(base_dir: &str) -> LibraryValidationResult {
    let paths = resolve_library_paths(base_dir);
    let mut errors = Vec::new();
    let metadata_path = format!("{}library.json", paths.base_dir);

    if !Path::new(&metadata_path).exists() {
        errors.push("Missing library.json".to_string());
    }
    if !Path::new(&paths.db_path).exists() {
        errors.push("Missing framecraft.db".to_string());
    } else {
        match has_core_database_schema(&paths.db_path) {
            Ok(true) => {}
            Ok(false) => errors.push("Missing database schema".to_string()),
            Err(error) => errors.push(error),
        }
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

    if has_core_database_schema(&paths.db_path)? {
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

fn has_core_database_schema(db_path: &str) -> Result<bool, String> {
    let conn = open_portable_database(db_path)?;
    Ok(["prompts", "results", "references"].iter().all(|table| {
        conn.query_row(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?1 LIMIT 1",
            [table],
            |_| Ok(()),
        )
        .is_ok()
    }))
}

fn migration_sql() -> [&'static str; 13] {
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
    ]
}

fn copy_media_files(
    filenames: &[String],
    source_dir: &str,
    target_dir: &str,
    copied_files: &mut Vec<String>,
) -> Result<(), String> {
    for filename in filenames {
        assert_safe_relative_media_path(filename)?;
        let from = format!("{}{}", source_dir, filename);
        let to = format!("{}{}", target_dir, filename);
        if let Some(parent) = Path::new(&to).parent() {
            fs::create_dir_all(parent).map_err(format_io_error)?;
        }
        copy_file(&from, &to)?;
        copied_files.push(to);
    }
    Ok(())
}

fn copy_file(from: &str, to: &str) -> Result<(), String> {
    if let Some(parent) = Path::new(to).parent() {
        fs::create_dir_all(parent).map_err(format_io_error)?;
    }
    fs::copy(from, to).map(|_| ()).map_err(format_io_error)
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
    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default();
    format!("{seconds}")
}

fn format_io_error(error: std::io::Error) -> String {
    error.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{env, fs, path::PathBuf};

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
    fn migrates_without_precreating_destination_db() {
        let root = test_root("migrate");
        let source = root.join("source");
        let target = root.join("target.framecraftlib");
        fs::create_dir_all(source.join("results/campaign")).unwrap();
        fs::create_dir_all(source.join("references")).unwrap();
        fs::write(source.join("framecraft.db"), "db").unwrap();
        fs::write(source.join("results/campaign/a.png"), "image").unwrap();

        let result = migrate_app_data_to_library_native(
            source.to_str().unwrap().to_string(),
            target.to_str().unwrap().to_string(),
            vec!["campaign/a.png".to_string()],
            vec![],
        )
        .unwrap();

        assert_eq!(
            fs::read_to_string(target.join("framecraft.db")).unwrap(),
            "db"
        );
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
    fn rejects_unsafe_media_paths() {
        assert!(assert_safe_relative_media_path("../escape.png").is_err());
        assert!(assert_safe_relative_media_path("/escape.png").is_err());
        assert!(assert_safe_relative_media_path("nested\\escape.png").is_err());
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

    fn sqlite_table_exists(db_path: &str, table: &str) -> bool {
        let conn = rusqlite::Connection::open(db_path).unwrap();
        conn.query_row(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?1 LIMIT 1",
            [table],
            |_| Ok(()),
        )
        .is_ok()
    }
}
