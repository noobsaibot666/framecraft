use crate::portable_sqlite::open_portable_database;
use rusqlite::{
    params_from_iter,
    types::{Value, ValueRef},
};
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
#[serde(rename_all = "camelCase")]
pub struct LibraryMergeReport {
    source_base_dir: String,
    target_base_dir: String,
    prompts: MergeTableReport,
    id_remaps: Vec<MergeIdRemap>,
    errors: Vec<String>,
}

#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MergeTableReport {
    imported: u32,
    skipped_duplicates: u32,
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

const PROMPT_COLUMNS: [&str; 30] = [
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
];

#[derive(Clone, Debug, PartialEq)]
struct TableRecord {
    values: Vec<Value>,
}

fn merge_library_package(
    source_base_dir: &str,
    target_base_dir: &str,
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
    let mut report = LibraryMergeReport {
        source_base_dir: source.base_dir,
        target_base_dir: target.base_dir,
        prompts: MergeTableReport::default(),
        id_remaps: Vec::new(),
        errors: Vec::new(),
    };

    merge_prompt_rows(&source_conn, &mut target_conn, &mut report)?;
    Ok(report)
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

fn merge_prompt_rows(
    source_conn: &rusqlite::Connection,
    target_conn: &mut rusqlite::Connection,
    report: &mut LibraryMergeReport,
) -> Result<(), String> {
    let source_rows = read_prompt_records(source_conn)?;
    let transaction = target_conn
        .transaction()
        .map_err(|error| error.to_string())?;

    for source_row in source_rows {
        let source_id = value_as_string(&source_row.values[0])?;
        match read_record_by_id(&transaction, "prompts", &PROMPT_COLUMNS, &source_id)? {
            Some(target_row) if target_row == source_row => {
                report.prompts.skipped_duplicates += 1;
            }
            Some(_) => {
                let new_id = generate_sqlite_id(&transaction)?;
                let mut remapped_row = source_row.clone();
                remapped_row.values[0] = Value::Text(new_id.clone());
                insert_table_record(&transaction, "prompts", &PROMPT_COLUMNS, &remapped_row)?;
                report.prompts.imported += 1;
                report.prompts.remapped += 1;
                report.id_remaps.push(MergeIdRemap {
                    table: "prompts".to_string(),
                    source_id,
                    target_id: new_id,
                    reason: "id_collision".to_string(),
                });
            }
            None => {
                insert_table_record(&transaction, "prompts", &PROMPT_COLUMNS, &source_row)?;
                report.prompts.imported += 1;
            }
        }
    }

    transaction.commit().map_err(|error| error.to_string())
}

fn read_prompt_records(conn: &rusqlite::Connection) -> Result<Vec<TableRecord>, String> {
    let sql = format!(
        "SELECT {} FROM prompts WHERE COALESCE(is_recipe, 0) = 0 ORDER BY created_at, id",
        PROMPT_COLUMNS.join(", ")
    );
    read_records_with_sql(conn, &sql, PROMPT_COLUMNS.len())
}

fn read_records_with_sql(
    conn: &rusqlite::Connection,
    sql: &str,
    column_count: usize,
) -> Result<Vec<TableRecord>, String> {
    let mut statement = conn.prepare(&sql).map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| record_from_row(row, column_count))
        .map_err(|error| error.to_string())?;
    let mut records = Vec::new();
    for row in rows {
        records.push(row.map_err(|error| error.to_string())?);
    }
    Ok(records)
}

fn read_record_by_id(
    conn: &rusqlite::Connection,
    table: &str,
    columns: &[&str],
    id: &str,
) -> Result<Option<TableRecord>, String> {
    let sql = format!("SELECT {} FROM {table} WHERE id = ?1", columns.join(", "));
    let mut statement = conn.prepare(&sql).map_err(|error| error.to_string())?;
    match statement.query_row([id], |row| record_from_row(row, columns.len())) {
        Ok(record) => Ok(Some(record)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

fn insert_table_record(
    conn: &rusqlite::Connection,
    table: &str,
    columns: &[&str],
    record: &TableRecord,
) -> Result<(), String> {
    let placeholders = (1..=columns.len())
        .map(|index| format!("?{index}"))
        .collect::<Vec<_>>()
        .join(", ");
    let sql = format!(
        "INSERT INTO {table} ({}) VALUES ({placeholders})",
        columns.join(", ")
    );
    conn.execute(&sql, params_from_iter(record.values.iter()))
        .map(|_| ())
        .map_err(|error| error.to_string())
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
    fn merge_imports_prompt_into_destination_library() {
        let root = test_root("merge-prompt");
        let source = root.join("Source.framecraftlib");
        let target = root.join("Target.framecraftlib");
        let source_paths = create_library_package(source.to_str().unwrap(), true).unwrap();
        let target_paths = create_library_package(target.to_str().unwrap(), true).unwrap();
        insert_prompt(&source_paths.db_path, "prompt-a", "Source Prompt");

        let report =
            merge_library_package(source.to_str().unwrap(), target.to_str().unwrap()).unwrap();

        assert_eq!(report.prompts.imported, 1);
        assert_eq!(report.prompts.skipped_duplicates, 0);
        assert_eq!(report.prompts.remapped, 0);
        assert_eq!(
            prompt_title(&target_paths.db_path, "prompt-a").as_deref(),
            Some("Source Prompt")
        );
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
        assert_eq!(prompt_count(&target_paths.db_path), 1);
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
        assert_eq!(report.id_remaps.len(), 1);
        assert_eq!(report.id_remaps[0].table, "prompts");
        assert_eq!(report.id_remaps[0].source_id, "shared-id");
        assert_ne!(report.id_remaps[0].target_id, "shared-id");
        assert_eq!(prompt_count(&target_paths.db_path), 2);
        assert_eq!(
            prompt_title(&target_paths.db_path, "shared-id").as_deref(),
            Some("Target Prompt")
        );
        assert_eq!(
            prompt_title(&target_paths.db_path, &report.id_remaps[0].target_id).as_deref(),
            Some("Source Prompt")
        );
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

    fn insert_prompt(db_path: &str, id: &str, title: &str) {
        let conn = rusqlite::Connection::open(db_path).unwrap();
        conn.execute(
            "INSERT INTO prompts (id, title, provider, prompt_text, created_at, updated_at)
             VALUES (?1, ?2, 'midjourney', ?3, '2026-06-26T00:00:00Z', '2026-06-26T00:00:00Z')",
            (id, title, format!("Prompt text for {title}")),
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

    fn prompt_count(db_path: &str) -> i64 {
        let conn = rusqlite::Connection::open(db_path).unwrap();
        conn.query_row(
            "SELECT COUNT(*) FROM prompts WHERE COALESCE(is_recipe, 0) = 0",
            [],
            |row| row.get(0),
        )
        .unwrap()
    }
}
