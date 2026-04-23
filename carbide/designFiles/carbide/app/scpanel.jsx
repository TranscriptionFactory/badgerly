// The Source Control panel — right side.
// Sections: Summary stat strip, Staged, Unstaged, Commit composer, History.
const { useState: useStateSC, useMemo: useMemoSC } = React;

function StatusBadge({ kind }) {
  const map = {
    M: { bg: "var(--warning-bg)", fg: "var(--warning-text-on-bg)", label: "M" },
    A: { bg: "var(--diff-add-bg)", fg: "var(--diff-add-fg)", label: "A" },
    D: { bg: "var(--diff-del-bg)", fg: "var(--diff-del-fg)", label: "D" },
    R: { bg: "var(--interactive-bg)", fg: "var(--teal-700)", label: "R" },
  };
  const s = map[kind] || map.M;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 18, height: 18, borderRadius: 4,
      background: s.bg, color: s.fg,
      fontFamily: "var(--font-family-mono)", fontSize: 11, fontWeight: 700,
    }}>{s.label}</span>
  );
}

function ChangeRow({ change, expanded, selected, onToggle, onStageToggle, onSelect, onExpand }) {
  return (
    <div>
      <div onClick={() => onSelect(change.id)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "5px 10px 5px 8px", cursor: "pointer",
          borderLeft: selected ? "2px solid var(--teal-500)" : "2px solid transparent",
          background: selected ? "var(--interactive-bg)" : "transparent",
        }}
        onMouseEnter={e => { if (!selected) e.currentTarget.style.background = "var(--sidebar-accent)"; }}
        onMouseLeave={e => { if (!selected) e.currentTarget.style.background = "transparent"; }}>
        <button onClick={(e) => { e.stopPropagation(); onExpand(change.id); }}
          style={{ color: "var(--muted-foreground)", display: "flex", padding: 0 }}>
          {expanded ? <Icons.ChevronD size={12}/> : <Icons.ChevronR size={12}/>}
        </button>
        <StatusBadge kind={change.status} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--foreground)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {change.short}
          </div>
          {change.folder ? (
            <div style={{ fontSize: 10.5, color: "var(--muted-foreground)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {change.folder}
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 6, fontFamily: "var(--font-family-mono)", fontSize: 10.5 }}>
          {change.additions > 0 ? <span style={{ color: "var(--diff-add-fg)" }}>+{change.additions}</span> : null}
          {change.deletions > 0 ? <span style={{ color: "var(--diff-del-fg)" }}>−{change.deletions}</span> : null}
        </div>
        <button onClick={(e) => { e.stopPropagation(); onStageToggle(change.id); }}
          title={change.staged ? "Unstage" : "Stage"}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 22, height: 22, borderRadius: 4,
            background: change.staged ? "var(--teal-500)" : "transparent",
            color: change.staged ? "white" : "var(--muted-foreground)",
            border: change.staged ? "none" : "1px solid var(--border)",
          }}>
          {change.staged ? <Icons.Check size={12} /> : <Icons.Plus size={12} />}
        </button>
      </div>
      {expanded ? (
        <div style={{
          padding: "6px 10px 10px 34px", fontSize: 11.5,
          color: "var(--muted-foreground)", lineHeight: 1.55,
        }}>
          {change.summary}
        </div>
      ) : null}
    </div>
  );
}

function SectionHeader({ label, count, rightSlot, onToggle, open }) {
  return (
    <div onClick={onToggle} style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "8px 10px 6px", cursor: "pointer",
      color: "var(--muted-foreground)",
      fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em",
      textTransform: "uppercase",
    }}>
      <span style={{ display: "flex" }}>
        {open ? <Icons.ChevronD size={12}/> : <Icons.ChevronR size={12}/>}
      </span>
      <span>{label}</span>
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        minWidth: 18, height: 16, padding: "0 5px", borderRadius: 999,
        background: "var(--background-surface-3)",
        color: "var(--muted-foreground)", fontSize: 10,
        fontFamily: "var(--font-family-mono)",
      }}>{count}</span>
      <div style={{ flex: 1 }} />
      <div onClick={e => e.stopPropagation()} style={{ display: "flex", gap: 2 }}>
        {rightSlot}
      </div>
    </div>
  );
}

function CommitComposer({ staged, aiCommit, onCommit }) {
  const aiSuggestion = "Frame Source Control around checkpoints; drop legacy commit modal";
  const [message, setMessage] = useStateSC(aiCommit ? aiSuggestion : "");
  const stagedFiles = staged.length;
  const add = staged.reduce((a, c) => a + c.additions, 0);
  const del = staged.reduce((a, c) => a + c.deletions, 0);
  return (
    <div style={{
      padding: 10, borderTop: "1px solid var(--border)",
      background: "var(--background-surface-2)",
    }}>
      {aiCommit ? (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          fontSize: 10.5, color: "var(--teal-700)", marginBottom: 8,
          textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600,
        }}>
          <Icons.Sparkles size={11} />
          <span>AI checkpoint title</span>
          <div style={{ flex: 1 }} />
          <button style={{ fontSize: 10.5, color: "var(--muted-foreground)", textTransform: "none", letterSpacing: 0, fontWeight: 500 }}
            onClick={() => setMessage(aiSuggestion)}>regenerate</button>
        </div>
      ) : null}
      <textarea
        value={message}
        onChange={e => setMessage(e.target.value)}
        placeholder={stagedFiles ? "Name this checkpoint…" : "Stage changes to create a checkpoint"}
        rows={3}
        style={{
          width: "100%", resize: "none", padding: "8px 10px",
          background: "var(--background)", border: "1px solid var(--border)",
          borderRadius: 6, color: "var(--foreground)",
          fontSize: 12.5, lineHeight: 1.55,
          outline: "none",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
        <button
          disabled={!stagedFiles || !message.trim()}
          onClick={() => onCommit(message)}
          style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            height: 30, borderRadius: 6,
            background: stagedFiles && message.trim() ? "var(--teal-500)" : "var(--secondary)",
            color: stagedFiles && message.trim() ? "white" : "var(--muted-foreground)",
            fontSize: 12, fontWeight: 500,
            cursor: stagedFiles && message.trim() ? "pointer" : "not-allowed",
          }}>
          <Icons.GitCommit size={13}/>
          <span>Checkpoint {stagedFiles} file{stagedFiles === 1 ? "" : "s"}</span>
          {(add || del) ? (
            <span style={{ opacity: 0.85, fontFamily: "var(--font-family-mono)", fontSize: 10.5 }}>
              +{add} −{del}
            </span>
          ) : null}
        </button>
        <button title="Amend previous checkpoint"
          style={{
            width: 30, height: 30, borderRadius: 6,
            background: "var(--background)", border: "1px solid var(--border)",
            color: "var(--muted-foreground)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
          <Icons.Undo size={13}/>
        </button>
      </div>
    </div>
  );
}

function HistoryRow({ cp, selected, onSelect }) {
  return (
    <div onClick={() => onSelect(cp.id)}
      style={{
        position: "relative", padding: "8px 12px 8px 34px", cursor: "pointer",
        borderLeft: selected ? "2px solid var(--teal-500)" : "2px solid transparent",
        background: selected ? "var(--interactive-bg)" : "transparent",
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = "var(--sidebar-accent)"; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = "transparent"; }}>
      <span style={{
        position: "absolute", left: 18, top: 14, width: 8, height: 8, borderRadius: 999,
        background: "var(--teal-500)", boxShadow: "0 0 0 2px var(--background)",
      }} />
      <span style={{
        position: "absolute", left: 21, top: 22, bottom: -2, width: 2,
        background: "var(--border)",
      }} />
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--foreground)",
          flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {cp.title}
        </span>
        {cp.ai ? <Icons.Sparkles size={11} style={{ color: "var(--teal-500)" }} /> : null}
      </div>
      <div style={{
        display: "flex", gap: 8, alignItems: "center",
        marginTop: 3, fontSize: 10.5, color: "var(--muted-foreground)",
        fontFamily: "var(--font-family-mono)",
      }}>
        <span>{cp.hash}</span>
        <span>·</span>
        <span>{cp.time}</span>
        <span>·</span>
        <span>{cp.changes} file{cp.changes === 1 ? "" : "s"}</span>
        <span style={{ color: "var(--diff-add-fg)" }}>+{cp.add}</span>
        <span style={{ color: "var(--diff-del-fg)" }}>−{cp.del}</span>
      </div>
    </div>
  );
}

function SourceControlPanel({
  changes, setChanges, selectedChangeId, setSelectedChangeId,
  checkpoints, selectedCp, setSelectedCp, aiCommit,
  branch, aheadBehind, onPush, onPull,
}) {
  const [stagedOpen, setStagedOpen] = useStateSC(true);
  const [unstagedOpen, setUnstagedOpen] = useStateSC(true);
  const [historyOpen, setHistoryOpen] = useStateSC(true);
  const [expanded, setExpanded] = useStateSC({});
  const staged = changes.filter(c => c.staged);
  const unstaged = changes.filter(c => !c.staged);

  const stageToggle = (id) => setChanges(cs => cs.map(c => c.id === id ? { ...c, staged: !c.staged } : c));
  const stageAll = () => setChanges(cs => cs.map(c => ({ ...c, staged: true })));
  const unstageAll = () => setChanges(cs => cs.map(c => ({ ...c, staged: false })));
  const toggleExpand = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  // Group history by day
  const grouped = useMemoSC(() => {
    const g = [];
    for (const cp of checkpoints) {
      const last = g[g.length - 1];
      if (last && last.day === cp.day) last.items.push(cp);
      else g.push({ day: cp.day, items: [cp] });
    }
    return g;
  }, [checkpoints]);

  return (
    <div style={{
      width: 340, flexShrink: 0, background: "var(--sidebar)",
      borderLeft: "1px solid var(--sidebar-border)",
      display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "10px 12px 8px", display: "flex", alignItems: "center",
        gap: 6, borderBottom: "1px solid var(--sidebar-border)",
      }}>
        <Icons.Branch size={14} style={{ color: "var(--teal-500)" }} />
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
          Source Control
        </div>
        <div style={{ flex: 1 }} />
        <button title="Pull" onClick={onPull}
          style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 7px",
            borderRadius: 5, background: "var(--background)",
            border: "1px solid var(--border)", fontSize: 11, color: "var(--foreground)" }}>
          <Icons.Download size={11} />
          <span style={{ fontFamily: "var(--font-family-mono)" }}>{aheadBehind.behind}</span>
        </button>
        <button title="Push" onClick={onPush}
          style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 7px",
            borderRadius: 5,
            background: aheadBehind.ahead ? "var(--teal-500)" : "var(--background)",
            border: aheadBehind.ahead ? "1px solid var(--teal-500)" : "1px solid var(--border)",
            color: aheadBehind.ahead ? "white" : "var(--foreground)",
            fontSize: 11 }}>
          <Icons.Upload size={11} />
          <span style={{ fontFamily: "var(--font-family-mono)" }}>{aheadBehind.ahead}</span>
        </button>
        <button title="Refresh"
          style={{ padding: 4, borderRadius: 5, color: "var(--muted-foreground)" }}>
          <Icons.Sync size={13} />
        </button>
      </div>

      <div style={{ flex: 1, overflow: "auto" }}>
        {/* Stat strip */}
        <div style={{
          padding: "10px 12px", display: "flex", gap: 10,
          borderBottom: "1px solid var(--border-subtle)",
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: "var(--muted-foreground)",
              textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
              Working tree
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 2 }}>
              <span style={{ fontSize: 20, fontWeight: 600, color: "var(--foreground)",
                fontFamily: "var(--font-family-mono)" }}>{changes.length}</span>
              <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>changed</span>
            </div>
          </div>
          <div style={{ width: 1, background: "var(--border-subtle)" }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: "var(--muted-foreground)",
              textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
              Staged
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 2 }}>
              <span style={{ fontSize: 20, fontWeight: 600, color: "var(--teal-600)",
                fontFamily: "var(--font-family-mono)" }}>{staged.length}</span>
              <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>ready</span>
            </div>
          </div>
        </div>

        {/* Staged */}
        <SectionHeader
          label="Staged" count={staged.length}
          open={stagedOpen} onToggle={() => setStagedOpen(o => !o)}
          rightSlot={
            <button onClick={unstageAll} title="Unstage all"
              style={{ fontSize: 10.5, color: "var(--muted-foreground)", padding: "2px 4px" }}>
              unstage all
            </button>
          }
        />
        {stagedOpen && staged.map(c => (
          <ChangeRow key={c.id} change={c}
            expanded={expanded[c.id]} selected={selectedChangeId === c.id}
            onStageToggle={stageToggle} onExpand={toggleExpand}
            onSelect={(id) => setSelectedChangeId(id)} />
        ))}
        {stagedOpen && staged.length === 0 && (
          <div style={{ padding: "4px 14px 10px", fontSize: 11.5, color: "var(--muted-foreground)" }}>
            Nothing staged yet.
          </div>
        )}

        {/* Unstaged */}
        <SectionHeader
          label="Changes" count={unstaged.length}
          open={unstagedOpen} onToggle={() => setUnstagedOpen(o => !o)}
          rightSlot={
            <button onClick={stageAll} title="Stage all"
              style={{ fontSize: 10.5, color: "var(--muted-foreground)", padding: "2px 4px" }}>
              stage all
            </button>
          }
        />
        {unstagedOpen && unstaged.map(c => (
          <ChangeRow key={c.id} change={c}
            expanded={expanded[c.id]} selected={selectedChangeId === c.id}
            onStageToggle={stageToggle} onExpand={toggleExpand}
            onSelect={(id) => setSelectedChangeId(id)} />
        ))}

        {/* History */}
        <SectionHeader
          label="Checkpoints" count={checkpoints.length}
          open={historyOpen} onToggle={() => setHistoryOpen(o => !o)}
          rightSlot={
            <button title="Open timeline" style={{ color: "var(--muted-foreground)", padding: 4 }}>
              <Icons.Clock size={12} />
            </button>
          }
        />
        {historyOpen && grouped.map(g => (
          <div key={g.day}>
            <div style={{
              padding: "6px 12px 4px 18px", fontSize: 10.5, fontWeight: 600,
              color: "var(--muted-foreground)",
              textTransform: "uppercase", letterSpacing: "0.06em",
            }}>{g.day}</div>
            {g.items.map(cp => (
              <HistoryRow key={cp.id} cp={cp} selected={selectedCp === cp.id} onSelect={setSelectedCp} />
            ))}
          </div>
        ))}
        <div style={{ height: 12 }} />
      </div>

      <CommitComposer staged={staged} aiCommit={aiCommit} onCommit={() => { /* no-op */ }} />
    </div>
  );
}

window.SourceControlPanel = SourceControlPanel;
