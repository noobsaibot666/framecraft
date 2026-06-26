use rusqlite::{Connection, OpenFlags};
use std::{
    fs::{self, OpenOptions},
    path::{Path, PathBuf},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

pub(crate) fn open_portable_database(db_path: &str) -> Result<Connection, String> {
    let path = Path::new(db_path);
    assert_database_access(path)?;
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

    match open_nolock_connection(path) {
        Ok(conn) => Ok(conn),
        Err(fallback_error) => Err(format_open_error(path, retry_error, Some(fallback_error))),
    }
}

fn open_configured_connection(path: &Path) -> Result<Connection, rusqlite::Error> {
    let conn = Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_FULL_MUTEX,
    )?;
    configure_connection(&conn)?;
    Ok(conn)
}

fn open_nolock_connection(path: &Path) -> Result<Connection, rusqlite::Error> {
    let conn = Connection::open_with_flags(
        sqlite_nolock_uri(path),
        OpenFlags::SQLITE_OPEN_READ_WRITE
            | OpenFlags::SQLITE_OPEN_FULL_MUTEX
            | OpenFlags::SQLITE_OPEN_URI,
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

    let probe = parent.join(format!(".framecraft-db-write-probe-{}", std::process::id()));
    fs::write(&probe, b"probe").map_err(|error| {
        format!(
            "Database directory is not writable: {} ({error})",
            parent.display()
        )
    })?;
    fs::remove_file(&probe).map_err(|error| {
        format!(
            "Database directory write probe could not be cleaned up: {} ({error})",
            probe.display()
        )
    })?;

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
        "Unable to open database file: {}. Parent: {}. WAL exists: {}. SHM exists: {}. SQLite: {error}",
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

fn sqlite_nolock_uri(path: &Path) -> String {
    let encoded_path = path
        .to_string_lossy()
        .bytes()
        .map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' | b'/' => {
                (byte as char).to_string()
            }
            _ => format!("%{byte:02X}"),
        })
        .collect::<String>();
    format!("file:{encoded_path}?mode=rw&nolock=1")
}

fn timestamp_slug() -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
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
    fn sqlite_nolock_uri_encodes_network_path() {
        let path =
            Path::new("/Volumes/DATA/04_SHARED/03 FRAMECRAFT/lib#1.framecraftlib/framecraft.db");

        let uri = sqlite_nolock_uri(path);

        assert_eq!(
            uri,
            "file:/Volumes/DATA/04_SHARED/03%20FRAMECRAFT/lib%231.framecraftlib/framecraft.db?mode=rw&nolock=1"
        );
    }

    #[test]
    fn nolock_connection_opens_existing_database_with_delete_journal() {
        let root = test_root("nolock-open");
        let db_path = root.join("framecraft db.sqlite");
        let conn = Connection::open(&db_path).unwrap();
        conn.execute_batch(
            "CREATE TABLE prompts (id INTEGER PRIMARY KEY, title TEXT NOT NULL);
             INSERT INTO prompts (title) VALUES ('Test');",
        )
        .unwrap();
        drop(conn);

        let conn = open_nolock_connection(&db_path).unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM prompts", [], |row| row.get(0))
            .unwrap();
        let journal_mode: String = conn
            .query_row("PRAGMA journal_mode", [], |row| row.get(0))
            .unwrap();

        assert_eq!(count, 1);
        assert_eq!(journal_mode.to_lowercase(), "delete");
        let _ = fs::remove_dir_all(root);
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
