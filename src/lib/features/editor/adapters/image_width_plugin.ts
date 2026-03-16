import { $prose } from "@milkdown/kit/utils";
import { imageBlockSchema } from "@milkdown/kit/component/image-block";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";

export const image_block_schema_with_width = imageBlockSchema.extendSchema(
  (prev) => (ctx) => {
    const base = prev(ctx);
    return {
      ...base,
      attrs: {
        ...base.attrs,
        width: { default: "", validate: "string" },
      },
      parseDOM: [
        {
          tag: `img[data-type="image-block"]`,
          getAttrs: (dom) => {
            if (!(dom instanceof HTMLElement)) return false;
            return {
              src: dom.getAttribute("src") ?? "",
              caption: dom.getAttribute("caption") ?? "",
              ratio: Number(dom.getAttribute("ratio") ?? 1),
              width: dom.getAttribute("data-width") ?? "",
            };
          },
        },
      ],
      toDOM: (node) => [
        "img",
        {
          "data-type": "image-block",
          src: String(node.attrs["src"] ?? ""),
          caption: String(node.attrs["caption"] ?? ""),
          ratio: String(node.attrs["ratio"] ?? 1),
          "data-width": String(node.attrs["width"] ?? ""),
        },
      ],
    };
  },
);

function apply_width_to_node_dom(view: EditorView) {
  view.state.doc.descendants((node, pos) => {
    if (node.type.name !== "image-block") return;
    const dom = view.nodeDOM(pos);
    if (!(dom instanceof HTMLElement)) return;
    const wrapper = dom.querySelector<HTMLElement>(".image-wrapper");
    if (!wrapper) return;
    const width =
      typeof node.attrs["width"] === "string" ? node.attrs["width"] : "";
    wrapper.style.width = width || "";
  });
}

const image_width_plugin_key = new PluginKey("image-width");

export const image_width_plugin = $prose(
  () =>
    new Plugin({
      key: image_width_plugin_key,
      view: (view) => {
        apply_width_to_node_dom(view);
        return {
          update: (updated_view) => {
            apply_width_to_node_dom(updated_view);
          },
        };
      },
    }),
);
