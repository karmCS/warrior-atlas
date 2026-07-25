import { buildGraph } from '@/lib/graph';
import { AtlasApp } from '@/components/AtlasApp';
import { HeroGate } from '@/components/HeroGate';

// Server component: the markdown → graph build step runs here, and the resulting
// records are handed to the client atlas. (Static at build time.)
export default function Page() {
  const graph = buildGraph();
  const points = graph.records.map((r) => ({ lat: r.lat, lng: r.lng }));
  return (
    <HeroGate points={points} styleCount={graph.records.length}>
      <AtlasApp graph={graph} />
    </HeroGate>
  );
}
