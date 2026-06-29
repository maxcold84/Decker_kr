import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "..");

const deckerC = fs.readFileSync(path.join(repoRoot, "c", "decker.c"), "utf8");
const domH = fs.readFileSync(path.join(repoRoot, "c", "dom.h"), "utf8");
const stringsH = fs.readFileSync(path.join(repoRoot, "c", "ko_ui_strings.h"), "utf8");
const fontH = fs.readFileSync(path.join(repoRoot, "c", "ko_ui_font.h"), "utf8");

assert.match(deckerC, /#include "ko_ui_strings\.h"/);
assert.match(deckerC, /#include "ko_ui_font\.h"/);

const helperStart = deckerC.indexOf("static const char* ui_text");
const helperEnd = deckerC.indexOf("typedef struct {", helperStart);
assert.notEqual(helperStart, -1, "c/decker.c must define ui_text");
assert.notEqual(helperEnd, -1, "native UI helpers must stay before app state structs");

const helper = deckerC.slice(helperStart, helperEnd);
for (const name of [
  "ui_text",
  "ui_utf8_next",
  "ui_glyph",
  "ui_textsize",
  "draw_ui_glyph",
  "draw_ui_text",
  "draw_ui_text_fit",
  "draw_ui_textc",
  "draw_ui_textr",
]) {
  assert.match(helper, new RegExp(`\\b${name}\\b`));
}

assert.match(helper, /KO_UI_STRINGS\[z\]\.id/);
assert.match(helper, /KO_UI_GLYPHS\[z\]\.codepoint/);
assert.match(helper, /draw_pix\(pos\.x\+glyph->x_offset\+x,pos\.y\+glyph->y_offset\+y,pattern\)/);
assert.match(helper, /draw_text\(\(rect\)\{cursor\.x,cursor\.y,0,0\},fallback,FONT_MENU,pattern\)/);

assert.match(stringsH, /^#ifndef DECKER_KO_UI_STRINGS_H/m);
assert.match(fontH, /^#ifndef DECKER_KO_UI_FONT_H/m);
assert.match(stringsH, /KO_UI_STRINGS\[KO_UI_STRING_COUNT\]/);
assert.match(fontH, /KO_UI_GLYPHS\[KO_UI_GLYPH_COUNT\]/);

for (const codePoint of ["0xD30C", "0xC77C", "0xCE74", "0xB4DC"]) {
  assert.match(fontH, new RegExp(codePoint));
}

assert.match(domH, /void draw_text_fit\(rect r,char\*text,lv\*f,int pattern\)\{[\s\S]*font_gw\(f,c\)[\s\S]*font_each\(f,g\.c\)/);
assert.match(domH, /void draw_textc\(rect r,char\*text,lv\*font,int pattern\)\{[\s\S]*font_textsize\(font,text\)/);

console.log("OK native Korean UI text helpers");
console.log("includes: ko_ui_strings.h, ko_ui_font.h");
console.log("glyph codepoints: 0xD30C, 0xC77C, 0xCE74, 0xB4DC");
