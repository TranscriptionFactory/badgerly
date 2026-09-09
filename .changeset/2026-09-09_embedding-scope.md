---
"carbide": minor
---

Semantic search only embeds files with a body and within the new per-vault Embedding Scope setting (Markdown / Documents / Everything). Vectors for files that fall out of scope are dropped on the next embedding pass, and non-markdown documents re-embed when their content changes.
