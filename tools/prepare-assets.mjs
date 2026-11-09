import { cp, mkdir, readFile, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const vendor = resolve(root, 'frontend/node_modules/@coderline/alphatab');
const publicDir = resolve(root, 'frontend/public');
const meta = JSON.parse(await readFile(join(vendor, 'package.json'), 'utf8'));
if (meta.version !== '1.8.3') throw new Error('Review alphaTab adaptations before changing its version.');
await mkdir(join(publicDir, 'alphatab'), { recursive: true });
for (const name of ['alphaTab.mjs', 'alphaTab.core.mjs', 'alphaTab.worker.mjs', 'alphaTab.worklet.mjs', 'alphaTab.js']) {
  await copyFile(join(vendor, 'dist', name), join(publicDir, 'alphatab', name));
}
await copyFile(join(vendor, 'LICENSE'), join(publicDir, 'alphatab/LICENSE'));
await cp(join(vendor, 'dist/font'), join(publicDir, 'font'), { recursive: true });
await mkdir(join(publicDir, 'soundfont'), { recursive: true });
await copyFile(join(vendor, 'dist/soundfont/sonivox.sf3'), join(publicDir, 'soundfont/sonivox.sf3'));
await copyFile(join(vendor, 'dist/soundfont/LICENSE'), join(publicDir, 'soundfont/SONiVOX-LICENSE'));
execFileSync(process.env.PYTHON || 'python3', [join(root, 'tools/patch-alphatab.py')], { stdio: 'inherit' });
console.log('Renderer, fonts and soundfont prepared from pinned npm packages.');
