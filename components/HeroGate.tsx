'use client';
import { useCallback, useEffect, useState } from 'react';
import { HeroGlobe, type HeroGlobePoint } from './HeroGlobe';
import { Icon } from './Icon';

// Enter transition: the wire-globe rushes forward while the wordmark splits and
// blurs out, uncovering the atlas that has been booting underneath the whole time.
const EXIT_MS = 900;
const EXIT_MS_REDUCED = 260;

type GateState = 'idle' | 'leaving' | 'gone';

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

interface HeroGateProps {
  points: HeroGlobePoint[];
  styleCount: number;
  regionCount: number;
  children: React.ReactNode;
}

export function HeroGate({ points, styleCount, regionCount, children }: HeroGateProps) {
  const [state, setState] = useState<GateState>('idle');
  const reduced = useReducedMotion();

  const enter = useCallback(() => {
    setState((s) => (s === 'idle' ? 'leaving' : s));
  }, []);

  useEffect(() => {
    if (state !== 'leaving') return;
    const t = setTimeout(() => setState('gone'), reduced ? EXIT_MS_REDUCED : EXIT_MS);
    return () => clearTimeout(t);
  }, [state, reduced]);

  const up = state !== 'gone';

  return (
    <>
      {/* `inert` keeps the booting atlas out of the tab order and the a11y tree
          while the gate is up, without unmounting (and re-paying for) the globe. */}
      <div className="wa-under" inert={up ? true : undefined}>
        {children}
      </div>

      {up ? (
        <section className="hero" data-state={state} aria-label="The Warrior Atlas — introduction">
          <div className="hero__stage">
            <HeroGlobe points={points} boost={state === 'leaving'} reduced={reduced} />
          </div>
          <div className="hero__grain" aria-hidden="true" />

          <header className="hero__bar">
            <span className="hero__mark">
              <Icon name="crosshair" size={15} color="var(--gold-500)" />
              Warrior Atlas
            </span>
            <span className="hero__ver">Vol. I · MMXXVI</span>
          </header>

          <div className="hero__inner">
            <p className="hero__kick">A martial arts encyclopedia project</p>
            <h1 className="hero__title">
              <span className="hero__line" data-text="The Warrior">
                The Warrior
              </span>
              <span className="hero__line" data-text="Atlas">
                Atlas
              </span>
            </h1>
            <p className="hero__sub">
              Learn about the origins of different martial arts around the world
            </p>
            <button type="button" className="hero__enter" onClick={enter}>
              <span className="hero__enter-label">Enter the atlas</span>
              <Icon name="arrow-right" size={15} />
            </button>
          </div>

          <footer className="hero__foot">
            <span>
              {styleCount} styles mapped · {regionCount} regions
            </span>
            <span className="hero__foot-hint">Built for desktop</span>
          </footer>
        </section>
      ) : null}
    </>
  );
}
