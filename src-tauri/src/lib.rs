mod commands;
mod filesystem;
mod github;
mod sync;
mod watcher;

use filesystem::{paths, AppState};
use tauri::http::{Response, StatusCode};

fn serve_asset(app: &tauri::AppHandle, uri: &str) -> Response<Vec<u8>> {
    use tauri::Manager;
    let fail = |code: StatusCode| Response::builder().status(code).body(Vec::new()).unwrap();
    let state = app.state::<AppState>();
    let Ok(root) = state.root() else { return fail(StatusCode::NOT_FOUND) };
    // mural://localhost/<percent-encoded relative path>
    let path_part = uri.split_once("://").map(|(_, r)| r).unwrap_or(uri);
    let path_part = path_part.split_once('/').map(|(_, p)| p).unwrap_or("");
    let path_part = path_part.split(['?', '#']).next().unwrap_or("");
    let rel = percent_decode(path_part);
    let Ok(abs) = paths::safe_join(&root, &rel) else { return fail(StatusCode::FORBIDDEN) };
    let Some(mime) = paths::image_mime(&abs) else { return fail(StatusCode::FORBIDDEN) };
    match std::fs::read(&abs) {
        Ok(bytes) => Response::builder()
            .header("Content-Type", mime)
            .header("Access-Control-Allow-Origin", "*")
            .body(bytes)
            .unwrap(),
        Err(_) => fail(StatusCode::NOT_FOUND),
    }
}

fn percent_decode(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' && i + 2 < b.len() {
            let hex = std::str::from_utf8(&b[i + 1..i + 3]).ok().and_then(|h| u8::from_str_radix(h, 16).ok());
            if let Some(v) = hex {
                out.push(v);
                i += 3;
                continue;
            }
        }
        out.push(b[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::default())
        .register_uri_scheme_protocol("mural", |ctx, request| {
            serve_asset(ctx.app_handle(), &request.uri().to_string())
        })
        .invoke_handler(tauri::generate_handler![
            commands::open_workspace,
            commands::close_workspace,
            commands::scan_workspace,
            commands::read_all_notes,
            commands::read_note,
            commands::write_note,
            commands::create_note,
            commands::create_dir,
            commands::rename_entry,
            commands::move_entry,
            commands::delete_entry,
            commands::list_trash,
            commands::restore_trash,
            commands::delete_trash,
            commands::empty_trash,
            commands::save_asset,
            commands::absolute_path,
            commands::read_meta,
            commands::write_meta,
            commands::launch_path,
            github::github_login_start,
            github::github_login_poll,
            github::github_status,
            github::github_logout,
            sync::sync_status,
            sync::sync_link,
            sync::sync_now,
            sync::sync_resolve,
            sync::sync_unlink,
            sync::github_list_repos,
            sync::github_create_repo,
        ])
        .run(tauri::generate_context!())
        .expect("error while running buturenotes");
}

#[cfg(test)]
mod tests {
    use super::percent_decode;

    #[test]
    fn decodes_percent_sequences() {
        assert_eq!(percent_decode("assets/a%20b.png"), "assets/a b.png");
        assert_eq!(percent_decode("a%2"), "a%2");
        assert_eq!(percent_decode("%C3%A9.png"), "é.png");
    }
}
