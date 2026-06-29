import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "..");
const htmlPath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(repoRoot, "js", "build", "decker.html");
const outDir = process.argv[3] ? path.resolve(process.argv[3]) : path.join(repoRoot, ".omo", "evidence", "decker-ko-ui", "web");
const bundledNodeModules = "C:/Users/Droll/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
const bundledPlaywrightModules = path.join(bundledNodeModules, ".pnpm", "playwright@1.61.0", "node_modules");

const fail = (messages) => {
  console.error("Korean UI web visual QA failed");
  for (const message of messages) console.error(`- ${message}`);
  process.exit(1);
};

const requireFromHere = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = requireFromHere("playwright"));
} catch {
  try {
    ({ chromium } = requireFromHere(requireFromHere.resolve("playwright", { paths: [bundledPlaywrightModules, bundledNodeModules] })));
  } catch (error) {
    fail([`Playwright is not available locally or in Codex bundled node modules: ${error.message}`]);
  }
}

fs.mkdirSync(outDir, { recursive: true });

const browserCandidates = [
  "C:/Progra~2/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
];
const executablePath = browserCandidates.find((candidate) => fs.existsSync(candidate));
const launchOptions = executablePath ? { headless: true, executablePath } : { headless: true };
const browser = await chromium.launch(launchOptions);
const page = await browser.newPage({ viewport: { width: 1000, height: 700 }, deviceScaleFactor: 1 });
const screenshots = [];
const visualChecks = [];
const errors = [];

const canvasStats = async () =>
  page.evaluate(() => {
    const canvas = document.querySelector("#display");
    if (!canvas) return { missing: true };
    const ctx = canvas.getContext("2d");
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let dark = 0;
    let light = 0;
    for (let index = 0; index < data.length; index += 4) {
      const value = data[index] + data[index + 1] + data[index + 2];
      if (value < 120) dark += 1;
      if (value > 650) light += 1;
    }
    return { width: canvas.width, height: canvas.height, dark, light };
  });

const capture = async (name) => {
  await page.waitForTimeout(250);
  const stats = await canvasStats();
  if (stats.missing) errors.push(`${name}: display canvas missing`);
  if (!stats.missing && stats.dark < 100) errors.push(`${name}: canvas appears blank or too light`);
  const filename = `${name}.png`;
  const fullPath = path.join(outDir, filename);
  await page.screenshot({ path: fullPath });
  const size = fs.statSync(fullPath).size;
  if (size < 1000) errors.push(`${name}: screenshot file is unexpectedly small`);
  screenshots.push({ name, file: filename, bytes: size, canvas: stats });
};

const tick = async () => {
  await page.evaluate(() => {
    tick();
    sync();
  });
};

const openMenu = async (id, fallback) => {
  const box = await page.evaluate(
    ({ id, fallback }) => {
      menu_setup();
      all_menus();
      const target = ui_text(id, fallback);
      const head = menu.heads.find((item) => item.name === target);
      const display = document.querySelector("#display").getBoundingClientRect();
      return head ? { x: head.b.x, y: head.b.y, w: head.b.w, h: head.b.h, zoom, left: display.left, top: display.top } : null;
    },
    { id, fallback },
  );
  if (!box) {
    errors.push(`menu not found: ${id}`);
    return;
  }
  await page.mouse.click(box.left + (box.x + box.w / 2) * box.zoom, box.top + (box.y + box.h / 2) * box.zoom);
  await page.waitForTimeout(150);
  await tick();
};

const menuLabelInk = async (name) => {
  const labels = await page.evaluate(() => {
    const canvas = document.querySelector("#display");
    if (!canvas || typeof menu === "undefined" || !menu.items) return [];
    const ctx = canvas.getContext("2d");
    const scale = typeof zoom === "number" && zoom > 0 ? zoom : 1;
    return menu.items
      .filter((item) => item.name)
      .map((item) => {
        const textSize = ui_textsize(item.name);
        const sx = Math.max(0, Math.floor(item.t.x * scale));
        const sy = Math.max(0, Math.floor(item.t.y * scale));
        const sw = Math.max(1, Math.ceil(textSize.x * scale));
        const sh = Math.max(1, Math.ceil(item.t.h * scale));
        const width = Math.max(1, Math.min(sw, canvas.width - sx));
        const height = Math.max(1, Math.min(sh, canvas.height - sy));
        const data = ctx.getImageData(sx, sy, width, height).data;
        let ink = 0;
        for (let index = 0; index < data.length; index += 4) {
          if (data[index] + data[index + 1] + data[index + 2] < 720) ink += 1;
        }
        return { name: item.name, ink, x: item.t.x, y: item.t.y, width: textSize.x, height: item.t.h };
      });
  });

  visualChecks.push({ name, labels });
  if (labels.length === 0) {
    errors.push(`${name}: no menu labels available for pixel inspection`);
    return;
  }

  const blankLabels = labels.filter((label) => label.ink < 8);
  if (blankLabels.length > 0) {
    errors.push(`${name}: menu labels have no visible Korean ink: ${blankLabels.map((label) => label.name).join(", ")}`);
  }
};

const openModal = async (type, setup = "") => {
  await page.evaluate(
    ({ type, setup }) => {
      if (setup) Function(setup)();
      modal_enter(type);
      tick();
      sync();
    },
    { type, setup },
  );
};

try {
  await page.goto(pathToFileURL(htmlPath).href);
  await page.waitForSelector("#display", { timeout: 10000 });
  await page.waitForFunction(() => typeof deck !== "undefined" && deck && typeof ui_text === "function", null, { timeout: 10000 });
  await page.evaluate(() => {
    load_deck(deck_read(""));
    tick();
    sync();
  });
  await page.waitForTimeout(700);

  const stringChecks = await page.evaluate(() => ({
    file: ui_text("menu.file", "File"),
    edit: ui_text("menu.edit", "Edit"),
    cards: ui_text("dialog.cards.title", "Cards"),
    fontGlyphs: typeof KO_UI_FONT !== "undefined" ? Object.keys(KO_UI_FONT.glyphs || {}).length : 0,
  }));
  if (stringChecks.file !== "파일") errors.push("menu.file Korean string did not load");
  if (stringChecks.edit !== "편집") errors.push("menu.edit Korean string did not load");
  if (stringChecks.cards !== "카드") errors.push("dialog.cards.title Korean string did not load");
  if (stringChecks.fontGlyphs < 50) errors.push("KO_UI_FONT glyph table did not load");

  await capture("initial");
  await openMenu("menu.decker", "Decker");
  await menuLabelInk("menu-decker");
  await capture("menu-decker");
  await page.keyboard.press("Escape");
  await tick();
  await openMenu("menu.file", "File");
  await menuLabelInk("menu-file");
  await capture("menu-file");
  await page.keyboard.press("Escape");
  await tick();
  await openMenu("menu.edit", "Edit");
  await menuLabelInk("menu-edit");
  await capture("menu-edit");
  await page.keyboard.press("Escape");
  await tick();

  await openModal("cards");
  await capture("dialog-cards");
  await page.keyboard.press("Escape");
  await tick();
  await openModal("sounds");
  await capture("dialog-sounds");
  await page.keyboard.press("Escape");
  await tick();
  await openModal("fonts");
  await capture("dialog-fonts");
  await page.keyboard.press("Escape");
  await tick();
  await openModal("deck_props");
  await capture("dialog-deck-properties");
  await page.keyboard.press("Escape");
  await tick();
  await openModal("save_deck");
  await capture("dialog-save-deck");
  await page.keyboard.press("Escape");
  await tick();
  await openModal("url", "ms.text=fieldstr(lms('https://example.com'))");
  await capture("dialog-url");

  const report = {
    ok: errors.length === 0,
    html: path.relative(repoRoot, htmlPath),
    screenshots,
    checks: stringChecks,
    visualChecks,
    notes: [
      "Canvas screenshots are captured from the actual web Decker bundle.",
      "Static Korean string/font loading is checked in-page because canvas labels are not DOM text.",
    ],
    errors,
  };
  fs.writeFileSync(path.join(outDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
} finally {
  await browser.close();
}

if (errors.length > 0) fail(errors);
console.log(`OK Korean UI web visual QA: ${screenshots.length} screenshots`);
console.log(`report: ${path.relative(repoRoot, path.join(outDir, "report.json"))}`);
