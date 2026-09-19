'use client';
import { Icon } from './Icon';
import type { ArtRecord } from '@/lib/types';

// Directed-edge ledger — reads the lineage graph as a scannable list. Each card is
// a source style and the styles it influenced; clicking a name jumps to the globe.
export function LineageView({ records, onSelect }: {
  records: ArtRecord[];
  onSelect: (id: string) => void;
}) {
  const byId = new Map(records.map((r) => [r.id, r]));
  const sources = records
    .filter((r) => r.lineageTo.some((id) => byId.has(id)))
    .sort((a, b) => b.lineageTo.length - a.lineageTo.length);
  const edgeCount = records.reduce((n, r) => n + r.lineageTo.filter((id) => byId.has(id)).length, 0);

  return (
    <div className="sheet">
      <div className="codex">
        <div className="codex__head">
          <h1 className="codex__title">The Lineage</h1>
          <p className="codex__sub">Follow the lineage and learn how each martial art influences others</p>
        </div>

        {sources.length === 0 ? (
          <div className="codex__empty">
            <Icon name="git-branch" size={30} color="var(--bone-700)" />
            <span>No lineage in view. Widen the filters.</span>
          </div>
        ) : (
          <div className="lineage-grid">
            {sources.map((s) => (
              <div key={s.id} className="ledger">
                <div className="ledger__from">
                  <button className="ledger__name" onClick={() => onSelect(s.id)}>{s.name}</button>
                  <span className="ledger__meta">{s.region} · {s.eraLabel}</span>
                </div>
                <div className="ledger__edges">
                  {s.lineageTo.map((id) => byId.get(id)).filter(Boolean).map((t) => (
                    <button key={t!.id} className="ledger__edge" onClick={() => onSelect(t!.id)}>
                      <Icon name="arrow-right" size={13} color="var(--gold-500)" /> {t!.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
