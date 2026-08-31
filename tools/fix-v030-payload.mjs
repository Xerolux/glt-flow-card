import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const designerB64 = [1, 2, 3, 4]
  .map((index) => readFileSync(`tools/v030-designer-${index}.b64`, "utf8").trim())
  .join("");

// Validate the reconstructed payload before replacing the corrupted temporary file.
gunzipSync(Buffer.from(designerB64, "base64"));
writeFileSync("tools/v030-designer.b64", `${designerB64}\n`);

await import("./apply-neo2030-v030.mjs");
