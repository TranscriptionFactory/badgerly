// Carbide v3 — "Pulse"
// Reimagine direction: kill the right panel. Everything source-control moves
// to a persistent bottom dock. The editor gets full width + real reading space.
// The dock has three tabs in one surface: a live checkpoint ruler, the working
// set (inline hunks), and the AI composer. The editor becomes the subject.

const { useState: useS3, useEffect: useE3, useMemo: useM3, useRef: useR3 } = React;

// ---------------- Chrome ----------------

function V3TopBar({ branch, ahead, behind, unsaved }) {
  return (
    <div style={{
      height: 42, display: "flex", alignItems: "center", gap: 12,
      paddingLeft: 78, paddingRight: 10,
      background: "var(--chrome)",
      borderBottom: "1px solid var(--hairline)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          width: 18, height: 18, borderRadius: 5,
          background: "conic-gradient(from 220deg, var(--accent-2), var(--accent), var(--accent-2))",
          boxShadow: "0 0 0 1px var(--accent-soft), 0 0 14px -3px var(--accent-glow)",
        }}/>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg)" }}>research-vault</div>
      </div>

      <div style={{
        display: "flex", alignItems: "center", gap: 1,
        background: "var(--surface)", border: "1px solid var(--hairline)",
        borderRadius: 7, padding: 2, height: 28,
      }}>
        <V3NavChip icon={Icons.ChevronL}/>
        <V3NavChip icon={Icons.ChevronR}/>
      </div>

      {/* Breadcrumb / omnibox */}
      <div style={{
        flex: 1, maxWidth: 640, height: 28,
        display: "flex", alignItems: "center", gap: 8,
        background: "var(--surface)", border: "1px solid var(--hairline)",
        borderRadius: 7, padding: "0 10px",
      }}>
        <Icons.File size={12} style={{ color: "var(--fg-3)" }}/>
        <span style={{ fontSize: 12, color: "var(--fg-3)" }}>Design /</span>
        <span style={{ fontSize: 12, color: "var(--fg)", fontWeight: 500 }}>Source Control Rationale</span>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--dirty)" }}/>
        <div style={{ flex: 1 }}/>
        <span style={{ fontSize: 10.5, fontFamily: "var(--mono)", color: "var(--fg-3)",
          padding: "1px 5px", background: "var(--panel)", borderRadius: 3 }}>⌘K</span>
      </div>

      <div style={{ flex: 1 }}/>

      {/* Right: unsaved + branch */}
      <button style={{
        display: "flex", alignItems: "center", gap: 6, height: 28,
        padding: "0 10px", borderRadius: 7,
        background: "var(--surface)", border: "1px solid var(--hairline)",
        fontSize: 11.5, color: "var(--fg-2)",
      }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--dirty)" }}/>
        <span><b style={{ color: "var(--fg)" }}>{unsaved}</b> unsaved</span>
      </button>
      <button style={{
        display: "flex", alignItems: "center", gap: 6, height: 28,
        padding: "0 10px", borderRadius: 7,
        background: "var(--surface)", border: "1px solid var(--hairline)",
        fontSize: 11.5, color: "var(--fg)",
      }}>
        <Icons.Branch size={11} style={{ color: "var(--accent)" }}/>
        <span style={{ fontWeight: 500 }}>{branch}</span>
        <span style={{ color: "var(--fg-3)", fontFamily: "var(--mono)", fontSize: 10.5 }}>↑{ahead}·↓{behind}</span>
      </button>
      <button style={{
        width: 28, height: 28, borderRadius: 7,
        background: "var(--surface)", border: "1px solid var(--hairline)",
        color: "var(--fg-2)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icons.More size={13}/>
      </button>
    </div>
  );
}

function V3NavChip({ icon: I }) {
  return (
    <button style={{
      width: 22, height: 22, borderRadius: 5,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "var(--fg-3)",
    }}
    onMouseEnter={e => { e.currentTarget.style.background = "var(--hover)"; e.currentTarget.style.color = "var(--fg)"; }}
    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--fg-3)"; }}>
      <I size={12}/>
    </button>
  );
}

// ---------------- Sidebar ----------------

function V3Sidebar({ activeFile, onFileClick, changes }) {
  const [tab, setTab] = useS3("files");
  const dirtyMap = useM3(() => {
    const m = {};
    for (const c of changes) {
      const id = c.short.replace(/\.md$/, "").toLowerCase();
      m[id] = c.status;
    }
    return m;
  }, [changes]);

  const statusFor = (name) => {
    const key = name.replace(/\.md$/, "").toLowerCase();
    // Find change whose short name matches (case-insensitive)
    const c = changes.find(ch => ch.short.toLowerCase().replace(/\.md$/, "") === key);
    return c ? c.status : null;
  };

  return (
    <div style={{
      width: 232, flexShrink: 0, display: "flex", flexDirection: "column",
      background: "var(--panel)", borderRight: "1px solid var(--hairline)",
    }}>
      <div style={{
        display: "flex", height: 32, padding: "0 8px",
        alignItems: "stretch", gap: 2,
        borderBottom: "1px solid var(--hairline)",
      }}>
        {[
          { id: "files", icon: Icons.Files },
          { id: "search", icon: Icons.Search },
          { id: "graph", icon: Icons.Graph },
          { id: "tasks", icon: Icons.Tasks },
          { id: "tags", icon: Icons.Tag },
        ].map(t => {
          const on = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
              position: "relative", color: on ? "var(--fg)" : "var(--fg-3)",
            }}>
              <t.icon size={13}/>
              {on ? <span style={{
                position: "absolute", left: 6, right: 6, bottom: 2, height: 2,
                background: "var(--accent)", borderRadius: 2,
                boxShadow: "0 0 8px var(--accent-glow)",
              }}/> : null}
            </button>
          );
        })}
      </div>

      <div style={{
        padding: "10px 10px 8px",
        display: "flex", alignItems: "center",
        gap: 7, background: "var(--surface)",
        borderRadius: 0,
      }}>
        <div style={{
          flex: 1, display: "flex", alignItems: "center", gap: 6,
          background: "var(--panel-2)", border: "1px solid var(--hairline)",
          borderRadius: 6, padding: "4px 8px",
        }}>
          <Icons.Search size={11} style={{ color: "var(--fg-3)" }}/>
          <span style={{ fontSize: 11.5, color: "var(--fg-3)" }}>Filter…</span>
        </div>
        <button title="New note" style={{
          width: 26, height: 26, borderRadius: 6,
          background: "var(--accent)", color: "var(--on-accent)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 12px -3px var(--accent-glow)",
        }}><Icons.Plus size={13}/></button>
      </div>

      <div style={{ flex: 1, overflow: "auto" }}>
        <V3Tree tree={window.VAULT_TREE} activeId={activeFile} onFileClick={onFileClick}/>
      </div>

      {/* Tag cloud footer */}
      <div style={{
        borderTop: "1px solid var(--hairline)", padding: "10px 10px 12px",
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
          textTransform: "uppercase", color: "var(--fg-3)", marginBottom: 7 }}>
          Tags
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {[
            ["design", 12], ["engineering", 8], ["rationale", 3],
            ["source-control", 4], ["research", 6],
          ].map(([t, n]) => (
            <span key={t} style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "2px 7px", borderRadius: 999,
              background: "var(--panel-2)", border: "1px solid var(--hairline)",
              fontSize: 10.5, color: "var(--fg-2)",
            }}>
              {t}
              <span style={{ color: "var(--fg-3)", fontFamily: "var(--mono)", fontSize: 9.5 }}>{n}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function V3Tree({ tree, activeId, onFileClick }) {
  const [open, setOpen] = useS3(
    Object.fromEntries(tree.filter(n => n.type === "folder").map(n => [n.name, n.open]))
  );
  const toggle = (n) => setOpen(o => ({ ...o, [n]: !o[n] }));
  const render = (node, depth = 0) => {
    const indent = 10 + depth * 12;
    if (node.type === "folder") {
      const o = open[node.name];
      return (
        <div key={node.name}>
          <div onClick={() => toggle(node.name)} style={{
            display: "flex", alignItems: "center", gap: 5,
            height: 26, paddingLeft: indent, paddingRight: 10,
            color: "var(--fg-2)", cursor: "pointer", fontSize: 12,
            fontWeight: 600, letterSpacing: "0.02em",
          }}
          onMouseEnter={e => e.currentTarget.style.background = "var(--hover)"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            {o ? <Icons.ChevronD size={11}/> : <Icons.ChevronR size={11}/>}
            <span>{node.name}</span>
          </div>
          {o && node.children.map(c => render(c, depth + 1))}
        </div>
      );
    }
    const isActive = activeId === node.id;
    const sc = { M: "var(--warn)", A: "var(--add)", D: "var(--del)" }[node.status];
    return (
      <div key={node.id} onClick={() => onFileClick(node.id)} style={{
        position: "relative", display: "flex", alignItems: "center", gap: 6,
        height: 26, paddingLeft: indent + 14, paddingRight: 10,
        color: isActive ? "var(--fg)" : "var(--fg-2)",
        background: isActive ? "color-mix(in oklch, var(--accent) 12%, transparent)" : "transparent",
        cursor: "pointer", fontSize: 12.5,
        borderRadius: 0,
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "var(--hover)"; }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
        {isActive ? (
          <span style={{
            position: "absolute", left: 0, top: 4, bottom: 4, width: 2,
            background: "var(--accent)", borderRadius: 1,
            boxShadow: "0 0 10px var(--accent-glow)",
          }}/>
        ) : null}
        <Icons.File size={11} style={{ color: "var(--fg-3)" }}/>
        <span style={{
          flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          fontWeight: isActive ? 500 : 400,
        }}>{node.name.replace(/\.md$/, "")}</span>
        {node.status ? (
          <span style={{
            width: 6, height: 6, borderRadius: 999,
            background: sc, boxShadow: `0 0 6px ${sc}`,
          }}/>
        ) : null}
      </div>
    );
  };
  return <div style={{ padding: "4px 0" }}>{tree.map(n => render(n))}</div>;
}

// ---------------- Editor (full width) ----------------

function V3Editor({ doc, dockOpen }) {
  return (
    <div style={{
      flex: 1, minWidth: 0, display: "flex", flexDirection: "column",
      background: "var(--canvas)", overflow: "hidden",
    }}>
      {/* Slim tab strip */}
      <div style={{
        height: 34, display: "flex", alignItems: "center", gap: 2,
        paddingLeft: 14, paddingRight: 8,
        borderBottom: "1px solid var(--hairline)", background: "var(--canvas-2)",
      }}>
        {[
          { id: "sc", name: "Source Control Rationale", dirty: true, active: true },
          { id: "ti", name: "Theme Inventory", dirty: true },
          { id: "aw", name: "Atomic Writes", dirty: false },
        ].map(t => (
          <button key={t.id} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "0 12px", height: 26, borderRadius: 6,
            background: t.active ? "var(--surface)" : "transparent",
            color: t.active ? "var(--fg)" : "var(--fg-3)",
            fontSize: 11.5, fontWeight: t.active ? 500 : 400,
            border: t.active ? "1px solid var(--hairline)" : "1px solid transparent",
          }}>
            <span>{t.name}</span>
            {t.dirty ? (
              <span style={{ width: 5, height: 5, borderRadius: 999, background: "var(--dirty)" }}/>
            ) : (
              <Icons.X size={10} style={{ opacity: 0.5 }}/>
            )}
          </button>
        ))}
        <div style={{ flex: 1 }}/>
        <button title="Outline" style={V3ToolBtn}>
          <Icons.Files size={12}/>
        </button>
        <button title="Preview" style={V3ToolBtn}>
          <Icons.Eye size={12}/>
        </button>
        <button title="Share" style={V3ToolBtn}>
          <Icons.Cloud size={12}/>
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
        <div style={{
          maxWidth: 820, margin: "0 auto", padding: "40px 48px 96px",
          fontSize: 14.5, lineHeight: 1.68, color: "var(--fg)",
        }}>
          {doc.map((b, i) => <V3Block key={i} block={b}/>)}
        </div>
      </div>
    </div>
  );
}

const V3ToolBtn = {
  width: 26, height: 26, borderRadius: 6,
  display: "flex", alignItems: "center", justifyContent: "center",
  color: "var(--fg-3)",
};

function V3Block({ block }) {
  const state = block.state || "clean";
  const railColor = { added: "var(--accent)", modified: "var(--warn)", deleted: "var(--del)", clean: "transparent" }[state];
  const railGlow = state === "added" ? "0 0 8px var(--accent-glow)" : "none";
  const inner = (() => {
    if (block.type === "h1") return <h1 style={{ fontSize: 32, fontWeight: 700, margin: "0 0 6px", letterSpacing: "-0.025em" }}>{block.text}</h1>;
    if (block.type === "meta") return <div style={{ color: "var(--fg-3)", fontSize: 12.5, marginBottom: 24 }}><V3Wikilinks text={block.text}/></div>;
    if (block.type === "h2") return <h2 style={{ fontSize: 18, fontWeight: 600, margin: "28px 0 10px", letterSpacing: "-0.005em" }}>{block.text}</h2>;
    if (block.type === "p") return <p style={{ margin: "0 0 16px" }}><V3Wikilinks text={block.text}/></p>;
    if (block.type === "quote") return (
      <blockquote style={{
        margin: "8px 0 18px", padding: "14px 20px",
        background: "linear-gradient(90deg, var(--accent-bg), transparent)",
        borderLeft: "3px solid var(--accent)",
        borderRadius: "0 8px 8px 0", color: "var(--accent-ink)",
        fontFamily: "var(--serif)", fontSize: 16, fontStyle: "italic",
        lineHeight: 1.5,
      }}>{block.text}</blockquote>
    );
    if (block.type === "ul") return (
      <ul style={{ margin: "6px 0 16px", padding: 0, listStyle: "none" }}>
        {block.items.map((it, j) => {
          const m = {
            added:   { fg: "var(--fg)",   bg: "color-mix(in oklch, var(--accent) 9%, transparent)", mark: "var(--accent)", deco: "none", ink: "var(--accent-ink)" },
            modified:{ fg: "var(--fg)",   bg: "transparent", mark: "var(--warn)", deco: "none" },
            deleted: { fg: "var(--fg-3)", bg: "color-mix(in oklch, var(--del) 7%, transparent)", mark: "var(--del)", deco: "line-through" },
            clean:   { fg: "var(--fg)",   bg: "transparent", mark: "var(--fg-3)", deco: "none" },
          }[it.state || "clean"];
          return (
            <li key={j} style={{
              display: "flex", gap: 10, padding: "3px 8px",
              borderRadius: 5, background: m.bg, color: m.fg,
              textDecoration: m.deco,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: 999, marginTop: 10, background: m.mark, flexShrink: 0 }}/>
              <span>{it.text}</span>
            </li>
          );
        })}
      </ul>
    );
    return null;
  })();
  return (
    <div style={{ display: "flex", gap: 16 }}>
      <div style={{
        width: 2, alignSelf: "stretch", marginTop: 6, marginBottom: 6,
        background: railColor, borderRadius: 2, boxShadow: railGlow,
      }}/>
      <div style={{ flex: 1, minWidth: 0 }}>{inner}</div>
    </div>
  );
}

function V3Wikilinks({ text }) {
  const parts = text.split(/(\[\[[^\]]+\]\])/g);
  return <>{parts.map((p, i) => p.startsWith("[[") ? (
    <span key={i} style={{
      color: "var(--accent-ink)", background: "var(--accent-bg)",
      padding: "1px 6px", borderRadius: 4, fontWeight: 500,
    }}>{p.slice(2, -2)}</span>
  ) : <span key={i}>{p}</span>)}</>;
}

// ---------------- Bottom Dock (the main event) ----------------

function V3Dock({ changes, setChanges, checkpoints, activeFile, setActiveFile,
  aiCommit, onReview, onClose, open, setOpen }) {
  const [tab, setTab] = useS3("changes");
  const staged = changes.filter(c => c.staged);
  const unstaged = changes.filter(c => !c.staged);
  const totalAdd = changes.reduce((a, c) => a + c.additions, 0);
  const totalDel = changes.reduce((a, c) => a + c.deletions, 0);

  const stageAll = () => setChanges(cs => cs.map(c => ({ ...c, staged: true })));
  const unstageAll = () => setChanges(cs => cs.map(c => ({ ...c, staged: false })));
  const stageToggle = (id) => setChanges(cs => cs.map(c => c.id === id ? { ...c, staged: !c.staged } : c));

  return (
    <div style={{
      position: "relative", flexShrink: 0,
      height: open ? 268 : 54,
      transition: "height 220ms ease",
      background: "var(--panel)", borderTop: "1px solid var(--hairline)",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      {/* Always-on top strip: ruler + tab selector */}
      <V3DockHeader
        tab={tab} setTab={setTab}
        open={open} setOpen={setOpen}
        changes={changes} staged={staged.length}
        checkpoints={checkpoints}
      />
      {open ? (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {tab === "changes" ? (
            <V3DockChanges
              staged={staged} unstaged={unstaged}
              stageAll={stageAll} unstageAll={unstageAll} stageToggle={stageToggle}
              onReview={onReview}
            />
          ) : null}
          {tab === "timeline" ? (
            <V3DockTimeline checkpoints={checkpoints}/>
          ) : null}
          {tab === "commit" ? (
            <V3DockCommit staged={staged} aiCommit={aiCommit} totalAdd={totalAdd} totalDel={totalDel}/>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function V3DockHeader({ tab, setTab, open, setOpen, changes, staged, checkpoints }) {
  const unstaged = changes.length - staged;
  return (
    <div style={{
      height: 54, flexShrink: 0, display: "flex", alignItems: "center",
      gap: 14, padding: "0 14px",
      background: "var(--panel-2)", borderBottom: open ? "1px solid var(--hairline)" : "none",
    }}>
      {/* Toggle */}
      <button onClick={() => setOpen(!open)} title={open ? "Collapse" : "Expand"} style={{
        width: 28, height: 28, borderRadius: 7,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--surface)", border: "1px solid var(--hairline)",
        color: "var(--fg-2)",
        transform: open ? "rotate(180deg)" : "none",
        transition: "transform 200ms",
      }}>
        <Icons.ChevronD size={13}/>
      </button>

      {/* Live checkpoint ruler — compressed */}
      <V3Ruler checkpoints={checkpoints} compressed={!open}/>

      {/* Tabs */}
      <div style={{
        display: "flex", gap: 2, background: "var(--surface)",
        border: "1px solid var(--hairline)", borderRadius: 7, padding: 2,
      }}>
        {[
          { id: "changes", label: "Changes", badge: changes.length, icon: Icons.GitCommit },
          { id: "timeline", label: "Timeline", badge: checkpoints.length, icon: Icons.Clock },
          { id: "commit", label: "Checkpoint", icon: Icons.Sparkles, primary: true },
        ].map(t => {
          const on = tab === t.id;
          return (
            <button key={t.id} onClick={() => { setTab(t.id); setOpen(true); }} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "0 10px", height: 22, borderRadius: 5,
              background: on ? (t.primary ? "var(--accent)" : "var(--panel-2)") : "transparent",
              color: on ? (t.primary ? "var(--on-accent)" : "var(--fg)") : "var(--fg-3)",
              fontSize: 11.5, fontWeight: on ? 600 : 500,
              boxShadow: on && t.primary ? "0 0 12px -3px var(--accent-glow)" : "none",
            }}>
              <t.icon size={11}/>
              <span>{t.label}</span>
              {t.badge != null ? (
                <span style={{
                  padding: "0 5px", minWidth: 15, height: 14, borderRadius: 999,
                  background: on && !t.primary ? "var(--accent-bg)" : on && t.primary ? "oklch(1 0 0 / 0.25)" : "var(--panel-2)",
                  color: on && !t.primary ? "var(--accent-ink)" : on && t.primary ? "var(--on-accent)" : "var(--fg-2)",
                  fontSize: 9.5, fontWeight: 700, fontFamily: "var(--mono)",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}>{t.badge}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1 }}/>

      {/* Quick summary */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: "var(--fg-3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{
            width: 7, height: 7, borderRadius: 2,
            background: "var(--accent)", boxShadow: "0 0 8px var(--accent-glow)",
          }}/>
          <span><b style={{ color: "var(--fg)", fontFamily: "var(--mono)" }}>{staged}</b> staged</span>
        </div>
        <span style={{ opacity: 0.4 }}>·</span>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 7, height: 7, borderRadius: 2, background: "var(--dirty)" }}/>
          <span><b style={{ color: "var(--fg)", fontFamily: "var(--mono)" }}>{unstaged}</b> pending</span>
        </div>
      </div>
    </div>
  );
}

function V3Ruler({ checkpoints, compressed }) {
  // A little horizontal ruler of checkpoints shown in-line in the dock header.
  const cps = [...checkpoints].reverse(); // oldest -> newest (left -> right)
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 3, height: 28,
      padding: "0 10px", background: "var(--surface)",
      border: "1px solid var(--hairline)", borderRadius: 7, minWidth: 220,
      position: "relative",
    }}>
      <div style={{
        position: "absolute", left: 10, right: 10, top: "50%", height: 1,
        background: "var(--hairline-strong)",
      }}/>
      {cps.map((cp, i) => {
        const isLast = i === cps.length - 1; // most recent
        return (
          <button key={cp.id} title={`${cp.title} · ${cp.day} ${cp.time}`} style={{
            position: "relative",
            width: isLast ? 12 : 8, height: isLast ? 12 : 8,
            borderRadius: isLast ? 4 : 999,
            background: isLast ? "var(--accent)" : cp.ai ? "var(--accent-soft)" : "var(--fg-3)",
            boxShadow: isLast ? "0 0 10px var(--accent-glow)" : "none",
            flexShrink: 0,
          }}/>
        );
      })}
      <span style={{ flex: 1 }}/>
      <span style={{ fontSize: 10, fontFamily: "var(--mono)", color: "var(--fg-3)" }}>now</span>
    </div>
  );
}

function V3DockChanges({ staged, unstaged, stageAll, unstageAll, stageToggle, onReview }) {
  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
      {/* Left: staged */}
      <V3DockColumn title="Staged" count={staged.length}
        right={staged.length ? <button style={V3LinkBtn} onClick={unstageAll}>unstage all</button> : null}>
        {staged.length === 0 ? (
          <V3DockEmpty
            icon={Icons.Check}
            text="Nothing staged yet."
            hint="Stage from the right column — it'll queue for your next checkpoint."
          />
        ) : staged.map(c => <V3ChangeRow key={c.id} change={c} onStage={stageToggle} onReview={onReview}/>)}
      </V3DockColumn>

      <div style={{ width: 1, background: "var(--hairline)" }}/>

      {/* Right: unstaged */}
      <V3DockColumn title="Pending" count={unstaged.length}
        right={<button style={V3LinkBtn} onClick={stageAll}>stage all</button>}>
        {unstaged.map(c => <V3ChangeRow key={c.id} change={c} onStage={stageToggle} onReview={onReview}/>)}
      </V3DockColumn>
    </div>
  );
}

const V3LinkBtn = {
  fontSize: 10.5, color: "var(--fg-3)", padding: "2px 4px",
  textDecoration: "underline", textUnderlineOffset: 2,
  textDecorationColor: "var(--hairline-strong)",
};

function V3DockColumn({ title, count, right, children }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{
        height: 30, display: "flex", alignItems: "center", gap: 6,
        padding: "0 14px", borderBottom: "1px solid var(--hairline)",
        background: "var(--panel-2)",
      }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
          textTransform: "uppercase", color: "var(--fg-2)",
        }}>{title}</span>
        <span style={{
          fontSize: 10, color: "var(--fg-3)", fontFamily: "var(--mono)",
          padding: "0 5px", background: "var(--surface)", border: "1px solid var(--hairline)",
          borderRadius: 3,
        }}>{count}</span>
        <div style={{ flex: 1 }}/>
        {right}
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 6 }}>{children}</div>
    </div>
  );
}

function V3ChangeRow({ change, onStage, onReview }) {
  const [hover, setHover] = useS3(false);
  const sc = { M: "var(--warn)", A: "var(--add)", D: "var(--del)", R: "var(--accent)" }[change.status];
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "5px 8px", borderRadius: 6,
        background: hover ? "var(--hover)" : "transparent",
        cursor: "pointer",
      }}
      onClick={() => onReview(change.id)}>
      <span style={{
        fontFamily: "var(--mono)", fontSize: 9.5, fontWeight: 700, color: sc,
        padding: "0 4px", borderRadius: 2, background: `color-mix(in oklch, ${sc} 14%, transparent)`,
        flexShrink: 0,
      }}>{change.status}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            fontSize: 12, fontWeight: 500, color: "var(--fg)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{change.short.replace(/\.md$/, "")}</span>
          <span style={{ color: "var(--fg-3)", fontSize: 10.5 }}>·</span>
          <span style={{ color: "var(--fg-3)", fontSize: 10.5,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{change.folder || "/"}</span>
        </div>
        <div style={{ fontSize: 10.5, color: "var(--fg-3)", marginTop: 1,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", gap: 6, alignItems: "center" }}>
          <Icons.Sparkles size={9} style={{ color: "var(--accent)", opacity: 0.7 }}/>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{change.summary}</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 5, alignItems: "center", flexShrink: 0 }}>
        {change.additions > 0 ? <span style={{ color: "var(--add)", fontFamily: "var(--mono)", fontSize: 10.5 }}>+{change.additions}</span> : null}
        {change.deletions > 0 ? <span style={{ color: "var(--del)", fontFamily: "var(--mono)", fontSize: 10.5 }}>−{change.deletions}</span> : null}
        <button onClick={(e) => { e.stopPropagation(); onStage(change.id); }} title={change.staged ? "Unstage" : "Stage"} style={{
          width: 22, height: 22, borderRadius: 5,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: change.staged ? "var(--accent)" : "transparent",
          border: change.staged ? "none" : "1px solid var(--hairline-strong)",
          color: change.staged ? "var(--on-accent)" : "var(--fg-2)",
          boxShadow: change.staged ? "0 0 10px -2px var(--accent-glow)" : "none",
        }}>
          {change.staged ? <Icons.Check size={11}/> : <Icons.Plus size={11}/>}
        </button>
      </div>
    </div>
  );
}

function V3DockEmpty({ icon: I, text, hint }) {
  return (
    <div style={{
      padding: "22px 16px", textAlign: "center",
      color: "var(--fg-3)", fontSize: 11.5,
    }}>
      <div style={{
        margin: "0 auto 8px", width: 34, height: 34, borderRadius: 999,
        background: "var(--panel-2)", border: "1px dashed var(--hairline-strong)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--fg-3)",
      }}>
        <I size={15}/>
      </div>
      <div style={{ color: "var(--fg-2)", fontWeight: 500 }}>{text}</div>
      {hint ? <div style={{ marginTop: 3, fontSize: 10.5, lineHeight: 1.45 }}>{hint}</div> : null}
    </div>
  );
}

// ---------------- Timeline tab (horizontal river) ----------------

function V3DockTimeline({ checkpoints }) {
  const [sel, setSel] = useS3(checkpoints[0].id);
  const cp = checkpoints.find(c => c.id === sel);
  const cps = [...checkpoints].reverse();
  const now = cps.findIndex(c => c.id === sel);
  const pct = cps.length <= 1 ? 100 : (now / (cps.length - 1)) * 100;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{
        flexShrink: 0, padding: "16px 20px 10px",
        borderBottom: "1px solid var(--hairline)",
      }}>
        <div style={{ position: "relative", height: 40 }}>
          {/* Track */}
          <div style={{
            position: "absolute", left: 12, right: 12, top: 20, height: 2,
            background: "var(--hairline-strong)", borderRadius: 2,
          }}/>
          {/* Progress */}
          <div style={{
            position: "absolute", left: 12, top: 20, height: 2,
            width: `calc(${pct}% * (100% - 24px) / 100%)`,
            background: "linear-gradient(90deg, var(--accent-2), var(--accent))",
            borderRadius: 2, boxShadow: "0 0 10px var(--accent-glow)",
          }}/>
          {cps.map((c, i) => {
            const p = cps.length <= 1 ? 50 : (i / (cps.length - 1)) * 100;
            const isActive = c.id === sel;
            const isPast = i < now;
            return (
              <button key={c.id} onClick={() => setSel(c.id)}
                title={`${c.title} · ${c.day} ${c.time}`}
                style={{
                  position: "absolute", top: 14,
                  left: `calc(12px + ${p}% * (100% - 24px) / 100%)`,
                  transform: "translateX(-50%)",
                  width: isActive ? 16 : 12, height: isActive ? 16 : 12,
                  borderRadius: 999,
                  background: isActive ? "var(--accent)" : isPast ? "var(--accent-soft)" : "var(--surface)",
                  border: `2px solid ${isActive ? "var(--canvas)" : "var(--panel)"}`,
                  boxShadow: isActive ? "0 0 0 2px var(--accent), 0 0 16px var(--accent-glow)" : "0 0 0 1px var(--hairline-strong)",
                }}/>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4,
          fontSize: 10, fontFamily: "var(--mono)", color: "var(--fg-3)" }}>
          <span>{cps[0]?.day} {cps[0]?.time}</span>
          <span>now</span>
        </div>
      </div>

      {cp ? (
        <div style={{
          flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr",
          padding: 16, gap: 16, overflow: "auto",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{
                width: 10, height: 10, borderRadius: 999,
                background: cp.ai ? "var(--accent)" : "var(--fg-2)",
                boxShadow: cp.ai ? "0 0 10px var(--accent-glow)" : "none",
              }}/>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>{cp.title}</div>
              {cp.ai ? (
                <span style={{
                  fontSize: 9.5, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase",
                  padding: "2px 6px", borderRadius: 3,
                  background: "var(--accent-bg)", color: "var(--accent-ink)",
                }}>AI-named</span>
              ) : null}
            </div>
            <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--fg-3)", marginBottom: 10,
              display: "flex", gap: 10 }}>
              <span>{cp.hash}</span>
              <span>{cp.day} {cp.time}</span>
              <span>{cp.changes} file{cp.changes === 1 ? "" : "s"}</span>
              <span style={{ color: "var(--add)" }}>+{cp.add}</span>
              <span style={{ color: "var(--del)" }}>−{cp.del}</span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button style={V3PrimaryBtn}>
                <Icons.Restore size={11}/>Restore this version
              </button>
              <button style={V3SecondaryBtn}>
                <Icons.Eye size={11}/>Diff to now
              </button>
            </div>
          </div>
          <div>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
              textTransform: "uppercase", color: "var(--fg-3)", marginBottom: 6,
            }}>Files touched</div>
            <div style={{
              background: "var(--surface)", border: "1px solid var(--hairline)",
              borderRadius: 7, overflow: "hidden",
            }}>
              {["Source Control Rationale.md", "Theme Inventory.md", "Activity Bar Specs.md"].slice(0, cp.changes).map((f, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 10px",
                  borderBottom: i < cp.changes - 1 ? "1px solid var(--hairline)" : "none",
                  fontSize: 11.5,
                }}>
                  <Icons.File size={11} style={{ color: "var(--fg-3)" }}/>
                  <span style={{ color: "var(--fg)", flex: 1,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f}</span>
                  <span style={{ color: "var(--add)", fontFamily: "var(--mono)", fontSize: 10.5 }}>+{Math.round(cp.add / cp.changes)}</span>
                  <span style={{ color: "var(--del)", fontFamily: "var(--mono)", fontSize: 10.5 }}>−{Math.round(cp.del / cp.changes)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const V3PrimaryBtn = {
  display: "flex", alignItems: "center", gap: 6,
  padding: "0 12px", height: 28, borderRadius: 7,
  background: "var(--accent)", color: "var(--on-accent)",
  fontSize: 11.5, fontWeight: 600,
  boxShadow: "0 0 12px -3px var(--accent-glow)",
};
const V3SecondaryBtn = {
  display: "flex", alignItems: "center", gap: 6,
  padding: "0 12px", height: 28, borderRadius: 7,
  background: "var(--surface)", border: "1px solid var(--hairline-strong)",
  color: "var(--fg)", fontSize: 11.5, fontWeight: 500,
};

// ---------------- Commit tab ----------------

function V3DockCommit({ staged, aiCommit, totalAdd, totalDel }) {
  const suggestion = "Frame Source Control around checkpoints; drop legacy commit modal";
  const [message, setMessage] = useS3(aiCommit ? suggestion : "");
  const [alternates, setAlternates] = useS3([
    "Rename 'commits' → 'checkpoints' across SC surfaces",
    "SC panel: unify staged/unstaged/history; remove modal dialog",
  ]);
  const add = staged.reduce((a, c) => a + c.additions, 0);
  const del = staged.reduce((a, c) => a + c.deletions, 0);
  const ready = staged.length > 0 && message.trim();
  return (
    <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1.2fr 1fr",
      padding: 16, gap: 16, overflow: "auto" }}>
      {/* Left: composer */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {aiCommit ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 10px", background: "var(--accent-bg)",
            border: "1px solid color-mix(in oklch, var(--accent) 30%, transparent)",
            borderRadius: 6, fontSize: 10.5, color: "var(--accent-ink)",
            letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 700,
          }}>
            <Icons.Sparkles size={11}/>
            <span>AI drafted this checkpoint title</span>
            <div style={{ flex: 1 }}/>
            <button style={{ textTransform: "none", fontSize: 10.5, letterSpacing: 0,
              color: "var(--accent-ink)", fontWeight: 500 }}>regenerate</button>
          </div>
        ) : null}
        <textarea
          value={message} onChange={e => setMessage(e.target.value)}
          placeholder={staged.length ? "Name this checkpoint…" : "Stage changes first"}
          rows={4}
          style={{
            width: "100%", resize: "none", padding: "12px 14px",
            background: "var(--surface)", border: "1px solid var(--hairline-strong)",
            borderRadius: 8, color: "var(--fg)",
            fontSize: 14, lineHeight: 1.5, outline: "none",
            fontFamily: "var(--sans)", fontWeight: 500,
          }}
        />
        {/* Alternates */}
        {aiCommit && alternates.length ? (
          <div>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
              textTransform: "uppercase", color: "var(--fg-3)", marginBottom: 6,
            }}>Or try…</div>
            {alternates.map((a, i) => (
              <button key={i} onClick={() => setMessage(a)} style={{
                display: "block", textAlign: "left", width: "100%",
                padding: "6px 10px", marginBottom: 4,
                background: "var(--surface)", border: "1px solid var(--hairline)",
                borderRadius: 6, fontSize: 12, color: "var(--fg-2)",
              }}>{a}</button>
            ))}
          </div>
        ) : null}
        <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
          <button disabled={!ready} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            height: 34, borderRadius: 8,
            background: ready ? "var(--accent)" : "var(--surface)",
            color: ready ? "var(--on-accent)" : "var(--fg-3)",
            fontSize: 12.5, fontWeight: 600,
            boxShadow: ready ? "0 0 16px -3px var(--accent-glow)" : "none",
            border: ready ? "none" : "1px solid var(--hairline)",
          }}>
            <Icons.GitCommit size={12}/>
            <span>Create checkpoint · {staged.length} file{staged.length === 1 ? "" : "s"}</span>
            {(add || del) ? (
              <span style={{ opacity: 0.8, fontFamily: "var(--mono)", fontSize: 10.5 }}>+{add} −{del}</span>
            ) : null}
          </button>
          <button style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "0 12px", height: 34, borderRadius: 8,
            background: "var(--surface)", border: "1px solid var(--hairline-strong)",
            color: "var(--fg)", fontSize: 11.5, fontWeight: 500,
          }}>
            <Icons.Undo size={11}/>Amend
          </button>
        </div>
      </div>
      {/* Right: staged preview */}
      <div>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
          textTransform: "uppercase", color: "var(--fg-3)", marginBottom: 8,
        }}>In this checkpoint</div>
        {staged.length === 0 ? (
          <div style={{
            padding: "32px 16px", textAlign: "center",
            color: "var(--fg-3)", fontSize: 11.5,
            border: "1px dashed var(--hairline-strong)", borderRadius: 8,
          }}>
            Nothing staged yet.
          </div>
        ) : (
          <div style={{
            background: "var(--surface)", border: "1px solid var(--hairline)",
            borderRadius: 8, overflow: "hidden",
          }}>
            {staged.map((c, i) => {
              const sc = { M: "var(--warn)", A: "var(--add)", D: "var(--del)" }[c.status];
              return (
                <div key={c.id} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 10px",
                  borderBottom: i < staged.length - 1 ? "1px solid var(--hairline)" : "none",
                }}>
                  <span style={{
                    fontFamily: "var(--mono)", fontSize: 9.5, fontWeight: 700, color: sc,
                    padding: "0 4px", borderRadius: 2,
                    background: `color-mix(in oklch, ${sc} 14%, transparent)`,
                  }}>{c.status}</span>
                  <span style={{ fontSize: 12, color: "var(--fg)", flex: 1,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.short}</span>
                  <span style={{ color: "var(--add)", fontFamily: "var(--mono)", fontSize: 10.5 }}>+{c.additions}</span>
                  <span style={{ color: "var(--del)", fontFamily: "var(--mono)", fontSize: 10.5 }}>−{c.deletions}</span>
                </div>
              );
            })}
            <div style={{
              padding: "6px 10px", background: "var(--panel-2)",
              display: "flex", justifyContent: "space-between",
              fontSize: 11, fontFamily: "var(--mono)", color: "var(--fg-2)",
            }}>
              <span>{staged.length} file{staged.length === 1 ? "" : "s"}</span>
              <span>
                <span style={{ color: "var(--add)" }}>+{add}</span>{"  "}
                <span style={{ color: "var(--del)" }}>−{del}</span>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- App root ----------------

function V3App() {
  const [tweaks, setTweaks] = useS3(window.TWEAKS);
  const [changes, setChanges] = useS3(window.CHANGES);
  const [activeFile, setActiveFile] = useS3("sc-rationale");
  const [selChange, setSelChange] = useS3("ch-1");
  const [diffOpen, setDiffOpen] = useS3(false);
  const [dockOpen, setDockOpen] = useS3(true);
  const [tweaksOpen, setTweaksOpen] = useS3(false);

  useE3(() => {
    document.documentElement.setAttribute("data-color-scheme", tweaks.theme === "dark" ? "dark" : "light");
  }, [tweaks.theme]);

  useE3(() => {
    const onMsg = (e) => {
      if (!e.data || typeof e.data !== "object") return;
      if (e.data.type === "__activate_edit_mode") setTweaksOpen(true);
      if (e.data.type === "__deactivate_edit_mode") setTweaksOpen(false);
    };
    window.addEventListener("message", onMsg);
    try { window.parent.postMessage({ type: "__edit_mode_available" }, "*"); } catch {}
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const branch = "design/sc-panel";
  const info = window.BRANCHES.find(b => b.name === branch) || { ahead: 7, behind: 1 };
  const selectedChange = changes.find(c => c.id === selChange);
  const openReview = (id) => { if (id) setSelChange(id); setDiffOpen(true); };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden",
      background: "var(--canvas)" }}>
      <V3TopBar branch={branch} ahead={info.ahead} behind={info.behind} unsaved={changes.length}/>
      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
        <V3Sidebar activeFile={activeFile} onFileClick={setActiveFile} changes={changes}/>
        <V3Editor doc={window.EDITOR_DOC} dockOpen={dockOpen}/>
        {diffOpen && selectedChange ? (
          <DiffViewer change={selectedChange} onClose={() => setDiffOpen(false)}/>
        ) : null}
      </div>
      <V3Dock
        changes={changes} setChanges={setChanges}
        checkpoints={window.CHECKPOINTS}
        activeFile={activeFile} setActiveFile={setActiveFile}
        aiCommit={tweaks.aiCommit}
        onReview={openReview}
        open={dockOpen} setOpen={setDockOpen}
      />
      {tweaksOpen ? <TweaksPanel tweaks={tweaks} setTweaks={setTweaks} onClose={() => setTweaksOpen(false)}/> : null}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<V3App/>);
