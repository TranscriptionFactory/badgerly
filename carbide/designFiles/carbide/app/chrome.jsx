// Carbide app chrome: title bar, activity bar, sidebar (file tree), tab bar, status bar.
const { useState } = React;

function TitleBar({ branch, aheadBehind, onBranchClick }) {
  return (
    <div style={{
      height: 30, display: "flex", alignItems: "center",
      background: "var(--background-surface-2)",
      borderBottom: "1px solid var(--sidebar-border)",
      paddingLeft: 74, paddingRight: 10,
      fontSize: 12, color: "var(--muted-foreground)",
      userSelect: "none",
      WebkitAppRegion: "drag"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ fontWeight: 500, color: "var(--foreground)" }}>research-vault</div>
        <span style={{ opacity: 0.5 }}>/</span>
        <span>Design</span>
        <span style={{ opacity: 0.5 }}>/</span>
        <span style={{ color: "var(--foreground)" }}>Source Control Rationale.md</span>
      </div>
      <div style={{ flex: 1 }} />
      <button onClick={onBranchClick} title="Switch branch"
        style={{ WebkitAppRegion: "no-drag", display: "flex", alignItems: "center", gap: 5,
          padding: "3px 9px", borderRadius: 6, color: "var(--foreground)",
          background: "var(--background)", border: "1px solid var(--border)" }}>
        <Icons.Branch size={12} />
        <span style={{ fontSize: 11, fontWeight: 500 }}>{branch}</span>
        <span style={{ fontSize: 10, color: "var(--muted-foreground)", fontFamily: "var(--font-family-mono)" }}>
          ↑{aheadBehind.ahead} ↓{aheadBehind.behind}
        </span>
      </button>
    </div>
  );
}

function ActivityBar({ active, onSelect, unsavedCount }) {
  const items = [
    { id: "files",  icon: Icons.Files,  label: "Files" },
    { id: "search", icon: Icons.Search, label: "Search" },
    { id: "sc",     icon: Icons.Branch, label: "Source Control", badge: unsavedCount },
    { id: "graph",  icon: Icons.Graph,  label: "Graph" },
    { id: "tasks",  icon: Icons.Tasks,  label: "Tasks" },
    { id: "tags",   icon: Icons.Tag,    label: "Tags" },
  ];
  return (
    <div style={{
      width: 44, flexShrink: 0, display: "flex", flexDirection: "column",
      alignItems: "center", paddingTop: 6, paddingBottom: 6,
      background: "var(--sidebar)",
      borderRight: "1px solid var(--sidebar-border)",
    }}>
      {items.map(it => {
        const isActive = active === it.id;
        return (
          <button key={it.id} onClick={() => onSelect(it.id)} title={it.label}
            style={{
              width: 44, height: 38, display: "flex", alignItems: "center", justifyContent: "center",
              position: "relative", color: isActive ? "var(--foreground)" : "var(--muted-foreground)",
            }}>
            <span style={{
              position: "absolute", left: 0, top: 8, bottom: 8, width: 2, borderRadius: 1,
              background: isActive ? "var(--teal-500)" : "transparent",
            }} />
            <it.icon size={18} />
            {it.badge ? (
              <span style={{
                position: "absolute", top: 6, right: 8,
                background: "var(--indicator-dirty)", color: "white",
                borderRadius: 999, padding: "0 4px", fontSize: 9, fontWeight: 600,
                minWidth: 14, height: 14, display: "inline-flex",
                alignItems: "center", justifyContent: "center",
                fontFamily: "var(--font-family-mono)",
              }}>{it.badge}</span>
            ) : null}
          </button>
        );
      })}
      <div style={{ flex: 1 }} />
      <button title="Settings" style={{
        width: 44, height: 38, display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--muted-foreground)",
      }}>
        <Icons.Settings size={18} />
      </button>
    </div>
  );
}

function FileTreeRow({ node, depth = 0, activeId, onFileClick, toggleFolder }) {
  const indent = 10 + depth * 14;
  if (node.type === "folder") {
    return (
      <div>
        <div onClick={() => toggleFolder(node.name)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            height: 26, paddingLeft: indent, paddingRight: 8,
            color: "var(--foreground)", cursor: "pointer",
            fontSize: 13,
          }}
          onMouseEnter={e => e.currentTarget.style.background = "var(--sidebar-accent)"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
          <span style={{ color: "var(--muted-foreground)", display: "flex" }}>
            {node.open ? <Icons.ChevronD size={12} /> : <Icons.ChevronR size={12} />}
          </span>
          {node.open ? <Icons.FolderOpen size={14} /> : <Icons.Folder size={14} />}
          <span style={{ fontWeight: 500 }}>{node.name}</span>
        </div>
        {node.open && node.children.map(c => (
          <FileTreeRow key={c.id || c.name} node={c} depth={depth + 1}
            activeId={activeId} onFileClick={onFileClick} toggleFolder={toggleFolder} />
        ))}
      </div>
    );
  }
  const isActive = activeId === node.id;
  const statusColor = {
    M: "var(--indicator-dirty)",
    A: "var(--teal-500)",
    D: "var(--diff-del-gutter)",
  }[node.status];
  return (
    <div onClick={() => onFileClick(node.id)}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        height: 26, paddingLeft: indent + 16, paddingRight: 8,
        color: "var(--foreground)", cursor: "pointer",
        fontSize: 13,
        background: isActive ? "var(--interactive-bg)" : "transparent",
        borderLeft: isActive ? "2px solid var(--teal-500)" : "2px solid transparent",
        marginLeft: isActive ? -2 : 0,
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "var(--sidebar-accent)"; }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
      <Icons.File size={13} style={{ color: "var(--muted-foreground)" }} />
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {node.name}
      </span>
      {node.status ? (
        <span style={{
          color: statusColor, fontFamily: "var(--font-family-mono)",
          fontSize: 11, fontWeight: 600,
        }}>{node.status}</span>
      ) : null}
    </div>
  );
}

function Sidebar({ tree, activeId, onFileClick }) {
  const [openMap, setOpenMap] = useState(
    Object.fromEntries(tree.filter(n => n.type === "folder").map(n => [n.name, n.open]))
  );
  const toggleFolder = (name) => setOpenMap(m => ({ ...m, [name]: !m[name] }));
  return (
    <div style={{
      width: 248, flexShrink: 0, background: "var(--sidebar)",
      borderRight: "1px solid var(--sidebar-border)",
      display: "flex", flexDirection: "column",
    }}>
      <div style={{
        padding: "10px 14px 8px", display: "flex", alignItems: "center",
        justifyContent: "space-between", borderBottom: "1px solid var(--sidebar-border)",
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em",
          textTransform: "uppercase", color: "var(--muted-foreground)" }}>
          Vault
        </div>
        <div style={{ display: "flex", gap: 4, color: "var(--muted-foreground)" }}>
          <button style={{ padding: 3 }}><Icons.Plus size={13}/></button>
          <button style={{ padding: 3 }}><Icons.More size={13}/></button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto", paddingTop: 4, paddingBottom: 8 }}>
        {tree.map(n => {
          const node = n.type === "folder" ? { ...n, open: openMap[n.name] } : n;
          return <FileTreeRow key={n.id || n.name} node={node}
            activeId={activeId} onFileClick={onFileClick} toggleFolder={toggleFolder} />;
        })}
      </div>
    </div>
  );
}

function TabBar() {
  const tabs = [
    { id: "sc-rationale", name: "Source Control Rationale.md", dirty: true, active: true },
    { id: "theme-inv",    name: "Theme Inventory.md",           dirty: true, active: false },
    { id: "atomic",       name: "Atomic Writes.md",             dirty: false, active: false },
  ];
  return (
    <div style={{
      height: 34, display: "flex", alignItems: "stretch",
      background: "var(--background-surface-2)",
      borderBottom: "1px solid var(--border)",
    }}>
      {tabs.map(t => (
        <div key={t.id} style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "0 12px", cursor: "pointer",
          background: t.active ? "var(--background)" : "transparent",
          borderRight: "1px solid var(--border)",
          borderTop: t.active ? "2px solid var(--teal-500)" : "2px solid transparent",
          marginTop: t.active ? -1 : 0,
          color: t.active ? "var(--foreground)" : "var(--muted-foreground)",
          fontSize: 12,
        }}>
          <Icons.File size={12} />
          <span>{t.name}</span>
          {t.dirty ? (
            <span style={{ width: 6, height: 6, borderRadius: 999,
              background: "var(--indicator-dirty)" }} />
          ) : (
            <Icons.X size={11} style={{ opacity: 0.6 }} />
          )}
        </div>
      ))}
      <div style={{ flex: 1 }} />
    </div>
  );
}

function StatusBar({ branch, aheadBehind, unsavedCount, lastCheckpoint, aiCommit }) {
  return (
    <div style={{
      height: 26, display: "flex", alignItems: "center",
      background: "var(--teal-700)", color: "oklch(0.98 0.02 155)",
      paddingLeft: 8, paddingRight: 8, fontSize: 11,
      fontFamily: "var(--font-family-mono)", gap: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 10px", borderRight: "1px solid oklch(0.98 0.02 155 / 0.15)" }}>
        <Icons.Branch size={11} />
        <span>{branch}</span>
        <span style={{ opacity: 0.75 }}>↑{aheadBehind.ahead} ↓{aheadBehind.behind}</span>
      </div>
      <div style={{ padding: "0 10px", borderRight: "1px solid oklch(0.98 0.02 155 / 0.15)" }}>
        {unsavedCount} unsaved
      </div>
      <div style={{ padding: "0 10px", borderRight: "1px solid oklch(0.98 0.02 155 / 0.15)", opacity: 0.85 }}>
        last checkpoint {lastCheckpoint}
      </div>
      <div style={{ padding: "0 10px", opacity: 0.85 }}>
        {aiCommit ? "ai-commit on" : "ai-commit off"}
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ padding: "0 10px", opacity: 0.85 }}>markdown · utf-8</div>
      <div style={{ padding: "0 10px", display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: "oklch(0.85 0.15 155)" }} />
        embeddings synced
      </div>
    </div>
  );
}

Object.assign(window, { TitleBar, ActivityBar, Sidebar, TabBar, StatusBar });
