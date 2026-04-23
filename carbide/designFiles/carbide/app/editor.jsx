// Center column — the WYSIWYG editor with a change rail in the gutter.

function ChangeRail({ state }) {
  // Shows a colored marker per paragraph on the left of the editor content.
  const map = {
    added:    { bg: "var(--diff-add-gutter)", label: "added" },
    modified: { bg: "var(--warning)", label: "modified" },
    deleted:  { bg: "var(--diff-del-gutter)", label: "deleted" },
    clean:    null,
  };
  const m = map[state];
  if (!m) return <div style={{ width: 3, alignSelf: "stretch" }} />;
  return (
    <div title={m.label} style={{
      width: 3, alignSelf: "stretch", background: m.bg, borderRadius: 2,
      marginTop: 4, marginBottom: 4,
    }} />
  );
}

function Block({ block, children, state }) {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "stretch" }}>
      <ChangeRail state={state || block.state} />
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

function WikiLinks({ text }) {
  // Render [[wikilinks]] in spruce green.
  const parts = text.split(/(\[\[[^\]]+\]\])/g);
  return <>{parts.map((p, i) => {
    if (p.startsWith("[[") && p.endsWith("]]")) {
      return <span key={i} style={{ color: "var(--teal-600)", borderBottom: "1px dotted var(--teal-400)" }}>
        {p.slice(2, -2)}
      </span>;
    }
    return <span key={i}>{p}</span>;
  })}</>;
}

function EditorView({ doc, density }) {
  const pad = density === "compact" ? "20px 40px" : "40px 72px";
  const blockGap = density === "compact" ? 10 : 16;
  return (
    <div style={{
      flex: 1, minWidth: 0, overflow: "auto",
      background: "var(--background)",
      fontFamily: "var(--font-family-sans)", color: "var(--foreground)",
    }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: pad }}>
        {doc.map((b, i) => {
          const key = i;
          if (b.type === "h1") return (
            <div key={key} style={{ marginBottom: 6 }}>
              <Block block={b}>
                <h1 style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>{b.text}</h1>
              </Block>
            </div>
          );
          if (b.type === "meta") return (
            <div key={key} style={{ marginBottom: 28 }}>
              <Block block={b}>
                <div style={{ color: "var(--muted-foreground)", fontSize: 12 }}>
                  <WikiLinks text={b.text} />
                </div>
              </Block>
            </div>
          );
          if (b.type === "h2") return (
            <div key={key} style={{ marginTop: 24, marginBottom: 10 }}>
              <Block block={b}>
                <h2 style={{ fontSize: 17, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>{b.text}</h2>
              </Block>
            </div>
          );
          if (b.type === "p") return (
            <div key={key} style={{ marginBottom: blockGap }}>
              <Block block={b}>
                <p style={{ margin: 0, lineHeight: 1.65, fontSize: 14 }}>
                  <WikiLinks text={b.text} />
                </p>
              </Block>
            </div>
          );
          if (b.type === "quote") return (
            <div key={key} style={{ marginBottom: blockGap }}>
              <Block block={b}>
                <blockquote style={{
                  margin: 0, padding: "8px 16px",
                  borderLeft: "3px solid var(--teal-400)",
                  background: "var(--teal-50)",
                  fontStyle: "italic", color: "var(--teal-700)",
                  lineHeight: 1.55, fontSize: 14, borderRadius: "0 6px 6px 0",
                }}>{b.text}</blockquote>
              </Block>
            </div>
          );
          if (b.type === "ul") return (
            <div key={key} style={{ marginBottom: blockGap }}>
              <Block block={b}>
                <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                  {b.items.map((it, j) => {
                    const itemColor = {
                      added:    { ink: "var(--foreground)", mark: "var(--diff-add-gutter)", deco: "none", bg: "color-mix(in oklch, var(--diff-add-bg) 45%, transparent)" },
                      modified: { ink: "var(--foreground)", mark: "var(--warning)", deco: "none", bg: "transparent" },
                      deleted:  { ink: "var(--muted-foreground)", mark: "var(--diff-del-gutter)", deco: "line-through", bg: "color-mix(in oklch, var(--diff-del-bg) 30%, transparent)" },
                      clean:    { ink: "var(--foreground)", mark: "var(--muted-foreground)", deco: "none", bg: "transparent" },
                    }[it.state || "clean"];
                    return (
                      <li key={j} style={{
                        display: "flex", alignItems: "flex-start", gap: 10,
                        padding: "3px 6px", borderRadius: 4,
                        background: itemColor.bg,
                        color: itemColor.ink, textDecoration: itemColor.deco,
                        lineHeight: 1.55, fontSize: 14,
                      }}>
                        <span style={{
                          width: 5, height: 5, borderRadius: 999, marginTop: 9,
                          background: itemColor.mark, flexShrink: 0,
                        }} />
                        <span>{it.text}</span>
                      </li>
                    );
                  })}
                </ul>
              </Block>
            </div>
          );
          return null;
        })}
        <div style={{ height: 200 }} />
      </div>
    </div>
  );
}

window.EditorView = EditorView;
