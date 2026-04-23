// Main composition.

const { useState, useEffect } = React;

function App() {
  const [tweaks, setTweaks] = useState(window.TWEAKS);
  const [tweaksOpen, setTweaksOpen] = useState(false);

  // Apply theme to the doc root
  useEffect(() => {
    document.documentElement.setAttribute("data-color-scheme", tweaks.theme === "dark" ? "dark" : "light");
  }, [tweaks.theme]);

  // Edit-mode handshake
  useEffect(() => {
    const onMessage = (e) => {
      if (!e.data || typeof e.data !== "object") return;
      if (e.data.type === "__activate_edit_mode") setTweaksOpen(true);
      if (e.data.type === "__deactivate_edit_mode") setTweaksOpen(false);
    };
    window.addEventListener("message", onMessage);
    try { window.parent.postMessage({ type: "__edit_mode_available" }, "*"); } catch {}
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const [changes, setChanges] = useState(window.CHANGES);
  const [checkpoints] = useState(window.CHECKPOINTS);
  const [activeFile, setActiveFile] = useState("sc-rationale");
  const [selectedChangeId, setSelectedChangeId] = useState("ch-1");
  const [selectedCp, setSelectedCp] = useState(null);
  const [diffOpen, setDiffOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [scrubCp, setScrubCp] = useState("c0");

  const branch = "design/sc-panel";
  const branchInfo = window.BRANCHES.find(b => b.name === branch) || { ahead: 7, behind: 1 };
  const unsavedCount = changes.length;
  const staged = changes.filter(c => c.staged);

  const onFileClick = (id) => {
    setActiveFile(id);
    // Map file -> a change if it's dirty, for convenience
    const ch = changes.find(c => c.file.endsWith(id + ".md") || c.short.toLowerCase().includes(id.replace(/-/g, " ")));
    if (ch) setSelectedChangeId(ch.id);
  };

  const onOpenDiff = (id) => {
    setSelectedChangeId(id);
    setDiffOpen(true);
  };

  const selectedChange = changes.find(c => c.id === selectedChangeId);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <TitleBar branch={branch} aheadBehind={branchInfo} onBranchClick={() => {}}/>
      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
        <ActivityBar active="sc" onSelect={() => {}} unsavedCount={unsavedCount}/>
        <Sidebar tree={window.VAULT_TREE} activeId={activeFile} onFileClick={onFileClick}/>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "var(--background)" }}>
          <TabBar/>
          <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
            <EditorView doc={window.EDITOR_DOC} density={tweaks.density}/>
            {/* Floating "Diff" button when a change is selected */}
            {selectedChange ? (
              <button onClick={() => setDiffOpen(true)}
                style={{
                  position: "absolute", top: 14, right: 14,
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 12px", borderRadius: 6,
                  background: "var(--background)", border: "1px solid var(--border)",
                  color: "var(--foreground)", fontSize: 12, fontWeight: 500,
                  boxShadow: "var(--shadow-sm)",
                }}>
                <Icons.GitCommit size={12}/>
                Review changes · {selectedChange.short}
              </button>
            ) : null}
            {timelineOpen ? (
              <Timeline
                checkpoints={checkpoints}
                activeId={scrubCp}
                onSelect={setScrubCp}
                onRestore={() => { setTimelineOpen(false); }}
                onClose={() => setTimelineOpen(false)}
              />
            ) : null}
            {diffOpen && selectedChange ? (
              <DiffViewer change={selectedChange} onClose={() => setDiffOpen(false)} />
            ) : null}
          </div>
        </div>
        <SourceControlPanel
          changes={changes} setChanges={setChanges}
          selectedChangeId={selectedChangeId}
          setSelectedChangeId={(id) => { setSelectedChangeId(id); setDiffOpen(true); }}
          checkpoints={checkpoints}
          selectedCp={selectedCp}
          setSelectedCp={(id) => { setSelectedCp(id); setScrubCp(id); setTimelineOpen(true); }}
          aiCommit={tweaks.aiCommit}
          branch={branch} aheadBehind={branchInfo}
          onPush={() => {}} onPull={() => {}}
        />
      </div>
      <StatusBar
        branch={branch} aheadBehind={branchInfo}
        unsavedCount={unsavedCount}
        lastCheckpoint="22 min ago"
        aiCommit={tweaks.aiCommit}
      />
      {tweaksOpen ? <TweaksPanel tweaks={tweaks} setTweaks={setTweaks} onClose={() => setTweaksOpen(false)} /> : null}
      {/* Floating 'open timeline' hint if closed */}
      {!timelineOpen ? (
        <button onClick={() => setTimelineOpen(true)}
          title="Open timeline"
          style={{
            position: "fixed", left: 48 + 248 + 20, bottom: 34 + 14, zIndex: 30,
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 10px", borderRadius: 999,
            background: "var(--popover)", border: "1px solid var(--border)",
            color: "var(--foreground)", fontSize: 11, fontWeight: 500,
            boxShadow: "var(--shadow-sm)",
          }}>
          <Icons.Clock size={12} style={{ color: "var(--teal-500)" }}/>
          Timeline
        </button>
      ) : null}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
