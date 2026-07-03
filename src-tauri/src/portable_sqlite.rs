use rusqlite::{Connection, OpenFlags};
use std::{
    fs::{self, File, OpenOptions},
    io::{self, Read, Seek, SeekFrom},
    path::{Path, PathBuf},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

pub(crate) fn open_portable_database(db_path: &str) -> Result<Connection, String> {
    let path = Path::new(db_path);
    assert_database_access(path)?;
    normalize_portable_journal_header(path)?;
    let first_error = match open_configured_connection(path) {
        Ok(conn) => return Ok(conn),
        Err(error) => error,
    };

    let retry_error = if quarantine_stale_shm(path)? {
        match open_configured_connection(path) {
            Ok(conn) => return Ok(conn),
            Err(error) => error,
        }
    } else {
        first_error
    };

    Err(format_open_error(path, retry_error, None))
}

fn open_configured_connection(path: &Path) -> Result<Connection, rusqlite::Error> {
    let conn = Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_FULL_MUTEX,
    )?;
    configure_connection(&conn)?;
    Ok(conn)
}

fn configure_connection(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.busy_timeout(Duration::from_secs(10))?;
    conn.pragma_update(None, "journal_mode", "DELETE")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    Ok(())
}

fn assert_database_access(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Err(format!("Missing database file: {}", path.display()));
    }
    let parent = path
        .parent()
        .ok_or_else(|| format!("Database path has no parent directory: {}", path.display()))?;
    if !parent.exists() {
        return Err(format!(
            "Database parent directory is missing: {}",
            parent.display()
        ));
    }

    // Unique per attempt, not just per process — concurrent opens on the same
    // directory from different threads share a pid and must not race on one
    // probe file (write/remove interleaving made the loser's remove ENOENT).
    static PROBE_COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
    let probe = parent.join(format!(
        ".framecraft-db-write-probe-{}-{}",
        std::process::id(),
        PROBE_COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
    ));
    fs::write(&probe, b"probe").map_err(|error| {
        format!(
            "Database directory is not writable: {} ({error})",
            parent.display()
        )
    })?;
    if let Err(error) = fs::remove_file(&probe) {
        // Already gone means the probe served its purpose — only surface
        // genuine cleanup failures (e.g. permissions flipped mid-flight).
        if error.kind() != std::io::ErrorKind::NotFound {
            return Err(format!(
                "Database directory write probe could not be cleaned up: {} ({error})",
                probe.display()
            ));
        }
    }

    OpenOptions::new()
        .read(true)
        .write(true)
        .open(path)
        .map(|_| ())
        .map_err(|error| {
            format!(
                "Database file is not writable: {} ({error})",
                path.display()
            )
        })
}

#[derive(Debug, PartialEq, Eq)]
enum JournalHeader {
    Rollback,
    Wal,
    Other,
}

fn database_journal_header(path: &Path) -> Result<JournalHeader, String> {
    let mut file = File::open(path).map_err(|error| {
        format!(
            "Could not read database journal header: {} ({error})",
            path.display()
        )
    })?;
    file.seek(SeekFrom::Start(18)).map_err(|error| {
        format!(
            "Could not seek database journal header: {} ({error})",
            path.display()
        )
    })?;
    let mut header = [0u8; 2];
    match file.read_exact(&mut header) {
        Ok(()) => {}
        Err(error) if error.kind() == io::ErrorKind::UnexpectedEof => {
            return Ok(JournalHeader::Other);
        }
        Err(error) => {
            return Err(format!(
                "Could not read database journal header: {} ({error})",
                path.display()
            ));
        }
    }

    Ok(match header {
        [1, 1] => JournalHeader::Rollback,
        [2, 2] => JournalHeader::Wal,
        _ => JournalHeader::Other,
    })
}

fn normalize_portable_journal_header(path: &Path) -> Result<bool, String> {
    if database_journal_header(path)? != JournalHeader::Wal {
        return Ok(false);
    }

    let wal = sidecar_path(path, "wal");
    let shm = sidecar_path(path, "shm");
    if wal.exists() || shm.exists() {
        return Err(format!(
            "Database is still in WAL mode and has SQLite sidecar files. Close every app using this library, then reopen it. WAL exists: {}. SHM exists: {}",
            wal.exists(),
            shm.exists()
        ));
    }

    let temp_path = std::env::temp_dir().join(format!(
        "framecraft-sqlite-journal-repair-{}-{}.db",
        std::process::id(),
        timestamp_slug()
    ));
    fs::copy(path, &temp_path).map_err(|error| {
        format!(
            "Could not copy database for journal repair: {} -> {} ({error})",
            path.display(),
            temp_path.display()
        )
    })?;

    let repair_result = convert_local_copy_to_rollback_journal(&temp_path)
        .and_then(|_| backup_database_before_repair(path))
        .and_then(|_| {
            fs::copy(&temp_path, path).map(|_| ()).map_err(|error| {
                format!(
                    "Could not replace database after journal repair: {} -> {} ({error})",
                    temp_path.display(),
                    path.display()
                )
            })
        });

    let _ = fs::remove_file(&temp_path);
    repair_result?;
    Ok(true)
}

fn convert_local_copy_to_rollback_journal(path: &Path) -> Result<(), String> {
    let conn = open_configured_connection(path).map_err(|error| {
        format!(
            "Could not normalize database journal mode: {} ({error})",
            path.display()
        )
    })?;
    let integrity: String = conn
        .query_row("PRAGMA integrity_check", [], |row| row.get(0))
        .map_err(|error| {
            format!(
                "Could not verify database after journal repair: {} ({error})",
                path.display()
            )
        })?;
    if integrity.to_lowercase() != "ok" {
        return Err(format!(
            "Database integrity check failed after journal repair: {} ({integrity})",
            path.display()
        ));
    }
    drop(conn);

    if database_journal_header(path)? != JournalHeader::Rollback {
        return Err(format!(
            "Database journal repair did not switch to rollback mode: {}",
            path.display()
        ));
    }

    Ok(())
}

fn backup_database_before_repair(path: &Path) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| format!("Database path has no parent directory: {}", path.display()))?;
    let backup_dir = parent
        .join("backups")
        .join(format!("sqlite-journal-repair-{}", timestamp_slug()));
    fs::create_dir_all(&backup_dir).map_err(|error| {
        format!(
            "Could not create database repair backup folder: {} ({error})",
            backup_dir.display()
        )
    })?;
    let backup_path = backup_dir.join(
        path.file_name()
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("framecraft.db")),
    );
    fs::copy(path, &backup_path).map(|_| ()).map_err(|error| {
        format!(
            "Could not back up database before journal repair: {} -> {} ({error})",
            path.display(),
            backup_path.display()
        )
    })
}

fn quarantine_stale_shm(path: &Path) -> Result<bool, String> {
    let shm = sidecar_path(path, "shm");
    if !shm.exists() {
        return Ok(false);
    }
    let parent = path
        .parent()
        .ok_or_else(|| format!("Database path has no parent directory: {}", path.display()))?;
    let quarantine_dir = parent
        .join("backups")
        .join(format!("sqlite-sidecars-{}", timestamp_slug()));
    fs::create_dir_all(&quarantine_dir).map_err(|error| {
        format!(
            "Could not create SQLite sidecar quarantine folder: {} ({error})",
            quarantine_dir.display()
        )
    })?;
    let target = quarantine_dir.join(
        shm.file_name()
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("framecraft.db-shm")),
    );
    fs::rename(&shm, &target).map_err(|error| {
        format!(
            "Could not quarantine stale SQLite shared-memory file: {} -> {} ({error})",
            shm.display(),
            target.display()
        )
    })?;
    Ok(true)
}

fn sidecar_path(path: &Path, suffix: &str) -> PathBuf {
    PathBuf::from(format!("{}-{suffix}", path.display()))
}

fn format_open_error(
    path: &Path,
    error: rusqlite::Error,
    fallback_error: Option<rusqlite::Error>,
) -> String {
    let parent = path
        .parent()
        .map(|path| path.display().to_string())
        .unwrap_or_else(|| "<none>".to_string());
    let wal = sidecar_path(path, "wal");
    let shm = sidecar_path(path, "shm");
    let mut message = format!(
        "Unable to open database file: {}. Parent: {}. WAL exists: {}. SHM exists: {}. SQLite: {error}. Close other Framecraft instances and applications using this library. Verify that the storage supports normal SQLite locking. If needed, move or copy the library to writable local storage and try again",
        path.display(),
        parent,
        wal.exists(),
        shm.exists()
    );
    if let Some(fallback_error) = fallback_error {
        message.push_str(&format!(
            ". NAS compatibility fallback also failed: {fallback_error}"
        ));
    }
    message
}

fn timestamp_slug() -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    format!("{millis}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reports_open_failure_with_database_path() {
        let root = test_root("open-failure");
        let db_dir = root.join("framecraft.db");
        fs::create_dir_all(&db_dir).unwrap();

        let error = open_portable_database(db_dir.to_str().unwrap()).unwrap_err();

        assert!(error.contains("Database file is not writable"));
        assert!(error.contains("framecraft.db"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn uses_delete_journal_mode_for_portable_database() {
        let root = test_root("journal-delete");
        let db_path = root.join("framecraft.db");
        let conn = Connection::open(&db_path).unwrap();
        conn.execute_batch(
            "CREATE TABLE prompts (id INTEGER PRIMARY KEY, title TEXT NOT NULL);
             PRAGMA journal_mode=WAL;",
        )
        .unwrap();
        drop(conn);

        let conn = open_portable_database(db_path.to_str().unwrap()).unwrap();
        let journal_mode: String = conn
            .query_row("PRAGMA journal_mode", [], |row| row.get(0))
            .unwrap();

        assert_eq!(journal_mode.to_lowercase(), "delete");
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn does_not_use_writable_nolock_fallback() {
        let source = include_str!("portable_sqlite.rs");

        for forbidden in [
            ["open", "_nolock_connection"].concat(),
            ["sqlite", "_nolock_uri"].concat(),
            ["SQLITE_OPEN", "_URI"].concat(),
            ["nolock", "=1"].concat(),
        ] {
            assert!(!source.contains(&forbidden), "found {forbidden}");
        }
    }

    #[test]
    fn formatted_open_error_includes_locking_recovery_guidance() {
        let path = Path::new("/Volumes/shared/Library.framecraftlib/framecraft.db");

        let error = format_open_error(path, rusqlite::Error::InvalidQuery, None);

        assert!(
            error.contains("Close other Framecraft instances and applications using this library")
        );
        assert!(error.contains("supports normal SQLite locking"));
        assert!(error.contains("move or copy the library to writable local storage"));
    }

    #[test]
    fn normalizes_wal_header_without_sidecars_before_portable_open() {
        let root = test_root("wal-header-normalize");
        let db_path = root.join("framecraft.db");
        let conn = Connection::open(&db_path).unwrap();
        conn.execute_batch(
            "CREATE TABLE prompts (id INTEGER PRIMARY KEY, title TEXT NOT NULL);
             INSERT INTO prompts (title) VALUES ('Test');
             PRAGMA journal_mode=WAL;",
        )
        .unwrap();
        drop(conn);
        let _ = fs::remove_file(sidecar_path(&db_path, "wal"));
        let _ = fs::remove_file(sidecar_path(&db_path, "shm"));

        assert_eq!(
            database_journal_header(&db_path).unwrap(),
            JournalHeader::Wal
        );

        let repaired = normalize_portable_journal_header(&db_path).unwrap();
        let conn = open_portable_database(db_path.to_str().unwrap()).unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM prompts", [], |row| row.get(0))
            .unwrap();

        assert!(repaired);
        assert_eq!(
            database_journal_header(&db_path).unwrap(),
            JournalHeader::Rollback
        );
        assert_eq!(count, 1);
        assert!(root.join("backups").exists());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn concurrent_opens_do_not_race_on_probe_file() {
        let root = test_root("concurrent-probe");
        let db_path = root.join("framecraft.db");
        let conn = Connection::open(&db_path).unwrap();
        conn.execute_batch(
            "CREATE TABLE prompts (id INTEGER PRIMARY KEY, title TEXT NOT NULL);",
        )
        .unwrap();
        drop(conn);

        let path_str = db_path.to_str().unwrap().to_string();
        let mut handles = Vec::new();
        for i in 0..16 {
            let p = path_str.clone();
            handles.push(std::thread::spawn(move || {
                let result = open_portable_database(&p);
                (i, result.map(|_| ()))
            }));
        }
        let mut errors = Vec::new();
        for h in handles {
            let (i, r) = h.join().unwrap();
            if let Err(e) = r {
                errors.push(format!("thread {i}: {e}"));
            }
        }
        let _ = fs::remove_dir_all(root);
        assert!(errors.is_empty(), "concurrent opens failed: {:#?}", errors);
    }

    fn test_root(label: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "framecraft-portable-sqlite-{label}-{}",
            timestamp_slug()
        ));
        fs::create_dir_all(&root).unwrap();
        root
    }
}
