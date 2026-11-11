const fs = require("node:fs");
const assert = require("node:assert/strict");

const html = fs.readFileSync("public/index.html", "utf8");
const start = html.indexOf("function renderLivePreview(data){");
const end = html.indexOf("\nfunction showProposal(data)", start);
assert(start >= 0 && end > start, "live preview renderer must exist");

const render = new Function(
  "data", "livePreviewWrap", "livePreview", "previewFileName",
  html.slice(start, end) + ";renderLivePreview(data);return livePreview.srcdoc;"
);
const wrapper = { classList: { add() {}, remove() {} } };
const frame = { removeAttribute() { this.srcdoc = ""; } };
const label = {};
const srcdoc = render({ files: [
  { path: "public/index.html", content: '<!doctype html><html><head><link rel="stylesheet" href="style.css"></head><body><h1>Preview test</h1><script src="app.js"></script></body></html>' },
  { path: "public/style.css", content: "body{color:red}" },
  { path: "public/app.js", content: "document.body.dataset.preview='ok';" }
]}, wrapper, frame, label);

assert(srcdoc.includes("<h1>Preview test</h1>"), "HTML should render");
assert(srcdoc.includes("body{color:red}"), "local CSS should be embedded");
assert(srcdoc.includes("dataset.preview"), "local JS should be embedded");
assert(srcdoc.includes("connect-src 'none'"), "preview CSP should block network connections");
assert.equal(label.textContent, "public/index.html");
assert(html.includes('sandbox="allow-scripts"'), "preview iframe must be sandboxed");
console.log("Sandboxed live preview tests passed.");
