# Warrior Atlas

*(working title — formerly "Martial Arts Globe")*

Interactive 3D globe mapping the history and lineage of world martial arts, built on Esri's ArcGIS Maps SDK for JavaScript. Portfolio piece targeting Esri, demonstrating an agentic content pipeline (structured APIs → Claude enrichment → markdown → graph) alongside geospatial dev skills.

**Status:** planning — specced, not built.

## Concept

Click a country on the globe — nodes surface for its martial arts. Click a node — history + curved geodesic arcs to related arts elsewhere (e.g. muay thai → kickboxing → boxing). A geographically-grounded lineage graph, same node/edge model as an Obsidian vault, pinned to real lat/lng instead of a free force simulation.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js on Vercel |
| Globe render | ArcGIS Maps SDK for JavaScript (`@arcgis/core`, `SceneView`) |
| UI chrome | Calcite Components |
| Local clustering | d3-force, geo-pinned |
| Arc geometry | turf.js `greatCircle()` / Esri `geodesicUtils` |
| Content | markdown + frontmatter, parsed at build (remark/unified) |
| Base graph data | Wikidata SPARQL + Wikipedia infobox |
| Enrichment | Claude API |
| RAG (stretch) | Voyage embeddings + Supabase pgvector |

Full spec lives in Mark's personal wiki: `wiki/projects/martial-arts-globe.md`.
