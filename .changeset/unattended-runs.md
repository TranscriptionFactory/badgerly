---
"carbide": minor
---

Run the assistant unattended: a note added to a configured trigger folder, or an explicit "run now", starts an agent turn whose edits arrive as proposals for review. Unattended runs are refused any tool that writes directly, get their own iteration budget with a hard backend cap, and report what they did in the review center under their own provenance group.
