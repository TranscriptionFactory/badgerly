use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::AppHandle;
use crate::shared::{io_utils, storage};
use super::service::safe_vault_abs_for_write;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct ProposalMutation {
    pub path: String,
    pub before: Option<String>,
    pub after: Option<String>,
}

static MUTATIONS: Mutex<()> = Mutex::new(());

fn note_path(root: &Path, path: &str) -> Result<PathBuf, String> {
    if !path.to_lowercase().ends_with(".md") || path.contains('\\') || path.split('/').any(|part| part.is_empty() || part.starts_with('.')) {
        return Err("invalid proposal note path".into());
    }
    let absolute = safe_vault_abs_for_write(root, path)?;
    let mut component = root.to_path_buf();
    for part in path.split('/') {
        component.push(part);
        if std::fs::symlink_metadata(&component).is_ok_and(|meta| meta.file_type().is_symlink()) {
            return Err("proposal paths must not traverse symlinks".into());
        }
    }
    Ok(absolute)
}

fn read_optional(path: &Path) -> Result<Option<String>, String> {
    match std::fs::read_to_string(path) {
        Ok(content) => Ok(Some(content)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

pub fn prepare_rename(root: &Path, from: &str, to: &str) -> Result<Vec<ProposalMutation>, String> {
    let source = note_path(root, from)?;
    let target = note_path(root, to)?;
    let content = read_optional(&source)?.ok_or("rename source is missing")?;
    if from == to || std::fs::symlink_metadata(&target).is_ok() { return Err("rename destination already exists".into()); }
    let map = HashMap::from([(from.to_string(), to.to_string())]);
    let rewritten = crate::features::search::service::rewrite_note_links(content.clone(), from.into(), to.into(), map.clone());
    let mut mutations = vec![
        ProposalMutation { path: from.into(), before: Some(content), after: None },
        ProposalMutation { path: to.into(), before: None, after: Some(rewritten.markdown) },
    ];
    for entry in walkdir::WalkDir::new(root).into_iter().filter_entry(|entry| entry.depth() == 0 || !entry.file_name().to_string_lossy().starts_with('.')) {
        let entry = entry.map_err(|error| error.to_string())?;
        if !entry.file_type().is_file() || entry.path().extension().is_none_or(|extension| !extension.eq_ignore_ascii_case("md")) { continue; }
        let path = entry.path().strip_prefix(root).map_err(|error| error.to_string())?.to_string_lossy().replace('\\', "/");
        if path == from { continue; }
        let absolute = note_path(root, &path)?;
        let before = std::fs::read_to_string(absolute).map_err(|error| error.to_string())?;
        let result = crate::features::search::service::rewrite_note_links(before.clone(), path.clone(), path.clone(), map.clone());
        if result.changed { mutations.push(ProposalMutation { path, before: Some(before), after: Some(result.markdown) }); }
    }
    Ok(mutations)
}

pub fn apply_mutations(root: &Path, mutations: &[ProposalMutation]) -> Result<(), String> {
    apply_mutations_with(root, mutations, |path, content| io_utils::atomic_write(path, content))
}

pub(crate) fn apply_mutations_with(root: &Path, mutations: &[ProposalMutation], mut write: impl FnMut(&Path, &[u8]) -> Result<(), String>) -> Result<(), String> {
    let _guard = MUTATIONS.lock().map_err(|error| error.to_string())?;
    let mut seen = HashSet::new();
    let mut paths = Vec::new();
    for mutation in mutations {
        if !seen.insert(&mutation.path) || mutation.before == mutation.after { return Err("invalid or duplicate mutation".into()); }
        let absolute = note_path(root, &mutation.path)?;
        if read_optional(&absolute)? != mutation.before { return Err(format!("conflict: {} changed before apply", mutation.path)); }
        paths.push(absolute);
    }
    if mutations.is_empty() { return Ok(()); }
    let archive_relative = format!(".carbide/archive/{}_proposal-mutation-{}", storage::format_epoch_ms_as_date(storage::now_ms()), rand::random::<u64>());
    let archive = safe_vault_abs_for_write(root, &archive_relative)?;
    std::fs::create_dir_all(&archive).map_err(|error| error.to_string())?;
    let manifest: Vec<_> = mutations.iter().enumerate().map(|(index, mutation)| serde_json::json!({ "backup": index, "path": mutation.path, "before_revision": mutation.before.as_deref().map(super::edit_operation::note_revision), "after_revision": mutation.after.as_deref().map(super::edit_operation::note_revision) })).collect();
    io_utils::atomic_write(&archive.join("manifest.json"), serde_json::to_vec_pretty(&manifest).map_err(|error| error.to_string())?.as_slice())?;
    let mut completed = Vec::new();
    for (index, (mutation, path)) in mutations.iter().zip(&paths).enumerate() {
        let backup = archive.join(index.to_string());
        let result = (|| {
            if read_optional(path)? != mutation.before { return Err(format!("conflict: {} changed during apply", mutation.path)); }
            if let Some(parent) = path.parent() { std::fs::create_dir_all(parent).map_err(|error| error.to_string())?; }
            if mutation.before.is_some() { std::fs::rename(path, &backup).map_err(|error| error.to_string())?; }
            completed.push(index);
            if let Some(content) = &mutation.after { write(path, content.as_bytes())?; }
            Ok::<(), String>(())
        })();
        if let Err(error) = result {
            let mut failures = Vec::new();
            for done in completed.into_iter().rev() {
                let restore = (|| {
                    if paths[done].exists() { std::fs::rename(&paths[done], archive.join(format!("{done}_failed"))).map_err(|error| error.to_string())?; }
                    if mutations[done].before.is_some() { std::fs::rename(archive.join(done.to_string()), &paths[done]).map_err(|error| error.to_string())?; }
                    Ok::<(), String>(())
                })();
                if let Err(error) = restore { failures.push(error); }
            }
            return Err(if failures.is_empty() { error } else { format!("{error}; rollback failed: {}; recovery archive: {}", failures.join("; "), archive.display()) });
        }
    }
    Ok(())
}

pub fn anchor_mutations(root: &Path, paths: &[String], anchor: &str) -> Result<Vec<ProposalMutation>, String> {
    let repo = git2::Repository::open(root).map_err(|error| error.to_string())?;
    let tree = repo.revparse_single(anchor).and_then(|object| object.peel_to_commit()).and_then(|commit| commit.tree()).map_err(|error| error.to_string())?;
    let mut mutations = Vec::new();
    for path in paths {
        let before = read_optional(&note_path(root, path)?)?;
        let after = match tree.get_path(Path::new(path)) {
            Ok(entry) => Some(String::from_utf8(repo.find_blob(entry.id()).map_err(|error| error.to_string())?.content().to_vec()).map_err(|error| error.to_string())?),
            Err(error) if error.code() == git2::ErrorCode::NotFound => None,
            Err(error) => return Err(error.to_string()),
        };
        if before != after { mutations.push(ProposalMutation { path: path.clone(), before, after }); }
    }
    Ok(mutations)
}

#[tauri::command]
#[specta::specta]
pub async fn prepare_proposal_rename(app: AppHandle, vault_id: String, from: String, to: String) -> Result<Vec<ProposalMutation>, String> {
    crate::shared::blocking::blocking("prepare_proposal_rename", move || {
        let root = storage::vault_path(&app, &vault_id)?;
        prepare_rename(Path::new(&root), &from, &to)
    }).await
}

#[tauri::command]
#[specta::specta]
pub async fn apply_proposal_mutations(app: AppHandle, vault_id: String, mutations: Vec<ProposalMutation>) -> Result<(), String> {
    crate::shared::blocking::blocking("apply_proposal_mutations", move || {
        let root = storage::vault_path(&app, &vault_id)?;
        apply_mutations(Path::new(&root), &mutations)
    }).await
}

#[tauri::command]
#[specta::specta]
pub async fn prepare_proposal_restore(app: AppHandle, vault_id: String, paths: Vec<String>, anchor: String) -> Result<Vec<ProposalMutation>, String> {
    crate::shared::blocking::blocking("prepare_proposal_restore", move || {
        let root = storage::vault_path(&app, &vault_id)?;
        anchor_mutations(Path::new(&root), &paths, &anchor)
    }).await
}
