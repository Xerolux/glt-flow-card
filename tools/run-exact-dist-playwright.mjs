import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const distPath = resolve(projectRoot, "dist/glt-flow-card.js");
const companionPath = resolve(projectRoot, "custom_components/glt_flow_card/www/glt-flow-card.js");
const manifestPath = resolve(projectRoot, "custom_components/glt_flow_card/build-manifest.json");
const cliPath = resolve(projectRoot, "node_modules/@playwright/test/cli.js");

function parseArgs(argv) {
  const result = {
    evidence: resolve(projectRoot, ".planning/tmp/exact-dist-results.json"),
    grep: null,
  };
  for (const arg of argv) {
    if (arg.startsWith("--grep=")) {
      result.grep = arg.slice("--grep=".length);
      continue;
    }
    if (arg.startsWith("--evidence=")) {
      result.evidence = resolve(projectRoot, arg.slice("--evidence=".length));
      continue;
    }
    throw new Error(`Unknown exact-dist argument: ${arg}`);
  }
  return result;
}

function run(command, args, options) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { ...options, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => resolveRun(signal ? 1 : (code ?? 1)));
  });
}

const options = parseArgs(process.argv.slice(2));
const dist = await readFile(distPath);
const companion = await readFile(companionPath);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const distSha256 = createHash("sha256").update(dist).digest("hex");
const distDescriptor = manifest.artifacts?.find((entry) => entry.path === "dist/glt-flow-card.js");
const companionDescriptor = manifest.artifacts?.find((entry) => entry.path === "custom_components/glt_flow_card/www/glt-flow-card.js");
if (!dist.equals(companion)) throw new Error("exact-dist gate: dist and Companion www bytes differ");
if (distDescriptor?.sha256 !== distSha256 || distDescriptor?.size !== dist.length) {
  throw new Error("exact-dist gate: build manifest does not identify dist bytes");
}
if (companionDescriptor?.sha256 !== distSha256 || companionDescriptor?.size !== companion.length) {
  throw new Error("exact-dist gate: build manifest does not identify Companion www bytes");
}
const exactDistEvidence = {
  dist_sha256: distSha256,
  dist_www_equal: true,
  manifest_matches_dist: true,
};
const requests = [];
const html = Buffer.from(`<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>GLT exact-dist harness</title></head>
  <body><main aria-label="GLT exact-dist test surface"></main>
  <script>window.__exactDistEvidence = ${JSON.stringify(exactDistEvidence)};</script>
  <script src="/dist/glt-flow-card.js"></script>
  <script>window.__exactDistReady = true;</script></body>
</html>`);

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  requests.push({ method: request.method, path: url.pathname });
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405).end();
    return;
  }
  if (url.pathname === "/") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(request.method === "HEAD" ? undefined : html);
    return;
  }
  if (url.pathname === "/dist/glt-flow-card.js") {
    response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
    response.end(request.method === "HEAD" ? undefined : dist);
    return;
  }
  if (url.pathname === "/favicon.ico") {
    response.writeHead(204).end();
    return;
  }
  response.writeHead(404).end();
});

await new Promise((resolveListen, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolveListen);
});

try {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Exact-dist server did not bind a TCP port");
  const baseUrl = `http://127.0.0.1:${address.port}/`;
  const specs = [
    "test/e2e/project-safety.spec.mjs",
    "test/e2e/project-authority.spec.mjs",
    "test/e2e/project-semantics.spec.mjs",
    "test/e2e/ledger-seed.spec.mjs",
    "test/e2e/project-operations.spec.mjs",
    "test/e2e/project-cad.spec.mjs",
    "test/e2e/project-alarms.spec.mjs",
  ];
  const args = [cliPath, "test", ...specs, "--config=playwright.config.mjs"];
  if (options.grep) args.push(`--grep=${options.grep}`);
  const exitCode = await run(process.execPath, args, {
    cwd: projectRoot,
    env: { ...process.env, EXACT_DIST_BASE_URL: baseUrl },
  });
  await mkdir(resolve(options.evidence, ".."), { recursive: true });
  await writeFile(options.evidence, `${JSON.stringify({
    card_sha256: distSha256,
    format: "glt-flow-card-exact-dist-results",
    grep: options.grep,
    passed: exitCode === 0,
    report_version: 1,
    skipped: false,
  }, null, 2)}\n`);
  process.stderr.write(`EXACT_DIST_EFFECTS ${JSON.stringify({ filesystem: requests })}\n`);
  process.exitCode = exitCode;
} finally {
  await new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
}
