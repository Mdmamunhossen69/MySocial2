import { cp, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const output = path.join(root, "dist");

// Deploy an explicit allowlist only. Never copy repository root wholesale:
// that could publish workflows, scripts, Firebase rules, or Admin tooling.
const files = [
  "index.html",
  "manifest.webmanifest",
  "sw.js",
  "firebase-messaging-sw.js",
  "css/styles.css",
  "js/app.js",
  "js/firebase-config.js",
  "js/image-host-config.js",
  "js/bots.js",
  "assets/icon.svg"
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const relativePath of files) {
  const source = path.join(root, relativePath);
  const destination = path.join(output, relativePath);
  const info = await stat(source).catch(() => null);
  if (!info?.isFile()) {
    throw new Error(`Required Hosting asset is missing: ${relativePath}`);
  }
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination);
}

console.log(`Firebase Hosting bundle created with ${files.length} allowlisted files in dist/.`);
