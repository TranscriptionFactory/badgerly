<script lang="ts">
  import * as Slider from "$lib/components/ui/slider/index.js";

  type Props = {
    hue: number;
    chroma: number;
    on_change: (hue: number, chroma: number) => void;
    disabled?: boolean;
  };

  let { hue, chroma, on_change, disabled = false }: Props = $props();

  let canvas: HTMLCanvasElement | undefined = $state();

  const STRIP_HEIGHT = 28;
  const STRIP_WIDTH = 320;

  $effect(() => {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = STRIP_WIDTH;
    canvas.height = STRIP_HEIGHT;
    for (let x = 0; x < STRIP_WIDTH; x++) {
      const h = (x / STRIP_WIDTH) * 360;
      ctx.fillStyle = `oklch(0.65 0.15 ${h})`;
      ctx.fillRect(x, 0, 1, STRIP_HEIGHT);
    }
  });

  function handle_strip_click(e: MouseEvent) {
    if (disabled) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    on_change(Math.round(x * 360), chroma);
  }

  let dragging = $state(false);

  function handle_strip_pointer_down(e: PointerEvent) {
    if (disabled) return;
    dragging = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    handle_strip_click(e);
  }

  function handle_strip_pointer_move(e: PointerEvent) {
    if (!dragging) return;
    handle_strip_click(e);
  }

  function handle_strip_pointer_up() {
    dragging = false;
  }

  const preview_style = $derived(`background: oklch(0.55 ${chroma} ${hue})`);

  const thumb_left = $derived(`${((hue / 360) * 100).toFixed(1)}%`);
</script>

<div class="AccentPicker" class:AccentPicker--disabled={disabled}>
  <div class="AccentPicker__row">
    <span class="AccentPicker__label">Accent Color</span>
    <span class="AccentPicker__preview" style={preview_style}></span>
    <span class="AccentPicker__value">{hue}°</span>
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="AccentPicker__strip-container"
    onpointerdown={handle_strip_pointer_down}
    onpointermove={handle_strip_pointer_move}
    onpointerup={handle_strip_pointer_up}
  >
    <canvas bind:this={canvas} class="AccentPicker__strip"></canvas>
    <div class="AccentPicker__thumb" style="left: {thumb_left}"></div>
  </div>

  <div class="AccentPicker__chroma-row">
    <span class="AccentPicker__label">Intensity</span>
    <Slider.Root
      type="single"
      value={chroma}
      onValueChange={(v: number) => on_change(hue, Math.round(v * 100) / 100)}
      min={0.02}
      max={0.3}
      step={0.01}
      class="flex-1"
      {disabled}
    />
    <span class="AccentPicker__value">{chroma.toFixed(2)}</span>
  </div>
</div>

<style>
  .AccentPicker {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .AccentPicker--disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  .AccentPicker__row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .AccentPicker__chroma-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .AccentPicker__label {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--foreground);
    white-space: nowrap;
  }

  .AccentPicker__preview {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2px solid var(--border);
    flex-shrink: 0;
  }

  .AccentPicker__value {
    font-size: var(--text-xs);
    font-family: var(--font-mono, ui-monospace, monospace);
    color: var(--muted-foreground);
    background: var(--muted);
    padding: var(--space-0-5) var(--space-2);
    border-radius: var(--radius-sm);
    min-width: 3rem;
    text-align: center;
  }

  .AccentPicker__strip-container {
    position: relative;
    height: 28px;
    border-radius: var(--radius-sm, 0.25rem);
    overflow: hidden;
    cursor: pointer;
    border: 1px solid var(--border);
  }

  .AccentPicker__strip {
    width: 100%;
    height: 100%;
    display: block;
  }

  .AccentPicker__thumb {
    position: absolute;
    top: 0;
    width: 4px;
    height: 100%;
    background: white;
    border: 1px solid oklch(0 0 0 / 40%);
    border-radius: 1px;
    transform: translateX(-50%);
    pointer-events: none;
    box-shadow: 0 1px 3px oklch(0 0 0 / 30%);
  }
</style>
