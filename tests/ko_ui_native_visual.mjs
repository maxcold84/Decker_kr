import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "..");
const defaultBinary = process.platform === "win32" ? "decker.exe" : "decker";
const binaryPath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(repoRoot, "c", "build", defaultBinary);
const outDir = process.argv[3] ? path.resolve(process.argv[3]) : path.join(repoRoot, ".omo", "evidence", "decker-ko-ui", "native");

const relative = (filePath) => path.relative(repoRoot, filePath).replaceAll(path.sep, "/");
const evidenceFile = (name) => path.join(outDir, name);
const readEvidence = (name) => {
  const filePath = evidenceFile(name);
  if (!fs.existsSync(filePath)) return "";
  return fs.readFileSync(filePath, "utf8").trim();
};

const commandExists = (command) => {
  const result = childProcess.spawnSync(process.platform === "win32" ? "where" : "command", process.platform === "win32" ? [command] : ["-v", command], {
    encoding: "utf8",
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return result.status === 0;
};

const findMsvcTool = (tool) => {
  const root = "C:/Program Files (x86)/Microsoft Visual Studio/2022/BuildTools/VC/Tools/MSVC";
  if (!fs.existsSync(root)) return null;
  const versions = fs.readdirSync(root).sort().reverse();
  for (const version of versions) {
    const candidate = path.join(root, version, "bin", "Hostx64", "x64", tool);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
};

const msvcClPath = findMsvcTool("cl.exe");
const msvcNmakePath = findMsvcTool("nmake.exe");

const pathChecks = [
  { name: "git usr make", path: "C:/Program Files/Git/usr/bin/make.exe" },
  { name: "git mingw gcc", path: "C:/Program Files/Git/mingw64/bin/gcc.exe" },
  { name: "git mingw32-make", path: "C:/Program Files/Git/mingw64/bin/mingw32-make.exe" },
  { name: "msys2 make", path: "C:/msys64/usr/bin/make.exe" },
  { name: "msys2 gcc", path: "C:/msys64/mingw64/bin/gcc.exe" },
  { name: "msys2 sdl2-config", path: "C:/msys64/mingw64/bin/sdl2-config" },
  { name: "chocolatey msys2 root", path: "C:/tools/msys64" },
  { name: "chocolatey msys2 pacman", path: "C:/tools/msys64/usr/bin/pacman.exe" },
  { name: "chocolatey msys2 make", path: "C:/tools/msys64/usr/bin/make.exe" },
  { name: "chocolatey msys2 mingw gcc", path: "C:/tools/msys64/mingw64/bin/gcc.exe" },
  { name: "chocolatey msys2 sdl2-config", path: "C:/tools/msys64/mingw64/bin/sdl2-config" },
  { name: "visual studio vswhere", path: "C:/Program Files (x86)/Microsoft Visual Studio/Installer/vswhere.exe" },
  { name: "visual studio vcvars64", path: "C:/Program Files (x86)/Microsoft Visual Studio/2022/BuildTools/VC/Auxiliary/Build/vcvars64.bat" },
  { name: "visual studio cl", path: msvcClPath },
  { name: "visual studio nmake", path: msvcNmakePath },
].map((check) => ({ ...check, exists: check.path ? fs.existsSync(check.path) : false }));

fs.mkdirSync(outDir, { recursive: true });

const toolChecks = [
  { name: "make", available: commandExists("make"), evidence: readEvidence("task-11-where-make.txt") },
  { name: "gcc", available: commandExists("gcc"), evidence: readEvidence("task-11-where-gcc.txt") },
  { name: "clang", available: commandExists("clang"), evidence: readEvidence("task-11-where-clang.txt") },
  { name: "cl", available: commandExists("cl"), evidence: readEvidence("task-11-where-cl.txt") },
];

const pathExists = (name) => pathChecks.find((check) => check.name === name)?.exists ?? false;
const buildEvidence = readEvidence("task-11-native-build-msys2-fixed.txt")
  || readEvidence("task-11-native-build-msys2.txt")
  || readEvidence("task-11-native-build.txt");
const missing = toolChecks.filter((tool) => !tool.available).map((tool) => tool.name);
const vcCompilerAvailable = Boolean(msvcClPath);
const msys2ToolchainAvailable = pathExists("chocolatey msys2 make")
  && pathExists("chocolatey msys2 mingw gcc")
  && pathExists("chocolatey msys2 sdl2-config");
const makeAvailable = toolChecks.find((tool) => tool.name === "make")?.available
  || pathExists("git usr make")
  || pathExists("chocolatey msys2 make")
  || pathExists("msys2 make");
const compilerAvailable = vcCompilerAvailable
  || toolChecks.some((tool) => ["gcc", "clang", "cl"].includes(tool.name) && tool.available)
  || pathExists("chocolatey msys2 mingw gcc")
  || pathExists("msys2 gcc");
const sdl2Available = commandExists("sdl2-config")
  || pathExists("chocolatey msys2 sdl2-config")
  || pathExists("msys2 sdl2-config");
const binaryExists = fs.existsSync(binaryPath);

const blockers = [];
if (!makeAvailable) blockers.push("GNU make is not available on PATH or in the detected MSYS2 locations, so the existing Makefile target `make decker` cannot run in this environment.");
if (!compilerAvailable) blockers.push("No C compiler was found on PATH or in the detected Visual Studio Build Tools installation.");
if (!sdl2Available) blockers.push("SDL2 development tools were not found on PATH or in the detected MSYS2 locations.");
if (vcCompilerAvailable && !msys2ToolchainAvailable && !binaryExists) blockers.push("Visual Studio `cl.exe` is installed, but this repo has no Windows/nmake native build path and no SDL2/SDL2_image development headers/libs were found by the recorded probes.");
if (pathChecks.find((check) => check.name === "chocolatey msys2 root")?.exists && !pathChecks.find((check) => check.name === "chocolatey msys2 pacman")?.exists) {
  blockers.push("Chocolatey MSYS2 root exists at C:/tools/msys64, but pacman, make, mingw gcc, and sdl2-config are absent there.");
}
if (!binaryExists) blockers.push(`Native Decker binary is missing at ${relative(binaryPath)}.`);
if (!binaryExists && buildEvidence) blockers.push(`Native build command output: ${buildEvidence.split(/\r?\n/).slice(0, 3).join(" ")}`);

const report = {
  ok: blockers.length === 0,
  blocked: blockers.length > 0,
  binary: relative(binaryPath),
  outDir: relative(outDir),
  screenshots: [],
  toolChecks,
  pathChecks,
  makeAvailable,
  compilerAvailable,
  sdl2Available,
  msys2ToolchainAvailable,
  missing,
  blockers,
  requiredUserAcceptance: blockers.length > 0,
  notes: blockers.length > 0
    ? [
      "Native GUI visual QA could not launch because the native binary cannot be built or found in this environment.",
      "Per .omo/plans/decker-ko-ui.md, final completion must wait for user acceptance or another environment with native build and GUI automation support.",
    ]
    : [
      "Native binary exists and required build tools were detected, but native GUI automation is not implemented for this platform in this script.",
    ],
};

fs.writeFileSync(path.join(outDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);

if (report.blocked) {
  console.error("Native Korean UI visual QA blocked");
  for (const blocker of blockers) console.error(`- ${blocker}`);
  console.error(`report: ${relative(path.join(outDir, "report.json"))}`);
  process.exit(2);
}

console.log("OK native Korean UI visual QA preflight");
console.log(`report: ${relative(path.join(outDir, "report.json"))}`);
