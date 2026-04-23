// Carbide v4 — "Obsidian"
// Moonshot: dark-first canvas. Floating translucent surfaces (vault, editor, dock).
// Vertical "river" on the left: every checkpoint as a glass node.
// Checkpoints dominate the metaphor — editor is a surface floating above the river.
// Diffs are inline annotations on the block margins, not modals.

const { useState: useS4, useEffect: useE4, useMemo: useM4 } = React;

function V4Shell({ children }) {
  return (
    <div style={{
      position: "relative", height: "100vh", overflow: "hidden",
      background: "radial-gradient(1200px 800px at 20% -10%, var(--bg-glow-1), transparent), radial-gradient(1000px 700px at 110% 110%, var(--bg-glow-2), transparent), var(--bg-deep)",
      color: "var(--fg)",
    }}>
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "radial-gradient(circle at 1px 1px, var(--grain) 1px, transparent 0)",
        backgroundSize: "3px 3px", opacity: 0.35, pointerEvents: "none",
      }}/>
      {children}
    </div>
  );
}

function V4TopBar({ branch, ahead, behind }) {
  return (
    <div style={{
      position: "relative", zIndex: 2,
      height: 44, paddingLeft: 80, paddingRight: 14,
      display: "flex", alignItems: "center", gap: 14,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{
          width: 20, height: 20, borderRadius: 5,
          background: "conic-gradient(from 200deg, var(--accent-2), var(--accent), var(--accent-2))",
          boxShadow: "0 0 0 1px oklch(1 0 0 / 0.15), 0 0 18px -2px var(--accent-glow)",
        }}/>
        <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em" }}>Carbide</div>
        <span style={{ opacity: 0.35 }}>·</span>
        <div style={{ fontSize: 12.5, color: "var(--fg-2)" }}>research-vault</div>
      </div>
      <div style={{ flex: 1 }}/>
      <div style={{
        height: 28, padding: "0 12px", minWidth: 380,
        display: "flex", alignItems: "center", gap: 8,
        background: "var(--glass)", border: "1px solid var(--edge)",
        borderRadius: 9, backdropFilter: "blur(12px)",
      }}>
        <Icons.Search size={12} style={{ color: "var(--fg-3)" }}/>
        <span style={{ fontSize: 12, color: "var(--fg-3)" }}>Jump to note, checkpoint, or command…</span>
        <div style={{ flex: 1 }}/>
        <span style={{ fontSize: 10, fontFamily: "var(--mono)", color: "var(--fg-3)",
          padding: "1px 5px", background: "var(--glass-deep)", borderRadius: 3,
          border: "1px solid var(--edge)" }}>⌘K</span>
      </div>
      <div style={{ flex: 1 }}/>
      <button style={V4Chip}>
        <Icons.Branch size={11} style={{ color: "var(--accent)" }}/>
        <span style={{ fontWeight: 500 }}>{branch}</span>
        <span style={{ color: "var(--fg-3)", fontFamily: "var(--mono)", fontSize: 10.5 }}>↑{ahead}·↓{behind}</span>
      </button>
      <button style={{ ...V4Chip, padding: 0, width: 28, justifyContent: "center" }}>
        <Icons.More size={13}/>
      </button>
    </div>
  );
}

const V4Chip = {
  display: "flex", alignItems: "center", gap: 6, height: 28,
  padding: "0 10px", borderRadius: 8,
  background: "var(--glass)", border: "1px solid var(--edge)",
  color: "var(--fg)", fontSize: 11.5,
  backdropFilter: "blur(12px)",
};

// ---------------- River (left rail: checkpoints as glass nodes) ----------------

function V4River({ checkpoints, selected, setSelected, changesCount }) {
  // newest at top
  return (
    <div style={{
      position: "relative", width: 72, flexShrink: 0, zIndex: 2,
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "16px 0 16px", gap: 0,
    }}>
      {/* Spine */}
      <div style={{
        position: "absolute", top: 40, bottom: 20, left: "50%", width: 2,
        marginLeft: -1, borderRadius: 2,
        background: "linear-gradient(to bottom, var(--accent) 0%, var(--accent) 8%, var(--edge) 40%, var(--edge) 100%)",
      }}/>
      {/* "Now" marker */}
      <div title="Working tree (uncommitted)" style={{
        position: "relative", width: 46, height: 46, borderRadius: 12,
        background: "linear-gradient(135deg, var(--accent), var(--accent-2))",
        boxShadow: "0 0 0 1px oklch(1 0 0 / 0.2), 0 0 24px -4px var(--accent-glow)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--on-accent)",
      }}>
        <Icons.GitCommit size={16}/>
        <span style={{
          position: "absolute", top: -4, right: -4,
          padding: "1px 5px", minWidth: 18, height: 18, borderRadius: 999,
          background: "var(--dirty)", color: "white",
          fontSize: 10, fontWeight: 700, fontFamily: "var(--mono)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 0 2px var(--bg-deep)",
        }}>{changesCount}</span>
      </div>
      <div style={{
        fontSize: 9.5, color: "var(--accent-ink)", fontWeight: 700,
        letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 6, marginBottom: 8,
      }}>Now</div>

      <div style={{ flex: 1, overflow: "auto", width: "100%", display: "flex",
        flexDirection: "column", alignItems: "center", gap: 14, paddingBottom: 12 }}>
        {checkpoints.map((cp, i) => {
          const isActive = selected === cp.id;
          return (
            <button key={cp.id}
              onClick={() => setSelected(cp.id)}
              title={`${cp.title}\n${cp.day} ${cp.time} · ${cp.hash}`}
              style={{
                position: "relative",
                width: isActive ? 30 : 22, height: isActive ? 30 : 22,
                borderRadius: isActive ? 9 : 999,
                background: isActive
                  ? "linear-gradient(135deg, var(--accent), var(--accent-2))"
                  : cp.ai ? "var(--glass-strong)" : "var(--glass)",
                border: `1px solid ${isActive ? "transparent" : "var(--edge-strong)"}`,
                boxShadow: isActive
                  ? "0 0 0 2px var(--bg-deep), 0 0 18px var(--accent-glow)"
                  : "0 0 0 2px var(--bg-deep)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: isActive ? "var(--on-accent)" : cp.ai ? "var(--accent)" : "var(--fg-3)",
                backdropFilter: "blur(10px)",
                transition: "all 160ms",
              }}>
              {cp.ai ? <Icons.Sparkles size={isActive ? 12 : 9}/> :
                <span style={{ width: 5, height: 5, borderRadius: 999, background: "currentColor" }}/>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------- Vault (floating surface) ----------------

function V4Vault({ activeFile, onFileClick, changes }) {
  return (
    <div style={{
      position: "relative", zIndex: 2,
      width: 248, flexShrink: 0, margin: "8px 0 16px",
      background: "var(--glass)", backdropFilter: "blur(18px)",
      border: "1px solid var(--edge)", borderRadius: 14,
      display: "flex", flexDirection: "column", overflow: "hidden",
      boxShadow: "0 20px 40px -20px oklch(0 0 0 / 0.5)",
    }}>
      <div style={{
        padding: "11px 14px 10px", display: "flex", alignItems: "center", gap: 7,
        borderBottom: "1px solid var(--edge)",
      }}>
        <Icons.Files size={13} style={{ color: "var(--fg-2)" }}/>
        <span style={{ fontSize: 12, fontWeight: 600 }}>Vault</span>
        <div style={{ flex: 1 }}/>
        <button style={{ color: "var(--fg-3)", padding: 2 }}><Icons.Plus size={12}/></button>
        <button style={{ color: "var(--fg-3)", padding: 2 }}><Icons.More size={12}/></button>
      </div>
      <div style={{ padding: "8px 10px 6px" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "var(--glass-deep)", border: "1px solid var(--edge)",
          borderRadius: 7, padding: "4px 8px",
        }}>
          <Icons.Search size={11} style={{ color: "var(--fg-3)" }}/>
          <span style={{ fontSize: 11.5, color: "var(--fg-3)" }}>Filter…</span>
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto", paddingBottom: 8 }}>
        <V4Tree tree={window.VAULT_TREE} activeId={activeFile} onFileClick={onFileClick}/>
      </div>
    </div>
  );
}

function V4Tree({ tree, activeId, onFileClick }) {
  const [open, setOpen] = useS4(
    Object.fromEntries(tree.filter(n => n.type === "folder").map(n => [n.name, n.open]))
  );
  const toggle = (n) => setOpen(o => ({ ...o, [n]: !o[n] }));
  const render = (node, depth = 0) => {
    const indent = 12 + depth * 12;
    if (node.type === "folder") {
      const o = open[node.name];
      return (
        <div key={node.name}>
          <div onClick={() => toggle(node.name)} style={{
            display: "flex", alignItems: "center", gap: 5,
            height: 24, paddingLeft: indent, paddingRight: 10,
            cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--fg-2)",
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
        height: 24, paddingLeft: indent + 14, paddingRight: 10,
        color: isActive ? "var(--fg)" : "var(--fg-2)",
        background: isActive ? "color-mix(in oklch, var(--accent) 18%, transparent)" : "transparent",
        cursor: "pointer", fontSize: 12.5,
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
        {node.status ? <span style={{ width: 6, height: 6, borderRadius: 999, background: sc, boxShadow: `0 0 6px ${sc}` }}/> : null}
      </div>
    );
  };
  return <div style={{ padding: "4px 0" }}>{tree.map(n => render(n))}</div>;
}

// ---------------- Editor (floating) ----------------

function V4Editor({ doc, changes, onReview }) {
  return (
    <div style={{
      position: "relative", zIndex: 2,
      flex: 1, minWidth: 0, margin: "8px 16px 16px 0",
      background: "var(--glass-strong)", backdropFilter: "blur(20px)",
      border: "1px solid var(--edge)", borderRadius: 14, overflow: "hidden",
      display: "flex", flexDirection: "column",
      boxShadow: "0 30px 60px -25px oklch(0 0 0 / 0.6)",
    }}>
      {/* Head */}
      <div style={{
        padding: "12px 18px", display: "flex", alignItems: "center", gap: 10,
        borderBottom: "1px solid var(--edge)",
      }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 11.5, color: "var(--fg-3)" }}>Design</span>
          <span style={{ color: "var(--fg-3)", opacity: 0.5 }}>/</span>
          <span style={{ fontSize: 12.5, color: "var(--fg)", fontWeight: 500 }}>Source Control Rationale</span>
          <span style={{
            width: 6, height: 6, borderRadius: 999,
            background: "var(--dirty)", boxShadow: "0 0 8px var(--dirty)",
          }}/>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
            color: "var(--accent-ink)", textTransform: "uppercase",
            padding: "2px 6px", borderRadius: 999,
            background: "color-mix(in oklch, var(--accent) 20%, transparent)",
            border: "1px solid color-mix(in oklch, var(--accent) 40%, transparent)",
          }}>4 edits</span>
        </div>
        <button onClick={onReview} style={{ ...V4Chip, fontSize: 11, height: 24, padding: "0 9px" }}>
          <Icons.GitCommit size={11}/>Review changes
        </button>
        <button style={{ ...V4Chip, padding: 0, width: 24, height: 24, justifyContent: "center" }}>
          <Icons.Eye size={11}/>
        </button>
        <button style={{ ...V4Chip, padding: 0, width: 24, height: 24, justifyContent: "center" }}>
          <Icons.More size={11}/>
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={{
          maxWidth: 820, margin: "0 auto", padding: "32px 96px 96px 48px",
          fontSize: 14.5, lineHeight: 1.7, color: "var(--fg)",
        }}>
          {doc.map((b, i) => <V4Block key={i} block={b}/>)}
        </div>
      </div>
    </div>
  );
}

function V4Block({ block }) {
  const state = block.state || "clean";
  const railColor = { added: "var(--accent)", modified: "var(--warn)", deleted: "var(--del)", clean: "transparent" }[state];
  const annotation = {
    added: "new",
    modified: "revised",
    deleted: "removed",
    clean: null,
  }[state];
  const inner = (() => {
    if (block.type === "h1") return <h1 style={{ fontSize: 32, fontWeight: 700, margin: "0 0 6px", letterSpacing: "-0.025em" }}>{block.text}</h1>;
    if (block.type === "meta") return <div style={{ color: "var(--fg-3)", fontSize: 12.5, marginBottom: 24 }}><V4Wikilinks text={block.text}/></div>;
    if (block.type === "h2") return <h2 style={{ fontSize: 17, fontWeight: 600, margin: "28px 0 10px" }}>{block.text}</h2>;
    if (block.type === "p") return <p style={{ margin: "0 0 16px" }}><V4Wikilinks text={block.text}/></p>;
    if (block.type === "quote") return (
      <blockquote style={{
        margin: "10px 0 18px", padding: "16px 22px",
        background: "linear-gradient(100deg, color-mix(in oklch, var(--accent) 14%, transparent), transparent)",
        borderLeft: "3px solid var(--accent)",
        borderRadius: "0 10px 10px 0",
        color: "var(--accent-ink)", fontFamily: "var(--serif)",
        fontSize: 17, fontStyle: "italic", lineHeight: 1.45,
      }}>{block.text}</blockquote>
    );
    if (block.type === "ul") return (
      <ul style={{ margin: "6px 0 16px", padding: 0, listStyle: "none" }}>
        {block.items.map((it, j) => {
          const m = {
            added: { fg: "var(--fg)", bg: "color-mix(in oklch, var(--accent) 11%, transparent)", mark: "var(--accent)", deco: "none" },
            modified: { fg: "var(--fg)", bg: "transparent", mark: "var(--warn)", deco: "none" },
            deleted: { fg: "var(--fg-3)", bg: "color-mix(in oklch, var(--del) 10%, transparent)", mark: "var(--del)", deco: "line-through" },
            clean: { fg: "var(--fg)", bg: "transparent", mark: "var(--fg-3)", deco: "none" },
          }[it.state || "clean"];
          return (
            <li key={j} style={{
              display: "flex", gap: 10, padding: "3px 10px",
              borderRadius: 5, background: m.bg, color: m.fg, textDecoration: m.deco,
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
    <div style={{ position: "relative", display: "flex", gap: 16 }}>
      <div style={{
        width: 2, alignSelf: "stretch", marginTop: 6, marginBottom: 6,
        background: railColor, borderRadius: 2,
        boxShadow: state === "added" ? "0 0 8px var(--accent-glow)" : "none",
      }}/>
      <div style={{ flex: 1, minWidth: 0 }}>{inner}</div>
      {annotation ? (
        <span style={{
          position: "absolute", right: -72, top: 10,
          fontSize: 9.5, fontWeight: 700, letterSpacing: "0.12em",
          textTransform: "uppercase", color: railColor, fontFamily: "var(--mono)",
        }}>{annotation}</span>
      ) : null}
    </div>
  );
}

function V4Wikilinks({ text }) {
  const parts = text.split(/(\[\[[^\]]+\]\])/g);
  return <>{parts.map((p, i) => p.startsWith("[[") ? (
    <span key={i} style={{
      color: "var(--accent)", background: "color-mix(in oklch, var(--accent) 14%, transparent)",
      padding: "1px 6px", borderRadius: 4, fontWeight: 500,
    }}>{p.slice(2, -2)}</span>
  ) : <span key={i}>{p}</span>)}</>;
}

// ---------------- Bottom "Checkpoint altar" ----------------

function V4Altar({ changes, setChanges, selectedCp, checkpoints, aiCommit, onReview }) {
  const [tab, setTab] = useS4("changes"); // changes | detail
  const cp = checkpoints.find(c => c.id === selectedCp);
  const staged = changes.filter(c => c.staged);
  const unstaged = changes.filter(c => !c.staged);
  const suggestion = "Frame Source Control around checkpoints; drop legacy commit modal";
  const [message, setMessage] = useS4(aiCommit ? suggestion : "");
  const add = staged.reduce((a, c) => a + c.additions, 0);
  const del = staged.reduce((a, c) => a + c.deletions, 0);
  const ready = staged.length > 0 && message.trim();
  const stageToggle = (id) => setChanges(cs => cs.map(c => c.id === id ? { ...c, staged: !c.staged } : c));

  return (
    <div style={{
      position: "relative", zIndex: 2,
      margin: "0 16px 16px 16px", height: 168,
      display: "grid", gridTemplateColumns: "1.2fr 1fr",
      gap: 12,
    }}>
      {/* Left: Changes / staged working panel */}
      <div style={{
        background: "var(--glass-strong)", backdropFilter: "blur(20px)",
        border: "1px solid var(--edge)", borderRadius: 14, overflow: "hidden",
        display: "flex", flexDirection: "column",
        boxShadow: "0 20px 40px -20px oklch(0 0 0 / 0.5)",
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 12px", borderBottom: "1px solid var(--edge)",
        }}>
          <Icons.GitCommit size={12} style={{ color: "var(--accent)" }}/>
          <span style={{ fontSize: 11.5, fontWeight: 600 }}>Working tree</span>
          <span style={{
            padding: "0 6px", height: 15, borderRadius: 999,
            background: "var(--glass-deep)", color: "var(--fg-2)",
            fontSize: 10, fontFamily: "var(--mono)",
            display: "inline-flex", alignItems: "center",
          }}>{changes.length}</span>
          <div style={{ flex: 1 }}/>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 10.5, color: "var(--fg-3)" }}>
            <span style={{ fontFamily: "var(--mono)", color: "var(--accent)" }}>{staged.length} staged</span>
            <span style={{ fontFamily: "var(--mono)" }}>{unstaged.length} pending</span>
          </div>
          <button onClick={() => setChanges(cs => cs.map(c => ({ ...c, staged: true })))} style={{
            fontSize: 10.5, color: "var(--fg-3)",
            textDecoration: "underline", textUnderlineOffset: 2,
          }}>stage all</button>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: 4 }}>
          {changes.map(c => <V4ChangeRow key={c.id} change={c} onStage={stageToggle} onReview={onReview}/>)}
        </div>
      </div>

      {/* Right: Checkpoint composer */}
      <div style={{
        background: "var(--glass-strong)", backdropFilter: "blur(20px)",
        border: "1px solid var(--edge)", borderRadius: 14, overflow: "hidden",
        display: "flex", flexDirection: "column", position: "relative",
        boxShadow: "0 20px 40px -20px oklch(0 0 0 / 0.5)",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          background: aiCommit ? "radial-gradient(500px 180px at 90% 110%, color-mix(in oklch, var(--accent) 16%, transparent), transparent)" : "none",
          pointerEvents: "none",
        }}/>
        <div style={{ position: "relative", padding: "8px 12px",
          display: "flex", alignItems: "center", gap: 8,
          borderBottom: "1px solid var(--edge)" }}>
          <Icons.Sparkles size={12} style={{ color: aiCommit ? "var(--accent)" : "var(--fg-3)" }}/>
          <span style={{ fontSize: 11.5, fontWeight: 600 }}>Next checkpoint</span>
          {aiCommit ? (
            <span style={{
              padding: "1px 6px", borderRadius: 999,
              background: "color-mix(in oklch, var(--accent) 20%, transparent)",
              color: "var(--accent-ink)", fontSize: 9.5, fontWeight: 700,
              letterSpacing: "0.08em", textTransform: "uppercase",
            }}>AI draft</span>
          ) : null}
          <div style={{ flex: 1 }}/>
          <button style={{ fontSize: 10.5, color: "var(--fg-3)",
            textDecoration: "underline", textUnderlineOffset: 2 }}>regenerate</button>
        </div>
        <div style={{ flex: 1, padding: 12, display: "flex", flexDirection: "column", gap: 8, position: "relative" }}>
          <textarea
            value={message} onChange={e => setMessage(e.target.value)}
            placeholder={staged.length ? "Name this checkpoint…" : "Stage changes first."}
            rows={2}
            style={{
              width: "100%", resize: "none", padding: "8px 10px",
              background: "var(--glass-deep)", border: "1px solid var(--edge)",
              borderRadius: 8, color: "var(--fg)",
              fontSize: 13, lineHeight: 1.5, outline: "none",
              fontFamily: "var(--sans)", fontWeight: 500,
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button disabled={!ready} style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              height: 32, borderRadius: 8,
              background: ready ? "linear-gradient(135deg, var(--accent), var(--accent-2))" : "var(--glass-deep)",
              color: ready ? "var(--on-accent)" : "var(--fg-3)",
              fontSize: 12, fontWeight: 600,
              border: ready ? "none" : "1px solid var(--edge)",
              boxShadow: ready ? "0 0 20px -4px var(--accent-glow)" : "none",
              cursor: ready ? "pointer" : "not-allowed",
            }}>
              <Icons.GitCommit size={12}/>
              <span>Create checkpoint · {staged.length} file{staged.length === 1 ? "" : "s"}</span>
              {(add || del) ? (
                <span style={{ opacity: 0.8, fontFamily: "var(--mono)", fontSize: 10.5 }}>+{add} −{del}</span>
              ) : null}
            </button>
            <button style={{
              width: 32, height: 32, borderRadius: 8,
              background: "var(--glass-deep)", border: "1px solid var(--edge)",
              color: "var(--fg-2)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}><Icons.Undo size={12}/></button>
          </div>
        </div>
      </div>
    </div>
  );
}

function V4ChangeRow({ change, onStage, onReview }) {
  const [hover, setHover] = useS4(false);
  const sc = { M: "var(--warn)", A: "var(--add)", D: "var(--del)", R: "var(--accent)" }[change.status];
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onClick={() => onReview(change.id)} style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "5px 8px", borderRadius: 7, cursor: "pointer",
        background: hover ? "var(--hover)" : "transparent",
      }}>
      <span style={{
        fontFamily: "var(--mono)", fontSize: 9.5, fontWeight: 700, color: sc,
        padding: "0 4px", borderRadius: 2,
        background: `color-mix(in oklch, ${sc} 18%, transparent)`,
      }}>{change.status}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: "var(--fg)", fontWeight: 500,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {change.short.replace(/\.md$/, "")}
        </div>
        <div style={{ fontSize: 10.5, color: "var(--fg-3)", marginTop: 1,
          display: "flex", alignItems: "center", gap: 6 }}>
          <Icons.Sparkles size={9} style={{ color: "var(--accent)", opacity: 0.7 }}/>
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{change.summary}</span>
        </div>
      </div>
      <span style={{ color: "var(--add)", fontFamily: "var(--mono)", fontSize: 10.5 }}>{change.additions > 0 ? `+${change.additions}` : ""}</span>
      <span style={{ color: "var(--del)", fontFamily: "var(--mono)", fontSize: 10.5 }}>{change.deletions > 0 ? `−${change.deletions}` : ""}</span>
      <button onClick={(e) => { e.stopPropagation(); onStage(change.id); }} style={{
        width: 22, height: 22, borderRadius: 5,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: change.staged ? "var(--accent)" : "transparent",
        border: change.staged ? "none" : "1px solid var(--edge-strong)",
        color: change.staged ? "var(--on-accent)" : "var(--fg-2)",
        boxShadow: change.staged ? "0 0 10px -2px var(--accent-glow)" : "none",
      }}>{change.staged ? <Icons.Check size={11}/> : <Icons.Plus size={11}/>}</button>
    </div>
  );
}

// ---------------- App root ----------------

function V4App() {
  const [tweaks, setTweaks] = useS4({ ...window.TWEAKS, theme: "dark" });
  const [changes, setChanges] = useS4(window.CHANGES);
  const [activeFile, setActiveFile] = useS4("sc-rationale");
  const [selChange, setSelChange] = useS4("ch-1");
  const [selCp, setSelCp] = useS4("c0");
  const [diffOpen, setDiffOpen] = useS4(false);
  const [tweaksOpen, setTweaksOpen] = useS4(false);

  useE4(() => {
    document.documentElement.setAttribute("data-color-scheme", tweaks.theme === "dark" ? "dark" : "light");
  }, [tweaks.theme]);

  useE4(() => {
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
    <V4Shell>
      <V4TopBar branch={branch} ahead={info.ahead} behind={info.behind}/>
      <div style={{
        height: "calc(100vh - 44px - 168px - 16px)",
        display: "flex", gap: 0,
      }}>
        <V4River
          checkpoints={window.CHECKPOINTS}
          selected={selCp} setSelected={setSelCp}
          changesCount={changes.length}
        />
        <V4Vault activeFile={activeFile} onFileClick={setActiveFile} changes={changes}/>
        <V4Editor doc={window.EDITOR_DOC} changes={changes} onReview={() => openReview(selChange)}/>
      </div>
      <V4Altar
        changes={changes} setChanges={setChanges}
        selectedCp={selCp} checkpoints={window.CHECKPOINTS}
        aiCommit={tweaks.aiCommit} onReview={openReview}
      />
      {diffOpen && selectedChange ? (
        <DiffViewer change={selectedChange} onClose={() => setDiffOpen(false)}/>
      ) : null}
      {tweaksOpen ? <TweaksPanel tweaks={tweaks} setTweaks={setTweaks} onClose={() => setTweaksOpen(false)}/> : null}
    </V4Shell>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<V4App/>);
