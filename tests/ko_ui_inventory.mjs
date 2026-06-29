import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KIND_ORDER = [
  "fixed-ui-label",
  "fixed-ui-format",
  "internal-token",
  "dynamic-user-content",
  "diagnostic",
];

const ALLOWED_KINDS = new Set(KIND_ORDER);

const REQUIRED_FIXED_UI_EXEMPLARS = [
  { id: "menu.file", owner: "app-chrome", source: "File", ko: "파일" },
  { id: "menu.edit", owner: "app-chrome", source: "Edit", ko: "편집" },
  { id: "command.cards", owner: "app-chrome", source: "Cards...", ko: "카드..." },
  { id: "command.properties", owner: "app-chrome", source: "Properties...", ko: "속성..." },
  { id: "command.open", owner: "app-chrome", source: "Open...", ko: "열기..." },
  { id: "command.save_as", owner: "app-chrome", source: "Save As...", ko: "다른 이름으로 저장..." },
];

const REQUIRED_INTERNAL_TOKENS = new Set([
  "card",
  "deck",
  "First",
  "Prev",
  "Next",
  "Last",
  "Back",
  "go[]",
  "play[]",
  "button",
  "field",
  "grid",
  "canvas",
  "menu",
  "body",
  "mono",
  "select",
]);

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "..");
const defaultInventoryPath = path.join(repoRoot, "resources", "ko-ui", "strings.json");
const args = process.argv.slice(2);
const coverageMode = args.includes("--coverage");
const parityMode = args.includes("--parity");
const pathArg = args.find((arg) => !arg.startsWith("--"));
const inventoryPath = pathArg ? path.resolve(pathArg) : defaultInventoryPath;

const REQUIRED_CHROME_IDS = [
  "menu.decker",
  "menu.file",
  "menu.edit",
  "menu.card",
  "menu.prototype",
  "menu.tool",
  "menu.view",
  "menu.style",
  "menu.widgets",
  "menu.help",
  "command.open",
  "command.save_as",
  "command.cards",
  "command.properties",
  "command.go_first",
  "command.go_previous",
  "command.go_next",
  "command.go_last",
  "command.new_button",
  "command.copy_table",
  "command.cut_image",
  "command.paste_sound",
  "command.clear_history",
];

const fail = (errors) => {
  console.error(`Korean UI inventory validation failed for ${path.relative(repoRoot, inventoryPath)}`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
};

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const requireString = (entry, field, errors) => {
  if (typeof entry[field] !== "string" || entry[field].length === 0) {
    errors.push(`${entry.id ?? "<unknown>"}: ${field} must be a non-empty string`);
  }
};

const validateRequiredFixedUiExemplars = (entriesById, errors) => {
  for (const expected of REQUIRED_FIXED_UI_EXEMPLARS) {
    const entry = entriesById.get(expected.id);
    if (!entry) {
      errors.push(`missing required fixed UI exemplar: ${expected.id}`);
      continue;
    }

    if (entry.kind !== "fixed-ui-label") {
      errors.push(`${expected.id}: required fixed UI exemplar must be kind fixed-ui-label`);
    }
    if (entry.owner !== expected.owner) {
      errors.push(`${expected.id}: expected owner "${expected.owner}"`);
    }
    if (entry.source !== expected.source) {
      errors.push(`${expected.id}: expected source "${expected.source}"`);
    }
    if (entry.ko !== expected.ko) {
      errors.push(`${expected.id}: expected ko "${expected.ko}"`);
    }
  }
};

const readSource = (relativePath, errors) => {
  const sourcePath = path.join(repoRoot, ...relativePath.split("/"));
  try {
    return fs.readFileSync(sourcePath, "utf8");
  } catch (error) {
    errors.push(`${relativePath}: could not read source: ${error.message}`);
    return "";
  }
};

const collectUsedUiTextIds = (source) => {
  const ids = new Set();
  const regex = /\bui_text\(\s*(['"])([^'"]+)\1/g;
  for (const match of source.matchAll(regex)) ids.add(match[2]);
  return ids;
};

const collectDirectMenuStringLabels = (source) => {
  const labels = [];
  const regex = /\bmenu_(?:bar|item|check)\(\s*(['"])([^'"]+)\1/g;
  for (const match of source.matchAll(regex)) labels.push(match[2]);
  return labels;
};

const validateCoverage = (entriesById, errors) => {
  const js = readSource("js/decker.js", errors);
  const native = readSource("c/decker.c", errors);
  const jsIds = collectUsedUiTextIds(js);
  const nativeIds = collectUsedUiTextIds(native);
  const allUsedIds = new Set([...jsIds, ...nativeIds]);

  for (const id of allUsedIds) {
    const entry = entriesById.get(id);
    if (!entry) {
      errors.push(`used UI string id is missing from inventory: ${id}`);
      continue;
    }
    if (entry.kind !== "fixed-ui-label" && entry.kind !== "fixed-ui-format" && entry.kind !== "diagnostic") {
      errors.push(`${id}: used UI string id must be fixed-ui-label, fixed-ui-format, or diagnostic`);
    }
  }

  for (const id of REQUIRED_CHROME_IDS) {
    if (!entriesById.has(id)) errors.push(`coverage required id missing from inventory: ${id}`);
    if (!jsIds.has(id)) errors.push(`coverage required id missing from web source: ${id}`);
    if (!nativeIds.has(id)) errors.push(`coverage required id missing from native source: ${id}`);
  }

  const jsDirectLabels = collectDirectMenuStringLabels(js);
  const nativeDirectLabels = collectDirectMenuStringLabels(native);
  for (const label of jsDirectLabels) errors.push(`web menu uses direct string literal instead of ui_text: ${label}`);
  for (const label of nativeDirectLabels) errors.push(`native menu uses direct string literal instead of ui_text: ${label}`);

  for (const token of ["First", "Prev", "Next", "Last", "Back"]) {
    if (!new RegExp(`lms\\('${token}'\\s*\\)`).test(js)) {
      errors.push(`web navigation token changed or missing: lms('${token}')`);
    }
    if (!new RegExp(`lmistr\\("${token}"\\s*\\)`).test(native)) {
      errors.push(`native navigation token changed or missing: lmistr("${token}")`);
    }
  }
};

const validateParity = (entriesById, errors) => {
  const js = readSource("js/decker.js", errors);
  const native = readSource("c/decker.c", errors);
  const jsIds = collectUsedUiTextIds(js);
  const nativeIds = collectUsedUiTextIds(native);
  const webOnlyIds = new Set([
    "command.fullscreen",
    "command.toolbars",
  ]);
  const nativeOnlyIds = new Set([
    "command.auto_save",
    "command.quit",
    "command.save",
    "command.paste_inline_image",
    "command.paste_rich_text",
    "command.paste_image",
    "command.paste_widgets",
    "command.paste_card",
    "command.tracing_mode",
  ]);
  for (const id of jsIds) {
    if (id.startsWith("command.") || id.startsWith("menu.")) {
      if (!nativeIds.has(id) && !webOnlyIds.has(id)) errors.push(`web/native parity missing native id: ${id}`);
    }
  }
  for (const id of nativeIds) {
    if (id.startsWith("command.") || id.startsWith("menu.")) {
      if (!jsIds.has(id) && !nativeOnlyIds.has(id)) errors.push(`web/native parity missing web id: ${id}`);
    }
  }
};

const validateEntry = (entry, index, seenIds, entriesById, tokenSources, tokenEntriesBySource, errors) => {
  if (!isPlainObject(entry)) {
    errors.push(`entries[${index}] must be an object`);
    return;
  }

  for (const field of ["id", "kind", "owner", "source"]) {
    requireString(entry, field, errors);
  }

  if (typeof entry.id === "string") {
    if (seenIds.has(entry.id)) errors.push(`${entry.id}: duplicate id`);
    seenIds.add(entry.id);
    entriesById.set(entry.id, entry);
  }

  if (!ALLOWED_KINDS.has(entry.kind)) {
    errors.push(`${entry.id ?? `entries[${index}]`}: invalid kind "${entry.kind}"`);
    return;
  }

  if (REQUIRED_INTERNAL_TOKENS.has(entry.source)) {
    if (entry.kind !== "internal-token") {
      errors.push(`${entry.id}: required internal token sources must be kind internal-token`);
    }
    if (entry.preserve !== true) {
      errors.push(`${entry.id}: required internal token sources must set preserve:true`);
    }
    if (Object.hasOwn(entry, "ko")) {
      errors.push(`${entry.id}: required internal token sources must not define ko`);
    }
  }

  if (entry.kind === "fixed-ui-label" || entry.kind === "fixed-ui-format") {
    requireString(entry, "ko", errors);
    if (Object.hasOwn(entry, "preserve")) {
      errors.push(`${entry.id}: fixed UI entries must not set preserve`);
    }
    return;
  }

  if (entry.kind === "internal-token") {
    if (entry.preserve !== true) errors.push(`${entry.id}: internal tokens must set preserve:true`);
    if (Object.hasOwn(entry, "ko")) errors.push(`${entry.id}: internal tokens must not define ko`);
    tokenSources.add(entry.source);
    tokenEntriesBySource.set(entry.source, entry);
    return;
  }

  if (entry.kind === "dynamic-user-content") {
    if (entry.preserve !== true) errors.push(`${entry.id}: dynamic user content must set preserve:true`);
    if (Object.hasOwn(entry, "ko")) errors.push(`${entry.id}: dynamic user content must not define ko`);
  }
};

let parsed;
try {
  parsed = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
} catch (error) {
  fail([`could not read or parse JSON: ${error.message}`]);
}

const errors = [];
if (!isPlainObject(parsed)) {
  errors.push("inventory root must be an object");
} else {
  if (parsed.schema_version !== "1") errors.push('schema_version must be "1"');
  if (!Array.isArray(parsed.entries)) errors.push("entries must be an array");
}

const seenIds = new Set();
const entriesById = new Map();
const tokenSources = new Set();
const tokenEntriesBySource = new Map();
const kindCounts = new Map(KIND_ORDER.map((kind) => [kind, 0]));
if (Array.isArray(parsed?.entries)) {
  parsed.entries.forEach((entry, index) => {
    if (isPlainObject(entry) && ALLOWED_KINDS.has(entry.kind)) {
      kindCounts.set(entry.kind, kindCounts.get(entry.kind) + 1);
    }
    validateEntry(entry, index, seenIds, entriesById, tokenSources, tokenEntriesBySource, errors);
  });
}

validateRequiredFixedUiExemplars(entriesById, errors);

for (const token of REQUIRED_INTERNAL_TOKENS) {
  if (!tokenSources.has(token)) errors.push(`missing required internal token: ${token}`);
}

if (coverageMode) validateCoverage(entriesById, errors);
if (parityMode) validateParity(entriesById, errors);

if (errors.length > 0) fail(errors);

console.log(`OK ${path.relative(repoRoot, inventoryPath)}`);
console.log(`entries: ${parsed.entries.length}`);
console.log("kind counts:");
for (const kind of KIND_ORDER) console.log(`- ${kind}: ${kindCounts.get(kind)}`);
console.log("required fixed app chrome exemplars:");
for (const entry of REQUIRED_FIXED_UI_EXEMPLARS) {
  console.log(`- ${entry.id}/${entry.source}->${entry.ko}`);
}
console.log("required internal tokens preserved:");
for (const token of REQUIRED_INTERNAL_TOKENS) {
  const entry = tokenEntriesBySource.get(token);
  console.log(`- ${token}: ${entry.id} preserve:true ko:absent`);
}
if (coverageMode) console.log("coverage: web/native menu UI string ids are inventoried and direct menu literals are absent");
if (parityMode) console.log("parity: web/native command and menu UI string ids match");
