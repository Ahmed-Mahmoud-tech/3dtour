/**
 * Purge the uploads/_originals archive (camera masters kept before lossy
 * transcodes).
 *
 * Policy 2026-07-19: originals are unused by the serving path and are deleted
 * after optimization; this script reclaims the disk held by masters archived
 * under the OLD policy.
 *
 * ⚠️  IRREVERSIBLE. These are the only server-side copies of the camera
 * masters — after purging, a corrupted transcode can only be recovered from
 * the camera's own storage (in July 2026 this archive is what rescued the
 * corrupted transition clips — see scripts/restore-originals.mjs).
 *
 * Dry run (default):  node scripts/purge-originals.mjs
 * Actually delete:    node scripts/purge-originals.mjs --yes
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ORIGINALS_DIR = path.resolve(__dirname, '../uploads/_originals');
const confirmed = process.argv.includes('--yes');

const fmtSize = (bytes) => {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.ceil(bytes / 1024)} KB`;
};

let entries;
try {
  entries = fs.readdirSync(ORIGINALS_DIR);
} catch {
  console.log(`Nothing to purge — ${ORIGINALS_DIR} does not exist.`);
  process.exit(0);
}

let total = 0;
const files = [];
for (const name of entries) {
  const full = path.join(ORIGINALS_DIR, name);
  const stat = fs.statSync(full);
  if (!stat.isFile()) continue;
  files.push({ name, full, size: stat.size });
  total += stat.size;
}

if (files.length === 0) {
  console.log('Nothing to purge — the archive is empty.');
  process.exit(0);
}

console.log(`${files.length} archived original(s), ${fmtSize(total)} total:`);
for (const f of files) console.log(`  ${fmtSize(f.size).padStart(10)}  ${f.name}`);

if (!confirmed) {
  console.log('\nDry run — nothing deleted. Re-run with --yes to delete these files permanently.');
  process.exit(0);
}

let freed = 0;
for (const f of files) {
  fs.unlinkSync(f.full);
  freed += f.size;
}
console.log(`\nDeleted ${files.length} file(s), freed ${fmtSize(freed)}.`);
