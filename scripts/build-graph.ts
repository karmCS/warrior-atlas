// Emits public/graph.json from content/arts/*.md and prints a health summary
// (node/edge counts, ghost links, co-located clusters). Run: `npm run graph`.

import fs from 'node:fs';
import path from 'node:path';
import { buildGraph } from '../lib/graph';

const graph = buildGraph();
const outDir = path.join(process.cwd(), 'public');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'graph.json'), JSON.stringify(graph, null, 2));

const edgeCount = graph.records.reduce((n, r) => n + r.lineageTo.length, 0);
const ghosts = new Set<string>();
for (const r of graph.records) {
  r.ghostFrom.forEach((g) => ghosts.add(g));
  r.ghostTo.forEach((g) => ghosts.add(g));
}
const clusters = new Map<string, number>();
for (const r of graph.records) clusters.set(r.country, (clusters.get(r.country) || 0) + 1);
const multi = [...clusters.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);

console.log(`✓ graph.json — ${graph.records.length} records, ${edgeCount} lineage edges`);
console.log(`  regions: ${graph.regions.join(', ')}`);
console.log(`  co-located clusters: ${multi.map(([c, n]) => `${c}×${n}`).join(', ') || 'none'}`);
console.log(`  ghost links (referenced, not yet mapped): ${ghosts.size} — ${[...ghosts].sort().join(', ')}`);
