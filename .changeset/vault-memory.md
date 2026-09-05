---
"carbide": minor
---

The assistant now remembers across sessions: any note with `memory: true` frontmatter is a memory. Matching memories join the chat context through the same retrieval and budget as other notes, and the native agent loop gets `list_memories` and `save_memory` tools (saves go to the new Memory Folder setting, default `Memory/`, and a repeated title updates the existing memory instead of creating a second note).

Memory saves return a conflict instead of replacing an occupied note unless its current frontmatter verifies the same memory title.
