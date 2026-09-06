<script lang="ts">
  import {
    render_rag_markdown,
    CITATION_INDEX_ATTR,
  } from "$lib/features/assistant/domain/chat_markdown";
  import type { AssistantCitation } from "$lib/features/assistant/types/session";

  const NO_CITATIONS = new Map<number, AssistantCitation>();

  type Props = {
    content: string;
    citations?: Map<number, AssistantCitation>;
    streaming?: boolean;
    on_citation?: ((citation: AssistantCitation) => void) | undefined;
    on_open_url?: ((href: string) => void) | undefined;
    on_open_path?: ((path: string) => void) | undefined;
  };

  let {
    content,
    citations = NO_CITATIONS,
    streaming = false,
    on_citation,
    on_open_url,
    on_open_path,
  }: Props = $props();

  const rendered_html = $derived(render_rag_markdown(content, citations));

  let content_el = $state<HTMLElement | null>(null);

  $effect(() => {
    const el = content_el;
    if (!el) return;
    const on_click = (event: MouseEvent) => {
      const source = event.target as HTMLElement | null;
      const target = source?.closest(`[${CITATION_INDEX_ATTR}]`);
      if (target) {
        const index = Number(target.getAttribute(CITATION_INDEX_ATTR));
        const citation = citations.get(index);
        if (citation) on_citation?.(citation);
        return;
      }
      const anchor = source?.closest("a");
      if (!anchor) return;
      // Swallowed even without a handler: a rendered link that reaches the
      // browser navigates the whole webview off the app.
      event.preventDefault();
      const href = anchor.getAttribute("href") ?? "";
      if (href === "" || href.startsWith("#")) return;
      // Scheme needs 2+ chars so Windows drive paths (C:/…) read as paths
      if (/^[a-z][a-z0-9+.-]+:/i.test(href)) {
        on_open_url?.(href);
        return;
      }
      let decoded = href;
      try {
        decoded = decodeURI(href);
      } catch {
        // malformed percent-encoding — fall back to the raw href
      }
      on_open_path?.(decoded);
    };
    el.addEventListener("click", on_click);
    return () => el.removeEventListener("click", on_click);
  });
</script>

<div
  bind:this={content_el}
  class="rag-markdown text-sm leading-[1.45] text-foreground"
>
  {@html rendered_html}{#if streaming}<span
      class="ml-0.5 inline-block w-1.5 animate-pulse select-none align-baseline text-foreground"
      aria-hidden="true">▍</span
    >{/if}
</div>

<style>
  .rag-markdown :global(> :not(:last-child)) {
    margin-bottom: 0.5rem;
  }
  .rag-markdown :global(ul),
  .rag-markdown :global(ol) {
    padding-left: 1.25rem;
  }
  .rag-markdown :global(ul) {
    list-style: disc;
  }
  .rag-markdown :global(ol) {
    list-style: decimal;
  }
  .rag-markdown :global(pre) {
    overflow-x: auto;
    border-radius: calc(var(--radius) - 2px);
    background: var(--muted);
    padding: 0.5rem;
  }
  .rag-markdown :global(code) {
    font-family: var(--font-mono, monospace);
    font-size: 0.85em;
  }
  .rag-markdown :global(blockquote) {
    border-left: 2px solid var(--border);
    padding-left: 0.75rem;
    color: var(--muted-foreground);
  }
  .rag-markdown :global(h1),
  .rag-markdown :global(h2),
  .rag-markdown :global(h3),
  .rag-markdown :global(h4) {
    font-weight: 600;
  }
</style>
