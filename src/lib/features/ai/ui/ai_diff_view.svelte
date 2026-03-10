<script lang="ts">
  import type { AiDraftDiff } from "$lib/features/ai/domain/ai_diff";

  type Props = {
    diff: AiDraftDiff | null;
  };

  let { diff }: Props = $props();
</script>

{#if diff && diff.hunks.length > 0}
  <div class="AiDiffView">
    {#each diff.hunks as hunk}
      <div class="AiDiffView__hunk">
        <div class="AiDiffView__header">{hunk.header}</div>
        {#each hunk.lines as line}
          <div
            class="AiDiffView__line"
            class:AiDiffView__line--addition={line.type === "addition"}
            class:AiDiffView__line--deletion={line.type === "deletion"}
          >
            <span class="AiDiffView__gutter AiDiffView__gutter--old">
              {line.old_line ?? ""}
            </span>
            <span class="AiDiffView__gutter AiDiffView__gutter--new">
              {line.new_line ?? ""}
            </span>
            <span class="AiDiffView__content">{line.content}</span>
          </div>
        {/each}
      </div>
    {/each}
  </div>
{:else}
  <div class="AiDiffView AiDiffView--empty">
    <span class="AiDiffView__placeholder">No changes to display</span>
  </div>
{/if}

<style>
  .AiDiffView {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs);
    line-height: 1.5;
    overflow: auto;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
  }

  .AiDiffView--empty {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-8);
  }

  .AiDiffView__placeholder {
    color: var(--muted-foreground);
    font-family: var(--font-sans, sans-serif);
    font-size: var(--text-sm);
  }

  .AiDiffView__hunk {
    border-bottom: 1px solid var(--border);
  }

  .AiDiffView__hunk:last-child {
    border-bottom: none;
  }

  .AiDiffView__header {
    padding: var(--space-1) var(--space-3);
    background-color: var(--muted);
    color: var(--muted-foreground);
    font-size: var(--text-xs);
    user-select: none;
  }

  .AiDiffView__line {
    display: flex;
    min-height: 1.5em;
  }

  .AiDiffView__line--addition {
    background-color: color-mix(in oklch, var(--chart-2) 15%, transparent);
  }

  .AiDiffView__line--deletion {
    background-color: color-mix(in oklch, var(--destructive) 15%, transparent);
  }

  .AiDiffView__gutter {
    display: inline-flex;
    justify-content: flex-end;
    width: 3em;
    padding-inline: var(--space-1);
    color: var(--muted-foreground);
    user-select: none;
    flex-shrink: 0;
    opacity: 0.6;
  }

  .AiDiffView__gutter--old {
    border-inline-end: 1px solid var(--border);
  }

  .AiDiffView__gutter--new {
    border-inline-end: 1px solid var(--border);
  }

  .AiDiffView__content {
    padding-inline: var(--space-2);
    white-space: pre;
  }
</style>
