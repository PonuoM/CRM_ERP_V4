#!/usr/bin/env node

/**
 * Upload a checked set of files to the host over FTP.
 *
 * host-build.ts copies the whole api/ folder, which is fine when the working tree holds exactly one
 * finished piece of work and dangerous when it holds three. This uploads an explicit file list
 * instead — by default the files git says you changed — and refuses to send a set that would break
 * the live site.
 *
 * The check that matters: a PHP file whose `require_once` points at a file that is new locally and
 * is NOT in this upload. Sending api/core/bootstrap.php without api/phone_privacy.php takes the
 * entire API down with a fatal error, and nothing else in the toolchain would have stopped you.
 *
 * Usage:
 *   npx tsx scripts/host/host-deploy.ts --target beta_test                      # dry run
 *   npx tsx scripts/host/host-deploy.ts --target beta_test --apply              # api/*.php only
 *   npx tsx scripts/host/host-deploy.ts --target beta_test --with-dist --apply  # and the frontend
 *   npx tsx scripts/host/host-deploy.ts --target mini_erp --files api/index.php,api/x.php --apply
 *
 * Settings come from the environment or the gitignored .env at the project root:
 *   FTP_HOST, FTP_USER, FTP_PASS, and FTP_REMOTE_ROOT (the folder the apps live in,
 *   e.g. /domains/prima49.com/public_html) or an explicit --base.
 *
 * The password is written to a 0600 temp config that curl reads with -K, and deleted on the way
 * out — it never reaches the command line, the process list, or shell history.
 */

import { execFileSync, execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..", "..");

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const useStaged = args.includes("--staged");
const withDist = args.includes("--with-dist");

function argValue(name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

/** Minimal .env reader — a handful of keys, no new dependency. */
function loadEnvFile(): Record<string, string> {
  const envPath = path.join(projectRoot, ".env");
  if (!fs.existsSync(envPath)) return {};

  const out: Record<string, string> = {};
  for (const rawLine of fs.readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const env = loadEnvFile();
const cfg = (key: string): string | undefined => process.env[key] || env[key];

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

function git(command: string): string {
  return execSync(command, { cwd: projectRoot, encoding: "utf-8" });
}

// ── Which files ────────────────────────────────────────────────────────────────────────────────

function resolveFileList(): string[] {
  const explicit = argValue("--files");
  if (explicit) {
    const named = explicit
      .split(",")
      .map((f) => f.trim().replace(/\\/g, "/"))
      .filter(Boolean);
    // --with-dist has to compose with --files: naming a few PHP files is the common way to ship a
    // change, and the frontend half of that change would otherwise be silently left behind.
    return withDist ? [...named, ...listDistFiles()] : named;
  }

  // Everything git considers changed: modified, staged, and untracked-but-not-ignored.
  const cmd = useStaged
    ? "git diff --cached --name-only"
    : "git status --porcelain=v1 --untracked-files=all";

  const raw = git(cmd);
  const files = useStaged
    ? raw.split(/\r?\n/)
    : raw
        .split(/\r?\n/)
        .filter((l) => l && !l.startsWith(" D") && !l.startsWith("D "))
        // porcelain lines are "XY path"; renames arrive as "old -> new".
        .map((l) => l.slice(3).split(" -> ").pop() as string);

  const list = files
    .map((f) => f.trim().replace(/^"|"$/g, "").replace(/\\/g, "/"))
    .filter(Boolean);

  // dist/ is a build output and is gitignored, so git never reports it as changed. Without this the
  // frontend would be quietly left behind on every deploy and the site would look unchanged.
  if (withDist) {
    list.push(...listDistFiles());
  }
  return list;
}

/** Every file under dist/, repo-relative. */
function listDistFiles(): string[] {
  const distDir = path.join(projectRoot, "dist");
  if (!fs.existsSync(distDir)) return [];

  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else out.push(path.relative(projectRoot, abs).replace(/\\/g, "/"));
    }
  };
  walk(distDir);
  return out;
}

/** Say plainly when a build exists but is not being sent — the silent version of this wastes an afternoon. */
function noteDistState(files: string[]): void {
  const index = path.join(projectRoot, "dist", "index.html");
  if (!fs.existsSync(index)) return;

  const built = fs.statSync(index).mtime;
  const age = Math.round((Date.now() - built.getTime()) / 60000);
  const when = age < 60 ? `${age} นาทีที่แล้ว` : `${Math.round(age / 60)} ชั่วโมงที่แล้ว`;

  if (files.some((f) => f.startsWith("dist/"))) {
    console.log(`Frontend    : ส่งด้วย — build เมื่อ ${when}`);
  } else {
    console.log(
      `Frontend    : ❗ ไม่ได้ส่ง (dist/ อยู่ใน .gitignore) — build ล่าสุดเมื่อ ${when}\n` +
        `              ใส่ --with-dist ถ้าต้องการอัปหน้าเว็บด้วย`,
    );
  }
}

/**
 * Only files the host actually serves. Sources that get compiled (tsx, ts) reach the host through
 * dist/, and sending them raw would publish source without changing behaviour.
 */
function isDeployable(rel: string): boolean {
  if (rel.startsWith("api/") && rel.endsWith(".php")) return true;
  if (rel.startsWith("dist/")) return true;
  if (rel === ".htaccess") return true;
  return false;
}

// ── Preflight ──────────────────────────────────────────────────────────────────────────────────

/** Files that exist locally but have never been committed — so they are almost certainly not on the host. */
function newLocalFiles(): Set<string> {
  const out = new Set<string>();
  for (const line of git("git status --porcelain=v1 --untracked-files=all").split(/\r?\n/)) {
    if (!line) continue;
    const status = line.slice(0, 2);
    if (status === "??" || status.includes("A")) {
      out.add(line.slice(3).trim().replace(/^"|"$/g, "").replace(/\\/g, "/"));
    }
  }
  return out;
}

/** Resolve `require_once __DIR__ . '/../x.php'` and `require_once 'x.php'` to a repo-relative path. */
function requiredPaths(absFile: string): string[] {
  const src = fs.readFileSync(absFile, "utf-8");
  const dir = path.dirname(absFile);
  const found: string[] = [];

  const dirRelative = /(?:require|include)(?:_once)?\s*\(?\s*__DIR__\s*\.\s*['"]([^'"]+)['"]/g;
  for (const m of src.matchAll(dirRelative)) {
    found.push(path.resolve(dir, "." + m[1]));
  }
  const plain = /(?:require|include)(?:_once)?\s*\(?\s*['"](\.[^'"]+\.php)['"]/g;
  for (const m of src.matchAll(plain)) {
    found.push(path.resolve(dir, m[1]));
  }

  return found
    .map((abs) => path.relative(projectRoot, abs).replace(/\\/g, "/"))
    .filter((rel) => !rel.startsWith(".."));
}

/** The compiled base path must match where the bundle is going, or the site renders blank. */
function checkBasePath(files: string[], target: string): void {
  if (!files.some((f) => f.startsWith("dist/"))) return;

  const file = path.join(projectRoot, "appBasePath.ts");
  if (!fs.existsSync(file)) return;

  let basePath: string | null = null;
  for (const line of fs.readFileSync(file, "utf-8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("/*")) continue;
    const m = trimmed.match(/const\s+APP_BASE_PATH\s*=\s*['"]([^'"]+)['"]/);
    if (m) {
      basePath = m[1];
      break;
    }
  }
  if (!basePath) return;

  const expected = `/${target}/`;
  if (basePath !== expected) {
    fail(
      `appBasePath.ts says APP_BASE_PATH = '${basePath}' but you are deploying to '${target}'.\n` +
        `The bundle in dist/ would look for its assets under ${basePath}, so ${expected} would render a blank page.\n\n` +
        `Fix: set APP_BASE_PATH = '${expected}' in appBasePath.ts, re-run the build, then deploy again.\n` +
        `(Uploading only api/*.php files needs no rebuild — the base path does not affect them.)`,
    );
  }
  console.log(`  ✓ APP_BASE_PATH '${basePath}' matches target '${target}'`);
}

function preflight(files: string[], target: string): void {
  console.log("Preflight");

  const phpFiles = files.filter((f) => f.endsWith(".php"));
  let syntaxChecked = 0;

  for (const rel of phpFiles) {
    const abs = path.join(projectRoot, rel);
    if (!fs.existsSync(abs)) fail(`${rel} is in the upload list but does not exist locally.`);
    try {
      execFileSync("php", ["-l", abs], { stdio: "pipe" });
      syntaxChecked++;
    } catch (e: any) {
      const out = (e.stdout?.toString() || e.message || "").trim();
      fail(`PHP syntax error in ${rel}\n  ${out}`);
    }
  }
  if (syntaxChecked) console.log(`  ✓ php -l passed on ${syntaxChecked} file(s)`);

  checkBasePath(files, target);

  // The coupling check. A require_once target that is new locally must travel with its dependants.
  const uploading = new Set(files);
  const isNew = newLocalFiles();
  const missing: string[] = [];

  for (const rel of phpFiles) {
    for (const dep of requiredPaths(path.join(projectRoot, rel))) {
      if (isNew.has(dep) && !uploading.has(dep)) {
        missing.push(`${rel}  →  requires ${dep}`);
      }
    }
  }

  if (missing.length) {
    fail(
      "These files require a file that is new locally and is not in this upload.\n" +
        "Uploading them alone would fatal-error the API:\n\n" +
        [...new Set(missing)].map((m) => "  " + m).join("\n") +
        "\n\nAdd the missing file(s) to the upload, or leave the dependants out.\n" +
        "(A file that is already live but still untracked in git looks 'new' here — committing it clears the warning.)",
    );
  }
  if (phpFiles.length) {
    console.log("  ✓ every require_once target is already live or travelling with this upload");
  }

  const skipped = files.filter((f) => !isDeployable(f));
  if (skipped.length) {
    console.log(`  · ${skipped.length} changed file(s) are not host-served, so they are skipped:`);
    for (const s of skipped.slice(0, 12)) console.log(`      ${s}`);
    if (skipped.length > 12) console.log(`      … and ${skipped.length - 12} more`);
  }
}

// ── Upload ─────────────────────────────────────────────────────────────────────────────────────

function main(): void {
  const target = argValue("--target");
  if (!target) {
    fail(
      "Pass --target (no default, so nobody reaches production by accident).\n" +
        "  --target beta_test    test copy on the host\n" +
        "  --target mini_erp     PRODUCTION",
    );
  }

  const host = cfg("FTP_HOST");
  const user = cfg("FTP_USER");
  const pass = cfg("FTP_PASS");
  const root = cfg("FTP_REMOTE_ROOT");
  const base = argValue("--base") ?? (root ? `${root.replace(/\/+$/, "")}/${target}` : undefined);

  const all = resolveFileList();
  const files = all.filter(isDeployable);

  console.log(`Target      : ${target}${target === "mini_erp" ? "  ⚠ PRODUCTION" : ""}`);
  console.log(`Remote base : ${base ?? "(not configured — dry run only)"}`);
  console.log(`Mode        : ${apply ? "APPLY (will overwrite)" : "dry run"}`);
  console.log(`Candidates  : ${all.length} changed, ${files.length} host-served`);
  noteDistState(files);
  console.log("");

  if (files.length === 0) {
    console.log("Nothing to upload.");
    return;
  }

  preflight(all, target);

  const shown = files.filter((f) => !f.startsWith("dist/assets/"));
  console.log(`\nFiles to upload (${files.length}):`);
  for (const f of shown) {
    const size = fs.statSync(path.join(projectRoot, f)).size;
    console.log(`  ${String(size).padStart(8)} B  ${f}`);
  }
  if (shown.length < files.length) {
    console.log(`  … plus ${files.length - shown.length} bundled asset(s) under dist/assets/`);
  }

  if (!apply) {
    console.log("\nDry run — nothing was sent. Re-run with --apply to upload.");
    return;
  }

  if (!host || !user || !pass || !base) {
    fail(
      "Missing FTP settings. Put these in the gitignored .env at the project root:\n" +
        "  FTP_HOST=...\n  FTP_USER=...\n  FTP_PASS=...\n" +
        "  FTP_REMOTE_ROOT=/domains/<your-domain>/public_html\n" +
        "(or pass the full remote path with --base)",
    );
  }

  // Keep the password out of the process list / shell history.
  const confDir = fs.mkdtempSync(path.join(os.tmpdir(), "host-deploy-"));
  const confPath = path.join(confDir, "ftp.conf");
  fs.writeFileSync(
    confPath,
    `user = "${user}:${pass}"\nconnect-timeout = 20\nmax-time = 600\n`,
    { mode: 0o600 },
  );

  let uploaded = 0;
  const failures: string[] = [];

  try {
    console.log("\nUploading");
    for (const rel of files) {
      const remote = `ftp://${host}${base.replace(/\/+$/, "")}/${rel}`;
      try {
        execFileSync(
          "curl",
          [
            "-s", "-S", "--fail", "--ftp-create-dirs", "-K", confPath,
            "-T", path.join(projectRoot, rel), remote,
          ],
          { stdio: "pipe" },
        );
        uploaded++;
        console.log(`  ✓ ${rel}`);
      } catch (e: any) {
        const msg = (e.stderr?.toString() || e.message || "").trim();
        failures.push(`${rel}: ${msg}`);
        console.log(`  ✗ ${rel}  ${msg}`);
      }
    }
  } finally {
    fs.rmSync(confDir, { recursive: true, force: true });
  }

  console.log(`\n${uploaded}/${files.length} uploaded.`);
  if (failures.length) {
    console.error("\nFailed:");
    for (const f of failures) console.error("  " + f);
    process.exit(1);
  }
}

main();
