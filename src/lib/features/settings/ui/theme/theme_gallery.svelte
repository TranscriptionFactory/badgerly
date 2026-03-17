<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";
  import type { Theme } from "$lib/shared/types/theme";
  import { get_all_themes } from "$lib/shared/types/theme";

  type Props = {
    user_themes: Theme[];
    active_theme_id: string;
    on_switch: (theme_id: string) => void;
    on_create_click: () => void;
  };

  let { user_themes, active_theme_id, on_switch, on_create_click }: Props =
    $props();

  const all_themes = $derived(get_all_themes(user_themes));

  function theme_preview_colors(theme: Theme): {
    bg: string;
    fg: string;
    accent: string;
  } {
    const overrides = theme.token_overrides;
    const is_dark = theme.color_scheme === "dark";
    return {
      bg:
        overrides["--background"] ??
        (is_dark ? "oklch(0.15 0 0)" : "oklch(0.98 0 0)"),
      fg:
        overrides["--foreground"] ??
        (is_dark ? "oklch(0.9 0 0)" : "oklch(0.15 0 0)"),
      accent:
        overrides["--primary"] ??
        `oklch(${is_dark ? "0.65" : "0.45"} ${theme.accent_chroma} ${theme.accent_hue})`,
    };
  }
</script>

<div class="ThemeGallery">
  {#each all_themes as theme (theme.id)}
    {@const colors = theme_preview_colors(theme)}
    <button
      type="button"
      class="ThemeGallery__card"
      class:ThemeGallery__card--active={theme.id === active_theme_id}
      onclick={() => on_switch(theme.id)}
      title={theme.name}
    >
      <div class="ThemeGallery__swatch" style="background: {colors.bg}">
        <div class="ThemeGallery__swatch-lines">
          <div
            class="ThemeGallery__swatch-heading"
            style="background: {colors.fg}"
          ></div>
          <div
            class="ThemeGallery__swatch-text"
            style="background: {colors.fg}; opacity: 0.5"
          ></div>
          <div
            class="ThemeGallery__swatch-text ThemeGallery__swatch-text--short"
            style="background: {colors.fg}; opacity: 0.5"
          ></div>
          <div
            class="ThemeGallery__swatch-accent"
            style="background: {colors.accent}"
          ></div>
        </div>
      </div>
      <span class="ThemeGallery__name">{theme.name}</span>
    </button>
  {/each}

  <button
    type="button"
    class="ThemeGallery__card ThemeGallery__card--add"
    onclick={on_create_click}
    title="Create new theme"
  >
    <div class="ThemeGallery__swatch ThemeGallery__swatch--add">
      <Plus />
    </div>
    <span class="ThemeGallery__name">New</span>
  </button>
</div>

<style>
  .ThemeGallery {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(5.5rem, 1fr));
    gap: var(--space-3);
  }

  .ThemeGallery__card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1-5);
    padding: var(--space-1-5);
    border-radius: var(--radius, 0.5rem);
    border: 2px solid transparent;
    cursor: pointer;
    transition: all 100ms ease;
    background: transparent;
  }

  .ThemeGallery__card:hover {
    background: var(--muted);
  }

  .ThemeGallery__card--active {
    border-color: var(--ring, var(--primary));
  }

  .ThemeGallery__swatch {
    width: 100%;
    aspect-ratio: 4 / 3;
    border-radius: var(--radius-sm, 0.25rem);
    border: 1px solid var(--border);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .ThemeGallery__swatch-lines {
    display: flex;
    flex-direction: column;
    gap: 3px;
    width: 70%;
    padding: 8px 0;
  }

  .ThemeGallery__swatch-heading {
    height: 4px;
    width: 60%;
    border-radius: 1px;
  }

  .ThemeGallery__swatch-text {
    height: 2px;
    width: 90%;
    border-radius: 1px;
  }

  .ThemeGallery__swatch-text--short {
    width: 50%;
  }

  .ThemeGallery__swatch-accent {
    height: 3px;
    width: 40%;
    border-radius: 1px;
    margin-top: 2px;
  }

  .ThemeGallery__swatch--add {
    color: var(--muted-foreground);
    border-style: dashed;
  }

  :global(.ThemeGallery__swatch--add svg) {
    width: 1.25rem;
    height: 1.25rem;
  }

  .ThemeGallery__card--add:hover .ThemeGallery__swatch--add {
    color: var(--foreground);
    border-color: var(--foreground);
  }

  .ThemeGallery__name {
    font-size: var(--text-xs);
    color: var(--muted-foreground);
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .ThemeGallery__card--active .ThemeGallery__name {
    color: var(--foreground);
    font-weight: 500;
  }
</style>
