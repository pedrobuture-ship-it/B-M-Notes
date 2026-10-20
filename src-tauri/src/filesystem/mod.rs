pub mod ops;
pub mod paths;
pub mod trash;

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

/// Shared state: the open workspace root plus hashes of content we wrote
/// ourselves (so the watcher can ignore our own saves).
#[derive(Default)]
pub struct AppState {
    pub root: Mutex<Option<PathBuf>>,
    pub self_writes: Arc<Mutex<HashMap<PathBuf, u64>>>,
    pub watcher: Mutex<Option<notify::RecommendedWatcher>>,
}

impl AppState {
    pub fn root(&self) -> Result<PathBuf, String> {
        self.root
            .lock()
            .map_err(|_| "state poisoned".to_string())?
            .clone()
            .ok_or_else(|| "No workspace is open".to_string())
    }
}

pub fn hash_content(s: &str) -> u64 {
    use std::hash::{Hash, Hasher};
    let mut h = std::collections::hash_map::DefaultHasher::new();
    s.hash(&mut h);
    h.finish()
}
