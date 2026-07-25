// Regression check for the "Random style" button.
//
// Two ways it used to lie to you:
//   1. It drew from every record when nothing was filtered in, so a search with
//      no matches opened a dossier for a style that has no node on the globe —
//      and the camera stayed put, because Globe resolves the fly-to target out
//      of the records it was actually given.
//   2. It drew with replacement, so it could return the style already open. At
//      22 records that reads as an occasional dead click; under a filter that
//      leaves a single match it is a dead button every time.
//
// Usage: npm run dev, then `node scripts/check-random.mjs`
import { chromium } from 'playwright';

const URL = process.env.ATLAS_URL || 'http://localhost:3111/';
const DRAWS = 25;

// Headless Chromium has no GPU; the SceneView never reaches `ready` without a
// software rasteriser.
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(URL, { waitUntil: 'domcontentloaded' });

const enter = page.locator('.hero__enter');
if (await enter.count()) {
  await enter.click();
  await page.locator('.hero').waitFor({ state: 'detached', timeout: 45000 });
}
await page.waitForSelector('.glabel', { timeout: 120000, state: 'attached' });
await page.waitForTimeout(2000);

// Freeze the spin so camera movement is attributable to the button alone.
const spin = page.locator('.zoom__spin');
if ((await spin.getAttribute('aria-pressed')) === 'true') await spin.click();
await page.waitForTimeout(500);

const btn = page.locator('button[aria-label="Random style"]');
const search = page.locator('.topsearch input');
const title = () => page.evaluate(() => document.querySelector('.panel .name')?.textContent?.trim() ?? null);

// Parse a "12.3456° N, 65.4321° W" style readout into signed degrees. The
// dossier prints 4dp, the camera readout 1dp, so compare numerically.
const parseLL = (s) => {
  const m = s && s.match(/([\d.]+)°\s*([NS]),\s*([\d.]+)°\s*([EW])/);
  if (!m) return null;
  return { lat: +m[1] * (m[2] === 'S' ? -1 : 1), lng: +m[3] * (m[4] === 'W' ? -1 : 1) };
};
const camera = async () => parseLL(await page.evaluate(() => document.querySelector('.coordread span')?.textContent?.trim() ?? ''));
const dossierLL = async () => parseLL(await page.evaluate(() => {
  const row = [...document.querySelectorAll('.panel .meta__row')].find((r) => r.querySelector('.k')?.textContent.trim() === 'Coordinates');
  return row?.querySelector('.v')?.textContent?.trim() ?? '';
}));

// The fly is 800ms, but under a software rasteriser the SceneView starves the
// animation clock badly enough that a fixed sleep is a coin flip. Poll for the
// camera to converge on the record the dossier is showing instead.
async function cameraReaches(target, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await camera();
    if (last && Math.abs(last.lat - target.lat) <= 0.2 && Math.abs(last.lng - target.lng) <= 0.2) return true;
    await page.waitForTimeout(150);
  }
  console.error(`      camera stalled at ${JSON.stringify(last)}, wanted ${JSON.stringify(target)}`);
  return false;
}

const fail = (msg) => { console.error(`FAIL ${msg}`); failed = true; };
let failed = false;

// ── 1. consecutive draws never repeat, and the camera lands on the pick ──
let prevTitle = await title();
const drawn = new Set();
for (let i = 0; i < DRAWS; i++) {
  await btn.click();
  await page.waitForTimeout(250); // let the click commit before reading
  const t = await title();
  if (!t) { fail(`draw ${i + 1} opened no dossier`); break; }
  if (t === prevTitle) { fail(`draw ${i + 1} re-picked the open style (${t}) — a dead click`); break; }
  const target = await dossierLL();
  if (!target) { fail(`draw ${i + 1} (${t}) has no coordinates in its dossier`); break; }
  if (!(await cameraReaches(target))) { fail(`draw ${i + 1} picked ${t} but the camera never flew there`); break; }
  drawn.add(t);
  prevTitle = t;
}
if (!failed) console.log(`PASS ${DRAWS} draws, no repeat of the open style, camera landed on every pick (${drawn.size} distinct)`);

// ── 2. nothing filtered in => the button goes disabled, not silently dead ──
await search.fill('zzzzqqq');
await page.waitForTimeout(600);
const visibleNodes = await page.locator('.glabel').evaluateAll((els) => els.filter((e) => e.style.visibility === 'visible').length);
if (visibleNodes !== 0) fail(`expected no visible globe nodes for a zero-match query, got ${visibleNodes}`);
if (!(await btn.isDisabled())) {
  fail('button is still enabled with nothing filtered in — it would open a dossier for a style the globe is not showing');
} else {
  console.log('PASS button disabled when the query matches nothing');
}

// ── 3. it comes back when the query is cleared ──
await search.fill('');
await page.waitForTimeout(600);
if (await btn.isDisabled()) fail('button stayed disabled after clearing the query');
else console.log('PASS button re-enables when the query is cleared');

// ── 4. a filter leaving exactly the open style also disables it ──
const before = await title();
await search.fill(before ?? '');
await page.waitForTimeout(600);
const matches = await page.locator('.glabel').evaluateAll((els) => els.filter((e) => e.style.visibility === 'visible').length);
if (matches === 1 && !(await btn.isDisabled())) {
  fail(`query "${before}" leaves only the already-open style, but the button is enabled — every click would be dead`);
} else if (matches === 1) {
  console.log('PASS button disabled when the only match is the style already open');
} else {
  console.log(`SKIP single-match case (query "${before}" left ${matches} nodes)`);
}

await browser.close();
process.exit(failed ? 1 : 0);
