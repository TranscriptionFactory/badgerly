import { createHighlighterCoreSync } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import type { HighlighterCore } from "shiki/core";

import langBash from "shiki/dist/langs/bash.mjs";
import langC from "shiki/dist/langs/c.mjs";
import langCpp from "shiki/dist/langs/cpp.mjs";
import langCsharp from "shiki/dist/langs/csharp.mjs";
import langCss from "shiki/dist/langs/css.mjs";
import langDiff from "shiki/dist/langs/diff.mjs";
import langDocker from "shiki/dist/langs/docker.mjs";
import langGo from "shiki/dist/langs/go.mjs";
import langGraphql from "shiki/dist/langs/graphql.mjs";
import langHtml from "shiki/dist/langs/html.mjs";
import langJava from "shiki/dist/langs/java.mjs";
import langJavascript from "shiki/dist/langs/javascript.mjs";
import langJson from "shiki/dist/langs/json.mjs";
import langJsx from "shiki/dist/langs/jsx.mjs";
import langKotlin from "shiki/dist/langs/kotlin.mjs";
import langLua from "shiki/dist/langs/lua.mjs";
import langMarkdown from "shiki/dist/langs/markdown.mjs";
import langPhp from "shiki/dist/langs/php.mjs";
import langPython from "shiki/dist/langs/python.mjs";
import langRuby from "shiki/dist/langs/ruby.mjs";
import langRust from "shiki/dist/langs/rust.mjs";
import langScss from "shiki/dist/langs/scss.mjs";
import langSql from "shiki/dist/langs/sql.mjs";
import langSvelte from "shiki/dist/langs/svelte.mjs";
import langSwift from "shiki/dist/langs/swift.mjs";
import langToml from "shiki/dist/langs/toml.mjs";
import langTsx from "shiki/dist/langs/tsx.mjs";
import langTypescript from "shiki/dist/langs/typescript.mjs";
import langMermaid from "shiki/dist/langs/mermaid.mjs";
import langXml from "shiki/dist/langs/xml.mjs";
import langYaml from "shiki/dist/langs/yaml.mjs";

import themeGithubLight from "shiki/dist/themes/github-light.mjs";
import themeGithubDark from "shiki/dist/themes/github-dark.mjs";

const BUNDLED_LANGS = [
  langBash,
  langC,
  langCpp,
  langCsharp,
  langCss,
  langDiff,
  langDocker,
  langGo,
  langGraphql,
  langHtml,
  langJava,
  langJavascript,
  langJson,
  langJsx,
  langKotlin,
  langLua,
  langMarkdown,
  langMermaid,
  langPhp,
  langPython,
  langRuby,
  langRust,
  langScss,
  langSql,
  langSvelte,
  langSwift,
  langToml,
  langTsx,
  langTypescript,
  langXml,
  langYaml,
];

export const LIGHT_THEME = "github-light";
export const DARK_THEME = "github-dark";

const LANG_ALIASES: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  sh: "bash",
  shell: "bash",
  md: "markdown",
  htm: "html",
  "c++": "cpp",
  "c#": "csharp",
  yml: "yaml",
  "objective-c": "objectivec",
};

let _highlighter: HighlighterCore | null = null;
let _supported_langs: Set<string> | null = null;

function get_highlighter(): HighlighterCore {
  if (!_highlighter) {
    _highlighter = createHighlighterCoreSync({
      engine: createJavaScriptRegexEngine(),
      themes: [themeGithubLight, themeGithubDark],
      langs: BUNDLED_LANGS,
    });
    _supported_langs = new Set(_highlighter.getLoadedLanguages());
  }
  return _highlighter;
}

export function init_highlighter(): void {
  try {
    get_highlighter();
  } catch (error) {
    console.error("Failed to initialize Shiki highlighter:", error);
  }
}

export function get_highlighter_sync(): HighlighterCore | null {
  return _highlighter;
}

export function resolve_language(
  lang: string | null | undefined,
): string | null {
  if (!lang) return null;
  const lower = lang.toLowerCase().trim();
  const resolved = LANG_ALIASES[lower] ?? lower;
  if (!_supported_langs) return null;
  return _supported_langs.has(resolved) ? resolved : null;
}

export function resolve_theme(): string {
  const scheme = document.documentElement.getAttribute("data-color-scheme");
  return scheme === "dark" ? DARK_THEME : LIGHT_THEME;
}
