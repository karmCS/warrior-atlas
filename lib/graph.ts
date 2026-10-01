// The Warrior Atlas — build-time content pipeline.
//
// Parses content/arts/*.md (frontmatter + prose), resolves the Obsidian-style
// [[wikilinks]] in `lineage`/`influenced` into a directed lineage graph, merges
// the curated display metadata, and emits the record array the frontend consumes.
//
// SERVER-ONLY: uses fs. Imported by the RSC page and by scripts/build-graph.mjs.

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import type { ArtRecord, Graph, Media } from './types';
import {
  ART_META, DEFAULT_META, ERA_LABELS, ERA_ORDER, DISCIPLINE_LABELS,
  normalizeMediaType, countryToIso,
} from './meta';

const ARTS_DIR = path.join(process.cwd(), 'content', 'arts');
// ponytail: stashed arts live here, unpublished; move a file back to arts/ to restore it.
const STASH_DIR = path.join(process.cwd(), 'content', '_stashed');
const COVERS_FILE = path.join(process.cwd(), 'content', 'covers.json');
const REGION_ORDER = ['East Asia', 'SE Asia', 'S Asia', 'Europe', 'N America', 'S America', 'Africa', 'Oceania', 'Unknown'];

// The wiki frontmatter is Obsidian-flavoured, not strict YAML: `lineage:
// [[judo]], [[jujutsu]]` is not a valid YAML value, and some titles carry an
// unquoted inner colon (`title: More Than Miyagi: The Pat Morita Story`) that a
// YAML parser reads as a nested mapping. Normalize the FRONTMATTER BLOCK ONLY
// (leaving the prose body untouched) before parsing: rewrite wikilink fields into
// string arrays, and hard-quote the string-valued fields so colons/parens are safe.
const STRING_FIELDS = /^(\s*(?:- )?)(title|type|origin_country|name|country|founded):[ \t]+(.*\S)[ \t]*$/;

function normalizeFrontmatterBlock(fm: string): string {
  return fm.split('\n').map((line) => {
    const wl = line.match(/^(lineage|influenced):[ \t]*(.*)$/);
    if (wl) {
      const links = [...wl[2].matchAll(/\[\[([^\]]+)\]\]/g)].map((x) => x[1].trim());
      return `${wl[1]}: [${links.map((s) => JSON.stringify(s)).join(', ')}]`;
    }
    const sf = line.match(STRING_FIELDS);
    if (sf) {
      const [, indent, key, rawVal] = sf;
      const v = rawVal.trim();
      // Only skip re-quoting when the value is *genuinely* balanced-quoted or a
      // flow collection — a value that merely starts with a quote (e.g. the film
      // title `'Salem's Lot`) is NOT valid YAML and must be re-quoted.
      const balancedQuote = v.length > 1 && ((v[0] === '"' && v.endsWith('"')) || (v[0] === "'" && v.endsWith("'")));
      const flow = v[0] === '[' || v[0] === '{';
      if (balancedQuote || flow) return line;
      return `${indent}${key}: ${JSON.stringify(v)}`;
    }
    return line;
  }).join('\n');
}

function normalizeSource(src: string): string {
  return src.replace(/^(---\r?\n)([\s\S]*?)(\r?\n---)/, (_m, open, fm, close) =>
    open + normalizeFrontmatterBlock(fm) + close);
}

// Cover URLs are resolved out-of-band by `npm run covers` and committed. Absent or
// null-URL entries simply leave `cover` undefined, and the card keeps its placeholder.
function readCovers(): Record<string, string> {
  if (!fs.existsSync(COVERS_FILE)) return {};
  const raw = JSON.parse(fs.readFileSync(COVERS_FILE, 'utf8')) as Record<string, { url?: string | null }>;
  return Object.fromEntries(
    Object.entries(raw).filter(([, v]) => typeof v?.url === 'string' && v.url).map(([k, v]) => [k, v.url as string]),
  );
}

function asSlugArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean);
}

interface RawArt {
  id: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  founded: string;
  lineage: string[];
  influenced: string[];
  media: Media[];
  history: string;
}

function readRaw(): RawArt[] {
  const covers = readCovers();
  const files = fs.readdirSync(ARTS_DIR).filter((f) => f.endsWith('.md')).sort();
  return files.map((file) => {
    const id = file.replace(/\.md$/, '');
    // CRLF checkouts (Windows autocrlf) would otherwise break the line-anchored frontmatter regexes.
    const src = fs.readFileSync(path.join(ARTS_DIR, file), 'utf8').replace(/\r\n?/g, '\n');
    const { data, content } = matter(normalizeSource(src));
    const media: Media[] = Array.isArray(data.notable_media)
      ? data.notable_media
          .filter((m: unknown) => m && typeof m === 'object' && (m as { title?: string }).title)
          .map((m: { title: string; type?: string; origin_country?: string }) => ({
            title: String(m.title),
            type: normalizeMediaType(m.type || ''),
            country: countryToIso(m.origin_country || ''),
            cover: covers[String(m.title)],
          }))
      : [];
    return {
      id,
      name: String(data.name ?? id),
      country: String(data.country ?? ''),
      lat: Number(data.lat),
      lng: Number(data.lng),
      founded: String(data.founded ?? ''),
      lineage: asSlugArray(data.lineage),
      influenced: asSlugArray(data.influenced),
      media,
      history: content.trim(),
    };
  });
}

export function buildGraph(): Graph {
  // A node with no real birthplace can't be placed on the globe — drop it loudly
  // rather than emitting a NaN coordinate that breaks the record contract.
  const raw = readRaw().filter((r) => {
    const ok = Number.isFinite(r.lat) && Number.isFinite(r.lng);
    if (!ok) console.warn(`[graph] skipping "${r.id}": missing or non-numeric lat/lng (${r.lat}, ${r.lng})`);
    return ok;
  });
  const realIds = new Set(raw.map((r) => r.id));
  // Links to stashed arts must not surface as ghost nodes.
  const stashed = new Set(fs.existsSync(STASH_DIR)
    ? fs.readdirSync(STASH_DIR).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, ''))
    : []);

  // Directed edges: a -> b means "a influenced b".
  const edges = new Set<string>();
  for (const r of raw) {
    for (const d of r.influenced) if (realIds.has(d)) edges.add(`${r.id}|${d}`);
    for (const a of r.lineage) if (realIds.has(a)) edges.add(`${a}|${r.id}`);
  }

  const records: ArtRecord[] = raw.map((r) => {
    const meta = ART_META[r.id] || DEFAULT_META;
    const lineageTo = [...edges].filter((e) => e.startsWith(`${r.id}|`)).map((e) => e.split('|')[1]);
    const lineageFrom = [...edges].filter((e) => e.endsWith(`|${r.id}`)).map((e) => e.split('|')[0]);
    return {
      id: r.id,
      name: r.name,
      country: r.country,
      code: meta.code,
      region: meta.region,
      discipline: meta.discipline,
      status: meta.status,
      origin: meta.origin || r.country,
      lat: r.lat,
      lng: r.lng,
      founded: r.founded,
      eraLabel: meta.eraLabel,
      era: meta.era,
      tagline: meta.tagline,
      video: meta.video || '',
      videoStart: meta.videoStart || 0,
      history: r.history,
      lineageTo,
      lineageFrom,
      ghostFrom: r.lineage.filter((s) => !realIds.has(s) && !stashed.has(s)),
      ghostTo: r.influenced.filter((s) => !realIds.has(s) && !stashed.has(s)),
      media: r.media,
    };
  });

  const present = <T>(all: T[], has: (v: T) => boolean) => all.filter(has);

  const regions = present(REGION_ORDER, (rg) => records.some((r) => r.region === rg));
  const disciplines = present(['striking', 'grappling', 'weapons'], (d) => records.some((r) => r.discipline === d))
    .map((value) => ({ value, label: DISCIPLINE_LABELS[value] }));
  const eras = [{ value: 'all', label: 'All eras' }].concat(
    present(ERA_ORDER, (e) => records.some((r) => r.era === e)).map((value) => ({ value, label: ERA_LABELS[value] })),
  );

  return { records, regions, disciplines, eras };
}
