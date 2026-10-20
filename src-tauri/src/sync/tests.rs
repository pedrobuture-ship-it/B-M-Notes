use super::*;
use std::fs;
use tempfile::TempDir;

fn git_in(dir: &Path, args: &[&str]) {
    let st = Command::new("git").current_dir(dir).args(args).output().unwrap();
    assert!(st.status.success(), "git {args:?}: {}", String::from_utf8_lossy(&st.stderr));
}

struct World {
    _remote: TempDir,
    url: String,
    a: TempDir,
    b: TempDir,
}

fn world() -> World {
    let remote = TempDir::new().unwrap();
    git_in(remote.path(), &["init", "-q", "--bare", "-b", "main"]);
    let url = remote.path().to_string_lossy().into_owned();
    let w = World { url, _remote: remote, a: TempDir::new().unwrap(), b: TempDir::new().unwrap() };
    w
}

fn git(dir: &TempDir) -> Git {
    Git::new(dir.path(), None)
}

fn write(dir: &TempDir, rel: &str, text: &str) {
    let p = dir.path().join(rel);
    fs::create_dir_all(p.parent().unwrap()).unwrap();
    fs::write(p, text).unwrap();
}

fn read(dir: &TempDir, rel: &str) -> String {
    fs::read_to_string(dir.path().join(rel)).unwrap()
}

#[test]
fn two_people_converge_on_different_files() {
    let w = world();
    write(&w.a, "one.md", "# one\n");
    git(&w.a).link(&w.url).unwrap();
    git(&w.b).link(&w.url).unwrap();
    assert_eq!(read(&w.b, "one.md"), "# one\n");

    write(&w.a, "a-only.md", "from a\n");
    write(&w.b, "b-only.md", "from b\n");
    git(&w.a).sync().unwrap();
    git(&w.b).sync().unwrap();
    let st = git(&w.a).sync().unwrap();
    assert!(st.conflicts.is_empty());
    assert_eq!(read(&w.a, "b-only.md"), "from b\n");
    assert_eq!(read(&w.b, "a-only.md"), "from a\n");
}

#[test]
fn same_file_different_lines_merges_automatically() {
    let w = world();
    write(&w.a, "n.md", "l1\nl2\nl3\nl4\nl5\nl6\nl7\n");
    git(&w.a).link(&w.url).unwrap();
    git(&w.b).link(&w.url).unwrap();
    write(&w.a, "n.md", "A1\nl2\nl3\nl4\nl5\nl6\nl7\n");
    write(&w.b, "n.md", "l1\nl2\nl3\nl4\nl5\nl6\nB7\n");
    git(&w.a).sync().unwrap();
    let st = git(&w.b).sync().unwrap();
    assert!(st.conflicts.is_empty());
    assert_eq!(read(&w.b, "n.md"), "A1\nl2\nl3\nl4\nl5\nl6\nB7\n");
}

#[test]
fn same_line_conflicts_and_can_be_resolved() {
    let w = world();
    write(&w.a, "n.md", "title\n");
    git(&w.a).link(&w.url).unwrap();
    git(&w.b).link(&w.url).unwrap();
    write(&w.a, "n.md", "mine\n");
    write(&w.b, "n.md", "theirs\n");
    git(&w.a).sync().unwrap();
    let st = git(&w.b).sync().unwrap();
    assert_eq!(st.conflicts, vec!["n.md".to_string()]);
    // Syncing again while conflicted does not push or lose anything.
    assert_eq!(git(&w.b).sync().unwrap().conflicts.len(), 1);

    let st = git(&w.b).resolve("n.md", "both").unwrap();
    assert!(st.conflicts.is_empty());
    assert_eq!(read(&w.b, "n.md"), "theirs\n");
    assert_eq!(read(&w.b, "n (from other).md"), "mine\n");
    git(&w.a).sync().unwrap();
    assert_eq!(read(&w.a, "n.md"), "theirs\n");
}

#[test]
fn board_json_merges_per_card_and_ignores_viewport() {
    let w = world();
    let base = r#"{"version":1,"viewport":{"x":0,"y":0,"zoom":1},"cards":{"a.md":{"x":0,"y":0},"b.md":{"x":10,"y":10}},"frames":[],"connections":[],"labels":{}}"#;
    write(&w.a, ".mural/board.json", base);
    write(&w.a, "a.md", "a\n");
    git(&w.a).link(&w.url).unwrap();
    git(&w.b).link(&w.url).unwrap();
    write(&w.a, ".mural/board.json", &base.replace(r#""a.md":{"x":0,"y":0}"#, r#""a.md":{"x":99,"y":0}"#).replace(r#""zoom":1"#, r#""zoom":2"#));
    write(&w.b, ".mural/board.json", &base.replace(r#""b.md":{"x":10,"y":10}"#, r#""b.md":{"x":10,"y":77}"#).replace(r#""zoom":1"#, r#""zoom":3"#));
    git(&w.a).sync().unwrap();
    let st = git(&w.b).sync().unwrap();
    assert!(st.conflicts.is_empty(), "{:?}", st.conflicts);
    let merged: serde_json::Value = serde_json::from_str(&read(&w.b, ".mural/board.json")).unwrap();
    assert_eq!(merged["cards"]["a.md"]["x"], 99);
    assert_eq!(merged["cards"]["b.md"]["y"], 77);
}

#[test]
fn private_files_are_ignored_and_status_reports_link() {
    let w = world();
    write(&w.a, "n.md", "x\n");
    write(&w.a, ".mural/settings.json", "{}");
    let g = git(&w.a);
    assert!(!g.status().linked);
    let st = g.link(&w.url).unwrap();
    assert!(st.linked && st.dirty == false && st.branch.as_deref() == Some("main"));
    let tracked = g.lines(&["ls-files"]);
    assert!(tracked.contains(&"n.md".to_string()));
    assert!(!tracked.iter().any(|f| f.contains("settings.json")));
    g.unlink().unwrap();
    assert!(!g.status().linked);
}

#[test]
fn edit_beats_delete_is_left_to_the_user() {
    let w = world();
    write(&w.a, "n.md", "x\n");
    git(&w.a).link(&w.url).unwrap();
    git(&w.b).link(&w.url).unwrap();
    fs::remove_file(w.a.path().join("n.md")).unwrap();
    write(&w.b, "n.md", "edited\n");
    git(&w.a).sync().unwrap();
    let st = git(&w.b).sync().unwrap();
    assert_eq!(st.conflicts, vec!["n.md".to_string()]);
    let st = git(&w.b).resolve("n.md", "mine").unwrap();
    assert!(st.conflicts.is_empty());
    assert_eq!(read(&w.b, "n.md"), "edited\n");
}
