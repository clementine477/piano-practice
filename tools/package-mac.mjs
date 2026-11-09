import packager from '@electron/packager';
import { createRequire } from 'node:module';
import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

if (process.platform !== 'darwin') throw new Error('Build the macOS preview on macOS.');
const root = fileURLToPath(new URL('../', import.meta.url));
const stage = join(root, '.cache/package');
await rm(stage, { recursive: true, force: true });
await cp(join(root, 'desktop'), stage, { recursive: true, filter: p => !p.includes('/node_modules') && !p.includes('/tests') });
const desktopPackage = JSON.parse(await readFile(join(stage, 'package.json'), 'utf8'));
const resolveFromDesktop = createRequire(join(root, 'desktop/package.json'));
const copied = new Set();
async function copyDependency(name, resolver) {
  if (copied.has(name)) return;
  copied.add(name);
  const manifest = resolver.resolve(name + '/package.json');
  const directory = dirname(manifest);
  const info = JSON.parse(await readFile(manifest, 'utf8'));
  await cp(directory, join(stage, 'node_modules', name), { recursive: true, filter: p => p === directory || !p.slice(directory.length + 1).startsWith('node_modules') });
  for (const dependency of Object.keys(info.dependencies || {})) await copyDependency(dependency, createRequire(manifest));
}
for (const dependency of Object.keys(desktopPackage.dependencies || {})) await copyDependency(dependency, resolveFromDesktop);
delete desktopPackage.devDependencies;
delete desktopPackage.scripts;
await writeFile(join(stage, 'package.json'), JSON.stringify(desktopPackage, null, 2));
const electron = JSON.parse(await readFile(resolveFromDesktop.resolve('electron/package.json'), 'utf8'));
await mkdir(join(root, 'release'), { recursive: true });
const apps = await packager({
  dir: stage, out: join(root, 'release'), name: 'Piano Practice',
  platform: 'darwin', arch: process.arch, electronVersion: electron.version,
  appVersion: desktopPackage.version, appBundleId: 'local.piano.practice',
  asar: true, prune: false, overwrite: true,
  extraResource: [join(root, 'frontend/dist'), join(root, 'LICENSE'), join(root, 'NOTICE'), join(root, 'licenses')],
});
for (const directory of apps) {
  const app = join(directory, 'Piano Practice.app');
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
  execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' });
  console.log('Built and locally signed:', app);
}
console.log('This preview is not Apple-notarized. See README for installation.');
