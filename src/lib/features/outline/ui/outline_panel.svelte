<script lang="ts">
  import { use_app_context } from "$lib/app/context/app_context.svelte";
  import { ACTION_IDS } from "$lib/app";
  import type { OutlineHeading } from "$lib/features/outline/types/outline";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import ListTreeIcon from "@lucide/svelte/icons/list-tree";

  const { stores, action_registry } = use_app_context();

  const headings = $derived(stores.outline.headings);
  const active_heading_id = $derived(stores.outline.active_heading_id);
  const collapsed_ids = $derived(stores.outline.collapsed_ids);

  const visible_headings = $derived.by(() => {
    const result: OutlineHeading[] = [];
    const skip_below_level: number[] = [];

    for (const heading of headings) {
      while (
        skip_below_level.length > 0 &&
        heading.level <= skip_below_level[skip_below_level.length - 1]!
      ) {
        skip_below_level.pop();
      }

      if (skip_below_level.length > 0) continue;

      result.push(heading);

      if (collapsed_ids.has(heading.id)) {
        skip_below_level.push(heading.level);
      }
    }

    return result;
  });

  function has_children(heading: OutlineHeading): boolean {
    const idx = headings.indexOf(heading);
    if (idx < 0 || idx >= headings.length - 1) return false;
    const next = headings[idx + 1];
    return next !== undefined && next.level > heading.level;
  }

  function handle_click(heading: OutlineHeading) {
    void action_registry.execute(
      ACTION_IDS.outline_scroll_to_heading,
      heading.pos,
    );
  }

  function toggle_collapsed(event: MouseEvent, heading: OutlineHeading) {
    event.stopPropagation();
    stores.outline.toggle_collapsed(heading.id);
  }
</script>

<div class="OutlinePanel">
  {#if headings.length === 0}
    <div class="OutlinePanel__empty">
      <div class="OutlinePanel__empty-icon">
        <ListTreeIcon />
      </div>
      <p class="OutlinePanel__empty-text">No headings</p>
    </div>
  {:else}
    <nav class="OutlinePanel__list">
      {#each visible_headings as heading (heading.id)}
        <button
          type="button"
          class="OutlinePanel__item"
          class:OutlinePanel__item--active={heading.id === active_heading_id}
          style="padding-inline-start: {(heading.level - 1) * 12 + 8}px"
          onclick={() => handle_click(heading)}
        >
          {#if has_children(heading)}
            <button
              type="button"
              class="OutlinePanel__chevron"
              class:OutlinePanel__chevron--collapsed={collapsed_ids.has(heading.id)}
              onclick={(e) => toggle_collapsed(e, heading)}
            >
              <ChevronRightIcon />
            </button>
          {:else}
            <span class="OutlinePanel__chevron-spacer"></span>
          {/if}
          <span class="OutlinePanel__item-text">
            {heading.text || "(empty heading)"}
          </span>
        </button>
      {/each}
    </nav>
  {/if}
</div>

<style>
  .OutlinePanel {
    height: 100%;
    overflow-y: auto;
    padding-block: var(--space-1);
  }

  .OutlinePanel__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-6);
    color: var(--muted-foreground);
  }

  .OutlinePanel__empty-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: calc(var(--size-icon-lg) * 1.5);
    height: calc(var(--size-icon-lg) * 1.5);
  }

  :global(.OutlinePanel__empty-icon svg) {
    width: var(--size-icon-lg);
    height: var(--size-icon-lg);
  }

  .OutlinePanel__empty-text {
    font-size: var(--text-sm);
  }

  .OutlinePanel__list {
    display: flex;
    flex-direction: column;
  }

  .OutlinePanel__item {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    width: 100%;
    border: none;
    background: none;
    cursor: pointer;
    padding-block: var(--space-1);
    padding-inline-end: var(--space-2);
    font-size: var(--text-xs);
    color: var(--muted-foreground);
    text-align: start;
    line-height: 1.4;
    transition:
      color var(--duration-fast) var(--ease-default),
      background-color var(--duration-fast) var(--ease-default);
  }

  .OutlinePanel__item:hover {
    color: var(--foreground);
    background-color: var(--accent);
  }

  .OutlinePanel__item--active {
    color: var(--interactive);
    font-weight: 500;
  }

  .OutlinePanel__chevron {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: var(--size-icon-sm);
    height: var(--size-icon-sm);
    border: none;
    background: none;
    cursor: pointer;
    padding: 0;
    color: inherit;
    transition: transform var(--duration-fast) var(--ease-default);
    transform: rotate(90deg);
  }

  .OutlinePanel__chevron--collapsed {
    transform: rotate(0deg);
  }

  :global(.OutlinePanel__chevron svg) {
    width: var(--size-icon-xs);
    height: var(--size-icon-xs);
  }

  .OutlinePanel__chevron-spacer {
    flex-shrink: 0;
    width: var(--size-icon-sm);
  }

  .OutlinePanel__item-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
