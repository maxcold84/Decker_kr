import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "..");
const deckerPath = path.join(repoRoot, "js", "decker.js");

const deckerSource = fs.readFileSync(deckerPath, "utf8");
const start = deckerSource.indexOf("ui_font=()=>");
const end = deckerSource.indexOf("draw_text_outlined=(pos,text,f)=>");

assert.notEqual(start, -1, "js/decker.js must define ui_font");
assert.notEqual(end, -1, "js/decker.js must keep draw_text_outlined after UI helpers");
assert.ok(end > start, "UI helper block must appear before existing draw_text helpers");

const helperSource = deckerSource.slice(start, end);
const context = {
  console,
  Object,
  Array,
  parseInt,
  max: Math.max,
  ceil: Math.ceil,
  FONT_MENU: { name: "menu" },
  rect: (x = 0, y = 0, w = 1, h = 1) => ({ x, y, w, h }),
  rcenter: (r, s) => ({ x: r.x + Math.ceil((r.w - s.x) / 2), y: r.y + Math.ceil((r.h - s.y) / 2), w: s.x, h: s.y }),
  font_h: () => 8,
  font_gw: () => 4,
  font_sw: () => 1,
  drawRects: [],
  drawPixels: [],
  fallbackDraws: [],
};
context.globalThis = context;
context.draw_rect = (r, pattern) => context.drawRects.push({ r, pattern });
context.draw_pix = (x, y, pattern) => context.drawPixels.push({ x, y, pattern });
context.draw_text = (r, text, font, pattern) => context.fallbackDraws.push({ r, text, font, pattern });
context.draw_text_fit = (r, text, font, pattern) => context.fallbackDraws.push({ r, text, font, pattern, fit: true });

for (const asset of ["js/ko-ui-strings.js", "js/ko-ui-font.js"]) {
  vm.runInNewContext(fs.readFileSync(path.join(repoRoot, asset), "utf8"), context, { filename: asset });
}
vm.runInNewContext(helperSource, context, { filename: "js/decker.js#ui-helpers" });

assert.equal(context.ui_text("menu.file"), "파일");
assert.equal(context.ui_text("missing.id", "Fallback"), "Fallback");

const formatted = context.ui_text_format("format.card_count", [3, 5]);
assert.match(formatted, /3/);
assert.match(formatted, /5/);

const size = context.ui_textsize("파일");
assert.ok(size.x > 0, "Korean UI text must have positive width");
assert.equal(size.y, context.KO_UI_FONT.lineHeight);

context.draw_ui_text(context.rect(0, 0, 200, 30), "파일", 1);
assert.ok(context.drawPixels.length > 0, "Korean UI text must draw atlas pixels");
assert.equal(context.drawRects.length, 0, "Korean UI glyphs must use point pixels, not zero-size draw_rect calls");
assert.equal(context.fallbackDraws.length, 0, "Korean UI glyphs must not fall back to DeckRoman draw_text");

context.draw_ui_text(context.rect(0, 0, 200, 30), "\u{1F600}", 1);
assert.equal(context.fallbackDraws.length, 1, "missing non-UI glyphs should use the existing draw_text fallback");

context.drawPixels.length = 0;
context.draw_ui_textc(context.rect(0, 0, 64, 24), "파일", 1);
assert.ok(context.drawPixels.length > 0, "centered Korean UI text must draw atlas pixels");

assert.match(deckerSource, /draw_text_fit=\(r,text,font,pattern\)=>\{[\s\S]*font_gw\(font,c\)[\s\S]*draw_char/);
assert.match(deckerSource, /draw_textc=\(r,text,font,pattern\)=>\{[\s\S]*font_textsize\(font,text\)/);

console.log("OK web Korean UI text helpers");
console.log(`ui_text(menu.file): ${context.ui_text("menu.file")}`);
console.log(`atlas pixels drawn: ${context.drawPixels.length}`);
