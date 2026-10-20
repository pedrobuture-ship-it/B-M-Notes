use crate::filesystem::{hash_content, ops, paths, trash, AppState};
use crate::watcher;
use base64::Engine;
use serde::Serialize;
use tauri::{AppHandle, State};

type Res<T> = Result<T, String>;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceInfo {
    pub root: String,
    pub name: String,
}

#[tauri::command]
pub fn open_workspace(app: AppHandle, state: State<'_, AppState>, path: String) -> Res<WorkspaceInfo> {
    let root = std::path::PathBuf::from(&path)
        .canonicalize()
        .map_err(|e| format!("Cannot open folder: {e}"))?;
    if !root.is_dir() {
        return Err("Not a folder".into());
    }
    std::fs::read_dir(&root).map_err(|e| format!("Cannot read folder: {e}"))?;
    let name = root
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| root.to_string_lossy().into_owned());
    *state.root.lock().map_err(|_| "state poisoned")? = Some(root.clone());
    state.self_writes.lock().map_err(|_| "state poisoned")?.clear();
    watcher::start(&app, &state, root.clone())?;
    Ok(WorkspaceInfo { root: root.to_string_lossy().into_owned(), name })
}

#[tauri::command]
pub fn close_workspace(state: State<'_, AppState>) -> Res<()> {
    *state.root.lock().map_err(|_| "state poisoned")? = None;
    *state.watcher.lock().map_err(|_| "state poisoned")? = None;
    Ok(())
}

#[tauri::command]
pub fn scan_workspace(state: State<'_, AppState>, ignored: Vec<String>) -> Res<Vec<ops::TreeNode>> {
    ops::scan(&state.root()?, &ignored)
}

#[tauri::command]
pub fn read_all_notes(state: State<'_, AppState>, ignored: Vec<String>) -> Res<Vec<ops::NoteFile>> {
    ops::read_all(&state.root()?, &ignored)
}

#[tauri::command]
pub fn read_note(state: State<'_, AppState>, path: String) -> Res<ops::NoteFile> {
    ops::read_note(&state.root()?, &path)
}

#[tauri::command]
pub fn write_note(state: State<'_, AppState>, path: String, content: String) -> Res<u64> {
    let root = state.root()?;
    let abs = paths::safe_join(&root, &path)?;
    state
        .self_writes
        .lock()
        .map_err(|_| "state poisoned")?
        .insert(abs, hash_content(&content));
    ops::write_note(&root, &path, &content)
}

#[tauri::command]
pub fn create_note(state: State<'_, AppState>, dir: String, name: String, content: String) -> Res<String> {
    ops::create_note(&state.root()?, &dir, &name, &content)
}

#[tauri::command]
pub fn create_dir(state: State<'_, AppState>, parent: String, name: String) -> Res<String> {
    ops::create_dir(&state.root()?, &parent, &name)
}

#[tauri::command]
pub fn rename_entry(state: State<'_, AppState>, path: String, new_name: String) -> Res<String> {
    ops::rename(&state.root()?, &path, &new_name)
}

#[tauri::command]
pub fn move_entry(state: State<'_, AppState>, path: String, new_parent: String) -> Res<String> {
    ops::move_entry(&state.root()?, &path, &new_parent)
}

#[tauri::command]
pub fn delete_entry(state: State<'_, AppState>, path: String) -> Res<()> {
    trash::move_to_trash(&state.root()?, &path).map(|_| ())
}

#[tauri::command]
pub fn list_trash(state: State<'_, AppState>, retention_days: u32) -> Res<Vec<trash::TrashItem>> {
    let root = state.root()?;
    trash::purge_expired(&root, retention_days)?;
    trash::list(&root)
}

#[tauri::command]
pub fn restore_trash(state: State<'_, AppState>, id: String) -> Res<String> {
    trash::restore(&state.root()?, &id)
}

#[tauri::command]
pub fn delete_trash(state: State<'_, AppState>, id: String) -> Res<()> {
    trash::delete(&state.root()?, &id)
}

#[tauri::command]
pub fn empty_trash(state: State<'_, AppState>) -> Res<()> {
    trash::empty(&state.root()?)
}

#[tauri::command]
pub fn save_asset(state: State<'_, AppState>, assets_dir: String, file_name: String, data_base64: String) -> Res<String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data_base64)
        .map_err(|e| e.to_string())?;
    ops::save_asset(&state.root()?, &assets_dir, &file_name, &bytes)
}

#[tauri::command]
pub fn absolute_path(state: State<'_, AppState>, path: String) -> Res<String> {
    let root = state.root()?;
    let abs = if path.is_empty() { root } else { paths::safe_join(&root, &path)? };
    Ok(abs.to_string_lossy().into_owned())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MetaRead {
    pub content: Option<String>,
    /// Latest valid backup, only offered for board.json.
    pub backup: Option<String>,
}

#[tauri::command]
pub fn read_meta(state: State<'_, AppState>, file: String) -> Res<MetaRead> {
    let root = state.root()?;
    let content = ops::read_meta(&root, &file)?;
    let backup = if file == "board.json" { ops::latest_board_backup(&root) } else { None };
    Ok(MetaRead { content, backup })
}

#[tauri::command]
pub fn write_meta(state: State<'_, AppState>, file: String, content: String) -> Res<()> {
    ops::write_meta(&state.root()?, &file, &content)
}

/// Folder passed on the command line (`buturenotes /path/to/notes`), if any.
#[tauri::command]
pub fn launch_path() -> Option<String> {
    std::env::args()
        .skip(1)
        .find(|a| !a.starts_with('-') && std::path::Path::new(a).is_dir())
}
