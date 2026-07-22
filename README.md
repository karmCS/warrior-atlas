# The Warrior Atlas

Interactive 3D globe mapping the birthplaces and lineage of the world's martial
arts, built on Esri's **ArcGIS Maps SDK for JavaScript**. A portfolio piece
targeting Esri: build *on* their SDK, with a markdown-driven content pipeline
(structured frontmatter → wikilink graph → globe) behind it.

**Status:** built — Next.js app with an interactive ArcGIS globe, a searchable
codex, and a lineage ledger, driven by 22 hand-authored martial-arts records.

## Concept

Spin the globe. Each country surfaces a blade-marked node for the styles born
there (Japan clusters nine — karate and its schools, judo, kudo, kickboxing).
Click a node → a **dossier** slides in with the style's history, birthplace,
lineage links, and an *In Media* strip. Great-circle arcs trace the descents
between styles across the globe (muay thai → kickboxing → boxing; judo → BJJ).
It's an Obsidian-style lineage graph, pinned to real geography.

Three views: **Atlas** (the globe), **Codex** (a filterable record grid), and
**Lineage** (the directed descent graph as a ledger).

## Run

```bash
npm install
cp .env.example .env.local     # then paste your ArcGIS API key into it
npm run dev                    # http://localhost:3000
# or
npm run build && npm start
```

`npm run build` first runs `npm run graph`, which parses the content and writes
`public/graph.json` (plus a health summary: node/edge/ghost counts). The app
itself doesn't read that file — the same parser runs in the server component at
build — but it's a useful artifact for inspecting the graph.

### The API key

The globe's default basemap is a **real Esri vector-tile basemap service**, so it
needs a free **ArcGIS Location Platform API key** with the basemaps privilege
(get one at [location.arcgis.com](https://location.arcgis.com)). Put it in
`.env.local` as `NEXT_PUBLIC_ARCGIS_API_KEY` — see `.env.example`.

Because the variable is `NEXT_PUBLIC_*`, Next inlines it into the client bundle
**at build time**: the key ships to every visitor, so restrict it by HTTP
referrer, and set it at build time on your host (Vercel etc.), not at runtime. A
build with no key succeeds silently — it just produces the keyless globe.

**No key? The globe still works.** With the variable absent or empty — a fork, a
CI build, an open-source clone — it falls back to the original keyless path: a
dark ember sphere draped with public-domain Natural Earth country outlines
(world-atlas topojson, fetched from a CDN). Fully offline, the land quietly drops
and the ember sphere still renders.

## Content pipeline

Each martial art is one markdown file under `content/arts/` with Obsidian-style
frontmatter — the exact convention Mark's wiki uses:

```yaml
---
name: Judo
country: Japan
lat: 35.7076
lng: 139.7534
founded: 1882
lineage: [[jujutsu]]
influenced: [[sambo]], [[bjj]], [[kudo]]
notable_media:
  - title: Sanshiro Sugata
    type: film
    origin_country: Japan
---
Prose history in the body…
```

At build, `lib/graph.ts`:

1. **Normalizes** the frontmatter — `[[wikilinks]]` aren't valid YAML, and some
   titles carry an unquoted inner colon (`title: More Than Miyagi: The Pat Morita
   Story`), so the frontmatter block is rewritten to real string arrays and
   quoted scalars before parsing (body prose is untouched).
2. **Builds a directed lineage graph.** `A influenced B` is one edge; it comes
   from both `B.lineage` (ancestors) and `A.influenced` (descendants), deduped.
   Only edges between two file-backed nodes are drawn as arcs.
3. **Resolves ghosts.** Wikilinks with no file of their own (`[[jujutsu]]`,
   `[[okinawan-te]]`, …) are kept as text in the dossier ("descends from Jujutsu
   · unmapped") but not drawn — the same idea as an Obsidian orphan link.
4. **Merges display metadata** from `lib/meta.ts` — region, discipline, status,
   birthplace city, ISO code, a compact era label, and a curated one-line
   tagline, keyed by file id. Add an art → drop a `.md` in `content/arts/` and a
   matching row in `ART_META`.
5. **Attaches cover art** for each `notable_media` entry from `content/covers.json`
   (see below). Missing or `null` → the card keeps its engraved `POSTER` placeholder.

### Cover art

`npm run covers` resolves one poster URL per media title and caches it in
`content/covers.json`, which is **committed**. The build never calls a network API;
it only reads that file, so `graph.json` is reproducible offline.

| Media type | Source | Key |
|---|---|---|
| Anime, Manga | AniList GraphQL (`coverImage.extraLarge`) | none |
| Film, Series, Documentary | TMDB `/search` → `image.tmdb.org/t/p/w780` | free `TMDB_API_KEY` in `.env.local` |
| fallback | iTunes Search (`800x1200bb`) | none, heavily rate-limited |

Images are hotlinked from the provider CDNs (no binaries in the repo) and are
served at 780 px — roughly 3× the 116 px card, so they stay crisp on retina.

The cache file is also the **manual override surface**: the script only fills
titles that are missing, so a URL you hand-edit sticks. Each entry records the
title the provider actually matched, which is how you spot a wrong hit
(`Choke` the 1999 BJJ documentary vs. `Choke` the 2008 comedy). To re-resolve one
title, delete its key and re-run; `--force` re-resolves everything. `"url": null`
means *deliberately uncovered* — `K-1` and `PKA World Championships` are
promotions, not titles, and keep the placeholder forever.

Cover art via TMDB and AniList. This product uses the TMDB API but is not
endorsed or certified by TMDB.

## Architecture

```
app/            Next.js App Router — layout, globals.css (design tokens), page (RSC)
components/     AtlasApp (state) · Globe (ArcGIS SceneView) · FilterRail
                DossierPanel · CodexView · LineageView · TopBar · Icon · Flag · Mark
lib/            graph.ts (parser) · meta.ts (curation) · flags.ts · types.ts
content/arts/   22 martial-arts markdown records
scripts/        build-graph.ts — emits public/graph.json + health summary
```

The globe (`components/Globe.tsx`) is a client-only component loaded via
`next/dynamic({ ssr: false })` — `@arcgis/core` touches `window`. It renders a
global `SceneView` over an Esri vector-tile basemap recolored to the ember
palette (Natural Earth polygons when keyless), places one blade node per country
cluster (multi-style countries open a popover), draws elevated great-circle arc
polylines for lineage edges, and flies the camera (`view.goTo`) to the selected
style.

### Basemap styling

A stock Esri basemap would be neutral grey and would gut the design system, so
the globe doesn't use one as-is. It fetches the **Dark Gray Canvas** style JSON —
the closest stock Esri basemap to the palette — rewrites every paint color into
the ember palette (lacquer-black ocean, warm-brown land, lantern-gold borders,
bone labels), drops the road/rail/building layers a world atlas doesn't need, and
hands the finished style to a `VectorTileLayer` at construction. The tiles are
genuinely Esri's; only the paint is ours.

Recoloring up front is deliberate: `VectorTileLayer`'s live restyling setters
(`setPaintProperties`, `deleteStyleLayer`, `setLayoutProperties`) are documented
against 2D `MapView`, and this is a 3D `SceneView`. Materializing the style
before the layer exists sidesteps that question entirely — and avoids the grey
flash you'd get repainting a live basemap.

The ground carries **no elevation layer** on purpose: lineage arcs are drawn at
`absolute-height` while node markers have no z, so a terrain surface would
visibly detach the arcs from their endpoints.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router), React 19 |
| Globe | ArcGIS Maps SDK for JavaScript (`@arcgis/core`, `SceneView`, global mode) |
| Basemap | Esri **Dark Gray Canvas** vector tiles, style JSON recolored to the ember palette — needs `NEXT_PUBLIC_ARCGIS_API_KEY` |
| Keyless fallback | Natural Earth `world-atlas` topojson (public domain, CDN) via `topojson-client` |
| Chrome | Bespoke *Warrior Atlas* design system (tokens + components, ported from the Claude Design project) |
| Content | markdown + frontmatter, parsed at build with `gray-matter` |
| Icons | `lucide-react` |

## Design ↔ spec reconciliation

The design source (Claude Design "Warrior Atlas") shipped a beautiful custom
*canvas* globe and 12 placeholder records; the wiki spec calls for ArcGIS and a
markdown pipeline. Where they conflicted, the spec won:

- **Globe:** rebuilt on ArcGIS `SceneView` (the Esri signal), not the canvas
  globe — a real Esri basemap service, recolored to ember rather than left as
  stock grey or swapped for satellite tiles.
- **Data:** the 22 `content/arts/*.md` records, parsed at build — not the
  design's hardcoded array.
- **Co-located arts:** solved by clustering per country + a pick-a-style popover
  (Japan's nine) rather than a literal d3-force jitter; same "don't stack" goal.
- **Chrome:** the project's own bespoke design system (more on-brand than
  Calcite, which the spec only *considered*).
- **RAG chat:** deferred — the spec lists it as an open v1 question / stretch.

## Known limitations

- Auto-rotate uses `requestAnimationFrame`; browsers pause it in background tabs
  (spin resumes when the tab is focused).
- Desktop-first — the globe, rail, and dossier need width; a notice shows on
  narrow screens.
- `region` / `discipline` / `status` / birthplace city are curated in
  `lib/meta.ts`, not derived from the frontmatter facts.
- An invalid or unprivileged ArcGIS key degrades *silently* to the keyless
  Natural Earth globe — the build stays green either way, so confirm the basemap
  in a browser after changing keys.
