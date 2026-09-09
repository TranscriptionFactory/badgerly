use crate::features::search::db::{list_frontmatter_tags, open_search_db_at_path};
use crate::features::search::tag_promotion::{
    is_promoted, promoted_set, promoted_setting_from_value,
};
use rusqlite::params;
use serde_json::json;
use std::collections::HashSet;
use tempfile::TempDir;

fn strings(items: &[&str]) -> Vec<String> {
    items.iter().map(|s| s.to_string()).collect()
}

fn set_of(setting: &[&str], frontmatter: &[&str]) -> HashSet<String> {
    promoted_set(&strings(setting), &strings(frontmatter))
}

#[test]
fn setting_parses_strings_and_strips_hash() {
    let value = json!(["#Work", " proj/a ", "plain", "", "   ", "#"]);
    let parsed = promoted_setting_from_value(Some(&value));
    assert_eq!(parsed, strings(&["Work", "proj/a", "plain"]));
}

#[test]
fn setting_ignores_non_string_entries() {
    let value = json!(["a", 1, null, true, { "x": 1 }, ["b"], "c"]);
    let parsed = promoted_setting_from_value(Some(&value));
    assert_eq!(parsed, strings(&["a", "c"]));
}

#[test]
fn setting_missing_or_not_an_array_is_empty() {
    assert!(promoted_setting_from_value(None).is_empty());
    assert!(promoted_setting_from_value(Some(&json!("work"))).is_empty());
    assert!(promoted_setting_from_value(Some(&json!({ "work": true }))).is_empty());
    assert!(promoted_setting_from_value(Some(&json!(null))).is_empty());
}

#[test]
fn promoted_set_is_lowercased_union_of_both_sources() {
    let set = set_of(&["Work", "Proj/A"], &["Area", "work"]);
    let expected: HashSet<String> = strings(&["work", "proj/a", "area"]).into_iter().collect();
    assert_eq!(set, expected);
}

#[test]
fn is_promoted_exact_case_insensitive() {
    let set = set_of(&["Work"], &[]);
    assert!(is_promoted("work", &set));
    assert!(is_promoted("WORK", &set));
    assert!(is_promoted("Work", &set));
    assert!(!is_promoted("works", &set));
    assert!(!is_promoted("wor", &set));
}

#[test]
fn is_promoted_by_ancestor_prefix() {
    let set = set_of(&["proj"], &[]);
    assert!(is_promoted("proj/a", &set));
    assert!(is_promoted("proj/a/b", &set));
    assert!(is_promoted("PROJ/A/B", &set));
    assert!(!is_promoted("project", &set));
    assert!(!is_promoted("project/a", &set));
    assert!(!is_promoted("other/proj", &set));
}

#[test]
fn is_promoted_matches_intermediate_ancestor() {
    let set = set_of(&["proj/a"], &[]);
    assert!(is_promoted("proj/a/b/c", &set));
    assert!(!is_promoted("proj", &set));
    assert!(!is_promoted("proj/b", &set));
}

#[test]
fn frontmatter_tags_promote_their_descendants() {
    let set = set_of(&[], &["Area"]);
    assert!(is_promoted("area", &set));
    assert!(is_promoted("Area/sub", &set));
    assert!(is_promoted("area/sub/deep", &set));
}

#[test]
fn unlisted_inline_tag_is_candidate() {
    let set = set_of(&["x"], &["y"]);
    assert!(!is_promoted("z", &set));
    assert!(!is_promoted("z/x", &set));
}

#[test]
fn empty_set_promotes_nothing() {
    let set = set_of(&[], &[]);
    assert!(set.is_empty());
    assert!(!is_promoted("anything", &set));
    assert!(!is_promoted("", &set));
}

fn open_db() -> (TempDir, rusqlite::Connection) {
    let tmp = TempDir::new().expect("temp dir");
    let conn = open_search_db_at_path(&tmp.path().join("test.db")).expect("db open");
    (tmp, conn)
}

fn insert_note(conn: &rusqlite::Connection, path: &str) {
    conn.execute(
        "INSERT OR IGNORE INTO notes (path, title, mtime_ms, ctime_ms, size_bytes, word_count, char_count, heading_count, reading_time_secs, last_indexed_at, file_type) VALUES (?1, ?1, 0, 0, 100, 50, 200, 2, 30, 0, 'md')",
        params![path],
    )
    .expect("insert note");
}

fn insert_tag(conn: &rusqlite::Connection, path: &str, tag: &str, line: i64, source: &str) {
    insert_note(conn, path);
    conn.execute(
        "INSERT INTO note_inline_tags (path, tag, line, source) VALUES (?1, ?2, ?3, ?4)",
        params![path, tag, line, source],
    )
    .expect("insert tag");
}

#[test]
fn list_frontmatter_tags_is_distinct_and_source_filtered() {
    let (_tmp, conn) = open_db();
    insert_tag(&conn, "a.md", "Work", 1, "frontmatter");
    insert_tag(&conn, "b.md", "Work", 1, "frontmatter");
    insert_tag(&conn, "b.md", "area/sub", 2, "frontmatter");
    insert_tag(&conn, "c.md", "draft", 7, "inline");
    insert_tag(&conn, "c.md", "Work", 9, "inline");

    let mut tags = list_frontmatter_tags(&conn).expect("list frontmatter tags");
    tags.sort();
    assert_eq!(tags, strings(&["Work", "area/sub"]));
}

#[test]
fn list_frontmatter_tags_is_empty_without_frontmatter_rows() {
    let (_tmp, conn) = open_db();
    insert_tag(&conn, "c.md", "draft", 7, "inline");

    let tags = list_frontmatter_tags(&conn).expect("list frontmatter tags");
    assert!(tags.is_empty());
}
