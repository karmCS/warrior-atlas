// Regression check: the globe canvas fills its container.
//
// The ArcGIS SDK ships no CSS of its own. Without the view box-model rules,
// .esri-view-surface has no height, the WebGL <canvas>'s height:100% has nothing to
// resolve against, and it falls back to a canvas element's intrinsic 300x150 — so the
// globe renders at exactly half its container's WIDTH in height and leaves a dead band
// underneath. It still tracks window resizes; it is just wrong at every size, which is
// why this went unnoticed.
//
// app/globals.css carries those rules inline rather than importing the SDK's 340 kB
// stylesheet. That means this app depends on Esri-internal class names, so this check
// exists to fail loudly if an SDK upgrade renames them.
//
// Usage: npm run dev (or npm start), then `node scripts/check-globe-fit.mjs`
import { chromium } from 'playwright';

const URL = process.env.ATLAS_URL || 'http://localhost:3111/';
const TOLERANCE_PX = 2;
const SIZES = [
  { w: 1440, h: 900 },
  { w: 1280, h: 780 },
  { w: 1024, h: 900 },
];

// Headless Chromium has no GPU; the SceneView never reaches `ready` without a
// software rasteriser.
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: SIZES[0].w, height: SIZES[0].h } });
await page.goto(URL, { waitUntil: 'domcontentloaded' });

const enter = page.locator('.hero__enter');
if (await enter.count()) {
  await enter.click();
  await page.locator('.hero').waitFor({ state: 'detached', timeout: 45000 });
}
await page.waitForSelector('.esri-view canvas', { timeout: 120000, state: 'attached' });
await page.waitForTimeout(2000);

const measure = () => page.evaluate(() => {
  const pick = (s) => document.querySelector(s);
  const box = (el) => (el ? { w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) } : null);
  return {
    container: box(pick('.map')),
    viewRoot: box(pick('.esri-view')),
    surface: box(pick('.esri-view-surface')),
    canvas: box(pick('.esri-view canvas')),
  };
});

let failed = false;
for (const size of SIZES) {
  await page.setViewportSize({ width: size.w, height: size.h });
  await page.waitForTimeout(1500);
  const m = await measure();
  if (!m.canvas || !m.container) {
    console.error(`FAIL ${size.w}x${size.h}: could not find the globe canvas or its container`);
    failed = true;
    continue;
  }
  const dh = Math.abs(m.canvas.h - m.container.h);
  const dw = Math.abs(m.canvas.w - m.container.w);
  const ratio = (m.canvas.w / m.canvas.h).toFixed(3);
  if (dh > TOLERANCE_PX || dw > TOLERANCE_PX) {
    console.error(
      `FAIL ${size.w}x${size.h}: canvas ${m.canvas.w}x${m.canvas.h} does not fill its ` +
      `${m.container.w}x${m.container.h} container (off by ${dw}x${dh}px, aspect ${ratio}). ` +
      (ratio === '2.000' ? 'Aspect is exactly 2.000 — the canvas has fallen back to its intrinsic 300x150, i.e. the view box-model CSS is missing.' : ''),
    );
    failed = true;
  } else {
    console.log(`PASS ${String(size.w).padStart(4)}x${size.h}: canvas ${m.canvas.w}x${m.canvas.h} fills its container`);
  }
}

await browser.close();
process.exit(failed ? 1 : 0);
