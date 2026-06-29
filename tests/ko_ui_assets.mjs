import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const REQUIRED_KOREAN_UI_SAMPLES = ["파일", "편집", "카드", "속성", "저장", "열기"];
const EXPECTED_KO_UI_PIXEL_SIZE = 16;

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "..");

const generatedFiles = [
  { label: "web font asset", path: path.join(repoRoot, "js", "ko-ui-font.js") },
  { label: "web string asset", path: path.join(repoRoot, "js", "ko-ui-strings.js") },
  { label: "native font header", path: path.join(repoRoot, "c", "ko_ui_font.h") },
  { label: "native string header", path: path.join(repoRoot, "c", "ko_ui_strings.h") },
];

const relative = (filePath) => path.relative(repoRoot, filePath).replaceAll(path.sep, "/");

const fail = (errors) => {
  console.error("Korean UI generated asset contract failed");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
};

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));

const hasInk = (pixels) => {
  if (Array.isArray(pixels)) return pixels.flat(Infinity).some((value) => Number(value) > 0);
  if (typeof pixels === "string") return /[1-9A-Fa-f]/.test(pixels);
  return false;
};

const codePointKeys = (char) => {
  const codePoint = char.codePointAt(0);
  const hex = codePoint.toString(16).toUpperCase();
  return [char, String(codePoint), `0x${hex}`, hex, `U+${hex}`];
};

const glyphForChar = (glyphs, char) => {
  for (const key of codePointKeys(char)) {
    if (Object.hasOwn(glyphs, key)) return glyphs[key];
  }
  return undefined;
};

const positiveNumber = (value) => typeof value === "number" && Number.isFinite(value) && value > 0;
const nonNegativeNumber = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;
const positiveInteger = (value) => Number.isInteger(value) && value > 0;

const loadWebFont = (filePath, errors) => {
  const source = fs.readFileSync(filePath, "utf8");
  const context = {
    module: { exports: {} },
    exports: {},
    globalThis: {},
  };
  context.window = context.globalThis;
  context.self = context.globalThis;

  try {
    vm.runInNewContext(source, context, { filename: relative(filePath), timeout: 1000 });
  } catch (error) {
    errors.push(`${relative(filePath)} must be valid JavaScript: ${error.message}`);
    return undefined;
  }

  return (
    context.globalThis.KO_UI_FONT ??
    context.KO_UI_FONT ??
    context.module.exports.KO_UI_FONT ??
    context.exports.KO_UI_FONT ??
    context.module.exports.default
  );
};

const validateInventoryCoverage = (errors) => {
  const inventoryPath = path.join(repoRoot, "resources", "ko-ui", "strings.json");
  const inventory = readJson(inventoryPath);
  const fixedKoreanValues = inventory.entries
      .filter((entry) => entry.kind === "fixed-ui-label" || entry.kind === "fixed-ui-format")
      .map((entry) => entry.ko);

  for (const sample of REQUIRED_KOREAN_UI_SAMPLES) {
    if (!fixedKoreanValues.some((value) => typeof value === "string" && value.includes(sample))) {
      errors.push(`${relative(inventoryPath)} must include fixed Korean UI sample "${sample}"`);
    }
  }
};

const validateGeneratedStrings = (webStringsPath, nativeStringsPath, errors) => {
  const webStrings = fs.readFileSync(webStringsPath, "utf8");
  const nativeStrings = fs.readFileSync(nativeStringsPath, "utf8");

  for (const sample of REQUIRED_KOREAN_UI_SAMPLES) {
    if (!webStrings.includes(sample)) errors.push(`${relative(webStringsPath)} must include "${sample}"`);
    if (!nativeStrings.includes(sample)) errors.push(`${relative(nativeStringsPath)} must include "${sample}"`);
  }
};

const validateWebFont = (fontPath, errors) => {
  const font = loadWebFont(fontPath, errors);
  if (!font || typeof font !== "object") {
    errors.push(`${relative(fontPath)} must expose a KO_UI_FONT object`);
    return;
  }

  const glyphs = font.glyphs;
  if (!glyphs || typeof glyphs !== "object" || Array.isArray(glyphs)) {
    errors.push(`${relative(fontPath)} must expose KO_UI_FONT.glyphs as an object`);
    return;
  }

  if (!positiveNumber(font.lineHeight)) errors.push("KO_UI_FONT.lineHeight must be positive");
  if (!positiveNumber(font.ascent)) errors.push("KO_UI_FONT.ascent must be positive");
  if (!nonNegativeNumber(font.descent)) errors.push("KO_UI_FONT.descent must be non-negative");
  if (font.pixelSize !== EXPECTED_KO_UI_PIXEL_SIZE) {
    errors.push(`KO_UI_FONT.pixelSize must be ${EXPECTED_KO_UI_PIXEL_SIZE}`);
  }

  const requiredChars = [...new Set([...REQUIRED_KOREAN_UI_SAMPLES.join("")])];
  for (const char of requiredChars) {
    const codePointKey = String(char.codePointAt(0));
    if (!Object.hasOwn(glyphs, codePointKey)) {
      errors.push(`KO_UI_FONT.glyphs must use code point key "${codePointKey}" for Hangul glyph "${char}"`);
      continue;
    }

    const glyph = glyphForChar(glyphs, char);
    if (!glyph || typeof glyph !== "object") {
      errors.push(`KO_UI_FONT.glyphs must include Hangul glyph "${char}"`);
      continue;
    }

    const advance = glyph.advance ?? glyph.xAdvance ?? glyph.xadvance;
    const width = glyph.width ?? glyph.w;
    const height = glyph.height ?? glyph.h;
    const pixels = glyph.pixels ?? glyph.bitmap ?? glyph.data;

    if (glyph.codePoint !== char.codePointAt(0)) errors.push(`glyph "${char}" must preserve its Unicode code point`);
    if (!positiveNumber(advance)) errors.push(`glyph "${char}" must have positive advance`);
    if (!positiveInteger(width)) errors.push(`glyph "${char}" must have deterministic positive integer width`);
    if (!positiveInteger(height)) errors.push(`glyph "${char}" must have deterministic positive integer height`);
    if (!hasInk(pixels)) errors.push(`glyph "${char}" must contain non-zero pixel data`);
  }
};

const validateNativeFontHeader = (fontHeaderPath, errors) => {
  const header = fs.readFileSync(fontHeaderPath, "utf8");
  if (!header.includes("KO_UI_FONT")) errors.push(`${relative(fontHeaderPath)} must define KO_UI_FONT data`);
  if (!header.includes(`#define KO_UI_FONT_PIXEL_SIZE ${EXPECTED_KO_UI_PIXEL_SIZE}`)) {
    errors.push(`${relative(fontHeaderPath)} must define KO_UI_FONT_PIXEL_SIZE ${EXPECTED_KO_UI_PIXEL_SIZE}`);
  }

  const requiredChars = [...new Set([...REQUIRED_KOREAN_UI_SAMPLES.join("")])];
  for (const char of requiredChars) {
    const hex = char.codePointAt(0).toString(16).toUpperCase();
    if (!header.includes(`0x${hex}`) && !header.includes(hex)) {
      errors.push(`${relative(fontHeaderPath)} must include code point U+${hex} for "${char}"`);
    }
  }
};

const errors = [];
validateInventoryCoverage(errors);

const missing = generatedFiles.filter((file) => !fs.existsSync(file.path));
for (const file of missing) {
  errors.push(`missing generated ${file.label}: ${relative(file.path)} (expected from Todo 5 generator)`);
}

if (missing.length === 0) {
  const fileByLabel = new Map(generatedFiles.map((file) => [file.label, file.path]));
  validateGeneratedStrings(fileByLabel.get("web string asset"), fileByLabel.get("native string header"), errors);
  validateWebFont(fileByLabel.get("web font asset"), errors);
  validateNativeFontHeader(fileByLabel.get("native font header"), errors);
}

if (errors.length > 0) fail(errors);

console.log("OK Korean UI generated asset contract");
console.log(`generated files: ${generatedFiles.map((file) => relative(file.path)).join(", ")}`);
console.log(`sample strings: ${REQUIRED_KOREAN_UI_SAMPLES.join(", ")}`);
