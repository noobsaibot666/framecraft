use chrono::DateTime;
use serde::{Deserialize, Serialize};
use std::{fs, path::Path, sync::Mutex};

const ACTIVE_LIBRARY_LOCK: &str = "locks/active.lock";
const LIBRARY_LOCK_STALE_MS: i64 = 5 * 60 * 1000;
const LOCK_CONFLICT_PREFIX: &str = "LOCK_CONFLICT:";
const LOCK_STALE_PREFIX: &str = "LOCK_STALE:";

#[derive(Clone, Deserialize, Serialize, Debug, PartialEq, Eq)]
pub struct LibraryLockInfo {
    session_id: String,
    machine: String,
    user: String,
    updated_at: String,
    app_version: String,
}

#[derive(Clone, Debug)]
struct ActiveLock {
    base_dir: String,
    session_id: String,
}

#[derive(Default)]
pub struct ActiveLockState {
    active: Mutex<Option<ActiveLock>>,
}

#[derive(Debug, PartialEq, Eq)]
enum LockEvaluation {
    Available,
    Owned,
    Conflict,
    Stale,
}

#[tauri::command(rename_all = "camelCase")]
pub fn acquire_library_lock_native(
    base_dir: String,
    current: LibraryLockInfo,
    now_ms: i64,
    force_takeover: bool,
    state: tauri::State<'_, ActiveLockState>,
) -> Result<LibraryLockInfo, String> {
    acquire_library_lock(&base_dir, current, now_ms, force_takeover, &state)
}

#[tauri::command(rename_all = "camelCase")]
pub fn refresh_library_lock_native(
    base_dir: String,
    current: LibraryLockInfo,
    now_ms: i64,
    state: tauri::State<'_, ActiveLockState>,
) -> Result<LibraryLockInfo, String> {
    acquire_library_lock(&base_dir, current, now_ms, false, &state)
}

#[tauri::command(rename_all = "camelCase")]
pub fn release_library_lock_native(
    base_dir: String,
    session_id: String,
    state: tauri::State<'_, ActiveLockState>,
) -> Result<(), String> {
    release_owned_lock(&base_dir, &session_id)?;
    clear_active_if_matches(&state, &base_dir, &session_id);
    Ok(())
}

pub fn release_active_lock(state: &ActiveLockState) {
    let active = state.active.lock().ok().and_then(|mut guard| guard.take());
    if let Some(active) = active {
        let _ = release_owned_lock(&active.base_dir, &active.session_id);
    }
}

pub fn release_active_lock_on_run_event(state: &ActiveLockState, event: &tauri::RunEvent) {
    if matches!(
        event,
        tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit
    ) {
        release_active_lock(state);
    }
}

fn acquire_library_lock(
    base_dir: &str,
    current: LibraryLockInfo,
    now_ms: i64,
    force_takeover: bool,
    state: &ActiveLockState,
) -> Result<LibraryLockInfo, String> {
    let path = lock_path(base_dir);
    let existing = read_library_lock(&path);

    match evaluate_library_lock(existing.as_ref(), &current, now_ms) {
        LockEvaluation::Conflict => {
            return Err(format_lock_error(LOCK_CONFLICT_PREFIX, existing.as_ref()));
        }
        LockEvaluation::Stale if !force_takeover => {
            return Err(format_lock_error(LOCK_STALE_PREFIX, existing.as_ref()));
        }
        LockEvaluation::Available | LockEvaluation::Owned | LockEvaluation::Stale => {}
    }

    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(format_io_error)?;
    }
    let raw = serde_json::to_string_pretty(&current).map_err(|error| error.to_string())?;
    fs::write(&path, raw).map_err(format_io_error)?;

    if let Ok(mut guard) = state.active.lock() {
        *guard = Some(ActiveLock {
            base_dir: normalize_dir(base_dir),
            session_id: current.session_id.clone(),
        });
    }

    Ok(current)
}

fn evaluate_library_lock(
    existing: Option<&LibraryLockInfo>,
    current: &LibraryLockInfo,
    now_ms: i64,
) -> LockEvaluation {
    let Some(existing) = existing else {
        return LockEvaluation::Available;
    };
    if existing.session_id == current.session_id {
        return LockEvaluation::Owned;
    }
    if existing.machine == current.machine && existing.user == current.user {
        return LockEvaluation::Owned;
    }

    let Some(updated_ms) = parse_rfc3339_ms(&existing.updated_at) else {
        return LockEvaluation::Stale;
    };
    if now_ms - updated_ms > LIBRARY_LOCK_STALE_MS {
        return LockEvaluation::Stale;
    }

    LockEvaluation::Conflict
}

fn release_owned_lock(base_dir: &str, session_id: &str) -> Result<(), String> {
    let path = lock_path(base_dir);
    let Some(existing) = read_library_lock(&path) else {
        return Ok(());
    };
    if existing.session_id == session_id && Path::new(&path).exists() {
        fs::remove_file(path).map_err(format_io_error)?;
    }
    Ok(())
}

fn clear_active_if_matches(state: &ActiveLockState, base_dir: &str, session_id: &str) {
    if let Ok(mut guard) = state.active.lock() {
        let normalized = normalize_dir(base_dir);
        if guard
            .as_ref()
            .map(|active| active.base_dir == normalized && active.session_id == session_id)
            .unwrap_or(false)
        {
            *guard = None;
        }
    }
}

fn lock_path(base_dir: &str) -> String {
    format!("{}{}", normalize_dir(base_dir), ACTIVE_LIBRARY_LOCK)
}

fn normalize_dir(path: &str) -> String {
    let normalized = path.replace('\\', "/");
    if normalized.ends_with('/') {
        normalized
    } else {
        format!("{normalized}/")
    }
}

fn read_library_lock(path: &str) -> Option<LibraryLockInfo> {
    fs::read_to_string(path)
        .ok()
        .and_then(|raw| serde_json::from_str::<LibraryLockInfo>(&raw).ok())
}

fn parse_rfc3339_ms(value: &str) -> Option<i64> {
    DateTime::parse_from_rfc3339(value)
        .ok()
        .map(|timestamp| timestamp.timestamp_millis())
}

fn format_lock_error(prefix: &str, lock: Option<&LibraryLockInfo>) -> String {
    let raw = lock
        .and_then(|lock| serde_json::to_string(lock).ok())
        .unwrap_or_else(|| "{}".to_string());
    format!("{prefix}{raw}")
}

fn format_io_error(error: std::io::Error) -> String {
    error.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        env,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn releases_owned_lock_file() {
        let root = test_root("release-owned");
        let lock = lock_info("session-a", "2026-06-25T10:00:00.000Z");
        write_test_lock(&root, &lock);

        release_owned_lock(root.to_str().unwrap(), "session-a").unwrap();

        assert!(!root.join(ACTIVE_LIBRARY_LOCK).exists());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn does_not_release_another_session_lock() {
        let root = test_root("release-other");
        let lock = lock_info("other-session", "2026-06-25T10:00:00.000Z");
        write_test_lock(&root, &lock);

        release_owned_lock(root.to_str().unwrap(), "session-a").unwrap();

        assert!(root.join(ACTIVE_LIBRARY_LOCK).exists());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn releases_active_state_lock_on_close() {
        let root = test_root("release-active");
        let current = lock_info("session-a", "2026-06-25T10:00:00.000Z");
        let state = ActiveLockState::default();

        acquire_library_lock(
            root.to_str().unwrap(),
            current,
            DateTime::parse_from_rfc3339("2026-06-25T10:00:00.000Z")
                .unwrap()
                .timestamp_millis(),
            false,
            &state,
        )
        .unwrap();
        release_active_lock(&state);

        assert!(!root.join(ACTIVE_LIBRARY_LOCK).exists());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn releases_active_state_lock_on_app_exit_event() {
        let root = test_root("release-exit");
        let current = lock_info("session-a", "2026-06-25T10:00:00.000Z");
        let state = ActiveLockState::default();

        acquire_library_lock(
            root.to_str().unwrap(),
            current,
            DateTime::parse_from_rfc3339("2026-06-25T10:00:00.000Z")
                .unwrap()
                .timestamp_millis(),
            false,
            &state,
        )
        .unwrap();
        release_active_lock_on_run_event(&state, &tauri::RunEvent::Exit);

        assert!(!root.join(ACTIVE_LIBRARY_LOCK).exists());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn recovers_same_machine_user_lock() {
        let root = test_root("recover-owner");
        let existing = lock_info("previous-session", "2026-06-25T09:59:00.000Z");
        let current = lock_info("session-a", "2026-06-25T10:00:00.000Z");
        let state = ActiveLockState::default();
        write_test_lock(&root, &existing);

        let result = acquire_library_lock(
            root.to_str().unwrap(),
            current.clone(),
            DateTime::parse_from_rfc3339("2026-06-25T10:00:00.000Z")
                .unwrap()
                .timestamp_millis(),
            false,
            &state,
        )
        .unwrap();

        assert_eq!(result, current);
        assert_eq!(
            read_library_lock(root.join(ACTIVE_LIBRARY_LOCK).to_str().unwrap()).unwrap(),
            current
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn blocks_fresh_lock_from_another_owner() {
        let existing = LibraryLockInfo {
            machine: "other-machine".to_string(),
            user: "other-user".to_string(),
            ..lock_info("other-session", "2026-06-25T09:59:00.000Z")
        };
        let current = lock_info("session-a", "2026-06-25T10:00:00.000Z");

        assert_eq!(
            evaluate_library_lock(
                Some(&existing),
                &current,
                DateTime::parse_from_rfc3339("2026-06-25T10:00:00.000Z")
                    .unwrap()
                    .timestamp_millis()
            ),
            LockEvaluation::Conflict
        );
    }

    fn lock_info(session_id: &str, updated_at: &str) -> LibraryLockInfo {
        LibraryLockInfo {
            session_id: session_id.to_string(),
            machine: "Win32".to_string(),
            user: "local-user".to_string(),
            updated_at: updated_at.to_string(),
            app_version: "0.1.0".to_string(),
        }
    }

    fn write_test_lock(root: &Path, lock: &LibraryLockInfo) {
        let path = root.join(ACTIVE_LIBRARY_LOCK);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, serde_json::to_string_pretty(lock).unwrap()).unwrap();
    }

    fn test_root(label: &str) -> PathBuf {
        let root = env::temp_dir().join(format!(
            "framecraft-lock-{label}-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        root
    }
}
