// Carbide v2 — "Lattice"
// Refinement direction: same 3-column bones, but ruthlessly tightened.
// - Editor widened; max-width removed in favor of measured columns.
// - Single left rail combining activity + vault (no more 2 narrow columns).
// - Right panel compacted into a dense "working set" card with inline hunks.
// - Luminous teal hairline on active rails (Octarine echo).
// - Type: Geist + Geist Mono; reads sharper than Inter at 12/13px.

const { useState: useS2, useEffect: useE2, useMemo: useM2 } = React;

// ---------------- Chrome ----------------

function V2TitleBar({ branch, ahead, behind }) {
  return (
    <div style={{
      height: 36, display: "flex", alignItems: "center",
      paddingLeft: 78, paddingRight: 8, gap: 10,
      background: "var(--chrome)", borderBottom: "1px solid var(--hairline)",
      color: "var(--fg-2)", fontSize: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{
          width: 16, height: 16, borderRadius: 4,
          background: "linear-gradient(135deg, var(--accent), var(--accent-2))",
          boxShadow: "0 0 0 1px var(--accent-soft), 0 0 12px -2px var(--accent-glow)",
        }}/>
        <span style={{ color: "var(--fg)", fontWeight: 600 }}>research-vault</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span style={{ color: "var(--fg-3)" }}>Design</span>
        <span style={{ opacity: 0.4 }}>/</span>
        <span style={{ color: "var(--fg)" }}>Source Control Rationale</span>
        <span style={{
          marginLeft: 6, width: 6, height: 6, borderRadius: 999,
          background: "var(--dirty)",
        }}/>
      </div>
      <div style={{ flex: 1 }}/>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        fontFamily: "var(--mono)", fontSize: 11, color: "var(--fg-3)",
      }}>
        <span>⌘K · commands</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>⌘P · files</span>
      </div>
      <div style={{ flex: 1 }}/>
      <button style={{
        display: "flex", alignItems: "center", gap: 6,
        height: 24, padding: "0 10px", borderRadius: 6,
        background: "var(--surface)", border: "1px solid var(--hairline-strong)",
        color: "var(--fg)", fontSize: 11.5,
      }}>
        <Icons.Branch size={11} style={{ color: "var(--accent)" }}/>
        <span style={{ fontWeight: 500 }}>{branch}</span>
        <span style={{ fontFamily: "var(--mono)", color: "var(--fg-3)" }}>↑{ahead}·↓{behind}</span>
      </button>
    </div>
  );
}

function V2LeftRail({ activeFile, onFileClick, unsaved }) {
  const [tab, setTab] = useS2("files");
  const tabs = [
    { id: "files", icon: Icons.Files, label: "Files" },
    { id: "sc", icon: Icons.Branch, label: "Source", badge: unsaved },
    { id: "search", icon: Icons.Search, label: "Search" },
    { id: "graph", icon: Icons.Graph, label: "Graph" },
    { id: "tasks", icon: Icons.Tasks, label: "Tasks" },
  ];
  return (
    <div style={{
      width: 260, flexShrink: 0, display: "flex", flexDirection: "column",
      background: "var(--panel)", borderRight: "1px solid var(--hairline)",
    }}>
      {/* Tab strip */}
      <div style={{
        display: "flex", height: 36, paddingLeft: 8,
        borderBottom: "1px solid var(--hairline)",
        alignItems: "stretch", gap: 2,
      }}>
        {tabs.map(t => {
          const on = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} title={t.label}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "0 9px", position: "relative",
                color: on ? "var(--fg)" : "var(--fg-3)",
              }}>
              <t.icon size={13}/>
              <span style={{ fontSize: 11.5, fontWeight: on ? 600 : 500 }}>{t.label}</span>
              {t.badge ? (
                <span style={{
                  padding: "0 5px", minWidth: 15, height: 14, borderRadius: 999,
                  background: "var(--accent)", color: "var(--on-accent)",
                  fontSize: 9.5, fontWeight: 700, fontFamily: "var(--mono)",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}>{t.badge}</span>
              ) : null}
              {on ? (
                <span style={{
                  position: "absolute", left: 4, right: 4, bottom: -1, height: 2,
                  background: "var(--accent)", borderRadius: 2,
                  boxShadow: "0 0 8px var(--accent-glow)",
                }}/>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Heading + search */}
      <div style={{ padding: "10px 12px 8px" }}>
        <div style={{
          display: "flex", alignItems: "center",
          background: "var(--surface)", border: "1px solid var(--hairline)",
          borderRadius: 6, padding: "4px 8px", gap: 6,
        }}>
          <Icons.Search size={12} style={{ color: "var(--fg-3)" }}/>
          <span style={{ fontSize: 11.5, color: "var(--fg-3)", flex: 1 }}>Filter vault…</span>
          <span style={{ fontSize: 10, fontFamily: "var(--mono)", color: "var(--fg-3)",
            padding: "1px 5px", background: "var(--chrome)", borderRadius: 3 }}>⌘F</span>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", paddingBottom: 8 }}>
        <V2Tree tree={window.VAULT_TREE} activeId={activeFile} onFileClick={onFileClick}/>
      </div>

      {/* Footer: recents */}
      <div style={{
        borderTop: "1px solid var(--hairline)", padding: "8px 12px",
        fontSize: 10.5, color: "var(--fg-3)",
        textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600,
      }}>
        <div style={{ marginBottom: 6 }}>Recently opened</div>
        {["Theme Inventory", "Atomic Writes", "LSP Integration"].map(r => (
          <div key={r} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "2px 0",
            fontSize: 11.5, color: "var(--fg-2)", fontWeight: 400,
            textTransform: "none", letterSpacing: 0,
          }}>
            <Icons.File size={11} style={{ color: "var(--fg-3)" }}/>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function V2Tree({ tree, activeId, onFileClick }) {
  const [open, setOpen] = useS2(
    Object.fromEntries(tree.filter(n => n.type === "folder").map(n => [n.name, n.open]))
  );
  const toggle = (n) => setOpen(o => ({ ...o, [n]: !o[n] }));
  const render = (node, depth = 0) => {
    const indent = 10 + depth * 12;
    if (node.type === "folder") {
      const o = open[node.name];
      return (
        <div key={node.name}>
          <div onClick={() => toggle(node.name)}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              height: 24, paddingLeft: indent, paddingRight: 8,
              color: "var(--fg-2)", cursor: "pointer", fontSize: 12.5,
            }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--hover)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            {o ? <Icons.ChevronD size={11}/> : <Icons.ChevronR size={11}/>}
            <span style={{ fontWeight: 600, letterSpacing: "0.01em" }}>{node.name}</span>
            <span style={{ flex: 1 }}/>
            <span style={{ fontSize: 10, color: "var(--fg-3)", fontFamily: "var(--mono)" }}>{node.children.length}</span>
          </div>
          {o && node.children.map(c => render(c, depth + 1))}
        </div>
      );
    }
    const isActive = activeId === node.id;
    const statusColors = { M: "var(--warn)", A: "var(--accent)", D: "var(--del)" };
    return (
      <div key={node.id} onClick={() => onFileClick(node.id)}
        style={{
          position: "relative", display: "flex", alignItems: "center", gap: 6,
          height: 24, paddingLeft: indent + 14, paddingRight: 10,
          color: isActive ? "var(--fg)" : "var(--fg-2)",
          background: isActive ? "var(--selected)" : "transparent",
          cursor: "pointer", fontSize: 12.5,
        }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "var(--hover)"; }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
        {isActive ? (
          <span style={{
            position: "absolute", left: 0, top: 3, bottom: 3, width: 2,
            background: "var(--accent)", borderRadius: 1,
            boxShadow: "0 0 8px var(--accent-glow)",
          }}/>
        ) : null}
        <span style={{
          flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          fontWeight: isActive ? 500 : 400,
        }}>
          {node.name.replace(/\.md$/, "")}
        </span>
        {node.status ? (
          <span style={{
            width: 14, height: 14, borderRadius: 3,
            background: statusColors[node.status] + "22",
            color: statusColors[node.status],
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: 9.5, fontWeight: 700, fontFamily: "var(--mono)",
          }}>{node.status}</span>
        ) : null}
      </div>
    );
  };
  return <div>{tree.map(n => render(n))}</div>;
}

// ---------------- Editor ----------------

function V2Editor({ doc, onReview }) {
  return (
    <div style={{
      flex: 1, minWidth: 0, display: "flex", flexDirection: "column",
      background: "var(--canvas)", overflow: "hidden",
    }}>
      {/* Tabs */}
      <div style={{
        height: 34, display: "flex", alignItems: "stretch",
        borderBottom: "1px solid var(--hairline)",
        background: "var(--chrome)",
      }}>
        {[
          { id: "sc", name: "Source Control Rationale", dirty: true, active: true },
          { id: "ti", name: "Theme Inventory", dirty: true },
          { id: "aw", name: "Atomic Writes", dirty: false },
        ].map(t => (
          <div key={t.id} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "0 14px 0 12px", cursor: "pointer",
            borderRight: "1px solid var(--hairline)",
            background: t.active ? "var(--canvas)" : "transparent",
            color: t.active ? "var(--fg)" : "var(--fg-3)",
            fontSize: 12, position: "relative",
          }}>
            {t.active ? (
              <span style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 2,
                background: "var(--accent)",
                boxShadow: "0 0 10px var(--accent-glow)",
              }}/>
            ) : null}
            <span>{t.name}</span>
            {t.dirty ? (
              <span style={{ width: 5, height: 5, borderRadius: 999,
                background: "var(--dirty)" }}/>
            ) : (
              <Icons.X size={10} style={{ opacity: 0.5 }}/>
            )}
          </div>
        ))}
        <div style={{ flex: 1 }}/>
        <button onClick={onReview} style={{
          display: "flex", alignItems: "center", gap: 6, padding: "0 12px",
          color: "var(--fg-2)", fontSize: 11.5, borderLeft: "1px solid var(--hairline)",
        }}>
          <Icons.Eye size={12}/>Reading
        </button>
        <button style={{
          display: "flex", alignItems: "center", gap: 6, padding: "0 12px",
          color: "var(--fg-3)", fontSize: 11.5,
        }}>
          <Icons.More size={13}/>
        </button>
      </div>

      {/* Change summary strip — the "what's different here" */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "7px 16px 7px 20px",
        background: "var(--canvas-2)", borderBottom: "1px solid var(--hairline)",
        fontSize: 11.5, color: "var(--fg-2)",
      }}>
        <Icons.Sparkles size={11} style={{ color: "var(--accent)" }}/>
        <span style={{ color: "var(--fg)" }}>Your edits today:</span>
        <span>reframed panel around <em style={{ color: "var(--accent)", fontStyle: "normal" }}>checkpoints</em> vs. commits · added editor rail surface · dropped modal commit dialog</span>
        <div style={{ flex: 1 }}/>
        <button onClick={onReview} style={{
          display: "flex", alignItems: "center", gap: 5, padding: "3px 9px",
          borderRadius: 5, background: "var(--surface)",
          border: "1px solid var(--hairline-strong)", color: "var(--fg)",
          fontSize: 11, fontWeight: 500,
        }}>
          <Icons.GitCommit size={11}/>Review changes
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={{
          maxWidth: 780, margin: "0 auto", padding: "28px 40px 120px",
          fontSize: 14, color: "var(--fg)", lineHeight: 1.65,
        }}>
          {doc.map((b, i) => <V2Block key={i} block={b}/>)}
        </div>
      </div>

      {/* Info strip */}
      <div style={{
        height: 26, display: "flex", alignItems: "center", gap: 14,
        padding: "0 16px", fontSize: 11, color: "var(--fg-3)",
        borderTop: "1px solid var(--hairline)", background: "var(--canvas-2)",
        fontFamily: "var(--mono)",
      }}>
        <span>416 words</span>
        <span>·</span>
        <span>3 min read</span>
        <span>·</span>
        <span>linked 2× · incoming 4</span>
        <div style={{ flex: 1 }}/>
        <span>md</span>
      </div>
    </div>
  );
}

function V2Block({ block }) {
  const state = block.state || "clean";
  const railColor = {
    added: "var(--accent)",
    modified: "var(--warn)",
    deleted: "var(--del)",
    clean: "transparent",
  }[state];
  const railGlow = {
    added: "0 0 8px var(--accent-glow)",
    modified: "0 0 6px oklch(0.75 0.13 85 / 0.5)",
    deleted: "0 0 6px oklch(0.62 0.13 28 / 0.45)",
    clean: "none",
  }[state];
  const inner = (() => {
    if (block.type === "h1") return <h1 style={{ fontSize: 30, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.02em" }}>{block.text}</h1>;
    if (block.type === "meta") return (
      <div style={{ color: "var(--fg-3)", fontSize: 12, marginBottom: 22 }}>
        <V2Wikilinks text={block.text}/>
      </div>
    );
    if (block.type === "h2") return <h2 style={{ fontSize: 16, fontWeight: 600, margin: "22px 0 8px", letterSpacing: "-0.005em" }}>{block.text}</h2>;
    if (block.type === "p") return <p style={{ margin: "0 0 14px" }}><V2Wikilinks text={block.text}/></p>;
    if (block.type === "quote") return (
      <blockquote style={{
        margin: "4px 0 16px", padding: "10px 16px",
        background: "var(--accent-bg)",
        borderLeft: "2px solid var(--accent)",
        borderRadius: "0 6px 6px 0", color: "var(--accent-ink)", fontStyle: "italic",
      }}>{block.text}</blockquote>
    );
    if (block.type === "ul") return (
      <ul style={{ margin: "4px 0 14px", padding: 0, listStyle: "none" }}>
        {block.items.map((it, j) => {
          const m = {
            added: { fg: "var(--fg)", bg: "color-mix(in oklch, var(--accent) 9%, transparent)", mark: "var(--accent)", deco: "none" },
            modified: { fg: "var(--fg)", bg: "transparent", mark: "var(--warn)", deco: "none" },
            deleted: { fg: "var(--fg-3)", bg: "color-mix(in oklch, var(--del) 7%, transparent)", mark: "var(--del)", deco: "line-through" },
            clean: { fg: "var(--fg)", bg: "transparent", mark: "var(--fg-3)", deco: "none" },
          }[it.state || "clean"];
          return (
            <li key={j} style={{
              display: "flex", gap: 10, padding: "3px 8px",
              borderRadius: 4, background: m.bg, color: m.fg,
              textDecoration: m.deco,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: 999, marginTop: 9, background: m.mark }}/>
              <span>{it.text}</span>
            </li>
          );
        })}
      </ul>
    );
    return null;
  })();
  return (
    <div style={{ display: "flex", gap: 14 }}>
      <div style={{
        width: 2, alignSelf: "stretch", marginTop: 4, marginBottom: 4,
        background: railColor, borderRadius: 2, boxShadow: railGlow,
      }}/>
      <div style={{ flex: 1, minWidth: 0 }}>{inner}</div>
    </div>
  );
}

function V2Wikilinks({ text }) {
  const parts = text.split(/(\[\[[^\]]+\]\])/g);
  return <>{parts.map((p, i) => p.startsWith("[[") ? (
    <span key={i} style={{
      color: "var(--accent-ink)",
      background: "var(--accent-bg)",
      padding: "1px 5px", borderRadius: 3,
      fontWeight: 500,
    }}>{p.slice(2, -2)}</span>
  ) : <span key={i}>{p}</span>)}</>;
}

// ---------------- Source Control Panel ----------------

function V2SourceControl({ changes, setChanges, checkpoints, ahead, behind, aiCommit, onReview }) {
  const staged = changes.filter(c => c.staged);
  const unstaged = changes.filter(c => !c.staged);
  const totalAdd = changes.reduce((a, c) => a + c.additions, 0);
  const totalDel = changes.reduce((a, c) => a + c.deletions, 0);
  const stageAll = () => setChanges(cs => cs.map(c => ({ ...c, staged: true })));
  const stageToggle = (id) => setChanges(cs => cs.map(c => c.id === id ? { ...c, staged: !c.staged } : c));
  const [message, setMessage] = useS2(aiCommit ? "Frame Source Control around checkpoints; drop legacy commit modal" : "");

  return (
    <div style={{
      width: 360, flexShrink: 0, display: "flex", flexDirection: "column",
      background: "var(--panel)", borderLeft: "1px solid var(--hairline)",
      overflow: "hidden",
    }}>
      {/* Branch header */}
      <div style={{
        padding: "12px 14px 10px", borderBottom: "1px solid var(--hairline)",
        background: "var(--panel-2)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icons.Branch size={13} style={{ color: "var(--accent)" }}/>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>design/sc-panel</div>
          <div style={{ flex: 1 }}/>
          <button title="Pull" style={V2IconBtn}>
            <Icons.Download size={11}/>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10.5 }}>{behind}</span>
          </button>
          <button title="Push" style={{ ...V2IconBtn, background: ahead ? "var(--accent)" : "var(--surface)",
            color: ahead ? "var(--on-accent)" : "var(--fg)", borderColor: ahead ? "var(--accent)" : "var(--hairline-strong)" }}>
            <Icons.Upload size={11}/>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10.5 }}>{ahead}</span>
          </button>
        </div>
        {/* Stat ribbon */}
        <div style={{
          marginTop: 10, display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
          gap: 1, background: "var(--hairline)",
          border: "1px solid var(--hairline)", borderRadius: 6, overflow: "hidden",
        }}>
          <V2Stat label="files" value={changes.length} tone="fg"/>
          <V2Stat label="staged" value={staged.length} tone="accent"/>
          <V2Stat label="+" value={totalAdd} tone="add" mono/>
          <V2Stat label="−" value={totalDel} tone="del" mono/>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto" }}>
        {/* Staged */}
        <V2Section
          title="Staged" count={staged.length}
          right={<button style={V2LinkBtn} onClick={() => setChanges(cs => cs.map(c => ({ ...c, staged: false })))}>unstage all</button>}
        >
          {staged.length === 0 ? <V2Empty text="Nothing staged yet — stage a change below."/> : null}
          {staged.map(c => <V2ChangeCard key={c.id} change={c} onStageToggle={stageToggle} onReview={onReview}/>)}
        </V2Section>

        {/* Unstaged */}
        <V2Section
          title="Changes" count={unstaged.length}
          right={<button style={V2LinkBtn} onClick={stageAll}>stage all</button>}
        >
          {unstaged.map(c => <V2ChangeCard key={c.id} change={c} onStageToggle={stageToggle} onReview={onReview}/>)}
        </V2Section>

        {/* History */}
        <V2Section title="Checkpoints" count={checkpoints.length}>
          <V2History checkpoints={checkpoints}/>
        </V2Section>
        <div style={{ height: 8 }}/>
      </div>

      {/* Composer */}
      <V2Composer staged={staged} aiCommit={aiCommit} message={message} setMessage={setMessage}/>
    </div>
  );
}

const V2IconBtn = {
  display: "flex", alignItems: "center", gap: 4,
  height: 22, padding: "0 8px", borderRadius: 5,
  background: "var(--surface)", border: "1px solid var(--hairline-strong)",
  color: "var(--fg)", fontSize: 11,
};
const V2LinkBtn = {
  fontSize: 10.5, color: "var(--fg-3)", padding: "2px 4px",
  textDecoration: "underline", textUnderlineOffset: 2,
  textDecorationColor: "var(--hairline-strong)",
};

function V2Stat({ label, value, tone, mono }) {
  const color = { fg: "var(--fg)", accent: "var(--accent)", add: "var(--add)", del: "var(--del)" }[tone];
  return (
    <div style={{ background: "var(--panel)", padding: "6px 8px" }}>
      <div style={{ fontSize: 9.5, color: "var(--fg-3)", textTransform: "uppercase",
        letterSpacing: "0.08em", fontWeight: 600 }}>{label}</div>
      <div style={{
        fontFamily: mono ? "var(--mono)" : "var(--sans)",
        fontSize: 15, fontWeight: 600, color, marginTop: 1,
      }}>{value}</div>
    </div>
  );
}

function V2Section({ title, count, right, children }) {
  const [open, setOpen] = useS2(true);
  return (
    <div>
      <div onClick={() => setOpen(o => !o)} style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "10px 12px 6px", cursor: "pointer", userSelect: "none",
      }}>
        {open ? <Icons.ChevronD size={11} style={{ color: "var(--fg-3)" }}/> : <Icons.ChevronR size={11} style={{ color: "var(--fg-3)" }}/>}
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
          textTransform: "uppercase", color: "var(--fg-2)",
        }}>{title}</span>
        <span style={{
          fontFamily: "var(--mono)", fontSize: 10, color: "var(--fg-3)",
          padding: "0 5px", background: "var(--surface)", borderRadius: 3,
        }}>{count}</span>
        <div style={{ flex: 1 }}/>
        <div onClick={e => e.stopPropagation()}>{right}</div>
      </div>
      {open ? <div style={{ padding: "0 8px" }}>{children}</div> : null}
    </div>
  );
}

function V2ChangeCard({ change, onStageToggle, onReview }) {
  const [exp, setExp] = useS2(false);
  const statusColors = { M: "var(--warn)", A: "var(--add)", D: "var(--del)", R: "var(--accent)" };
  const sc = statusColors[change.status];
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--hairline)",
      borderRadius: 7, padding: "6px 8px", marginBottom: 6,
      borderLeft: `2px solid ${sc}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <div style={{ minWidth: 0, flex: 1, cursor: "pointer" }} onClick={() => onReview(change.id)}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{
              fontFamily: "var(--mono)", fontSize: 9.5, fontWeight: 700, color: sc,
              padding: "0 4px", borderRadius: 2, background: `color-mix(in oklch, ${sc} 14%, transparent)`,
            }}>{change.status}</span>
            <span style={{
              fontSize: 12, fontWeight: 500, color: "var(--fg)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              flex: 1,
            }}>{change.short.replace(/\.md$/, "")}</span>
          </div>
          <div style={{ display: "flex", gap: 7, alignItems: "center", marginTop: 2, fontSize: 10.5, color: "var(--fg-3)" }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{change.folder || "/"}</span>
            <div style={{ flex: 1 }}/>
            {change.additions > 0 ? <span style={{ color: "var(--add)", fontFamily: "var(--mono)" }}>+{change.additions}</span> : null}
            {change.deletions > 0 ? <span style={{ color: "var(--del)", fontFamily: "var(--mono)" }}>−{change.deletions}</span> : null}
          </div>
        </div>
        <button onClick={() => setExp(e => !e)} title="Peek" style={{
          width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--fg-3)",
        }}>
          {exp ? <Icons.ChevronD size={11}/> : <Icons.ChevronR size={11}/>}
        </button>
        <button onClick={() => onStageToggle(change.id)} title={change.staged ? "Unstage" : "Stage"}
          style={{
            width: 22, height: 22, borderRadius: 5,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: change.staged ? "var(--accent)" : "transparent",
            border: change.staged ? "none" : "1px solid var(--hairline-strong)",
            color: change.staged ? "var(--on-accent)" : "var(--fg-2)",
            boxShadow: change.staged ? "0 0 8px var(--accent-glow)" : "none",
          }}>
          {change.staged ? <Icons.Check size={11}/> : <Icons.Plus size={11}/>}
        </button>
      </div>
      {exp ? (
        <div style={{
          marginTop: 8, paddingTop: 8, borderTop: "1px dashed var(--hairline)",
          fontFamily: "var(--mono)", fontSize: 11, lineHeight: 1.55,
          color: "var(--fg-2)",
        }}>
          <div style={{ fontFamily: "var(--sans)", fontSize: 11, fontStyle: "italic",
            color: "var(--fg-3)", marginBottom: 6, display: "flex", gap: 5, alignItems: "center" }}>
            <Icons.Sparkles size={10} style={{ color: "var(--accent)" }}/>
            {change.summary}
          </div>
          {change.hunks.slice(0, 6).map((h, i) => (
            <div key={i} style={{
              padding: "1px 6px", borderRadius: 3, whiteSpace: "pre-wrap",
              background: h.kind === "add" ? "color-mix(in oklch, var(--add) 14%, transparent)" :
                          h.kind === "del" ? "color-mix(in oklch, var(--del) 14%, transparent)" : "transparent",
              color: h.kind === "add" ? "var(--add-ink)" :
                     h.kind === "del" ? "var(--del-ink)" : "var(--fg-2)",
            }}>
              <span style={{ opacity: 0.7, marginRight: 6 }}>{h.kind === "add" ? "+" : h.kind === "del" ? "−" : " "}</span>
              {h.line}
            </div>
          ))}
          {change.hunks.length > 6 ? (
            <div style={{ marginTop: 4, fontSize: 10.5, color: "var(--fg-3)", fontFamily: "var(--sans)" }}>
              +{change.hunks.length - 6} more hunks — <button style={{ color: "var(--accent)" }} onClick={() => onReview(change.id)}>open full diff</button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function V2Empty({ text }) {
  return (
    <div style={{
      padding: "10px 10px 14px", fontSize: 11, color: "var(--fg-3)",
      fontStyle: "italic",
    }}>{text}</div>
  );
}

function V2History({ checkpoints }) {
  // Group by day
  const groups = useM2(() => {
    const g = [];
    for (const cp of checkpoints) {
      const last = g[g.length - 1];
      if (last && last.day === cp.day) last.items.push(cp);
      else g.push({ day: cp.day, items: [cp] });
    }
    return g;
  }, [checkpoints]);
  return (
    <div style={{ position: "relative", padding: "4px 4px 8px" }}>
      {groups.map(g => (
        <div key={g.day} style={{ marginBottom: 6 }}>
          <div style={{
            padding: "4px 8px", fontSize: 10, letterSpacing: "0.08em",
            fontWeight: 700, color: "var(--fg-3)", textTransform: "uppercase",
          }}>{g.day}</div>
          {g.items.map((cp, i) => (
            <div key={cp.id} style={{
              position: "relative", padding: "5px 10px 5px 28px", cursor: "pointer",
              borderRadius: 6,
            }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--hover)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              {/* Spine */}
              <span style={{
                position: "absolute", left: 14, top: 0, bottom: 0, width: 1,
                background: "var(--hairline-strong)",
              }}/>
              <span style={{
                position: "absolute", left: 10, top: 10,
                width: 9, height: 9, borderRadius: 999,
                background: cp.ai ? "var(--accent)" : "var(--fg-2)",
                boxShadow: cp.ai ? "0 0 0 2px var(--panel), 0 0 8px var(--accent-glow)" : "0 0 0 2px var(--panel)",
              }}/>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: "var(--fg)", fontWeight: 500,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {cp.title}
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--fg-3)", fontFamily: "var(--mono)",
                    display: "flex", gap: 8, marginTop: 1 }}>
                    <span>{cp.hash}</span>
                    <span>{cp.time}</span>
                    <span style={{ color: "var(--add)" }}>+{cp.add}</span>
                    <span style={{ color: "var(--del)" }}>−{cp.del}</span>
                  </div>
                </div>
                {cp.ai ? <Icons.Sparkles size={10} style={{ color: "var(--accent)" }}/> : null}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function V2Composer({ staged, aiCommit, message, setMessage }) {
  const count = staged.length;
  const add = staged.reduce((a, c) => a + c.additions, 0);
  const del = staged.reduce((a, c) => a + c.deletions, 0);
  const ready = count > 0 && message.trim();
  return (
    <div style={{
      borderTop: "1px solid var(--hairline)",
      background: "var(--panel-2)", padding: "10px 12px",
    }}>
      {aiCommit ? (
        <div style={{
          display: "flex", alignItems: "center", gap: 5, marginBottom: 7,
          fontSize: 10, letterSpacing: "0.08em", fontWeight: 700,
          color: "var(--accent-ink)", textTransform: "uppercase",
        }}>
          <Icons.Sparkles size={10} style={{ color: "var(--accent)" }}/>
          <span>AI drafted this</span>
          <div style={{ flex: 1 }}/>
          <button style={{ fontSize: 10, letterSpacing: 0, color: "var(--fg-3)",
            textTransform: "none", fontWeight: 500 }}>regenerate</button>
        </div>
      ) : null}
      <textarea
        value={message}
        onChange={e => setMessage(e.target.value)}
        placeholder={count ? "Name this checkpoint…" : "Stage something first"}
        rows={2}
        style={{
          width: "100%", resize: "none", padding: "7px 9px",
          background: "var(--surface)", border: "1px solid var(--hairline-strong)",
          borderRadius: 6, color: "var(--fg)",
          fontSize: 12, lineHeight: 1.5, fontFamily: "var(--sans)",
          outline: "none",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7 }}>
        <button disabled={!ready} style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          height: 30, borderRadius: 6,
          background: ready ? "var(--accent)" : "var(--surface)",
          color: ready ? "var(--on-accent)" : "var(--fg-3)",
          fontSize: 12, fontWeight: 600,
          boxShadow: ready ? "0 0 14px -2px var(--accent-glow)" : "none",
          border: ready ? "none" : "1px solid var(--hairline)",
          cursor: ready ? "pointer" : "not-allowed",
        }}>
          <Icons.GitCommit size={12}/>
          <span>Checkpoint {count} file{count === 1 ? "" : "s"}</span>
          {(add || del) ? (
            <span style={{ opacity: 0.8, fontFamily: "var(--mono)", fontSize: 10.5 }}>+{add} −{del}</span>
          ) : null}
        </button>
        <button style={{
          width: 30, height: 30, borderRadius: 6,
          background: "var(--surface)", border: "1px solid var(--hairline-strong)",
          color: "var(--fg-2)", display: "flex", alignItems: "center", justifyContent: "center",
        }} title="Amend previous"><Icons.Undo size={12}/></button>
      </div>
    </div>
  );
}

// ---------------- Bottom status bar ----------------

function V2StatusBar({ branch, ahead, behind, unsaved, aiCommit }) {
  return (
    <div style={{
      height: 26, display: "flex", alignItems: "center",
      background: "var(--chrome-deep)", color: "var(--fg-2)",
      fontFamily: "var(--mono)", fontSize: 10.5,
      borderTop: "1px solid var(--hairline)",
    }}>
      <div style={{ padding: "0 10px", display: "flex", alignItems: "center", gap: 6,
        borderRight: "1px solid var(--hairline)", height: "100%" }}>
        <Icons.Branch size={11} style={{ color: "var(--accent)" }}/>
        <span style={{ color: "var(--fg)" }}>{branch}</span>
        <span style={{ color: "var(--fg-3)" }}>↑{ahead} ↓{behind}</span>
      </div>
      <div style={{ padding: "0 10px", borderRight: "1px solid var(--hairline)", height: "100%",
        display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--dirty)" }}/>
        <span>{unsaved} unsaved</span>
      </div>
      <div style={{ padding: "0 10px", borderRight: "1px solid var(--hairline)", height: "100%",
        display: "flex", alignItems: "center", gap: 6 }}>
        <Icons.Clock size={11}/>
        <span>last checkpoint 22m ago</span>
      </div>
      <div style={{ padding: "0 10px", height: "100%", display: "flex", alignItems: "center", gap: 6 }}>
        <Icons.Sparkles size={10} style={{ color: aiCommit ? "var(--accent)" : "var(--fg-3)" }}/>
        <span style={{ color: aiCommit ? "var(--fg)" : "var(--fg-3)" }}>ai-commit {aiCommit ? "on" : "off"}</span>
      </div>
      <div style={{ flex: 1 }}/>
      <div style={{ padding: "0 10px", color: "var(--fg-3)" }}>markdown · utf-8 · LF</div>
      <div style={{ padding: "0 10px", display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ width: 6, height: 6, borderRadius: 999,
          background: "var(--add)", boxShadow: "0 0 6px var(--add)" }}/>
        <span>embeddings synced</span>
      </div>
    </div>
  );
}

// ---------------- Diff overlay (reuse DiffViewer from app/) ----------------
// We'll reuse window.DiffViewer.

// ---------------- App root ----------------

function V2App() {
  const [tweaks, setTweaks] = useS2(window.TWEAKS);
  const [changes, setChanges] = useS2(window.CHANGES);
  const [activeFile, setActiveFile] = useS2("sc-rationale");
  const [selChange, setSelChange] = useS2("ch-1");
  const [diffOpen, setDiffOpen] = useS2(false);
  const [tweaksOpen, setTweaksOpen] = useS2(false);

  useE2(() => {
    document.documentElement.setAttribute("data-color-scheme", tweaks.theme === "dark" ? "dark" : "light");
  }, [tweaks.theme]);

  useE2(() => {
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
      <V2TitleBar branch={branch} ahead={info.ahead} behind={info.behind}/>
      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
        <V2LeftRail activeFile={activeFile} onFileClick={setActiveFile} unsaved={changes.length}/>
        <V2Editor doc={window.EDITOR_DOC} onReview={() => openReview(selChange)}/>
        <V2SourceControl
          changes={changes} setChanges={setChanges}
          checkpoints={window.CHECKPOINTS}
          ahead={info.ahead} behind={info.behind}
          aiCommit={tweaks.aiCommit}
          onReview={openReview}
        />
        {diffOpen && selectedChange ? (
          <DiffViewer change={selectedChange} onClose={() => setDiffOpen(false)}/>
        ) : null}
      </div>
      <V2StatusBar branch={branch} ahead={info.ahead} behind={info.behind}
        unsaved={changes.length} aiCommit={tweaks.aiCommit}/>
      {tweaksOpen ? <TweaksPanel tweaks={tweaks} setTweaks={setTweaks} onClose={() => setTweaksOpen(false)}/> : null}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<V2App/>);
