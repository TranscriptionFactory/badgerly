use git2::{Oid, Repository, Signature, Time};

use crate::features::git::service::{collect_file_history, git_show_file_following_renames};

fn commit(repo: &Repository, files: &[(&str, &str)], parents: &[Oid], message: &str, time: i64) -> Oid {
    let mut tree = repo.treebuilder(None).unwrap();
    for (path, content) in files {
        tree.insert(*path, repo.blob(content.as_bytes()).unwrap(), 0o100644).unwrap();
    }
    let tree = repo.find_tree(tree.write().unwrap()).unwrap();
    let parents: Vec<_> = parents.iter().map(|id| repo.find_commit(*id).unwrap()).collect();
    let signature = Signature::new("Test", "test@example.com", &Time::new(time, 0)).unwrap();
    repo.commit(None, &signature, &signature, message, &tree, &parents.iter().collect::<Vec<_>>()).unwrap()
}

fn set_head(repo: &Repository, id: Oid) {
    repo.reference("refs/heads/main", id, true, "test head").unwrap();
    repo.set_head("refs/heads/main").unwrap();
}

#[test]
fn merge_history_tracks_each_parent_path_and_emits_each_commit_once() {
    let dir = tempfile::tempdir().unwrap();
    let repo = Repository::init(dir.path()).unwrap();
    let root = dir.path().to_str().unwrap();
    let base = commit(&repo, &[("old.md", "note\n")], &[], "base", 10);
    let left = commit(&repo, &[("left.md", "note\n")], &[base], "rename left", 30);
    let right = commit(&repo, &[("right.md", "note\n")], &[base], "rename right", 20);
    let merge = commit(&repo, &[("current.md", "note\n")], &[left, right], "merge", 5);
    set_head(&repo, merge);

    let history = collect_file_history(root, "current.md", 20).unwrap();
    let hashes: Vec<_> = history.iter().map(|entry| entry.hash.clone()).collect();
    assert_eq!(hashes, [merge, left, right, base].map(|id| id.to_string()));
    let limited = collect_file_history(root, "current.md", 2).unwrap();
    assert_eq!(limited.iter().map(|entry| &entry.hash).collect::<Vec<_>>(), hashes[..2].iter().collect::<Vec<_>>());
    for id in [left, right, base] {
        assert_eq!(git_show_file_following_renames(root, "current.md", &id.to_string()).unwrap(), "note\n");
    }
}

#[test]
fn converging_rename_trails_report_ambiguous_content_at_the_common_ancestor() {
    let dir = tempfile::tempdir().unwrap();
    let repo = Repository::init(dir.path()).unwrap();
    let root = dir.path().to_str().unwrap();
    let shared = "shared line\n".repeat(20);
    let a = format!("{shared}left\n");
    let b = format!("{shared}right\n");
    let base = commit(&repo, &[("a.md", &a), ("b.md", &b)], &[], "base", 10);
    let left = commit(&repo, &[("current.md", &a), ("b.md", &b)], &[base], "left", 20);
    let right = commit(&repo, &[("a.md", &a), ("current.md", &b)], &[base], "right", 30);
    let merge = commit(&repo, &[("current.md", &a)], &[left, right], "merge", 40);
    set_head(&repo, merge);

    let error = git_show_file_following_renames(root, "current.md", &base.to_string()).unwrap_err();
    assert!(error.contains("ambiguous rename"), "{error}");
    assert_eq!(git_show_file_following_renames(root, "current.md", &left.to_string()).unwrap(), a);
    assert_eq!(git_show_file_following_renames(root, "current.md", &right.to_string()).unwrap(), b);
}

#[test]
fn revisions_outside_head_ancestry_use_the_requested_path_directly() {
    let dir = tempfile::tempdir().unwrap();
    let repo = Repository::init(dir.path()).unwrap();
    let root = dir.path().to_str().unwrap();
    let base = commit(&repo, &[("old.md", "original")], &[], "base", 10);
    let head = commit(&repo, &[("current.md", "original")], &[base], "rename", 20);
    let outside = commit(&repo, &[("current.md", "other content")], &[base], "outside", 30);
    set_head(&repo, head);

    assert_eq!(git_show_file_following_renames(root, "current.md", &outside.to_string()).unwrap(), "other content");
}

#[test]
fn history_and_pre_rename_reads_continue_beyond_ten_thousand_commits() {
    let dir = tempfile::tempdir().unwrap();
    let repo = Repository::init(dir.path()).unwrap();
    let root = dir.path().to_str().unwrap();
    let base = commit(&repo, &[("old.md", "original")], &[], "base", 1);
    let rename = commit(&repo, &[("current.md", "original")], &[base], "rename", 2);
    let tree = repo.find_commit(rename).unwrap().tree().unwrap();
    let mut head = rename;
    for i in 0..10_001 {
        let signature = Signature::new("Test", "test@example.com", &Time::new(i + 3, 0)).unwrap();
        head = repo.commit(None, &signature, &signature, "unrelated", &tree, &[&repo.find_commit(head).unwrap()]).unwrap();
    }
    set_head(&repo, head);

    let history = collect_file_history(root, "current.md", 2).unwrap();
    assert_eq!(history.iter().map(|entry| entry.hash.clone()).collect::<Vec<_>>(), [rename, base].map(|id| id.to_string()));
    assert_eq!(git_show_file_following_renames(root, "current.md", &base.to_string()).unwrap(), "original");
}

#[test]
fn zero_limit_and_unknown_paths_return_no_commits() {
    let dir = tempfile::tempdir().unwrap();
    let repo = Repository::init(dir.path()).unwrap();
    let root = dir.path().to_str().unwrap();
    let base = commit(&repo, &[("note.md", "original")], &[], "base", 1);
    set_head(&repo, base);
    assert!(collect_file_history(root, "note.md", 0).unwrap().is_empty());
    assert!(collect_file_history(root, "missing.md", 10).unwrap().is_empty());
}

#[test]
fn checkpoint_tag_normalization_matches_frontend_parity_vectors() {
    let vectors: serde_json::Value = serde_json::from_str(include_str!("../../tests/fixtures/checkpoint_tags.json")).unwrap();
    for vector in vectors.as_array().unwrap() {
        let description = vector["description"].as_str().unwrap();
        let slug = vector["slug"].as_str().unwrap();
        assert_eq!(crate::features::git::service::checkpoint_tag_name(description, 42),
            format!("checkpoint-{slug}-42"), "{description}");
    }
}

#[test]
fn missing_branch_candidates_do_not_make_a_unique_ancestor_path_ambiguous() {
    let dir = tempfile::tempdir().unwrap();
    let repo = Repository::init(dir.path()).unwrap();
    let root = dir.path().to_str().unwrap();
    let base = commit(&repo, &[("old.md", "original")], &[], "base", 10);
    let left = commit(&repo, &[("current.md", "original")], &[base], "rename", 20);
    let right = commit(&repo, &[("old.md", "original"), ("other.md", "other")], &[base], "other", 30);
    let merge = commit(&repo, &[("old.md", "original"), ("current.md", "original"), ("other.md", "other")], &[left, right], "merge", 40);
    set_head(&repo, merge);

    assert_eq!(git_show_file_following_renames(root, "current.md", &base.to_string()).unwrap(), "original");
}

#[test]
fn a_missing_tracked_path_does_not_fall_back_to_an_unrelated_old_note() {
    let dir = tempfile::tempdir().unwrap();
    let repo = Repository::init(dir.path()).unwrap();
    let root = dir.path().to_str().unwrap();
    let base = commit(&repo, &[("current.md", "unrelated")], &[], "base", 10);
    let created = commit(&repo, &[("old.md", "new note")], &[base], "replace", 20);
    let renamed = commit(&repo, &[("current.md", "new note")], &[created], "rename", 30);
    set_head(&repo, renamed);

    let error = git_show_file_following_renames(root, "current.md", &base.to_string()).unwrap_err();
    assert!(error.contains("not found"), "{error}");
}
