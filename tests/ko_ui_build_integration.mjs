import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
const errors = [];

const assert = (condition, message) => {
  if (!condition) errors.push(message);
};

const assertOrder = (source, labels, file) => {
  const positions = labels.map((label) => source.indexOf(label));
  labels.forEach((label, index) => {
    assert(positions[index] >= 0, `${file}: missing ${label}`);
  });
  for (let index = 1; index < positions.length; index += 1) {
    assert(positions[index - 1] < positions[index], `${file}: wrong order for ${labels.join(" before ")}`);
  }
};

const makefile = read("Makefile");
const webDecker = read("scripts/web_decker.sh");
const resources = read("scripts/resources.sh");

assert(makefile.includes("KO_UI_SOURCES=scripts/build_ko_ui_assets.mjs resources/ko-ui/strings.json fonts/dunggeunmo/DungGeunMo.ttf"), "Makefile: missing Korean UI source dependency list");
assert(makefile.includes("KO_UI_ASSETS=js/ko-ui-strings.js js/ko-ui-font.js c/ko_ui_strings.h c/ko_ui_font.h"), "Makefile: missing Korean UI generated asset list");
assert(makefile.includes("$(KO_UI_ASSETS): $(KO_UI_SOURCES)"), "Makefile: generated assets do not depend on source inventory and font");
assert(makefile.includes("node scripts/build_ko_ui_assets.mjs"), "Makefile: generated asset rule does not run the generator");
assert(/c\/build\/decker:\s+\$\(KO_UI_ASSETS\)/.test(makefile), "Makefile: native decker target does not depend on Korean UI assets");
assert(/c\/resources\.h:\s+\$\(KO_UI_ASSETS\)/.test(makefile), "Makefile: resources header target does not depend on Korean UI assets");
assert(/js:\s+jsres\s+\$\(KO_UI_ASSETS\)/.test(makefile), "Makefile: js target does not refresh Korean UI assets");
assert(/web-decker:\s+js\s+\$\(KO_UI_ASSETS\)/.test(makefile), "Makefile: web-decker target does not refresh Korean UI assets");

assertOrder(webDecker, ["cat js/ko-ui-strings.js", "cat js/ko-ui-font.js", "cat js/decker.js"], "scripts/web_decker.sh");
assertOrder(resources, ["xxd -i js/ko-ui-strings.js", "xxd -i js/ko-ui-font.js", "xxd -i js/decker.js"], "scripts/resources.sh");
assert(!/blog\.kakaocdn\.net|expires=1782831599/.test(makefile + webDecker + resources), "build scripts must not depend on expiring Kakao CDN URLs");

if (errors.length > 0) {
  console.error("Korean UI build integration validation failed");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("OK Korean UI build integration");
console.log("Makefile: generator dependencies wired for js, web-decker, c/resources.h, and native decker");
console.log("scripts/web_decker.sh: Korean UI string/font assets precede js/decker.js");
console.log("scripts/resources.sh: Korean UI string/font assets precede js/decker.js");
