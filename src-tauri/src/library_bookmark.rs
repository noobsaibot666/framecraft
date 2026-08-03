// Command surface for the sandboxed Mac App Store build's "portable"
// library mode (src/lib/libraryConfig.ts: mode === "portable"). Framecraft
// only ever has one active library open at a time (unlike Darkwave's
// multi-library catalog), so a single `Mutex<Option<BookmarkAccess>>` is
// enough — activating a new bookmark simply drops (and thereby releases)
// whichever one was previously held.
//
// Both commands exist unconditionally (stub-parity with license.rs): on
// non-macOS or the direct-dist build there is no sandbox to route around,
// so they no-op rather than requiring the frontend to special-case the
// platform before calling them.

#[cfg(all(target_os = "macos", not(feature = "direct-dist")))]
use crate::security_scoped_bookmark::{self, BookmarkAccess};

#[cfg(all(target_os = "macos", not(feature = "direct-dist")))]
#[derive(Default)]
pub struct BookmarkAccessState(pub std::sync::Mutex<Option<BookmarkAccess>>);

#[cfg(not(all(target_os = "macos", not(feature = "direct-dist"))))]
#[derive(Default)]
pub struct BookmarkAccessState;

/// Mints a security-scoped bookmark for a folder the user just picked via
/// the dialog plugin (see `openLibraryFromDialog` / `migrateCurrentDataToLibraryFromDialog`
/// in `src/lib/librarySettings.ts`). Returns an empty string when there is
/// nothing to bookmark (non-macOS, or the unsandboxed direct-dist build) —
/// the frontend only persists a bookmark when this is non-empty.
#[cfg(all(target_os = "macos", not(feature = "direct-dist")))]
#[tauri::command]
pub fn create_library_bookmark(path: String) -> Result<String, String> {
    security_scoped_bookmark::create_bookmark(std::path::Path::new(&path))
}

#[cfg(not(all(target_os = "macos", not(feature = "direct-dist"))))]
#[tauri::command]
pub fn create_library_bookmark(_path: String) -> Result<String, String> {
    Ok(String::new())
}

/// Resolves a stored bookmark and holds security-scoped access open for the
/// rest of this process's life (or until the next call replaces it). Called
/// once per library (re)connect from `getFramecraftDb()`
/// (`src/lib/dbConnection.ts`), before any native SQLite call touches the
/// portable path. Returns the resolved absolute path so the caller can
/// self-heal its stored path if an SMB/NAS share remounted under a
/// different `/Volumes/…` mount than last session.
#[cfg(all(target_os = "macos", not(feature = "direct-dist")))]
#[tauri::command]
pub fn activate_library_bookmark(
    state: tauri::State<'_, BookmarkAccessState>,
    bookmark: String,
) -> Result<String, String> {
    let access = security_scoped_bookmark::resolve_bookmark(&bookmark)?;
    let resolved_path = access
        .path()
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_default();

    let mut held = state.0.lock().expect("bookmark access mutex poisoned");
    *held = Some(access);

    Ok(resolved_path)
}

#[cfg(not(all(target_os = "macos", not(feature = "direct-dist"))))]
#[tauri::command]
pub fn activate_library_bookmark(
    _state: tauri::State<'_, BookmarkAccessState>,
    _bookmark: String,
) -> Result<String, String> {
    Ok(String::new())
}
