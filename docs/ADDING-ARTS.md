# Adding a martial art

Process for adding a new record to `content/arts/`, reconstructed from the
2026-07-11 seed-data build session (the first 22 files) and the README's
content-pipeline notes.

## 1. Research

Pull structured facts before writing prose:

- **Wikidata SPARQL** — the martial-arts class is **`Q11417`** ("martial arts");
  the combat-sport class is `Q7128792`. Key properties: `P144` derived from
  (→ `lineage`), `P495` country of origin, `P625` coordinates, `P571` inception.
- **Wikipedia infobox** `parenthood=` field as a fallback/enrichment source
  when Wikidata is thin.

> Earlier versions of this project's notes cited `Q166142` as "martial art".
> That is wrong — `Q166142` is *application software*. Verified 2026-07-25.

Two traps worth knowing before you trust a lookup:

- **Verify the QID by fetching its label**, don't trust a remembered number.
  A label search for "Arnis" returns the German *town* of Arnis first; the
  martial art was the third hit.
- **Expect empty properties.** Arnis (`Q752190`) has no `P144`, no `P571` and
  no `P625` at all. An absent property is a finding to respect, not a gap to
  fill with a guess — `jeet-kune-do.md` records `influenced: unknown` for
  exactly this reason.

### Check the ghost links first

Before choosing a slug, look at what the existing records already point to:

```bash
npm run graph   # prints "ghost links (referenced, not yet mapped): …"
```

If your art already appears there, **use that exact slug** — the new file
converts a dangling reference into a real edge. Adding `arnis` resolved the
`[[arnis]]` ghost that `jeet-kune-do.md` had been carrying, which is why the
edge count rose without any existing file being touched.

## 2. Write `content/arts/<slug>.md`

Frontmatter schema (matches every existing file, e.g. `judo.md`):

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

- `notable_media`: 2-6 **real** depictions only (film/tv/anime/manga/game/
  documentary) — no fictional arts, no made-up styles from action movies.
- Body: 150-250 words of prose history. Run the `/humanizer` and
  `/article-writing` skills on the draft before committing it — keeps the
  prose from reading as AI-generated.
- **Flag disputed/uncertain facts inline in the prose** rather than guessing
  or silently picking one version (e.g. "sources differ on…", "Wikipedia
  labels this founding legendary"). This discipline held up well across the
  first 22 files and should stay the default.

## 3. Apply a modeling pattern if the art needs one

**Disputed or dual origin** (used for Kickboxing, Taekwondo): don't flatten to
one country. Split into sibling node files (e.g. `kickboxing-japan.md` /
`kickboxing-usa.md`), cross-link them via the `influenced` field, and add an
explicit prose caveat that the link is a parallel/sibling relationship — not a
technical `P144` derivation. (Silat was modeled this way originally but was
later unified into a single `silat-indonesia.md` node with a one-line prose
caveat about the disputed Malaysian origin, rather than kept as two files.)

**Real internal lineage / style branches** (used for Karate): one root node
for the shared origin, N branch nodes each with `lineage: [[root]]`. Only add
cross-branch relationships when independently sourced, not assumed just
because branches share a founder-era.

**No sourceable single origin** (used for Wrestling): anchor to where the art
is verifiably *popularized* today (Olympic medal counts, a named regional
hotspot) rather than leaving country/coordinates blank.

## 4. Add a matching row to `lib/meta.ts` `ART_META`

The frontmatter carries facts; `ART_META` carries curated display fields the
frontmatter doesn't encode:

```ts
'your-slug': {
  region: 'East Asia',
  discipline: 'striking', // 'striking' | 'grappling' | 'weapons'
  status: 'verified',     // 'verified' | 'disputed' | 'extinct'
  origin: 'City',
  code: 'XX',             // ISO2
  eraLabel: 'EST. 1900',
  era: '1900s',           // filter bucket
  tagline: 'One punchy line.',
},
```

Missing an entry falls back to `DEFAULT_META` (build stays green, but the
card looks unstyled) — don't skip this step.

## 5. Resolve cover art

```bash
npm run covers
```

Resolves one poster per `notable_media` title into the **committed**
`content/covers.json` cache (AniList → TMDB → iTunes, in that order). The
build never calls a network API — it only reads this file.

- Check the title each provider actually matched (recorded per entry) to
  catch a wrong hit (e.g. the wrong movie sharing a title).
- Delete a title's key and re-run to re-resolve just that one; `--force`
  re-resolves everything.
- A hand-edited URL sticks — the script only fills entries that are missing.
- `"url": null` means deliberately uncovered (e.g. a promotion, not a title)
  — leave it.

## 6. Rebuild the graph

```bash
npm run graph     # or: npm run build, which runs this first
```

Emits `public/graph.json` plus a health summary (node/edge/ghost counts).
Confirm your new lineage/influenced edges resolved to real nodes and didn't
silently become ghost links (a wikilink with no matching file).

## 7. Verify in the browser

```bash
npm run dev
```

Confirm the new node clusters under the right country, the dossier renders
(history, lineage links, In Media strip), and any new arcs draw correctly.

## Scale note

The original 22-file dataset was built as a flat batch of parallel
general-purpose `Agent` dispatches, one martial art per agent, each doing its
own Wikidata/Wikipedia research and writing its own file — no `Workflow`
orchestration needed. Scaled cleanly to 14-22 concurrent agents in one batch.
For a single addition, one agent (or a manual pass) through steps 1-7 above is
enough.
