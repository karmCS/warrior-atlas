'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { TopBar, View } from './TopBar';
import { FilterRail } from './FilterRail';
import { DossierPanel } from './DossierPanel';
import { CodexView } from './CodexView';
import { LineageView } from './LineageView';
import { Icon } from './Icon';
import type { ArtRecord, Graph } from '@/lib/types';

export interface Filters {
  regions: string[];
  disciplines: string[];
  era: string;
  verified: boolean;
  disputed: boolean;
  extinct: boolean;
  routes: boolean;
  labels: boolean;
  autorotate: boolean;
}

const DEFAULT_FILTERS: Filters = {
  regions: [], disciplines: [], era: 'all',
  verified: true, disputed: true, extinct: true,
  routes: true, labels: true, autorotate: true,
};

const Globe = dynamic(() => import('./Globe').then((m) => m.Globe), {
  ssr: false,
  loading: () => (
    <div className="map"><div className="map-loading"><Icon name="compass" size={26} color="var(--bone-700)" /> Summoning the globe…</div></div>
  ),
});

export function AtlasApp({ graph }: { graph: Graph }) {
  const all = graph.records;
  const [view, setView] = useState<View>('atlas');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [centerSignal, setCenterSignal] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((s) => {
      if (!filters[s.status as 'verified' | 'disputed' | 'extinct']) return false;
      if (filters.regions.length && !filters.regions.includes(s.region)) return false;
      if (filters.disciplines.length && !filters.disciplines.includes(s.discipline)) return false;
      if (filters.era !== 'all' && s.era !== filters.era) return false;
      if (q && !`${s.name} ${s.origin} ${s.country} ${s.region} ${s.discipline}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [all, query, filters]);

  const selected = all.find((s) => s.id === selectedId) || null;
  // Keep the dossier open even when the selected record is filtered out of view
  // (e.g. following a lineage link to a hidden style) rather than silently closing.
  const panelOpen = view === 'atlas' && !!selected;

  const select = useCallback((id: string) => { setSelectedId(id); setView('atlas'); }, []);
  const onCenter = useCallback((r: ArtRecord) => { setSelectedId(r.id); setView('atlas'); setCenterSignal((n) => n + 1); }, []);
  const clearFilters = useCallback(() => { setFilters(DEFAULT_FILTERS); setQuery(''); }, []);
  const shuffle = useCallback(() => {
    const pool = filtered.length ? filtered : all;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) { setSelectedId(pick.id); setView('atlas'); setCenterSignal((n) => n + 1); }
  }, [filtered, all]);

  // keyboard: "/" focus search, Esc close panel
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === '/' && document.activeElement !== searchRef.current) { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'Escape') setSelectedId(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="wa-app">
      <TopBar view={view} onView={setView} query={query} onQuery={setQuery} count={all.length} searchRef={searchRef} onShuffle={shuffle} />
      <div className="stage">
        <FilterRail
          filters={filters} setFilters={setFilters}
          shown={filtered.length} total={all.length} onClear={clearFilters}
          regions={graph.regions} disciplines={graph.disciplines} eras={graph.eras}
        />
        <div className="stage__main">
          <Globe
            records={filtered}
            selectedId={selectedId}
            onSelect={setSelectedId}
            routes={filters.routes}
            labels={filters.labels}
            autorotate={filters.autorotate}
            paused={panelOpen}
            centerSignal={centerSignal}
          />
          {view === 'codex' ? <CodexView records={filtered} onSelect={select} disciplines={graph.disciplines} /> : null}
          {view === 'lineage' ? <LineageView records={filtered} onSelect={select} /> : null}
          {panelOpen && selected ? (
            <DossierPanel record={selected} all={all} onClose={() => setSelectedId(null)} onSelect={setSelectedId} onCenter={onCenter} />
          ) : null}
        </div>
      </div>
      <div className="mobile-warn"><Icon name="triangle-alert" size={15} color="var(--gold-500)" /> Built for desktop — the globe, rail, and panel need width to breathe.</div>
    </div>
  );
}
