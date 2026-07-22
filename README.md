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
npm run dev       # http://localhost:3000
# or
npm run build && npm start
```

`npm run build` first runs `npm run graph`, which parses the content and writes
`public/graph.json` (plus a health summary: node/edge/ghost counts). The app
itself doesn't read that file — the same parser runs in the server component at
build — but it's a useful artifact for inspecting the graph.

The globe needs **no ArcGIS API key**: it renders keyless (a dark ember sphere,
no basemap tiles) and drapes public-domain Natural Earth country outlines
(world-atlas, fetched from a CDN) over it. Offline, the land quietly drops and
the ember globe still renders.

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
keyless global `SceneView`, drapes country polygons, places one blade node per
country cluster (multi-style countries open a popover), draws elevated
great-circle arc polylines for lineage edges, and flies the camera (`view.goTo`)
to the selected style.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router), React 19 |
| Globe | ArcGIS Maps SDK for JavaScript (`@arcgis/core`, `SceneView`, global mode, keyless) |
| Land | Natural Earth `world-atlas` topojson (public domain, CDN) via `topojson-client` |
| Chrome | Bespoke *Warrior Atlas* design system (tokens + components, ported from the Claude Design project) |
| Content | markdown + frontmatter, parsed at build with `gray-matter` |
| Icons | `lucide-react` |

## Design ↔ spec reconciliation

The design source (Claude Design "Warrior Atlas") shipped a beautiful custom
*canvas* globe and 12 placeholder records; the wiki spec calls for ArcGIS and a
markdown pipeline. Where they conflicted, the spec won:

- **Globe:** rebuilt on ArcGIS `SceneView` (the Esri signal), not the canvas
  globe — keyless dark ember styling instead of satellite tiles.
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
