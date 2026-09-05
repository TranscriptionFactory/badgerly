import type { Node as ProseNode } from "prosemirror-model";
import { schema } from "./schema";
import { EditorState } from "prosemirror-state";
import { parse_to_mdast } from "./markdown_pipeline";
import { mdast_to_pm } from "./mdast_to_pm";
import {
  create_wiki_link_converter_prose_plugin,
  wiki_link_plugin_key,
} from "./wiki_link_plugin";
import { matches_block, type BlockAnchor } from "../domain/ambient_anchor";

export function create_ambient_section_anchor_resolver(
  markdown: string,
): (start_line: number, end_line: number) => BlockAnchor | null {
  const source_blocks = new Map<number, ProseNode>();
  const raw_doc = mdast_to_pm(
    parse_to_mdast(markdown),
    markdown,
    source_blocks,
  );
  const positions = new Map<ProseNode, number>();
  raw_doc.descendants((node, pos) => {
    positions.set(node, pos);
  });
  const state = EditorState.create({
    doc: raw_doc,
    plugins: [
      create_wiki_link_converter_prose_plugin({
        link_type: schema.marks.link,
      }),
    ],
  });
  const normalized = state.applyTransaction(
    state.tr.setMeta(wiki_link_plugin_key, { action: "full_scan" }),
  );
  const doc = normalized.state.doc;

  return (start_line, end_line) => {
    const source = [...source_blocks.entries()]
      .filter(
        ([line, node]) =>
          line >= start_line && line <= end_line && node.textContent.length > 0,
      )
      .sort(([a], [b]) => a - b)[0]?.[1];
    if (!source) return null;
    let pos = positions.get(source);
    if (pos === undefined) return null;
    for (const tr of normalized.transactions) pos = tr.mapping.map(pos);
    const block = doc.nodeAt(pos);
    if (!block?.isTextblock) return null;
    const anchor: BlockAnchor = {
      kind: "block",
      node_type: block.type.name,
      level:
        block.type.name === "heading" ? (block.attrs.level as number) : null,
      match: block.textContent,
      occurrence: 0,
    };
    doc.descendants((node, block_pos) => {
      if (block_pos < pos && matches_block(node, anchor))
        anchor.occurrence += 1;
    });
    return anchor;
  };
}
