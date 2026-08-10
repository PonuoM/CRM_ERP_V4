#!/usr/bin/env node

/**
 * Prune stale Vite bundles from the host's dist/assets over FTP.
 *
 * Vite emits content-hashed filenames (index-<hash>.js). Uploading a new build
 * never overwrites the previous one, so every deploy leaves its predecessor
 * behind. Left unattended this filled the account's disk quota and took the
 * server down (sessions could no longer be written).
 *
 * A remote asset is deleted only when ALL of these hold:
 *   - it is not present in the local build that is being deployed
 *   - it is not referenced by the local dist/index.html
 *   - it is older than ASSET_KEEP_DAYS (grace window for browsers still
 *     holding a cached index.html that points at the previous bundle)
 *
 * Dry-run by default. Pass --apply to actually delete.
 *
 * Credentials come from the environment or the gitignored .env at project root:
 *   FTP_HOST, FTP_USER, FTP_PASS, FTP_REMOTE_BASE
 * where FTP_REMOTE_BASE is the app root on the host, e.g.
 *   /domains/prima49.com/public_html/mini_erp
 *
 * Usage:
 *   npx tsx scripts/host/prune-remote-assets.ts                  # dry run
 *   npx tsx scripts/host/prune-remote-assets.ts --apply
 *   npx tsx scripts/host/prune-remote-assets.ts --base /domains/.../testweb1 --apply
 */

import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..", "..");

const ASSET_KEEP_DAYS = 7;

const args = process.argv.slice(2);
const apply = args.includes("--apply");

function argValue(name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

/** Minimal .env reader — we only need a handful of keys and want no new deps. */
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

const fileEnv = loadEnvFile();
function cfg(key: string): string | undefined {
  return process.env[key] ?? fileEnv[key];
}

/**
 * Parse one ProFTPD/unix LIST line.
 * Recent entries carry "Mon DD HH:MM"; older ones carry "Mon DD  YYYY".
 */
const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

interface RemoteFile {
  name: string;
  size: number;
  mtime: number;
}

function parseListing(listing: string): RemoteFile[] {
  const now = new Date();
  const files: RemoteFile[] = [];

  for (const line of listing.split(/\r?\n/)) {
    if (!line.startsWith("-")) continue; // files only, skip dirs/symlinks
    const parts = line.split(/\s+/);
    if (parts.length < 9) continue;

    const size = Number(parts[4]);
    const month = MONTHS[parts[5]];
    const day = Number(parts[6]);
    const timeOrYear = parts[7];
    const name = parts.slice(8).join(" ");
    if (!name || Number.isNaN(size) || month === undefined) continue;

    let mtime: number;
    if (/^\d{4}$/.test(timeOrYear)) {
      mtime = new Date(Number(timeOrYear), month, day).getTime();
    } else {
      const [h, m] = timeOrYear.split(":").map(Number);
      // No year in the listing: it is within the last ~6 months. If the month
      // is still ahead of today, it must belong to the previous year.
      const year =
        month > now.getMonth() ? now.getFullYear() - 1 : now.getFullYear();
      mtime = new Date(year, month, day, h || 0, m || 0).getTime();
    }

    files.push({ name, size, mtime });
  }

  return files;
}

function main(): void {
  const host = cfg("FTP_HOST");
  const user = cfg("FTP_USER");
  const pass = cfg("FTP_PASS");
  const base = argValue("--base") ?? cfg("FTP_REMOTE_BASE");

  if (!host || !user || !pass || !base) {
    console.error(
      "Missing FTP settings. Set FTP_HOST, FTP_USER, FTP_PASS and FTP_REMOTE_BASE\n" +
        "in the environment or in the gitignored .env at the project root.\n" +
        "FTP_REMOTE_BASE is the app root on the host, e.g. /domains/example.com/public_html/mini_erp",
    );
    process.exit(1);
  }

  // Prefer the folder that host-build.ts produced; fall back to a plain vite build.
  const localAssets = [
    path.join(projectRoot, "host", "dist", "assets"),
    path.join(projectRoot, "dist", "assets"),
  ].find((p) => fs.existsSync(p));

  if (!localAssets) {
    console.error(
      "No local build found (looked for host/dist/assets and dist/assets).\n" +
        "Run `npm run host:build` first — pruning without a local build would delete the live bundle.",
    );
    process.exit(1);
  }

  const localIndex = path.join(localAssets, "..", "index.html");
  const keep = new Set(fs.readdirSync(localAssets));

  // Belt and braces: never delete anything index.html still points at.
  if (fs.existsSync(localIndex)) {
    const html = fs.readFileSync(localIndex, "utf-8");
    for (const m of html.matchAll(/assets\/([A-Za-z0-9._-]+\.(?:js|css))/g)) {
      keep.add(m[1]);
    }
  }

  const remoteDir = `${base.replace(/\/+$/, "")}/dist/assets`;
  console.log(`Local build : ${localAssets} (${keep.size} files)`);
  console.log(`Remote dir  : ${remoteDir}`);
  console.log(`Mode        : ${apply ? "APPLY (will delete)" : "dry run"}`);

  // Keep the password out of the process list / shell history.
  const confPath = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "prune-ftp-")),
    "ftp.conf",
  );
  fs.writeFileSync(
    confPath,
    `user = "${user}:${pass}"\nconnect-timeout = 20\nmax-time = 300\n`,
    { mode: 0o600 },
  );

  try {
    // The local build may be older than what is actually deployed. The remote
    // index.html is the only authority on which bundle is live right now, so
    // whatever it references is protected regardless of local state.
    const remoteIndex = execFileSync(
      "curl",
      ["-s", "-K", confPath, `ftp://${host}${base.replace(/\/+$/, "")}/dist/index.html`],
      { encoding: "utf-8", maxBuffer: 8 * 1024 * 1024 },
    );

    const liveRefs: string[] = [];
    for (const m of remoteIndex.matchAll(/assets\/([A-Za-z0-9._-]+\.(?:js|css))/g)) {
      liveRefs.push(m[1]);
      keep.add(m[1]);
    }

    if (liveRefs.length === 0) {
      console.error(
        "\nCould not read the live dist/index.html (or it references no assets).\n" +
          "Refusing to prune — deleting the bundle a live index.html points at would take the app down.",
      );
      process.exit(1);
    }
    console.log(`Live bundles: ${liveRefs.join(", ")}`);

    const listing = execFileSync(
      "curl",
      ["-s", "-K", confPath, `ftp://${host}${remoteDir}/`],
      { encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 },
    );

    const remote = parseListing(listing);
    if (remote.length === 0) {
      console.error("Remote listing came back empty — aborting rather than guessing.");
      process.exit(1);
    }

    const cutoff = Date.now() - ASSET_KEEP_DAYS * 24 * 60 * 60 * 1000;
    const stale: RemoteFile[] = [];
    let keptRecent = 0;

    for (const f of remote) {
      if (keep.has(f.name)) continue;
      if (f.mtime > cutoff) {
        keptRecent++;
        continue;
      }
      stale.push(f);
    }

    const freed = stale.reduce((sum, f) => sum + f.size, 0);
    console.log(
      `\nRemote has ${remote.length} file(s). ` +
        `${stale.length} stale, ${keptRecent} within the ${ASSET_KEEP_DAYS}-day grace window.`,
    );
    console.log(`Reclaimable : ${(freed / 1048576).toFixed(1)} MB\n`);

    if (stale.length === 0) {
      console.log("Nothing to prune.");
      return;
    }

    for (const f of stale.slice(0, 10)) {
      console.log(`  ${(f.size / 1048576).toFixed(1).padStart(8)} MB  ${f.name}`);
    }
    if (stale.length > 10) console.log(`  ... and ${stale.length - 10} more`);

    if (!apply) {
      console.log("\nDry run — nothing deleted. Re-run with --apply to delete.");
      return;
    }

    // One connection per chunk; `*` prefix keeps a single failure from
    // aborting the remaining deletes in that batch.
    const CHUNK = 40;
    let deleted = 0;
    for (let i = 0; i < stale.length; i += CHUNK) {
      const chunk = stale.slice(i, i + CHUNK);
      const cmdArgs = ["-s", "-K", confPath];
      for (const f of chunk) cmdArgs.push("-Q", `*DELE ${remoteDir}/${f.name}`);
      cmdArgs.push(`ftp://${host}${remoteDir}/`, "-o", os.devNull);

      execFileSync("curl", cmdArgs, { encoding: "utf-8" });
      deleted += chunk.length;
      console.log(`  deleted ${deleted}/${stale.length}`);
    }

    console.log(`\nPruned ${deleted} file(s), freed ${(freed / 1048576).toFixed(1)} MB.`);
  } finally {
    fs.rmSync(path.dirname(confPath), { recursive: true, force: true });
  }
}

main();
