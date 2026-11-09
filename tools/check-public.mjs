import { readdir, readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url));
const skip = new Set(['node_modules', '__pycache__', '.git', '.cache', 'dist', 'release', 'artifacts']);
const generated = ['frontend/public/alphatab/', 'frontend/public/font/', 'frontend/public/soundfont/'];
let files = 0; const problems = [];
async function visit(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (skip.has(entry.name) || entry.name === '.DS_Store') continue;
    const p = join(dir, entry.name), rel = relative(root, p);
    if (generated.some(prefix => (rel + '/').startsWith(prefix))) continue;
    if (entry.isSymbolicLink()) { problems.push(rel + ': unexpected symlink'); continue; }
    if (entry.isDirectory()) { await visit(p); continue; }
    files++;
    if (/\.(musicxml|mxl|mid|midi|quick\.json)$/i.test(rel) && !['tests/fixtures/timing.musicxml', 'examples/Day One.musicxml', 'examples/Are You Lost.musicxml'].includes(rel)) problems.push(rel + ': unapproved music');
    if (/(^|\/)(\.env|.*\.(pem|key|db|sqlite|zip|dmg)|Login Data|Cookies|Preferences)$/.test(rel)) problems.push(rel + ': private/generated artifact');
    if ((await stat(p)).size > 5 * 1024 * 1024) problems.push(rel + ': unexpectedly large source file');
    if (/\.(png|wav|ico)$/i.test(rel)) continue;
    const text = await readFile(p, 'utf8');
    if (/\/Users\/[a-zA-Z0-9_-]+\/|\/var\/folders\/|gh[pousr]_[A-Za-z0-9]{25,}|sk-proj-[A-Za-z0-9_-]{20,}/.test(text)) problems.push(rel + ': private path or credential pattern');
  }
}
await visit(root);
if (problems.length) throw new Error(problems.join('\n'));
execFileSync(process.env.PYTHON || 'python3', [join(root, 'tools/fetch-samples.py'), '--verify-only'], { stdio: 'inherit' });
console.log('Public source check passed:', files, 'files; only listed example scores; no profiles or private paths.');
