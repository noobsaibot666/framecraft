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
    if create_empty_db && !Path::new(&paths.db_path).exists() {
        fs::write(&paths.db_path, []).map_err(format_io_error)?;
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
    }
    if !Path::new(&paths.results_dir).exists() {
        errors.push("Missing results directory".to_string());
    }
    if !Path::new(&paths.references_dir).exists() {
        errors.push("Missing references directory".to_string());
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
}
