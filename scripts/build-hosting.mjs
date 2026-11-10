import { cp, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const output = path.join(root, "dist");
const target = process.env.FIREBASE_TARGET || "production";
if (!["production", "staging"].includes(target)) {
  throw new Error('FIREBASE_TARGET must be "production" or "staging".');
}

// Publish an explicit allowlist only. Never copy the repository root wholesale:
// this prevents workflows, scripts, Firestore rules, and Admin tooling being exposed.
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

if (target === "staging") {
  // Replace only the generated Hosting bundle; source files and production config stay untouched.
  for (const [sourcePath, destinationPath] of [
    ["js/firebase-config.staging.js", "js/firebase-config.js"],
    ["firebase-messaging-sw.staging.js", "firebase-messaging-sw.js"]
  ]) {
    const source = path.join(root, sourcePath);
    const destination = path.join(output, destinationPath);
    const info = await stat(source).catch(() => null);
    if (!info?.isFile()) throw new Error(`Required staging config is missing: ${sourcePath}`);
    await cp(source, destination);
  }
}

console.log(`Firebase Hosting ${target} bundle created with ${files.length} allowlisted files in dist/.`);
