use serde_json::Value;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum EmbeddingScope {
    Markdown,
    Documents,
    All,
}

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub(crate) struct NoteEmbedFacts {
    pub file_type: Option<String>,
    pub source: Option<String>,
    pub char_count: i64,
}

pub(crate) fn embedding_scope_from_editor(editor: Option<&Value>) -> EmbeddingScope {
    match editor
        .and_then(|e| e.get("embedding_scope"))
        .and_then(Value::as_str)
    {
        Some("markdown") => EmbeddingScope::Markdown,
        Some("all") => EmbeddingScope::All,
        _ => EmbeddingScope::Documents,
    }
}

pub(crate) fn note_embed_eligible(facts: &NoteEmbedFacts, scope: EmbeddingScope) -> bool {
    if facts.char_count <= 0 {
        return false;
    }
    let documents_or_wider = scope != EmbeddingScope::Markdown;
    if facts.source.as_deref() == Some("linked") {
        return documents_or_wider;
    }
    match facts.file_type.as_deref() {
        Some("markdown" | "canvas") => true,
        Some("pdf" | "html" | "epub" | "text") => documents_or_wider,
        Some("code") => scope == EmbeddingScope::All,
        _ => false,
    }
}
