import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

async function listFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(entryPath)));
      continue;
    }
    files.push(entryPath);
  }

  return files;
}

function formatBytes(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function normalize_href(href) {
  return href.replace(/[?#].*$/, "").replace(/^\//, "");
}

async function read_startup_modulepreloads(root, summaries) {
  const client_root = path.dirname(path.dirname(root));
  const html_candidates = [
    path.join(client_root, "index.html"),
    path.join(client_root, "200.html"),
  ];

  let html = null;
  for (const candidate of html_candidates) {
    try {
      html = await readFile(candidate, "utf8");
      break;
    } catch {
      continue;
    }
  }

  if (html === null) {
    return {
      count: 0,
      total_bytes: 0,
      total_size: formatBytes(0),
      entries: [],
    };
  }

  const summary_by_file = new Map(
    summaries.map((entry) => [path.normalize(entry.file), entry]),
  );
  const entries = [];
  const seen = new Set();

  for (const tag of html.match(/<link\b[^>]*>/g) ?? []) {
    if (!/rel="modulepreload"/.test(tag)) {
      continue;
    }

    const href = tag.match(/href="([^"]+)"/)?.[1];
    if (!href) {
      continue;
    }

    const normalized_href = normalize_href(href);
    if (seen.has(normalized_href)) {
      continue;
    }
    seen.add(normalized_href);

    const file = path.join(client_root, normalized_href);
    const summary = summary_by_file.get(path.normalize(file));
    if (!summary) {
      continue;
    }

    entries.push({
      file: normalized_href,
      bytes: summary.bytes,
      size: formatBytes(summary.bytes),
    });
  }

  const total_bytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);

  return {
    count: entries.length,
    total_bytes,
    total_size: formatBytes(total_bytes),
    entries: [...entries].sort((a, b) => b.bytes - a.bytes),
  };
}

async function main() {
  const candidateRoots = [
    "build/_app/immutable",
    ".svelte-kit/output/client/_app/immutable",
  ];

  let root = null;
  for (const candidate of candidateRoots) {
    try {
      await stat(candidate);
      root = candidate;
      break;
    } catch {
      continue;
    }
  }

  if (!root) {
    throw new Error(
      "No immutable client output found. Run `pnpm build` first.",
    );
  }

  const files = await listFiles(root);
  const summaries = await Promise.all(
    files.map(async (file) => ({
      file,
      bytes: (await stat(file)).size,
    })),
  );

  const clientFiles = summaries.filter((entry) =>
    /\.(js|css|mjs)$/.test(entry.file),
  );
  const totalBytes = clientFiles.reduce((sum, entry) => sum + entry.bytes, 0);
  const startup_modulepreloads = await read_startup_modulepreloads(
    root,
    clientFiles,
  );
  const largest = [...clientFiles]
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 10)
    .map((entry) => ({
      file: path.relative(root, entry.file),
      bytes: entry.bytes,
      size: formatBytes(entry.bytes),
    }));

  console.log(
    JSON.stringify(
      {
        root,
        file_count: clientFiles.length,
        total_bytes: totalBytes,
        total_size: formatBytes(totalBytes),
        startup_modulepreloads: {
          count: startup_modulepreloads.count,
          total_bytes: startup_modulepreloads.total_bytes,
          total_size: startup_modulepreloads.total_size,
          largest: startup_modulepreloads.entries.slice(0, 10),
        },
        largest,
      },
      null,
      2,
    ),
  );
}

void main();
