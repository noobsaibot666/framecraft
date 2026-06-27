use crate::portable_sqlite::open_portable_database;
use rusqlite::{
    params_from_iter,
    types::{Value, ValueRef},
};
use serde::Serialize;
use std::{
    fs,
    path::{Component, Path, PathBuf},
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
    results: MergeTableReport,
    references: MergeTableReport,
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

const REQUIRED_RELEASE_TABLES: [&str; 27] = [
    "app_meta",
    "assistant_messages",
    "assistant_threads",
    "avoidance_patterns",
    "comparison_items",
    "comparison_sessions",
    "creative_directions",
    "deliverable_references",
    "export_presets",
    "generation_queue",
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
    "srefs",
    "token_categories",
    "token_patterns",
    "tokens",
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
        source_base_dir: source.base_dir.clone(),
        target_base_dir: target.base_dir.clone(),
        prompts: MergeTableReport::default(),
        results: MergeTableReport::default(),
        references: MergeTableReport::default(),
        id_remaps: Vec::new(),
        errors: Vec::new(),
    };

    merge_prompt_rows(&source_conn, &mut target_conn, &mut report)?;
    merge_result_rows(
        &source_conn,
        &mut target_conn,
        &source,
        &target,
        &mut report,
    )?;
    merge_reference_rows(
        &source_conn,
        &mut target_conn,
        &source,
        &target,
        &mut report,
    )?;
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

fn merge_result_rows(
    source_conn: &rusqlite::Connection,
    target_conn: &mut rusqlite::Connection,
    source: &LibraryPathsDto,
    target: &LibraryPathsDto,
    report: &mut LibraryMergeReport,
) -> Result<(), String> {
    let source_rows = read_table_records(source_conn, "results", &RESULT_COLUMNS, "created_at")?;
    let transaction = target_conn
        .transaction()
        .map_err(|error| error.to_string())?;

    for source_row in source_rows {
        let source_id = value_as_string(&source_row.values[0])?;
        let mut merge_row = source_row.clone();
        remap_result_prompt_id(&mut merge_row, &report.id_remaps)?;
        rewrite_result_media_paths(&mut merge_row, source, target)?;

        match read_record_by_id(&transaction, "results", &RESULT_COLUMNS, &source_id)? {
            Some(target_row) if target_row == merge_row => {
                report.results.skipped_duplicates += 1;
            }
            Some(_) => {
                let new_id = generate_sqlite_id(&transaction)?;
                merge_row.values[0] = Value::Text(new_id.clone());
                copy_result_media_files_collision_safe(&mut merge_row, source, target, &new_id)?;
                insert_table_record(&transaction, "results", &RESULT_COLUMNS, &merge_row)?;
                report.results.imported += 1;
                report.results.remapped += 1;
                report.id_remaps.push(MergeIdRemap {
                    table: "results".to_string(),
                    source_id,
                    target_id: new_id,
                    reason: "id_collision".to_string(),
                });
            }
            None => {
                copy_result_media_files_collision_safe(&mut merge_row, source, target, &source_id)?;
                insert_table_record(&transaction, "results", &RESULT_COLUMNS, &merge_row)?;
                report.results.imported += 1;
            }
        }
    }

    transaction.commit().map_err(|error| error.to_string())
}

fn merge_reference_rows(
    source_conn: &rusqlite::Connection,
    target_conn: &mut rusqlite::Connection,
    source: &LibraryPathsDto,
    target: &LibraryPathsDto,
    report: &mut LibraryMergeReport,
) -> Result<(), String> {
    let source_rows = read_table_records(
        source_conn,
        "\"references\"",
        &REFERENCE_COLUMNS,
        "created_at",
    )?;
    let transaction = target_conn
        .transaction()
        .map_err(|error| error.to_string())?;

    for source_row in source_rows {
        let source_id = value_as_string(&source_row.values[0])?;
        let mut merge_row = source_row.clone();
        rewrite_reference_media_paths(&mut merge_row, source, target)?;

        match read_record_by_id(
            &transaction,
            "\"references\"",
            &REFERENCE_COLUMNS,
            &source_id,
        )? {
            Some(target_row) if target_row == merge_row => {
                report.references.skipped_duplicates += 1;
            }
            Some(_) => {
                let new_id = generate_sqlite_id(&transaction)?;
                merge_row.values[0] = Value::Text(new_id.clone());
                copy_reference_media_files_collision_safe(&mut merge_row, source, target, &new_id)?;
                insert_table_record(
                    &transaction,
                    "\"references\"",
                    &REFERENCE_COLUMNS,
                    &merge_row,
                )?;
                report.references.imported += 1;
                report.references.remapped += 1;
                report.id_remaps.push(MergeIdRemap {
                    table: "references".to_string(),
                    source_id,
                    target_id: new_id,
                    reason: "id_collision".to_string(),
                });
            }
            None => {
                copy_reference_media_files_collision_safe(&mut merge_row, source, target, &source_id)?;
                insert_table_record(
                    &transaction,
                    "\"references\"",
                    &REFERENCE_COLUMNS,
                    &merge_row,
                )?;
                report.references.imported += 1;
            }
        }
    }

    transaction.commit().map_err(|error| error.to_string())
}

fn remap_result_prompt_id(row: &mut TableRecord, remaps: &[MergeIdRemap]) -> Result<(), String> {
    let prompt_id = value_as_string(&row.values[1])?;
    if let Some(remap) = remaps
        .iter()
        .find(|remap| remap.table == "prompts" && remap.source_id == prompt_id)
    {
        row.values[1] = Value::Text(remap.target_id.clone());
    }
    Ok(())
}

fn rewrite_result_media_paths(
    row: &mut TableRecord,
    source: &LibraryPathsDto,
    target: &LibraryPathsDto,
) -> Result<(), String> {
    rewrite_media_value(&mut row.values[2], &source.results_dir, &target.results_dir)?;
    rewrite_media_value(&mut row.values[3], &source.results_dir, &target.results_dir)?;
    Ok(())
}

fn rewrite_reference_media_paths(
    row: &mut TableRecord,
    source: &LibraryPathsDto,
    target: &LibraryPathsDto,
) -> Result<(), String> {
    rewrite_media_value(
        &mut row.values[4],
        &source.references_dir,
        &target.references_dir,
    )?;
    rewrite_media_value(
        &mut row.values[5],
        &source.references_dir,
        &target.references_dir,
    )?;
    Ok(())
}

fn rewrite_media_value(
    value: &mut Value,
    source_prefix: &str,
    target_prefix: &str,
) -> Result<(), String> {
    let Value::Text(path) = value else {
        return Ok(());
    };
    if !path.starts_with(source_prefix) {
        return Ok(());
    }
    let relative = &path[source_prefix.len()..];
    assert_safe_relative_media_path(relative)?;
    *path = format!("{target_prefix}{relative}");
    Ok(())
}

fn copy_result_media_files_collision_safe(
    row: &mut TableRecord,
    source: &LibraryPathsDto,
    target: &LibraryPathsDto,
    id_hint: &str,
) -> Result<(), String> {
    copy_media_value_collision_safe(
        &mut row.values[2],
        &source.results_dir,
        &target.results_dir,
        id_hint,
    )?;
    copy_media_value_collision_safe(
        &mut row.values[3],
        &source.results_dir,
        &target.results_dir,
        id_hint,
    )?;
    Ok(())
}

fn copy_reference_media_files_collision_safe(
    row: &mut TableRecord,
    source: &LibraryPathsDto,
    target: &LibraryPathsDto,
    id_hint: &str,
) -> Result<(), String> {
    copy_media_value_collision_safe(
        &mut row.values[4],
        &source.references_dir,
        &target.references_dir,
        id_hint,
    )?;
    copy_media_value_collision_safe(
        &mut row.values[5],
        &source.references_dir,
        &target.references_dir,
        id_hint,
    )?;
    Ok(())
}

fn copy_media_value_collision_safe(
    value: &mut Value,
    source_prefix: &str,
    target_prefix: &str,
    id_hint: &str,
) -> Result<(), String> {
    let Value::Text(target_path) = value else {
        return Ok(());
    };
    if !target_path.starts_with(target_prefix) {
        return Ok(());
    }
    let relative = target_path[target_prefix.len()..].to_string();
    assert_safe_relative_media_path(&relative)?;
    let from = format!("{source_prefix}{relative}");
    let target_relative = collision_safe_relative_path(&relative, target_prefix, id_hint)?;
    let to = format!("{target_prefix}{target_relative}");
    copy_file(&from, &to)?;
    *target_path = to;
    Ok(())
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
    let trimmed = sanitized.trim_matches('-').chars().take(48).collect::<String>();
    if trimmed.is_empty() {
        "item".to_string()
    } else {
        trimmed
    }
}

fn read_table_records(
    conn: &rusqlite::Connection,
    table: &str,
    columns: &[&str],
    order_column: &str,
) -> Result<Vec<TableRecord>, String> {
    let sql = format!(
        "SELECT {} FROM {table} ORDER BY {order_column}, id",
        columns.join(", ")
    );
    read_records_with_sql(conn, &sql, columns.len())
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
        match has_required_database_schema(&paths.db_path) {
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

    if has_required_database_schema(&paths.db_path)? {
        return Ok(validate_library_package(&paths.base_dir));
    }

    if has_previous_release_schema(&paths.db_path)? {
        upgrade_previous_release_schema(&paths.db_path)?;
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
    let has_tables = REQUIRED_RELEASE_TABLES.iter().all(|table| {
        conn.query_row(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?1 LIMIT 1",
            [table],
            |_| Ok(()),
        )
        .is_ok()
    });
    Ok(has_tables
        && connection_column_exists(&conn, "comparison_sessions", "comparison_type")?
        && connection_column_exists(&conn, "comparison_sessions", "outcome_summary")?
        && connection_column_exists(&conn, "comparison_items", "source_role")?)
}

fn has_previous_release_schema(db_path: &str) -> Result<bool, String> {
    let conn = open_portable_database(db_path)?;
    Ok(REQUIRED_RELEASE_TABLES
        .iter()
        .filter(|table| **table != "creative_directions")
        .all(|table| {
            conn.query_row(
                "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?1 LIMIT 1",
                [table],
                |_| Ok(()),
            )
            .is_ok()
        }))
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

fn upgrade_previous_release_schema(db_path: &str) -> Result<(), String> {
    let conn = open_portable_database(db_path)?;
    if !connection_column_exists(&conn, "comparison_sessions", "comparison_type")? {
        conn.execute_batch(
            "ALTER TABLE comparison_sessions ADD COLUMN comparison_type TEXT NOT NULL DEFAULT 'result_result';",
        )
        .map_err(|error| error.to_string())?;
    }
    if !connection_column_exists(&conn, "comparison_sessions", "outcome_summary")? {
        conn.execute_batch("ALTER TABLE comparison_sessions ADD COLUMN outcome_summary TEXT;")
            .map_err(|error| error.to_string())?;
    }
    if !connection_column_exists(&conn, "comparison_items", "source_role")? {
        conn.execute_batch(
            "ALTER TABLE comparison_items ADD COLUMN source_role TEXT NOT NULL DEFAULT 'result';",
        )
        .map_err(|error| error.to_string())?;
    }
    conn.execute_batch(include_str!("../migrations/016_creative_directions.sql"))
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn migration_sql() -> [&'static str; 16] {
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
    fn repair_upgrades_previous_release_schema() {
        let root = test_root("repair-previous-release-schema");
        let package = root.join("PreviousRelease.framecraftlib");
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
        assert!(validation.errors.contains(&"Missing database schema".to_string()));
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
        assert!(validation.errors.contains(&"Missing database schema".to_string()));
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
        fs::write(source.join("results/campaign/shared-thumb.png"), "source thumb").unwrap();
        fs::write(target.join("results/campaign/shared.png"), "target image").unwrap();
        fs::write(target.join("results/campaign/shared-thumb.png"), "target thumb").unwrap();
        insert_result(
            &source_paths.db_path,
            "shared-result",
            "prompt-a",
            Some(&format!("{}campaign/shared.png", source_paths.results_dir)),
            Some(&format!("{}campaign/shared-thumb.png", source_paths.results_dir)),
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
        let (_, file_path, thumb_path) = result_paths(&target_paths.db_path, &remap.target_id).unwrap();

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
        assert_ne!(file_path, format!("{}campaign/shared.png", target_paths.results_dir));
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
        fs::write(source.join("references/mood/shared-thumb.png"), "source thumb").unwrap();
        fs::write(target.join("references/mood/shared.png"), "target ref").unwrap();
        fs::write(target.join("references/mood/shared-thumb.png"), "target thumb").unwrap();
        insert_reference(
            &source_paths.db_path,
            "shared-ref",
            "Source Reference",
            Some(&format!("{}mood/shared.png", source_paths.references_dir)),
            Some(&format!("{}mood/shared-thumb.png", source_paths.references_dir)),
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
        assert_ne!(file_path, format!("{}mood/shared.png", target_paths.references_dir));
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
        exists
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

    fn prompt_count(db_path: &str) -> i64 {
        let conn = rusqlite::Connection::open(db_path).unwrap();
        conn.query_row(
            "SELECT COUNT(*) FROM prompts WHERE COALESCE(is_recipe, 0) = 0",
            [],
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
