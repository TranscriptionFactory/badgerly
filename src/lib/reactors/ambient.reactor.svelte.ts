import { create_debounced_task_controller } from "$lib/reactors/debounced_task";
import type {
  AmbientLinkFacts,
  AmbientNotice,
  AssistantNoticeStore,
} from "$lib/features/assistant";
import type { EditorStore } from "$lib/features/editor";
import type { MissingLinkHit, SearchPort } from "$lib/features/search";
import type { UIStore } from "$lib/app";
import type { VaultStore } from "$lib/features/vault";
import type { VaultId } from "$lib/shared/types/ids";

const SCAN_DEBOUNCE_MS = 400;

export type AmbientReactorState = {
  scanned_vault_id: string | null;
  scanned_note_path: string | null;
  last_is_dirty: boolean;
  mtime_ms: number;
  max_notices: number;
  min_score: number;
};

export type AmbientReactorInput = {
  settings_loaded: boolean;
  enabled: boolean;
  vault_id: string | null;
  note_path: string | null;
  is_dirty: boolean;
  mtime_ms: number;
  max_notices: number;
  min_score: number;
};

export type AmbientDecision = {
  action: "noop" | "clear" | "scan";
  note_path: string | null;
  clear_first: boolean;
  next_state: AmbientReactorState;
};

// The producer arrives as a dependency rather than being imported here: the
// layering lint bans cross-feature deep imports, and keeping the reactor
// ignorant of which producers exist is what lets the tests swap one in.
// `produce_ambient_notices` is the value passed at the mount site.
export type AmbientProducer = (
  facts: AmbientLinkFacts,
  now: number,
) => AmbientNotice[];

export const INITIAL_AMBIENT_STATE: AmbientReactorState = {
  scanned_vault_id: null,
  scanned_note_path: null,
  last_is_dirty: false,
  mtime_ms: 0,
  max_notices: 3,
  min_score: 0.6,
};

// Pure so the trigger policy is testable in the cheap `node` environment,
// leaving jsdom for the zero-IO proof alone.
//
// Gate ORDER is load-bearing for I6. `settings_loaded` is read FIRST and bails
// to `noop`, because until settings land the flag still reads as its default
// and acting on it would either scan a vault the user opted out of, or wipe a
// queue on a value nobody chose. This is deliberately stricter than
// `lint.reactor`, which performs IO (`lint_service.stop()`) on its no-vault
// path; treat that as precedent to avoid, not to copy.
export function resolve_ambient_decision(
  state: AmbientReactorState,
  input: AmbientReactorInput,
): AmbientDecision {
  if (!input.settings_loaded) {
    return {
      action: "noop",
      note_path: null,
      clear_first: false,
      next_state: state,
    };
  }

  if (!input.enabled || !input.vault_id || !input.note_path) {
    return {
      action: "clear",
      note_path: null,
      clear_first: false,
      next_state: INITIAL_AMBIENT_STATE,
    };
  }

  const next_state: AmbientReactorState = {
    ...state,
    last_is_dirty: input.is_dirty,
  };

  // Never scan a buffer mid-edit: the index still holds the last saved text, so
  // findings computed now would describe content the user has already changed.
  if (input.is_dirty) {
    return {
      action: "noop",
      note_path: input.note_path,
      clear_first: false,
      next_state,
    };
  }

  const vault_changed = input.vault_id !== state.scanned_vault_id;
  const note_changed = input.note_path !== state.scanned_note_path;
  const save_completed = state.last_is_dirty;

  const scan_input_changed =
    input.mtime_ms !== state.mtime_ms ||
    input.max_notices !== state.max_notices ||
    input.min_score !== state.min_score;

  if (
    !vault_changed &&
    !note_changed &&
    !save_completed &&
    !scan_input_changed
  ) {
    return {
      action: "noop",
      note_path: input.note_path,
      clear_first: false,
      next_state,
    };
  }

  next_state.mtime_ms = input.mtime_ms;
  next_state.max_notices = input.max_notices;
  next_state.min_score = input.min_score;
  next_state.scanned_vault_id = input.vault_id;
  next_state.scanned_note_path = input.note_path;

  return {
    action: "scan",
    note_path: input.note_path,
    // Notices are scoped to the vault whose links produced them.
    clear_first: vault_changed && state.scanned_vault_id !== null,
    next_state,
  };
}

type ScanRequest = {
  vault_id: string;
  note_path: string;
  mtime_ms: number;
  max_notices: number;
  min_score: number;
};

type MissingLinkCacheEntry = {
  mtime_ms: number;
  max_notices: number;
  min_score: number;
  hits: MissingLinkHit[];
};

export function create_ambient_reactor(
  ui_store: UIStore,
  vault_store: VaultStore,
  editor_store: EditorStore,
  notice_store: AssistantNoticeStore,
  search_port: SearchPort,
  produce: AmbientProducer,
  now: () => number = Date.now,
): () => void {
  let state = INITIAL_AMBIENT_STATE;
  // Guards against a snapshot landing after the note moved on; the reply would
  // otherwise be written against whatever note is open by then.
  let generation = 0;
  // Block similarity is the expensive half of a scan, so it is fetched once per
  // (note, mtime) and replayed from here on every revisit until the note is
  // saved again. A new mtime also lifts the user's declines for that note.
  const missing_link_cache = new Map<string, MissingLinkCacheEntry>();

  function clear_all() {
    notice_store.clear();
    missing_link_cache.clear();
  }

  function load_missing_links(
    { vault_id, note_path, mtime_ms, max_notices, min_score }: ScanRequest,
    scan_generation: number,
  ): Promise<MissingLinkHit[]> {
    const cached = missing_link_cache.get(note_path);
    if (cached && cached.mtime_ms !== mtime_ms) {
      notice_store.lift_missing_link_suppressions(note_path);
    }
    if (max_notices <= 0) return Promise.resolve([]);
    if (
      cached &&
      cached.mtime_ms === mtime_ms &&
      cached.max_notices === max_notices &&
      cached.min_score === min_score
    ) {
      return Promise.resolve(cached.hits);
    }

    return search_port
      .find_missing_links(
        vault_id as VaultId,
        note_path,
        max_notices,
        min_score,
      )
      .then((hits) => {
        if (scan_generation === generation) {
          missing_link_cache.set(note_path, {
            mtime_ms,
            max_notices,
            min_score,
            hits,
          });
        }
        return hits;
      })
      .catch(() => []);
  }

  const scan = create_debounced_task_controller<ScanRequest>({
    run: (request) => {
      const scan_generation = generation;
      const { vault_id, note_path } = request;
      void Promise.all([
        search_port.get_note_links_snapshot(vault_id as VaultId, note_path),
        load_missing_links(request, scan_generation),
      ])
        .then(([snapshot, missing_links]) => {
          if (scan_generation !== generation) return;
          const linked = new Set<string>(
            [...snapshot.backlinks, ...snapshot.outlinks].map(
              (note) => note.path,
            ),
          );
          notice_store.replace_for_note(
            note_path,
            produce(
              {
                note_path,
                backlinks: snapshot.backlinks,
                outlinks: snapshot.outlinks,
                orphan_links: snapshot.orphan_links,
                missing_links: missing_links.filter(
                  (hit) => !linked.has(hit.target_path),
                ),
                suppressed_targets:
                  notice_store.suppressed_missing_link_targets(note_path),
                missing_link_max_notices:
                  ui_store.editor_settings.ambient_missing_link_max_notices,
              },
              now(),
            ),
          );
        })
        .catch(() => {
          // A failed snapshot means no findings to offer, not an error to
          // surface: ambient is advisory and must never interrupt.
        });
    },
  });

  return $effect.root(() => {
    $effect(() => {
      const decision = resolve_ambient_decision(state, {
        settings_loaded: ui_store.editor_settings_loaded,
        enabled: ui_store.editor_settings.ambient_notices_enabled,
        vault_id: vault_store.active_vault_id,
        note_path: editor_store.open_note?.meta.path ?? null,
        is_dirty: editor_store.open_note?.is_dirty ?? false,
        mtime_ms: editor_store.open_note?.meta.mtime_ms ?? 0,
        max_notices: ui_store.editor_settings.ambient_missing_link_max_notices,
        min_score: ui_store.editor_settings.ambient_missing_link_min_score,
      });
      state = decision.next_state;

      if (decision.action === "noop") {
        if (
          !ui_store.editor_settings_loaded ||
          editor_store.open_note?.is_dirty
        ) {
          generation += 1;
          scan.cancel();
        }
        return;
      }

      generation += 1;
      scan.cancel();

      if (decision.action === "clear") {
        clear_all();
        return;
      }

      if (decision.clear_first) {
        clear_all();
      }

      const vault_id = vault_store.active_vault_id;
      if (!vault_id || !decision.note_path) return;

      scan.schedule(
        {
          vault_id: String(vault_id),
          note_path: decision.note_path,
          mtime_ms: editor_store.open_note?.meta.mtime_ms ?? 0,
          max_notices:
            ui_store.editor_settings.ambient_missing_link_max_notices,
          min_score: ui_store.editor_settings.ambient_missing_link_min_score,
        },
        SCAN_DEBOUNCE_MS,
      );
    });

    return () => {
      generation += 1;
      scan.cancel();
    };
  });
}
