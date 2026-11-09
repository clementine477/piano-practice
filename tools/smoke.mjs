import { _electron } from 'playwright';
import { createRequire } from 'node:module';
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const requireDesktop = createRequire(join(root, 'desktop/package.json'));
await mkdir(join(root, '.cache'), { recursive: true });
const profile = await mkdtemp(join(root, '.cache/smoke-'));
const executablePath = process.env.PIANO_TEST_APP || requireDesktop('electron');
const args = [...(process.env.PIANO_TEST_APP ? [] : [join(root, 'desktop')]), '--user-data-dir=' + profile, '--headless-check', '--mute-audio'];
const app = await _electron.launch({ executablePath, args });
const errors = [], requests = [];
try {
  const page = await app.firstWindow();
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => requests.push({ url: request.url(), error: request.failure()?.errorText }));
  await page.waitForURL('p225://app/?smoke=1');
  await page.waitForLoadState('load');
  await page.waitForFunction(() => window.qa?.useAppStore.getState().libraryReady);
  assert.equal(await page.evaluate(() => window.qa.useAppStore.getState().savedSongs.length), 0);
  assert.equal(await page.getByRole('button', { name: /^(课程|Courses)$/ }).count(), 0);
  const xml = await readFile(join(root, 'tests/fixtures/timing.musicxml'), 'utf8');
  await page.evaluate(async xml => window.qa.useAppStore.getState().loadMusicXmlFile(new File([xml], 'Timing.musicxml', { type: 'application/xml' })), xml);
  await page.waitForFunction(() => window.qa.useAppStore.getState().document?.notes.length === 72);
  const document = await page.evaluate(() => {
    const d = window.qa.useAppStore.getState().document;
    return { notes: d.notes.length, hands: d.notes.reduce((s, n) => (s[n.hand] = (s[n.hand] || 0) + 1, s), {}), tempoMap: d.tempoMap, pedal: d.sustainRanges, duration: d.totalDuration };
  });
  assert.equal(document.hands.left, 8);
  assert.equal(document.hands.right, 64);
  assert.equal(document.pedal.length, 8);
  assert(Math.abs(document.duration - (16 * 60 / 90 + 16 * 60 / 108)) < 0.01);
  assert.deepEqual([...new Set(document.tempoMap.map(t => Math.round(t.bpm)))], [90,108]);
  const checks = [];
  for (const instrument of ['upright-kw', 'ydp-grand', 'salamander-grand', 'steinway-b']) {
    await page.evaluate(async instrument => {
      const q = window.qa, s = q.useAppStore.getState();
      q.syncEngine.pause(); s.updateSettings({ instrument }); s.setDemo(true); s.seek(2);
      await q.syncEngine.play();
    }, instrument);
    await page.waitForTimeout(1000);
    const result = await page.evaluate(async () => {
      const q = window.qa, piano = q.pianoSampledPlayback.piano, a = piano.context.createAnalyser();
      a.fftSize = 4096; piano.output.connect(a);
      const rms = () => { const x = new Float32Array(4096); a.getFloatTimeDomainData(x); return Math.sqrt(x.reduce((s,v) => s + v*v, 0)/x.length); };
      await new Promise(r => setTimeout(r, 80)); const audible = rms();
      q.syncEngine.pause(); const before = q.useAppStore.getState().currentSeconds;
      await new Promise(r => setTimeout(r, 250));
      const result = { audible, silent: rms(), voices: piano.voices.size, missing: piano.state.missingSamples, unreleased: piano.state.unreleased, frozen: before === q.useAppStore.getState().currentSeconds };
      a.disconnect(); return result;
    });
    assert(result.audible > 1e-6, instrument + ' must produce audio');
    assert(result.silent < 1e-6, instrument + ' must stop on pause');
    assert.equal(result.voices, 0); assert.equal(result.missing, 0); assert.equal(result.unreleased, 0); assert(result.frozen);
    checks.push({ instrument, ...result });
  }
  for (let i = 0; i < 3; i++) for (const layoutMode of ['falling', 'sheet', 'all', 'piano']) {
    await page.evaluate(layoutMode => window.qa.useAppStore.getState().updateSettings({ layoutMode }), layoutMode);
    await page.waitForTimeout(60);
  }
  await page.evaluate(() => { window.qa.useAppStore.getState().updateSettings({ layoutMode: 'all' }); window.dispatchEvent(new CustomEvent('piano-notation-change', { detail: 'staff' })); });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(root, '.cache/smoke.png') });
  const examples = [];
  if (process.argv.includes('--examples')) for (const title of ['Day One', 'Are You Lost']) {
    const score = await readFile(join(root, 'examples', title + '.musicxml'), 'utf8');
    await page.evaluate(async ({ score, title }) => {
      const q = window.qa; q.syncEngine.pause();
      await q.useAppStore.getState().loadMusicXmlFile(new File([score], title + '.musicxml', { type: 'application/xml' }));
    }, { score, title });
    await page.waitForFunction(title => window.qa.useAppStore.getState().document?.title === title && !window.qa.useAppStore.getState().isLoadingDocument, title);
    const info = await page.evaluate(() => {
      const s = window.qa.useAppStore.getState(), d = s.document;
      return { title: d.title, notes: d.notes.length, bars: d.measures.length, duration: d.totalDuration, error: s.loadError };
    });
    assert(info.notes > 100); assert(info.duration > 60); assert(!info.error);
    examples.push(info);
    await page.waitForTimeout(500);
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
  const report = { passed: true, document, checks, examples, viewSwitches: 12, errors, requests };
  await writeFile(join(root, '.cache/smoke.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(JSON.stringify({ errors, requests }));
  const page = await app.firstWindow();
  console.error((await page.locator('body').innerText()).slice(0, 1800));
  throw error;
} finally { await app.close(); }
