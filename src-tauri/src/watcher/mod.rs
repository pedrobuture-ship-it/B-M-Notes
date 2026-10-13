//! Filesystem watcher. Debounces raw notify events and emits a single
//! `fs-change` event to the frontend. Our own saves are filtered by content hash.

use crate::filesystem::{hash_content, paths, AppState};
use notify::{EventKind, RecursiveMode, Watcher};
use serde::Serialize;
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::mpsc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct FsChange {
    /// Markdown files whose content changed externally (relative paths).
    changed: Vec<String>,
    /// Files that no longer exist.
    removed: Vec<String>,
    /// A folder or file was created/removed/renamed: the tree must be rescanned.
    structure: bool,
}

pub fn start(app: &AppHandle, state: &State<'_, AppState>, root: PathBuf) -> Result<(), String> {
    let (tx, rx) = mpsc::channel::<notify::Event>();
    let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
        if let Ok(ev) = res {
            let _ = tx.send(ev);
        }
    })
    .map_err(|e| e.to_string())?;
    watcher
        .watch(&root, RecursiveMode::Recursive)
        .map_err(|e| format!("Cannot watch folder: {e}"))?;
    *state.watcher.lock().map_err(|_| "state poisoned")? = Some(watcher);

    let self_writes = state.self_writes.clone();
    let app = app.clone();
    std::thread::spawn(move || {
        // Thread ends when the watcher (and its sender) is dropped.
        while let Ok(first) = rx.recv() {
            let mut events = vec![first];
            while let Ok(ev) = rx.recv_timeout(Duration::from_millis(150)) {
                events.push(ev);
            }
            let mut changed = HashSet::new();
            let mut removed = HashSet::new();
            let mut structure = false;
            for ev in events {
                let is_remove = matches!(ev.kind, EventKind::Remove(_));
                let is_create = matches!(ev.kind, EventKind::Create(_));
                let is_modify_name = matches!(ev.kind, EventKind::Modify(notify::event::ModifyKind::Name(_)));
                for p in ev.paths {
                    let Some(rel) = paths::to_rel(&root, &p) else { continue };
                    if rel.is_empty() {
                        continue;
                    }
                    let skip = rel.split('/').any(|seg| {
                        paths::is_ignored(seg, &[]) || seg.ends_with(".mural-tmp") || seg.starts_with('.') && seg != "."
                    });
                    if skip {
                        continue;
                    }
                    if is_remove || is_create || is_modify_name {
                        structure = true;
                    }
                    if !paths::is_markdown(&p) {
                        continue;
                    }
                    if !p.exists() {
                        removed.insert(rel);
                    } else {
                        changed.insert((rel, p.clone()));
                    }
                }
            }
            let mut changed_out = Vec::new();
            for (rel, abs) in changed {
                if let Ok(content) = std::fs::read_to_string(&abs) {
                    let h = hash_content(&content);
                    let is_self = self_writes.lock().map(|m| m.get(&abs) == Some(&h)).unwrap_or(false);
                    if is_self {
                        continue;
                    }
                }
                changed_out.push(rel);
            }
            if changed_out.is_empty() && removed.is_empty() && !structure {
                continue;
            }
            let _ = app.emit(
                "fs-change",
                FsChange { changed: changed_out, removed: removed.into_iter().collect(), structure },
            );
        }
    });
    Ok(())
}
