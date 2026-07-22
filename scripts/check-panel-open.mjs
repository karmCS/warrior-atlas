// Regression check for the dossier-open swipe.
//
// The panel mounts parked at translateX(100%), i.e. fully outside the stage, and
// immediately focuses its close button. If the stage can scroll, the browser
// scroll-into-views that button and drags the whole map sideways by the panel
// width — the map animates instead of the panel. This asserts the stage does not
// move at all while the dossier opens.
//
// Usage: npm run dev, then `node scripts/check-panel-open.mjs`
import { chromium } from 'playwright';

const URL = process.env.ATLAS_URL || 'http://localhost:3111/';
const TOLERANCE_PX = 2;

// Headless Chromium has no GPU; the SceneView never reaches `ready` without a
// software rasteriser.
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.glabel', { timeout: 120000, state: 'attached' });
await page.waitForTimeout(2500);

// Freeze the spin so only the click is under test.
const spin = page.locator('.zoom__spin');
if ((await spin.getAttribute('aria-pressed')) === 'true') await spin.click();
await page.waitForTimeout(700);

const stageX = () => page.evaluate(() => Math.round(document.querySelector('.stage__main').getBoundingClientRect().x));
const panelX = () => page.evaluate(() => {
  const e = document.querySelector('.panel');
  return e ? Math.round(e.getBoundingClientRect().x) : null;
});

const before = await stageX();
const target = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.glabel')].find((e) => e.style.visibility === 'visible');
  if (!el) return null;
  const r = el.querySelector('.glabel__box').getBoundingClientRect();
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
});
if (!target) { console.error('FAIL no visible country label to click'); await browser.close(); process.exit(1); }

await page.mouse.click(target.x, target.y);

// Sample across the panel's whole 320ms enter animation. Only the stage position
// is asserted — under software rendering the SceneView starves the compositor, so
// the panel's own animation clock advances too erratically to assert on.
let worst = before;
for (let i = 0; i < 16; i++) {
  const s = await stageX();
  if (Math.abs(s - before) > Math.abs(worst - before)) worst = s;
  await page.waitForTimeout(40);
}
const panelRest = await panelX();
await browser.close();

const drift = Math.abs(worst - before);
if (drift > TOLERANCE_PX) {
  console.error(`FAIL stage drifted ${drift}px while the dossier opened (expected <= ${TOLERANCE_PX}px) — the map is animating instead of the panel.`);
  process.exit(1);
}
console.log(`PASS stage held at x=${before} (drift ${drift}px); panel at x=${panelRest}`);
