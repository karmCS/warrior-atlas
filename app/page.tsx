import { buildGraph } from '@/lib/graph';
import { AtlasApp } from '@/components/AtlasApp';

// Server component: the markdown → graph build step runs here, and the resulting
// records are handed to the client atlas. (Static at build time.)
export default function Page() {
  const graph = buildGraph();
  return <AtlasApp graph={graph} />;
}
