use std::collections::HashMap;

use super::extract_links;
use crate::features::search::service::{resolve_note_link, resolve_wiki_link, rewrite_note_links};

#[test]
fn session_links_do_not_become_note_index_targets() {
    let links = extract_links("[[◈ session-1]] [[◈ Session #3|alias]] [session](◈%20session-1) [[ordinary]]", &[]);
    assert_eq!(links.len(), 1);
    assert_eq!(links[0].target, "ordinary");
}

#[test]
fn note_resolvers_reject_reserved_session_targets() {
    for target in ["◈ session-1", " ◈ Title #3", "◈"] {
        assert!(resolve_note_link("note.md".into(), target.into()).is_none());
        assert!(resolve_wiki_link("note.md".into(), target.into()).is_none());
    }
    assert_eq!(resolve_wiki_link("note.md".into(), "ordinary".into()), Some("ordinary.md".into()));
}

#[test]
fn note_rename_repairs_preserve_session_links() {
    let original = "[[◈ session-1]] [[ordinary]]";
    let result = rewrite_note_links(original.into(), "source.md".into(), "source.md".into(), HashMap::from([
        ("◈ session-1.md".into(), "wrong.md".into()),
        ("ordinary.md".into(), "renamed.md".into()),
    ]));
    assert!(result.changed);
    assert_eq!(result.markdown, "[[◈ session-1]] [[renamed]]");
}
