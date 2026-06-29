import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const GUARDED_KINDS = new Set(["internal-token", "dynamic-user-content"]);
const REQUIRED_INTERNAL_TOKEN = "card";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "..");
const inventoryPath = path.join(repoRoot, "resources", "ko-ui", "strings.json");

const relative = (filePath) => path.relative(repoRoot, filePath).replaceAll(path.sep, "/");

const fail = (errors) => {
  console.error(`Korean UI scope guard failed for ${relative(inventoryPath)}`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
};

const clone = (value) => JSON.parse(JSON.stringify(value));
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

const validateGuardedEntries = (inventory) => {
  const errors = [];
  if (!inventory || typeof inventory !== "object" || Array.isArray(inventory)) {
    return ["inventory root must be an object"];
  }
  if (!Array.isArray(inventory.entries)) return ["entries must be an array"];

  for (const [index, entry] of inventory.entries.entries()) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push(`entries[${index}] must be an object`);
      continue;
    }

    const label = entry.id ?? `entries[${index}]`;
    const isGuarded = GUARDED_KINDS.has(entry.kind) || entry.preserve === true;
    if (!isGuarded) continue;

    if (entry.preserve !== true) errors.push(`${label}: guarded entries must set preserve:true`);
    if (hasOwn(entry, "ko")) errors.push(`${label}: guarded entries must not define ko`);
  }

  return errors;
};

let inventory;
try {
  inventory = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
} catch (error) {
  fail([`could not read or parse JSON: ${error.message}`]);
}

const errors = validateGuardedEntries(inventory);
const tokenEntry = inventory.entries.find(
  (entry) => entry.id === "token.card" || (entry.kind === "internal-token" && entry.source === REQUIRED_INTERNAL_TOKEN),
);

if (!tokenEntry) {
  errors.push(`missing internal token guard for "${REQUIRED_INTERNAL_TOKEN}"`);
} else if (tokenEntry.kind !== "internal-token" || tokenEntry.preserve !== true || hasOwn(tokenEntry, "ko")) {
  errors.push("token.card must be an internal-token with preserve:true and no ko replacement");
}

const mutated = clone(inventory);
const mutatedToken = mutated.entries.find(
  (entry) => entry.id === "token.card" || (entry.kind === "internal-token" && entry.source === REQUIRED_INTERNAL_TOKEN),
);
if (!mutatedToken) {
  errors.push("mutation check could not find token.card");
} else {
  mutatedToken.ko = "카드";
  const mutationErrors = validateGuardedEntries(mutated);
  const caughtMutation = mutationErrors.some(
    (error) => error.includes(mutatedToken.id ?? "token.card") && error.includes("must not define ko"),
  );
  if (!caughtMutation) errors.push("mutation check failed to reject a Korean replacement on token.card");
}

if (errors.length > 0) fail(errors);

const guardedCount = inventory.entries.filter(
  (entry) => GUARDED_KINDS.has(entry.kind) || entry.preserve === true,
).length;

console.log(`OK ${relative(inventoryPath)}`);
console.log(`guarded entries: ${guardedCount}`);
console.log("token.card mutation: caught");
