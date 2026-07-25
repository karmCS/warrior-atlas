// Regression check: the globe draws with the Basemap Styles v2 service, not a fallback.
//
// The two style sources describe the SAME Dark Gray Canvas tiles, and the app recolours
// whichever one it gets into the ember palette — so a key that the v2 service rejects is
// visually undetectable. The globe looks perfect while quietly running on the public
// legacy style item. Only the network tells the truth, which is what this checks.
//
// Esri reports an under-privileged key as 401 with an inner 498 "Token Invalid" rather
// than a 403, so this reads like a bad key when the key is usually fine and simply lacks
// the "Basemap styles" privilege.
//
// Usage:
//   node scripts/check-basemap.mjs            # key only, no browser (fast)
//   node scripts/check-basemap.mjs --runtime  # also boot the app and assert what it used
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const V2 = 'https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/styles/arcgis/dark-gray/base';
// Not named URL: that would shadow the global URL class this file constructs below.
const APP_URL = process.env.ATLAS_URL || 'http://localhost:3111/';
let failed = false;

function readKey() {
  if (process.env.NEXT_PUBLIC_ARCGIS_API_KEY) return process.env.NEXT_PUBLIC_ARCGIS_API_KEY.trim();
  const path = new URL('../.env.local', import.meta.url);
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch (err) {
    console.log(`      (no .env.local at ${path.pathname}: ${err.code ?? err.message})`);
    return '';
  }
  const line = text.split(/\r?\n/).find((l) => l.startsWith('NEXT_PUBLIC_ARCGIS_API_KEY='));
  if (!line) { console.log('      (.env.local has no NEXT_PUBLIC_ARCGIS_API_KEY line)'); return ''; }
  const value = line.slice(line.indexOf('=') + 1).trim();
  if (!value) console.log('      (NEXT_PUBLIC_ARCGIS_API_KEY is present but empty)');
  return value;
}

const key = readKey();
if (!key) {
  console.log('SKIP no NEXT_PUBLIC_ARCGIS_API_KEY configured — the app is in its keyless Natural Earth mode by design.');
  process.exit(0);
}

// ── 1. does the key actually work against the v2 styles service? ──
//
// When it does not, DERIVE why rather than guessing. Esri distinguishes these, and the
// distinction decides whether you regenerate the key or change a setting on it:
//
//   499 Token Required  — nothing was sent
//   498 Token Invalid   — sent, but not recognised (wrong key, revoked, expired)
//   403                 — recognised, but not entitled to this service
//
// Comparing the real key against a deliberately fake one is what separates "invalid"
// from "under-privileged". Do NOT try to infer key validity from a 200 on
// basemaps.arcgis.com: that tile service is anonymously readable and returns 200 with
// no token at all, so it cannot discriminate.
const esriCode = async (url) => {
  const r = await fetch(url);
  const body = await r.text().catch(() => '');
  return { status: r.status, code: Number(body.match(/"code":\s*(\d+)/)?.[1]) || null, body };
};

const real = await esriCode(`${V2}?token=${encodeURIComponent(key)}`);
if (real.status === 200) {
  const style = JSON.parse(real.body || 'null');
  if (Array.isArray(style?.layers)) console.log(`PASS Basemap Styles v2 accepted the key (${style.layers.length} style layers)`);
  else { console.error('FAIL v2 responded 200 but with no style layers'); failed = true; }
} else {
  const none = await esriCode(V2);
  const fake = await esriCode(`${V2}?token=AAPTnotarealtokenatall123`);
  console.error(`FAIL Basemap Styles v2 rejected the key: HTTP ${real.status} (Esri code ${real.code}).`);
  console.error(`     control: no token -> ${none.code}, deliberately fake token -> ${fake.code}`);
  if (real.code === 498 && fake.code === 498 && none.code === 499) {
    console.error('     Your key is answered identically to a fake one, while sending nothing gets a');
    console.error('     different code. ArcGIS does not recognise this key at all — it is wrong,');
    console.error('     revoked, or expired. This is NOT a privilege problem (that returns 403) and');
    console.error('     NOT a referrer problem (the response is identical with any Referer).');
    console.error('     Fix: generate a fresh API key at https://location.arcgis.com and put it in');
    console.error('     .env.local as NEXT_PUBLIC_ARCGIS_API_KEY.');
  } else if (real.status === 403) {
    console.error('     The key is recognised but is not entitled to this service. Enable the');
    console.error('     "Basemap styles" privilege on it in the Location Platform dashboard.');
  }
  console.error('     Until then the globe still renders — it falls through to the public legacy');
  console.error('     style item and looks identical — but it is NOT using the v2 service.');
  failed = true;
}

// ── 2. optionally, what did the running app actually end up using? ──
if (process.argv.includes('--runtime')) {
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const bad = [];
  page.on('response', (r) => { if (r.status() >= 400 && /arcgis/i.test(r.url())) bad.push(`${r.status()} ${r.url().replace(/token=[^&]+/, 'token=***')}`); });

  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  const enter = page.locator('.hero__enter');
  if (await enter.count()) { await enter.click(); await page.locator('.hero').waitFor({ state: 'detached', timeout: 45000 }); }
  await page.waitForSelector('.esri-view canvas', { timeout: 120000, state: 'attached' });
  await page.waitForTimeout(3500);

  const used = await page.evaluate(() => window.__waBasemap ?? null);
  if (!used) { console.error('FAIL the app did not record which basemap source it used'); failed = true; }
  else if (used.degraded) { console.error(`FAIL the app rendered with a fallback source: "${used.label}"`); failed = true; }
  else console.log(`PASS the app rendered with "${used.label}"`);

  if (bad.length) { console.error(`FAIL ${bad.length} failing arcgis request(s):`); bad.forEach((b) => console.error(`     ${b}`)); failed = true; }
  else console.log('PASS no failing arcgis requests');

  await browser.close();
}

process.exit(failed ? 1 : 0);
