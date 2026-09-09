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

pub(crate) fn embedding_scope_from_editor(_editor: Option<&Value>) -> EmbeddingScope {
    todo!("lane A step 1")
}

pub(crate) fn note_embed_eligible(_facts: &NoteEmbedFacts, _scope: EmbeddingScope) -> bool {
    todo!("lane A step 1")
}
