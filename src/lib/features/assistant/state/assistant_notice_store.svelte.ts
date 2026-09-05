import type {
  AmbientNotice,
  AmbientNoticeId,
} from "$lib/features/assistant/types/ambient";

// I6: the one ambient notice queue. In-memory by contract (I8) — no
// persistence port, no hydration reactor, nothing survives a restart, exactly
// like the proposal store it feeds.
//
// Read paths are REAL because they are the frozen shape AU-061 builds its rail
// against while AU-060 is still implementing the producers; every mutator is
// AU-060's to implement.
//
// No injectable clock, deliberately — the same ruling as the proposal store
// (D2-3). `add_many` takes fully formed notices whose `created_at` the producer
// supplies; this store is hydrate-shaped, not create-shaped.
export class AssistantNoticeStore {
  notices = $state<AmbientNotice[]>([]);

  get(id: AmbientNoticeId): AmbientNotice | null {
    return this.notices.find((notice) => notice.id === id) ?? null;
  }

  // The rail renders one note at a time; the cap and overflow split is
  // `partition_notices`, not this store's business.
  for_note(note_path: string): AmbientNotice[] {
    return this.notices.filter((notice) => notice.note_path === note_path);
  }

  get count(): number {
    return this.notices.length;
  }

  // A producer replaces its whole finding set for a note rather than diffing:
  // the deterministic producers recompute from scratch, so a merge would leave
  // findings behind that the source no longer reports.
  replace_for_note(note_path: string, notices: AmbientNotice[]): void {
    this.notices = [
      ...this.notices.filter((notice) => notice.note_path !== note_path),
      ...notices,
    ];
  }

  // Declined (source, target) pairs for `missing_link`, keyed by source note.
  // Not `$state`: nothing renders from it; the reactor reads it when it
  // rebuilds a note's set. Accept retires through `dismiss` too, so an
  // accepted pair is also held back until the note is saved — otherwise a
  // cache replay would re-offer a link that is already queued for review.
  private suppressed_missing_links = new Map<string, Set<string>>();

  dismiss(id: AmbientNoticeId): void {
    const notice = this.get(id);
    if (notice?.kind === "missing_link" && notice.target_path) {
      this.suppress_missing_link(notice.note_path, notice.target_path);
    }
    this.notices = this.notices.filter((notice) => notice.id !== id);
  }

  private suppress_missing_link(note_path: string, target_path: string): void {
    const targets = this.suppressed_missing_links.get(note_path) ?? new Set();
    targets.add(target_path);
    this.suppressed_missing_links.set(note_path, targets);
  }

  suppressed_missing_link_targets(note_path: string): string[] {
    return [...(this.suppressed_missing_links.get(note_path) ?? [])];
  }

  // The declines were about the note as it was; once its mtime moves the
  // reactor calls this before it re-queries.
  lift_missing_link_suppressions(note_path: string): void {
    this.suppressed_missing_links.delete(note_path);
  }

  // Vault switch clears everything — notices are scoped to the vault whose
  // links produced them.
  clear(): void {
    this.notices = [];
    this.suppressed_missing_links.clear();
  }
}
