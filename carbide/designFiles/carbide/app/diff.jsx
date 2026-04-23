// Diff viewer overlay — appears when user selects a change or a checkpoint.
// Split or unified view. Uses Carbide's markdown-aware rendering cues.

function DiffHunks({ hunks, mode }) {
  // mode: "unified" | "split"
  if (mode === "unified") {
    let oldN = 1, newN = 1;
    return (
      <div style={{
        fontFamily: "var(--font-family-mono)", fontSize: 12.5, lineHeight: 1.65,
        background: "var(--background)",
      }}>
        {hunks.map((h, i) => {
          const row = (kind, l, r, text) => (
            <div key={i + "-" + kind} style={{
              display: "grid", gridTemplateColumns: "38px 38px 1fr",
              background: kind === "add" ? "var(--diff-add-bg)" :
                          kind === "del" ? "var(--diff-del-bg)" : "transparent",
              color:      kind === "add" ? "var(--diff-add-fg)" :
                          kind === "del" ? "var(--diff-del-fg)" : "var(--foreground)",
            }}>
              <span style={{ textAlign: "right", paddingRight: 8, color: "var(--muted-foreground)",
                borderRight: "1px solid var(--border-subtle)", userSelect: "none" }}>{l}</span>
              <span style={{ textAlign: "right", paddingRight: 8, color: "var(--muted-foreground)",
                borderRight: "1px solid var(--border-subtle)", userSelect: "none" }}>{r}</span>
              <span style={{ paddingLeft: 12, whiteSpace: "pre-wrap" }}>
                <span style={{ color: kind === "add" ? "var(--diff-add-gutter)" :
                                    kind === "del" ? "var(--diff-del-gutter)" : "transparent",
                  marginRight: 8, fontWeight: 700 }}>
                  {kind === "add" ? "+" : kind === "del" ? "−" : " "}
                </span>
                {text}
              </span>
            </div>
          );
          if (h.kind === "add") { const r = row("add", "", newN, h.line); newN++; return r; }
          if (h.kind === "del") { const r = row("del", oldN, "", h.line); oldN++; return r; }
          const r = row("ctx", oldN, newN, h.line); oldN++; newN++; return r;
        })}
      </div>
    );
  }
  // split
  // Pair dels with adds for matching rows
  const left = [], right = [];
  let oN = 1, nN = 1;
  hunks.forEach(h => {
    if (h.kind === "context") { left.push({ n: oN, t: h.line, k: "ctx" }); right.push({ n: nN, t: h.line, k: "ctx" }); oN++; nN++; }
    else if (h.kind === "del") { left.push({ n: oN, t: h.line, k: "del" }); right.push({ n: "", t: "", k: "pad" }); oN++; }
    else if (h.kind === "add") { left.push({ n: "", t: "", k: "pad" }); right.push({ n: nN, t: h.line, k: "add" }); nN++; }
  });
  // compact pad pairs: where left-pad is directly after right-pad or vice versa, zip them.
  const rows = [];
  const max = Math.max(left.length, right.length);
  for (let i = 0; i < max; i++) rows.push([left[i] || { k: "pad" }, right[i] || { k: "pad" }]);
  // reduce pad-on-one-side-adjacent-to-real-on-other by pairing a "pad" right with the next real add if previous was del
  const zipped = [];
  for (let i = 0; i < rows.length; i++) {
    const [l, r] = rows[i];
    if (l.k === "del" && r.k === "pad" && rows[i+1] && rows[i+1][0].k === "pad" && rows[i+1][1].k === "add") {
      zipped.push([l, rows[i+1][1]]);
      i++;
    } else {
      zipped.push([l, r]);
    }
  }
  const cellBg = (k) => k === "add" ? "var(--diff-add-bg)" : k === "del" ? "var(--diff-del-bg)" : k === "pad" ? "var(--background-surface-2)" : "transparent";
  const cellFg = (k) => k === "add" ? "var(--diff-add-fg)" : k === "del" ? "var(--diff-del-fg)" : "var(--foreground)";
  return (
    <div style={{
      fontFamily: "var(--font-family-mono)", fontSize: 12.5, lineHeight: 1.65,
    }}>
      {zipped.map(([l, r], i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
          <div style={{ display: "grid", gridTemplateColumns: "38px 1fr",
            background: cellBg(l.k), color: cellFg(l.k),
            borderRight: "1px solid var(--border)" }}>
            <span style={{ textAlign: "right", paddingRight: 8, color: "var(--muted-foreground)",
              userSelect: "none", borderRight: "1px solid var(--border-subtle)" }}>{l.n ?? ""}</span>
            <span style={{ paddingLeft: 12, whiteSpace: "pre-wrap" }}>{l.t || "\u00a0"}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "38px 1fr",
            background: cellBg(r.k), color: cellFg(r.k) }}>
            <span style={{ textAlign: "right", paddingRight: 8, color: "var(--muted-foreground)",
              userSelect: "none", borderRight: "1px solid var(--border-subtle)" }}>{r.n ?? ""}</span>
            <span style={{ paddingLeft: 12, whiteSpace: "pre-wrap" }}>{r.t || "\u00a0"}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function DiffViewer({ change, onClose }) {
  const [mode, setMode] = React.useState("split");
  if (!change) return null;
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 50,
      background: "color-mix(in oklch, var(--background) 96%, transparent)",
      backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "min(980px, 100%)", maxHeight: "100%",
        background: "var(--background)", border: "1px solid var(--border)",
        borderRadius: 10, boxShadow: "var(--shadow-lg)",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        <div style={{
          padding: "10px 12px", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", gap: 10,
          background: "var(--background-surface-2)",
        }}>
          <StatusBadge kind={change.status} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: "var(--foreground)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {change.short}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)",
              fontFamily: "var(--font-family-mono)" }}>{change.file}</div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ fontFamily: "var(--font-family-mono)", fontSize: 11, display: "flex", gap: 8 }}>
            {change.additions > 0 ? <span style={{ color: "var(--diff-add-fg)" }}>+{change.additions}</span> : null}
            {change.deletions > 0 ? <span style={{ color: "var(--diff-del-fg)" }}>−{change.deletions}</span> : null}
          </div>
          <div style={{ display: "inline-flex", background: "var(--secondary)", borderRadius: 6, padding: 2 }}>
            {["split", "unified"].map(m => (
              <button key={m} onClick={() => setMode(m)} style={{
                padding: "3px 10px", fontSize: 11, borderRadius: 4,
                background: mode === m ? "var(--background)" : "transparent",
                color: mode === m ? "var(--foreground)" : "var(--muted-foreground)",
                boxShadow: mode === m ? "var(--shadow-xs)" : "none",
              }}>{m}</button>
            ))}
          </div>
          <button onClick={onClose} title="Close"
            style={{ padding: 4, color: "var(--muted-foreground)" }}>
            <Icons.X size={14} />
          </button>
        </div>
        <div style={{
          padding: "6px 12px", fontSize: 11, color: "var(--muted-foreground)",
          background: "var(--background-surface-2)",
          borderBottom: "1px solid var(--border)",
          fontStyle: "italic",
        }}>
          <Icons.Sparkles size={10} style={{ verticalAlign: "middle", color: "var(--teal-500)" }} />
          &nbsp;{change.summary}
        </div>
        <div style={{ overflow: "auto", flex: 1 }}>
          <DiffHunks hunks={change.hunks} mode={mode} />
        </div>
        <div style={{
          padding: "8px 12px", borderTop: "1px solid var(--border)",
          background: "var(--background-surface-2)",
          display: "flex", gap: 8, alignItems: "center",
        }}>
          <button style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 10px", borderRadius: 6,
            background: change.staged ? "var(--background)" : "var(--teal-500)",
            color: change.staged ? "var(--foreground)" : "white",
            border: change.staged ? "1px solid var(--border)" : "none",
            fontSize: 12, fontWeight: 500,
          }}>
            {change.staged ? <><Icons.Minus size={12}/>Unstage</> : <><Icons.Plus size={12}/>Stage file</>}
          </button>
          <button style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 10px", borderRadius: 6,
            background: "var(--background)", border: "1px solid var(--border)",
            color: "var(--foreground)", fontSize: 12,
          }}>
            <Icons.Undo size={12}/>Discard
          </button>
          <button style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 10px", borderRadius: 6,
            background: "var(--background)", border: "1px solid var(--border)",
            color: "var(--foreground)", fontSize: 12,
          }}>
            <Icons.Eye size={12}/>Open in editor
          </button>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
            ⌘↵ to stage · ⌫ to discard · Esc to close
          </div>
        </div>
      </div>
    </div>
  );
}

window.DiffViewer = DiffViewer;
