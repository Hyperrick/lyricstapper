import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const MAX_LINES = 800;
const SOURCE_EXTENSIONS = new Set([".cjs", ".css", ".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const sourceRoots = ["app", "tests", "worker"];
const rootSourceFiles = ["eslint.config.mjs", "next.config.ts", "vite.config.ts"];

async function collectSourceFiles(relativeDirectory) {
  const directory = path.join(repositoryRoot, relativeDirectory);
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(relativePath);
    return SOURCE_EXTENSIONS.has(path.extname(entry.name)) ? [relativePath] : [];
  }));
  return files.flat();
}

function countLines(content) {
  if (!content) return 0;
  return content.split(/\r?\n/).length - (content.endsWith("\n") ? 1 : 0);
}

test("source files stay within the 800 line limit", async () => {
  const nestedFiles = (await Promise.all(sourceRoots.map(collectSourceFiles))).flat();
  const sourceFiles = [...rootSourceFiles, ...nestedFiles].sort();
  const oversizedFiles = [];

  for (const relativePath of sourceFiles) {
    const content = await readFile(path.join(repositoryRoot, relativePath), "utf8");
    const lineCount = countLines(content);
    if (lineCount > MAX_LINES) oversizedFiles.push(`${relativePath}: ${lineCount} lines`);
  }

  assert.deepEqual(oversizedFiles, [], `Split files that exceed ${MAX_LINES} lines:\n${oversizedFiles.join("\n")}`);
});
