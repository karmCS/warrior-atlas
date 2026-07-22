'use client';
import { RefObject } from 'react';
import { Icon } from './Icon';
import { Mark } from './Mark';

const VIEWS = ['atlas', 'codex', 'lineage'] as const;
export type View = (typeof VIEWS)[number];

export function TopBar({ view, onView, query, onQuery, count, searchRef, onShuffle }: {
  view: View;
  onView: (v: View) => void;
  query: string;
  onQuery: (q: string) => void;
  count: number;
  searchRef: RefObject<HTMLInputElement | null>;
  onShuffle: () => void;
}) {
  return (
    <header className="topbar">
      <Mark size={30} />
      <span className="topbar__name">The Warrior Atlas</span>
      <span className="topbar__count">{count} RECORDS</span>
      <nav className="topbar__nav">
        {VIEWS.map((v) => (
          <button key={v} className={view === v ? 'on' : ''} aria-current={view === v ? 'page' : undefined} onClick={() => onView(v)}>{v}</button>
        ))}
      </nav>
      <div className="topbar__right">
        <div className="topsearch">
          <Icon name="search" size={15} />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search styles, birthplaces…"
            aria-label="Search"
          />
          {query ? (
            <button className="iconbtn" style={{ width: 20, height: 20, border: 0 }} onClick={() => onQuery('')} aria-label="Clear search"><Icon name="x" size={13} /></button>
          ) : <kbd>/</kbd>}
        </div>
        <button className="iconbtn" title="Random style" aria-label="Random style" onClick={onShuffle}><Icon name="shuffle" size={16} /></button>
        <button className="iconbtn" title="About" aria-label="About"><Icon name="info" size={16} /></button>
      </div>
    </header>
  );
}
