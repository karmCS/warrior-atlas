'use client';
import { useEffect, useRef } from 'react';
import { Icon } from './Icon';
import { Flag } from './Flag';
import { mediaIcon } from '@/lib/meta';
import type { ArtRecord, Media } from '@/lib/types';

function fmtCoord(lat: number, lng: number) {
  const la = Math.abs(lat).toFixed(4) + '° ' + (lat >= 0 ? 'N' : 'S');
  const lo = Math.abs(lng).toFixed(4) + '° ' + (lng >= 0 ? 'E' : 'W');
  return la + ', ' + lo;
}
function prettySlug(s: string) {
  return s.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
function wordCount(t: string) { return t.trim().split(/\s+/).filter(Boolean).length; }

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    verified: ['badge-verified', 'Verified'],
    disputed: ['badge-disputed', 'Disputed'],
    extinct: ['badge-extinct', 'Extinct †'],
  };
  const [cls, label] = map[status] || map.verified;
  return <span className={cls}><span className="dot" /> {label}</span>;
}

function MediaCard({ m }: { m: Media }) {
  return (
    <div className="mcard">
      <div className="poster cut-1">
        <Icon name={mediaIcon(m.type)} size={22} color="var(--bone-700)" />
        <span className="poster__ph">POSTER</span>
        {m.cover ? (
          // Sits over the placeholder, which stays visible if the CDN drops the file.
          <img
            className="poster__img" src={m.cover} alt="" aria-hidden loading="lazy" decoding="async"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : null}
      </div>
      <div className="mcard__title">{m.title}</div>
      <div className="mcard__foot">
        <span className="type-badge" data-t={m.type}>{m.type}</span>
        {m.country ? <Flag code={m.country} sm /> : null}
      </div>
    </div>
  );
}

export function DossierPanel({ record, all, onClose, onSelect, onCenter }: {
  record: ArtRecord;
  all: ArtRecord[];
  onClose: () => void;
  onSelect: (id: string) => void;
  onCenter: (r: ArtRecord) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  // Move focus into the dialog on open and restore it to the trigger on close.
  // preventScroll matters: on mount the panel is still parked at translateX(100%)
  // by its enter animation, i.e. entirely outside the stage. A plain focus() makes
  // the browser scroll the stage sideways to reveal the button, so the whole map
  // lurches 424px left and is then dragged back as the panel slides in.
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus({ preventScroll: true });
    return () => prev?.focus?.({ preventScroll: true });
  }, []);

  const byId = new Map(all.map((r) => [r.id, r]));
  const from = record.lineageFrom.map((id) => byId.get(id)).filter(Boolean) as ArtRecord[];
  const to = record.lineageTo.map((id) => byId.get(id)).filter(Boolean) as ArtRecord[];
  const hasLineage = from.length || to.length || record.ghostFrom.length || record.ghostTo.length;
  const paras = record.history.split(/\n{2,}/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);

  return (
    <aside className="panel" role="dialog" aria-modal="true" aria-label={record.name}>
      <div className="panel__bar" />
      <button className="panel__x" ref={closeRef} onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
      <div className="panel__body">
        <div className="head">
          <div className="kick">{record.country} · {record.founded}</div>
          <h2 className="name">{record.name}</h2>
          <div className="badges">
            <StatusBadge status={record.status} />
            <span className="tag">{record.discipline}</span>
            <span className="tag">{record.region}</span>
            {record.code ? <span className="stamp"><Flag code={record.code} /><span className="stamp__code">{record.code}</span></span> : null}
          </div>
        </div>

        <div className="body">
          {record.tagline ? <p className="tagline">{record.tagline}</p> : null}

          <div className="clip cut-1">
            {record.video ? (
              <iframe
                className="clip__frame"
                src={`https://www.youtube.com/embed/${record.video}${record.videoStart ? `?start=${record.videoStart}` : ''}`}
                title={`${record.name} — clip`}
                loading="lazy"
                allow="accelerometer; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div className="clip__ph"><Icon name="film" size={18} color="var(--bone-700)" /> No clip catalogued yet</div>
            )}
          </div>

          <div className="meta">
            <div className="meta__row"><span className="k">Birthplace</span><span className="v">{record.origin}</span></div>
            <div className="meta__row"><span className="k">Coordinates</span><span className="v mono">{fmtCoord(record.lat, record.lng)}</span></div>
            <div className="meta__row"><span className="k">Founded</span><span className="v mono">{record.eraLabel || record.founded.toUpperCase()}</span></div>
            <div className="meta__row"><span className="k">Discipline</span><span className="v" style={{ textTransform: 'capitalize' }}>{record.discipline}</span></div>
          </div>

          <div className="sec">
            <div className="sec__h"><span className="label">History</span><span className="wordcount">{wordCount(record.history)} words</span></div>
            <div className="history">{paras.map((p, i) => <p key={i}>{p}</p>)}</div>
          </div>

          <div className="sec" id="wa-lineage-sec">
            <span className="label">Lineage &amp; Influence</span>
            <div className="lineage-list">
              {from.map((s) => (
                <button key={'f' + s.id} className="chip-link" onClick={() => onSelect(s.id)}>
                  <Icon name="corner-left-up" size={13} color="var(--red-400)" /> descends from {s.name}
                </button>
              ))}
              {to.map((s) => (
                <button key={'t' + s.id} className="chip-link" onClick={() => onSelect(s.id)}>
                  <Icon name="arrow-right" size={13} color="var(--gold-500)" /> influenced {s.name}
                </button>
              ))}
              {record.ghostFrom.map((g) => (
                <span key={'gf' + g} className="chip-link ghost">
                  <Icon name="corner-left-up" size={13} color="var(--bone-700)" /> descends from {prettySlug(g)} · unmapped
                </span>
              ))}
              {record.ghostTo.map((g) => (
                <span key={'gt' + g} className="chip-link ghost">
                  <Icon name="arrow-right" size={13} color="var(--bone-700)" /> influenced {prettySlug(g)} · unmapped
                </span>
              ))}
              {!hasLineage ? <span className="lineage-empty">No documented lineage links in the codex yet.</span> : null}
            </div>
          </div>

          <div className="sec">
            <div className="sec__h"><span className="label">In Media</span><span className="n">· {record.media.length}</span></div>
            {record.media.length ? (
              <>
                <div className="strip">{record.media.slice(0, 6).map((m, i) => <MediaCard key={i} m={m} />)}</div>
                {/* TMDB terms of use require this notice wherever their artwork appears. */}
                {record.media.some((m) => m.cover) ? (
                  <p className="media-credit">Cover art via TMDB &amp; AniList. This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
                ) : null}
              </>
            ) : (
              <div className="media-empty"><Icon name="film" size={16} color="var(--bone-700)" /> No screen appearances catalogued yet.</div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
            <button className="btn btn--primary btn--full panel__center" onClick={() => onCenter(record)}><Icon name="crosshair" size={16} /> Center on globe</button>
            <button className="btn btn--secondary btn--full" onClick={() => document.getElementById('wa-lineage-sec')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}><Icon name="route" size={16} /> Trace lineage</button>
          </div>
        </div>
      </div>
    </aside>
  );
}
