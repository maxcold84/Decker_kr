import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(repoRoot, "js", "build", "decker.html");

const fail = (messages) => {
  console.error(`Korean UI web bundle validation failed for ${path.relative(repoRoot, artifactPath)}`);
  for (const message of messages) console.error(`- ${message}`);
  process.exit(1);
};

let html;
try {
  html = fs.readFileSync(artifactPath, "utf8");
} catch (error) {
  fail([`could not read bundle: ${error.message}`]);
}

const checks = [];
const errors = [];
const requireContains = (needle, label) => {
  const index = html.indexOf(needle);
  if (index < 0) errors.push(`missing ${label}`);
  checks.push({ label, index });
  return index;
};

const stringsIndex = requireContains("const KO_UI_STRINGS", "generated string table");
const fontIndex = requireContains("const KO_UI_FONT", "generated font atlas");
const uiTextIndex = requireContains("ui_text=", "web UI text helper");
requireContains("파일", "Korean File menu translation");
requireContains("편집", "Korean Edit menu translation");

if (stringsIndex >= 0 && fontIndex >= 0 && uiTextIndex >= 0) {
  if (!(stringsIndex < fontIndex && fontIndex < uiTextIndex)) {
    errors.push("generated strings/font assets must load before js/decker.js helpers");
  }
}

if (errors.length > 0) fail(errors);

console.log(`OK ${path.relative(repoRoot, artifactPath)}`);
for (const check of checks) console.log(`- ${check.label}: byte ${check.index}`);
