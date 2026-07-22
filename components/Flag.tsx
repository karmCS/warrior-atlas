// Flag swatch — CSS-gradient approximation; the ISO code is the source of truth.
import { flagFor } from '@/lib/flags';

export function Flag({ code, sm = false }: { code: string; sm?: boolean }) {
  const f = flagFor(code);
  return <span className={'flag' + (sm ? ' flag--sm' : '')} title={f.name} style={{ background: f.css }} />;
}
