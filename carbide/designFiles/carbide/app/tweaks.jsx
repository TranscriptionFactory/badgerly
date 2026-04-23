// Tweaks panel — floating, bottom-right. Toggle theme, density, AI commit.

function TweaksPanel({ tweaks, setTweaks, onClose }) {
  const set = (k, v) => setTweaks(t => {
    const next = { ...t, [k]: v };
    try {
      window.parent.postMessage({ type: "__edit_mode_set_keys", edits: { [k]: v } }, "*");
    } catch {}
    return next;
  });
  return (
    <div className="tweaks-panel">
      <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
        <h4 style={{ margin: 0 }}>Tweaks</h4>
        <div style={{ flex: 1 }} />
        <button onClick={onClose} style={{ color: "var(--muted-foreground)", padding: 2 }}>
          <Icons.X size={12}/>
        </button>
      </div>

      <div className="tweaks-row">
        <label>Theme</label>
        <div className="tweaks-seg">
          <button data-on={tweaks.theme === "light"} onClick={() => set("theme", "light")}>Light</button>
          <button data-on={tweaks.theme === "dark"} onClick={() => set("theme", "dark")}>Dark</button>
        </div>
      </div>

      <div className="tweaks-row">
        <label>Density</label>
        <div className="tweaks-seg">
          <button data-on={tweaks.density === "comfortable"} onClick={() => set("density", "comfortable")}>Comfy</button>
          <button data-on={tweaks.density === "compact"} onClick={() => set("density", "compact")}>Compact</button>
        </div>
      </div>

      <div className="tweaks-row">
        <label>AI checkpoint titles</label>
        <button className="tweaks-switch" data-on={tweaks.aiCommit}
          onClick={() => set("aiCommit", !tweaks.aiCommit)} />
      </div>

      <div style={{
        marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--border)",
        fontSize: 10.5, color: "var(--muted-foreground)", lineHeight: 1.45,
      }}>
        Click the timeline clock in the status bar or the <Icons.Clock size={10} style={{ verticalAlign: "-1px" }}/> in the history header to scrub through checkpoints.
      </div>
    </div>
  );
}

window.TweaksPanel = TweaksPanel;
