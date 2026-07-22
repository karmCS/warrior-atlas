// Resolves a cover image URL for every `notable_media` entry in content/arts/*.md
// and caches the result in content/covers.json. Run: `npm run covers`.
//
// The cache file is committed and is also the MANUAL OVERRIDE surface: this script
// only fills entries that are missing, so any URL you hand-edit in there sticks.
// Re-resolve a single bad match by deleting its key and re-running (or `--force`).
//
// Sources, in order of preference per media type:
//   anime | manga  → AniList GraphQL (no key, best art for these)
//   film | tv | …  → TMDB (needs a free TMDB_API_KEY) → iTunes Search (no key)
// Images are served from each provider's CDN at a fixed poster width; nothing is
// downloaded into the repo.

import fs from 'node:fs';
import path from 'node:path';
import { buildGraph } from '../lib/graph';
import type { Media } from '../lib/types';

const CACHE = path.join(process.cwd(), 'content', 'covers.json');
const TMDB_KEY = process.env.TMDB_API_KEY || '';
const TMDB_SIZE = 'w780'; // 780×1170 — 3× the rendered card, retina-safe
const FORCE = process.argv.includes('--force');

export interface CoverEntry {
  url: string | null;
  // tmdb | anilist | itunes | manual — resolved, never re-fetched
  // none — nothing found *yet*; retried on the next run (e.g. once a TMDB key exists)
  // skip — deliberately uncovered (not a real title); never retried, keeps the placeholder
  src: string;
  match?: string; // what the provider actually matched, for eyeballing mistakes
}
type Cache = Record<string, CoverEntry>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Frontmatter titles carry human qualifiers the search APIs choke on:
// "Ip Man: The Final Fight (2013)", "Ip Man (2013 TV series)",
// "Karate Baka Ichidai (Karate Master)". Split into a clean query + year hint,
// keeping the parenthetical as a second query to try if the first misses.
function parseTitle(title: string): { query: string; alt: string | null; year: number | null } {
  const paren = title.match(/\(([^)]*)\)/);
  const inner = paren ? paren[1].trim() : '';
  const yearMatch = inner.match(/\b(1[89]\d{2}|20\d{2})\b/);
  const query = title.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  // A parenthetical that is real words (not just a year/format note) is an alias.
  const isAlias = inner && !/^\W*(1[89]\d{2}|20\d{2})[\s\w]*$/.test(inner) && !/series|film|tv/i.test(inner);
  return { query: query || title, alt: isAlias ? inner : null, year: yearMatch ? Number(yearMatch[1]) : null };
}

async function json(url: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url.replace(TMDB_KEY, '***')}`);
  return res.json();
}

// --- providers: each returns a CoverEntry or null (no confident match) --------

async function fromAniList(query: string, type: 'ANIME' | 'MANGA'): Promise<CoverEntry | null> {
  const body = JSON.stringify({
    query: `query($s:String,$t:MediaType){Media(search:$s,type:$t){title{romaji english}coverImage{extraLarge}}}`,
    variables: { s: query, t: type },
  });
  const data = await json('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body,
  }).catch(() => null);
  const m = data?.data?.Media;
  if (!m?.coverImage?.extraLarge) return null;
  return { url: m.coverImage.extraLarge, src: 'anilist', match: m.title.english || m.title.romaji };
}

async function fromTmdb(query: string, year: number | null, kind: 'movie' | 'tv'): Promise<CoverEntry | null> {
  if (!TMDB_KEY) return null;
  const yearParam = year ? `&${kind === 'tv' ? 'first_air_date_year' : 'year'}=${year}` : '';
  const url = `https://api.themoviedb.org/3/search/${kind}?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}${yearParam}`;
  const data = await json(url).catch(() => null);
  const hit = (data?.results || []).find((r: any) => r.poster_path);
  if (!hit) return null;
  const date = hit.release_date || hit.first_air_date || '';
  return {
    url: `https://image.tmdb.org/t/p/${TMDB_SIZE}${hit.poster_path}`,
    src: 'tmdb',
    match: `${hit.title || hit.name}${date ? ` (${date.slice(0, 4)})` : ''}`,
  };
}

async function fromItunes(query: string, kind: 'movie' | 'tvSeason'): Promise<CoverEntry | null> {
  const url = `https://itunes.apple.com/search?media=${kind === 'movie' ? 'movie' : 'tvShow'}&entity=${kind}&limit=1&term=${encodeURIComponent(query)}`;
  const data = await json(url).catch(() => null);
  const hit = data?.results?.[0];
  if (!hit?.artworkUrl100) return null;
  // iTunes serves any size off the same path; ask for a poster-grade one.
  return {
    url: String(hit.artworkUrl100).replace(/\/\d+x\d+bb\.(jpg|png)$/, '/800x1200bb.jpg'),
    src: 'itunes',
    match: hit.trackName || hit.collectionName,
  };
}

async function resolve(m: Media): Promise<CoverEntry> {
  const { query, alt, year } = parseTitle(m.title);
  // Several entries name an *episode* of a series ("Human Weapon: Sambo"). Falling
  // back to the text before the colon finds the series itself.
  const series = query.includes(':') ? query.split(':')[0].trim() : null;
  const queries = [...new Set([query, alt, series].filter(Boolean) as string[])];

  for (const q of queries) {
    let hit: CoverEntry | null = null;
    if (m.type === 'Anime') hit = await fromAniList(q, 'ANIME');
    else if (m.type === 'Manga') hit = await fromAniList(q, 'MANGA');
    else {
      const kind = m.type === 'Series' ? 'tv' : 'movie';
      hit = await fromTmdb(q, year, kind);
      // Docs and series get miscategorised in the frontmatter often enough that
      // one cross-kind retry is worth the extra request.
      if (!hit) hit = await fromTmdb(q, year, kind === 'tv' ? 'movie' : 'tv');
      if (!hit) hit = await fromItunes(q, kind === 'tv' ? 'tvSeason' : 'movie');
    }
    if (hit) return hit;
    await sleep(120);
  }
  return { url: null, src: 'none' };
}

// `npm run covers -- --selftest` — the title parser is the only real logic here,
// and it is what silently turns into wrong posters when it breaks.
function selftest() {
  const eq = (a: unknown, b: unknown, m: string) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
  };
  eq(parseTitle('Enter the Dragon'), { query: 'Enter the Dragon', alt: null, year: null }, 'plain title');
  eq(parseTitle('The Grandmaster (2013)'), { query: 'The Grandmaster', alt: null, year: 2013 }, 'year only');
  eq(parseTitle('Ip Man (2013 TV series)'), { query: 'Ip Man', alt: null, year: 2013 }, 'year + format note');
  eq(parseTitle('Ip Man (film series, 2008-2019)'), { query: 'Ip Man', alt: null, year: 2008 }, 'franchise note');
  eq(parseTitle('Geran (Silat Warriors: Deed of Death)'),
    { query: 'Geran', alt: 'Silat Warriors: Deed of Death', year: null }, 'alias kept as fallback query');
  // A title that is *only* a parenthetical must not parse to an empty query.
  eq(parseTitle('(Untitled)').query.length > 0, true, 'never yields an empty query');
  console.log('✓ parseTitle self-test passed');
}

async function main() {
  if (process.argv.includes('--selftest')) return selftest();
  const cache: Cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
  const all = buildGraph().records.flatMap((r) => r.media);
  const seen = new Map<string, Media>();
  for (const m of all) if (!seen.has(m.title)) seen.set(m.title, m);

  if (!TMDB_KEY) console.warn('! TMDB_API_KEY not set — film/series fall back to iTunes (thinner catalogue).');

  let filled = 0;
  for (const [title, m] of seen) {
    const cached = cache[title];
    if (!FORCE && cached && (cached.url || cached.src === 'skip')) continue;
    const entry = await resolve(m);
    cache[title] = entry;
    filled++;
    console.log(`${entry.url ? '✓' : '·'} ${title} → ${entry.match || 'no match'} [${entry.src}]`);
    await sleep(150); // stay well under AniList's 90/min and TMDB's rate limit
  }

  const ordered: Cache = Object.fromEntries([...seen.keys()].filter((t) => cache[t]).map((t) => [t, cache[t]]));
  fs.writeFileSync(CACHE, JSON.stringify(ordered, null, 2) + '\n');

  const missing = [...seen.keys()].filter((t) => !ordered[t]?.url);
  console.log(`\n✓ covers.json — ${Object.keys(ordered).length} titles, ${filled} newly resolved`);
  if (missing.length) console.log(`  no cover (${missing.length}): ${missing.join(', ')}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
