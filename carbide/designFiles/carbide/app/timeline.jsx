// Timeline scrubber — floating, bottom of the editor.
// A horizontal ruler of checkpoints you can drag to travel back through time.

function Timeline({ checkpoints, activeId, onSelect, onRestore, onClose }) {
  const [dragX, setDragX] = React.useState(null);
  // Reverse so oldest is on the left
  const cps = [...checkpoints].reverse();
  const activeIdx = cps.findIndex(c => c.id === activeId);
  const now = activeIdx < 0 ? cps.length - 1 : activeIdx;
  const pct = cps.length <= 1 ? 100 : (now / (cps.length - 1)) * 100;
  const active = cps[now];

  return (
    <div style={{
      position: "absolute", left: 48 + 248, right: 340, bottom: 34,
      margin: "0 20px 14px", zIndex: 40,
      background: "var(--popover)", border: "1px solid var(--border)",
      borderRadius: 12, boxShadow: "var(--shadow-lg)",
      padding: "12px 16px 14px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <Icons.Clock size={13} style={{ color: "var(--teal-500)" }}/>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)" }}>
          Timeline
        </div>
        <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
          Drag to travel back · Source Control Rationale.md
        </div>
        <div style={{ flex: 1 }} />
        {active ? (
          <>
            <button onClick={() => onRestore(active.id)}
              style={{ display: "flex", alignItems: "center", gap: 5,
                padding: "4px 10px", borderRadius: 5,
                background: "var(--teal-500)", color: "white",
                fontSize: 11, fontWeight: 500 }}>
              <Icons.Restore size={11}/>Restore this version
            </button>
          </>
        ) : null}
        <button onClick={onClose} style={{ padding: 4, color: "var(--muted-foreground)" }}>
          <Icons.X size={13}/>
        </button>
      </div>
      <div style={{ position: "relative", height: 52 }}>
        {/* Track */}
        <div style={{
          position: "absolute", left: 10, right: 10, top: 26, height: 2,
          background: "var(--border)", borderRadius: 2,
        }}/>
        {/* Progress */}
        <div style={{
          position: "absolute", left: 10, top: 26, height: 2,
          width: `calc(${pct}% * (100% - 20px) / 100%)`,
          background: "var(--teal-500)", borderRadius: 2,
        }}/>
        {/* Checkpoints */}
        {cps.map((cp, i) => {
          const p = cps.length <= 1 ? 50 : (i / (cps.length - 1)) * 100;
          const isActive = i === now;
          const isPast = i < now;
          return (
            <button key={cp.id} onClick={() => onSelect(cp.id)}
              title={`${cp.title} · ${cp.day} ${cp.time}`}
              style={{
                position: "absolute", top: 18, left: `calc(10px + ${p}% * (100% - 20px) / 100%)`,
                transform: "translateX(-50%)",
                width: 18, height: 18, borderRadius: 999,
                background: isActive ? "var(--teal-500)" :
                            isPast ? "var(--teal-200)" : "var(--background-surface-3)",
                border: `2px solid ${isActive ? "var(--teal-700)" : "var(--background)"}`,
                boxShadow: isActive ? "0 0 0 3px var(--interactive-bg)" : "none",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
              {cp.ai && isActive ? <Icons.Sparkles size={8} style={{ color: "white" }}/> : null}
            </button>
          );
        })}
        {/* Labels under the active cp */}
        {active ? (
          <div style={{
            position: "absolute",
            left: `calc(10px + ${pct}% * (100% - 20px) / 100%)`,
            top: 40, transform: "translateX(-50%)",
            fontSize: 10.5, whiteSpace: "nowrap",
            color: "var(--muted-foreground)",
            fontFamily: "var(--font-family-mono)",
          }}>
            {active.hash} · {active.day} {active.time}
          </div>
        ) : null}
      </div>
      {active ? (
        <div style={{
          marginTop: 16, paddingTop: 12,
          borderTop: "1px solid var(--border-subtle)",
          display: "flex", alignItems: "flex-start", gap: 12,
        }}>
          <div style={{
            flexShrink: 0, width: 4, alignSelf: "stretch",
            background: "var(--teal-500)", borderRadius: 2,
          }}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>
              {active.title}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2,
              display: "flex", gap: 10, fontFamily: "var(--font-family-mono)" }}>
              <span>{active.changes} file{active.changes === 1 ? "" : "s"}</span>
              <span style={{ color: "var(--diff-add-fg)" }}>+{active.add}</span>
              <span style={{ color: "var(--diff-del-fg)" }}>−{active.del}</span>
              {active.ai ? <span style={{ color: "var(--teal-600)" }}>ai-named</span> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

window.Timeline = Timeline;
