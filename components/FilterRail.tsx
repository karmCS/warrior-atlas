'use client';
import { Dispatch, SetStateAction } from 'react';
import { Icon } from './Icon';
import type { Filters } from './AtlasApp';

export function FilterRail({ filters, setFilters, shown, total, onClear, regions, disciplines, eras }: {
  filters: Filters;
  setFilters: Dispatch<SetStateAction<Filters>>;
  shown: number;
  total: number;
  onClear: () => void;
  regions: string[];
  disciplines: { value: string; label: string }[];
  eras: { value: string; label: string }[];
}) {
  function toggleArr(key: 'regions' | 'disciplines', v: string) {
    setFilters((f) => {
      const has = f[key].includes(v);
      return { ...f, [key]: has ? f[key].filter((x) => x !== v) : [...f[key], v] };
    });
  }
  function toggle(key: 'verified' | 'disputed' | 'extinct' | 'routes' | 'labels' | 'autorotate') {
    setFilters((f) => ({ ...f, [key]: !f[key] }));
  }

  return (
    <aside className="rail">
      <div className="rail__grp">
        <span className="label">Region</span>
        <div className="chips">
          {regions.map((r) => (
            <button key={r} className={'fchip' + (filters.regions.includes(r) ? ' on' : '')} onClick={() => toggleArr('regions', r)}>{r}</button>
          ))}
        </div>
      </div>

      <div className="rail__grp">
        <span className="label">Discipline</span>
        <div className="chips">
          {disciplines.map((d) => (
            <button key={d.value} className={'fchip fchip--disc' + (filters.disciplines.includes(d.value) ? ' on' : '')} onClick={() => toggleArr('disciplines', d.value)}>{d.label}</button>
          ))}
        </div>
      </div>

      <div className="rail__grp">
        <span className="label">Era</span>
        <div className="selectbox">
          <select value={filters.era} onChange={(e) => setFilters((f) => ({ ...f, era: e.target.value }))} aria-label="Era">
            {eras.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <span className="chev"><Icon name="chevron-down" size={14} /></span>
        </div>
      </div>

      <div className="rail__grp">
        <span className="label">Status</span>
        {(['verified', 'disputed', 'extinct'] as const).map((k) => (
          <label key={k} className="check">
            <input type="checkbox" className="check__in" checked={filters[k]} onChange={() => toggle(k)} />
            <span className="box" aria-hidden="true">{filters[k] ? <Icon name="check" size={11} /> : null}</span>
            <span style={{ textTransform: 'capitalize' }}>{k}</span>
            {k === 'extinct' ? <span style={{ color: 'var(--red-400)' }}>†</span> : null}
          </label>
        ))}
      </div>

      <div className="rail__grp">
        <span className="label">Globe</span>
        {([['routes', 'Lineage routes'], ['labels', 'Country labels'], ['autorotate', 'Auto-rotate']] as const).map(([k, label]) => (
          <label key={k} className="check">
            <input type="checkbox" className="check__in" checked={filters[k]} onChange={() => toggle(k)} />
            <span className="box" aria-hidden="true">{filters[k] ? <Icon name="check" size={11} /> : null}</span>
            <span>{label}</span>
          </label>
        ))}
      </div>

      <div className="rail__foot">
        <span className="mono" style={{ color: 'var(--bone-500)', fontSize: '11px' }}>{shown} OF {total} SHOWN</span>
        <button className="btn btn--secondary btn--full" onClick={onClear}><Icon name="x" size={14} /> Clear filters</button>
      </div>
    </aside>
  );
}
