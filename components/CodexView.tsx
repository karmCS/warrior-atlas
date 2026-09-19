'use client';
import { useState } from 'react';
import { Icon } from './Icon';
import type { ArtRecord } from '@/lib/types';

function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = { verified: 'badge-verified', disputed: 'badge-disputed', extinct: 'badge-extinct' };
  const label: Record<string, string> = { verified: 'Verified', disputed: 'Disputed', extinct: 'Extinct †' };
  return <span className={map[status] || map.verified}><span className="dot" /> {label[status] || 'Verified'}</span>;
}
function shortCoord(lat: number, lng: number) {
  return `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(2)}° ${lng >= 0 ? 'E' : 'W'}`;
}

export function CodexView({ records, onSelect, disciplines }: {
  records: ArtRecord[];
  onSelect: (id: string) => void;
  disciplines: { value: string; label: string }[];
}) {
  const [tab, setTab] = useState('all');
  const tabs = [{ value: 'all', label: 'All' }, ...disciplines];
  const count = (v: string) => (v === 'all' ? records.length : records.filter((r) => r.discipline === v).length);
  const shown = tab === 'all' ? records : records.filter((r) => r.discipline === tab);

  return (
    <div className="sheet">
      <div className="codex">
        <div className="codex__head">
          <h1 className="codex__title">The Codex</h1>
          <p className="codex__sub">Learn about the birthplace of every style.</p>
          <div className="codex__tabs">
            {tabs.map((t) => (
              <button key={t.value} className={'codex__tab' + (tab === t.value ? ' on' : '')} onClick={() => setTab(t.value)}>
                {t.label} <span className="c">{count(t.value)}</span>
              </button>
            ))}
          </div>
        </div>

        {shown.length === 0 ? (
          <div className="codex__empty">
            <Icon name="compass" size={30} color="var(--bone-700)" />
            <span>No records here. The trail goes cold.</span>
          </div>
        ) : (
          <div className="codex__grid">
            {shown.map((s) => (
              <button key={s.id} className="cxcard" onClick={() => onSelect(s.id)}>
                <span className="cxcard__rail" />
                <div className="cxcard__top">
                  <span className="cxcard__region">{s.region} · {s.eraLabel}</span>
                  <StatusDot status={s.status} />
                </div>
                <div className="cxcard__name">{s.name}</div>
                <div className="cxcard__tag">{s.tagline}</div>
                <div className="cxcard__foot">
                  <span className="cxcard__coord">{shortCoord(s.lat, s.lng)}</span>
                  <span className="cxcard__disc">{s.discipline}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
