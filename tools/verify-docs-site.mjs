/* Prove the documentation sources are complete and the site build is exact.
 *
 * The wiki job copies `docs/wiki/*.md` verbatim over the published pages, so an
 * empty or missing source silently deletes a page rather than failing. And a
 * site that renders differently on two runs cannot be transferred as one exact
 * artifact. Both are checked here, in Node, so the same check runs on a
 * developer's machine and in CI without a shell-specific diff.
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = path.join(ROOT, "_site");

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function walk(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await walk(path.join(directory, entry.name), relative));
    else files.push([relative, sha256(await readFile(path.join(directory, entry.name)))]);
  }
  return files;
}

function buildSite() {
  const result = spawnSync(process.execPath, ["tools/build-site.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`documentation site build failed:\n${result.stdout}\n${result.stderr}`);
  }
}

async function requireCompleteSources() {
  const wiki = (await readdir(path.join(ROOT, "docs/wiki"))).filter((name) => name.endsWith(".md"));
  if (wiki.length === 0) throw new Error("docs/wiki contains no Markdown sources");
  for (const relative of ["README.md", "README.de.md", ...wiki.map((name) => `docs/wiki/${name}`)]) {
    const info = await stat(path.join(ROOT, relative)).catch(() => null);
    if (!info || info.size === 0) throw new Error(`empty or missing documentation source: ${relative}`);
  }
  return wiki.length + 2;
}

async function main() {
  const sources = await requireCompleteSources();
  console.log(`PASS ${sources} documentation sources present and non-empty`);

  buildSite();
  const first = await walk(SITE);
  buildSite();
  const second = await walk(SITE);

  if (first.length !== second.length) {
    throw new Error(`site build is not deterministic: ${first.length} then ${second.length} files`);
  }
  for (const [index, [relative, digest]] of first.entries()) {
    const [otherPath, otherDigest] = second[index];
    if (relative !== otherPath || digest !== otherDigest) {
      throw new Error(`site build is not deterministic: ${relative}`);
    }
  }
  console.log(`PASS ${first.length} generated site files are byte-identical across two builds`);
}

main().catch((error) => {
  console.error(`documentation verification failed: ${error.message}`);
  process.exitCode = 1;
});
