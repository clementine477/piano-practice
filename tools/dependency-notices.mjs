import { createRequire } from 'node:module';
import { existsSync, realpathSync } from 'node:fs';
import { readFile, readdir, mkdir, copyFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const out = join(root, 'licenses/npm');
await mkdir(out, { recursive: true });
const seen = new Set(), inventory = [];
async function walk(name, from) {
  if (name === '@bach-to-basics/shared') return;
  const req = createRequire(from);
  let manifest;
  for (const p of req.resolve.paths(name) || []) {
    const candidate = join(p, name, 'package.json');
    if (existsSync(candidate)) { manifest = realpathSync(candidate); break; }
  }
  if (!manifest) throw new Error('Cannot resolve license for ' + name);
  const info = JSON.parse(await readFile(manifest, 'utf8'));
  const id = info.name + '@' + info.version;
  if (seen.has(id)) return;
  seen.add(id);
  const dir = dirname(manifest), destination = id.replaceAll('/', '__');
  const files = (await readdir(dir)).filter(n => /^(licen[cs]e|copying|notice)([.\-_]|$)/i.test(n));
  await mkdir(join(out, destination), { recursive: true });
  for (const file of files) await copyFile(join(dir, file), join(out, destination, file));
  inventory.push({ name: info.name, version: info.version, license: info.license || 'SEE LICENSE', repository: info.repository?.url || info.repository || null, notices: files.map(f => destination + '/' + f) });
  for (const dep of Object.keys(info.dependencies || {})) await walk(dep, manifest);
}
for (const p of ['frontend/package.json', 'desktop/package.json']) {
  const from = join(root, p), info = JSON.parse(await readFile(from, 'utf8'));
  for (const dep of Object.keys(info.dependencies || {})) await walk(dep, from);
}
inventory.sort((a,b) => a.name.localeCompare(b.name));
await writeFile(join(out, 'inventory.json'), JSON.stringify(inventory, null, 2) + '\n');
console.log('Included notices for', inventory.length, 'production packages.');
