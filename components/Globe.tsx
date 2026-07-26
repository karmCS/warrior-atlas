'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import esriConfig from '@arcgis/core/config';
import { version as arcgisVersion } from '@arcgis/core/kernel';
import EsriMap from '@arcgis/core/Map';
import Basemap from '@arcgis/core/Basemap';
import SceneView from '@arcgis/core/views/SceneView';
import * as reactiveUtils from '@arcgis/core/core/reactiveUtils';
import Ground from '@arcgis/core/Ground';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import VectorTileLayer from '@arcgis/core/layers/VectorTileLayer';
import Graphic from '@arcgis/core/Graphic';
import Point from '@arcgis/core/geometry/Point';
import Polyline from '@arcgis/core/geometry/Polyline';
import Polygon from '@arcgis/core/geometry/Polygon';
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import { feature } from 'topojson-client';
import { Icon } from './Icon';
import type { ArtRecord } from '@/lib/types';

// Assets (icons, workers, vector-tile decoders) load from the CDN, version-pinned to
// the installed @arcgis/core — a basemap pulls workers from here, so the two must agree.
esriConfig.assetsPath = `https://js.arcgis.com/${arcgisVersion}/@arcgis/core/assets`;

// Esri basemap auth. NEXT_PUBLIC_* is inlined into the client bundle at build time, so
// this must be a referrer-restricted key. Absent or empty (fork, CI, open-source clone)
// → the globe falls back to the keyless Natural Earth path in loadLand().
//
// The key is deliberately NOT assigned to esriConfig.apiKey here. That is a global: it
// appends ?token= to every arcgis.com request, including the ones on the keyless fallback
// path. A fallback that advertises itself as keyless should not be sending credentials,
// and staying anonymous there keeps it working when the key is the very thing that is
// broken — an INVALID token makes an otherwise-public request fail (498), where sending
// none at all succeeds. Whichever style source actually wins sets the key, or leaves it
// unset, for itself — see loadEmberBasemap.
const ARCGIS_KEY = (process.env.NEXT_PUBLIC_ARCGIS_API_KEY ?? '').trim();

const GOLD = '#F2BF2B';
const GOLD_HOT = '#FFD34D';
const RED = '#C22026';
const RED_HOT = '#E23B33';
const BONE = '#E2D3B0';
const LACQUER = '#0B0706';
const LAND_BROWN = '#4A3418';

const EARTH_R = 6378137;      // metres — drives the horizon cutoff that culls labels
const SPIN_DEG_PER_SEC = 7.2; // was 0.12°/frame @60fps; now frame-rate independent
const SPIN_RAMP = 6;          // 1/s — how fast the spin eases up to / down from speed
const USER_IDLE_MS = 1400;    // how long the globe holds still after a zoom/drag
const PANEL_W = 424;          // keep in sync with `.panel` width in globals.css

// ── great-circle math (geodesic arc geometry, spec: elevated-vertex polylines) ──
const RAD = Math.PI / 180;
type Vec = [number, number, number];
function toVec(lng: number, lat: number): Vec {
  const la = lat * RAD, lo = lng * RAD;
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
}
function fromVec(v: Vec): [number, number] {
  return [Math.atan2(v[1], v[0]) / RAD, Math.asin(Math.max(-1, Math.min(1, v[2]))) / RAD];
}
function greatCircle(aLng: number, aLat: number, bLng: number, bLat: number, n: number): number[][] {
  const a = toVec(aLng, aLat), b = toVec(bLng, bLat);
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  d = Math.acos(Math.max(-1, Math.min(1, d)));
  const lift = Math.max(4e5, Math.min(3.5e6, 4e5 + d * 1.6e6));
  const s = Math.sin(d);
  const out: number[][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    let p: Vec;
    if (s < 1e-6) p = a;
    else {
      const k0 = Math.sin((1 - t) * d) / s, k1 = Math.sin(t * d) / s;
      p = [a[0] * k0 + b[0] * k1, a[1] * k0 + b[1] * k1, a[2] * k0 + b[2] * k1];
    }
    const [lng, lat] = fromVec(p);
    out.push([lng, lat, lift * Math.sin(Math.PI * t)]);
  }
  return out;
}
function normLng(x: number) { return ((x + 180) % 360 + 360) % 360 - 180; }
function fmtCenter(lat: number, lng: number) {
  return `${Math.abs(lat).toFixed(1)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(normLng(lng)).toFixed(1)}° ${lng >= 0 ? 'E' : 'W'}`;
}

interface Cluster { country: string; lat: number; lng: number; ids: string[]; styles: ArtRecord[]; }
function clusterByCountry(records: ArtRecord[]): Cluster[] {
  const map = new Map<string, Cluster>();
  for (const s of records) {
    if (!map.has(s.country)) map.set(s.country, { country: s.country, lat: 0, lng: 0, ids: [], styles: [] });
    map.get(s.country)!.styles.push(s);
  }
  const out: Cluster[] = [];
  for (const c of map.values()) {
    c.lat = c.styles.reduce((a, s) => a + s.lat, 0) / c.styles.length;
    c.lng = c.styles.reduce((a, s) => a + s.lng, 0) / c.styles.length;
    c.ids = c.styles.map((s) => s.id);
    out.push(c);
  }
  return out;
}

function nodeSymbol(selected: boolean, hovered: boolean) {
  return new SimpleMarkerSymbol({
    style: 'diamond',
    color: selected ? RED : hovered ? GOLD_HOT : GOLD,
    size: selected ? 15 : hovered ? 14 : 11,
    outline: { color: selected ? RED_HOT : hovered ? GOLD_HOT : [11, 7, 6, 0.9], width: selected ? 1.6 : 1 },
  });
}

function routeSymbol(emph: boolean) {
  return new SimpleLineSymbol({
    color: emph ? 'rgba(226,74,58,0.95)' : 'rgba(226,74,58,0.42)',
    width: emph ? 2.4 : 1.3,
    style: 'dash',
    cap: 'round',
  });
}

export function Globe({ records, selectedId, onSelect, routes, labels, autorotate, onAutorotate, paused, centerSignal }: {
  records: ArtRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  routes: boolean;
  labels: boolean;
  autorotate: boolean;
  onAutorotate: (on: boolean) => void;
  paused: boolean;
  centerSignal: number;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<SceneView | null>(null);
  const nodeLayerRef = useRef<GraphicsLayer | null>(null);
  const routeLayerRef = useRef<GraphicsLayer | null>(null);
  const coordRef = useRef<HTMLSpanElement>(null);
  const spin = useRef({ paused: false, dragging: false, animating: false, hovering: false, raf: 0, last: 0, idleUntil: 0, vel: 0 });
  const clustersRef = useRef<Map<string, Cluster>>(new Map());
  const routeMetaRef = useRef<{ graphic: Graphic; a: string; b: string }[]>([]);
  const handlers = useRef({ onSelect });
  handlers.current.onSelect = onSelect;

  // DOM label overlay: one <button> per country, repositioned on every camera
  // change by writing `transform` straight onto the node. Labels used to be Esri
  // TextSymbols, which depth-sorted against the draped land polygons and against
  // each other — that reshuffling is what made them flicker while the globe spun.
  // In the DOM they have a stable paint order, and they get real :hover and
  // :focus-visible affordances for free.
  const labelElsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const labelPtsRef = useRef<Map<string, Point>>(new Map());
  const nodeGraphicsRef = useRef<Map<string, Graphic>>(new Map());
  const hoverRef = useRef<string | null>(null);
  const layoutRef = useRef<(() => void) | null>(null);

  const [ready, setReady] = useState(false);
  const [pop, setPop] = useState<{ cluster: Cluster; x: number; y: number } | null>(null);
  const popRef = useRef<Cluster | null>(null);
  const clusters = useMemo(() => clusterByCountry(records), [records]);
  const selectedCountry = useMemo(
    () => (selectedId ? records.find((r) => r.id === selectedId)?.country ?? null : null),
    [records, selectedId],
  );

  const pick = useCallback((c: Cluster) => {
    if (c.styles.length === 1) {
      handlers.current.onSelect(c.styles[0].id);
      setPop(null); popRef.current = null;
      return;
    }
    popRef.current = c;
    const sp = viewRef.current?.toScreen(new Point({ longitude: c.lng, latitude: c.lat }));
    if (sp) setPop({ cluster: c, x: sp.x, y: sp.y });
  }, []);

  // Hover deliberately stays out of React state: pointer-move fires constantly and
  // would re-render the whole overlay on every mouse twitch. Touch the two nodes
  // that actually changed instead.
  const setHover = useCallback((country: string | null) => {
    if (hoverRef.current === country) return;
    const prev = hoverRef.current;
    hoverRef.current = country;
    spin.current.hovering = country != null;
    for (const key of [prev, country]) {
      if (!key) continue;
      const on = key === country;
      labelElsRef.current.get(key)?.classList.toggle('is-hot', on);
      const g = nodeGraphicsRef.current.get(key);
      if (g) g.symbol = nodeSymbol(!!g.attributes?.selected, on);
    }
    const el = viewRef.current?.container as HTMLDivElement | undefined;
    if (el) el.style.cursor = country ? 'pointer' : '';
  }, []);

  // ── init the SceneView once ──
  useEffect(() => {
    if (!boxRef.current) return;
    const box = boxRef.current;
    let disposed = false;
    let teardown: (() => void) | null = null;

    (async () => {
      // A SceneView locks its spatial reference at CONSTRUCTION, and a VectorTileLayer
      // draws only when its tiling scheme matches that SR — it does not reproject. Esri's
      // vector basemaps are Web Mercator, so the basemap has to be on the Map before the
      // view exists. Assigning it after view.ready leaves the view in 4326 and the tiles
      // silently blank: loadStatus reports "loaded" while nothing renders.
      const basemap = await loadEmberBasemap();
      if (disposed) return;

      const landLayer = new GraphicsLayer({ id: 'land' });
      const routeLayer = new GraphicsLayer({ id: 'routes', elevationInfo: { mode: 'absolute-height' } });
      // Lifted off the surface so the diamonds never z-fight the basemap tiles (or the
      // draped land rings of the keyless fallback).
      const nodeLayer = new GraphicsLayer({ id: 'nodes', elevationInfo: { mode: 'relative-to-ground', offset: 60000 } });
      routeLayerRef.current = routeLayer; nodeLayerRef.current = nodeLayer;

      // No elevation layers: the ground stays a flat sphere so the absolute-height arcs
      // and their node endpoints keep meeting. surfaceColor shows through wherever the
      // basemap has no tiles (the poles) and everywhere in the keyless fallback. Basemaps
      // always draw beneath operational layers, so route/node ordering and the nodeLayer
      // hitTest filter are untouched either way.
      const map = new EsriMap({
        ground: new Ground({ surfaceColor: [12, 8, 6] }),
        basemap: basemap ?? undefined,
        layers: [landLayer, routeLayer, nodeLayer],
      });
      const view = new SceneView({
        container: box,
        map,
        viewingMode: 'global',
        qualityProfile: 'high',
        camera: { position: { longitude: 25, latitude: 12, z: 2.4e7 }, heading: 0, tilt: 0 },
        constraints: { altitude: { min: 1.5e6, max: 6e7 }, clipDistance: { mode: 'auto' } },
        environment: {
          background: { type: 'color', color: [8, 5, 5, 1] },
          starsEnabled: false,
          atmosphereEnabled: false,
          lighting: { type: 'virtual', directShadowsEnabled: false },
        },
        popupEnabled: false,
        ui: { components: [] },
      });
      viewRef.current = view;

      // NB: view.when() proved unreliable here (never settled despite view.ready
      // flipping true). Drive setup off the ready property directly instead.
      reactiveUtils.whenOnce(() => view.ready).then(() => {
        if (view.destroyed) return;
        setReady(true);
        if (!basemap) loadLand(landLayer);
        spin.current.last = performance.now();
        spin.current.raf = requestAnimationFrame(frame);
      }).catch(() => {});

      const onClick = view.on('click', (e) => {
        view.hitTest(e, { include: nodeLayer }).then((res) => {
          const hit = res.results.find((r) => r.type === 'graphic' && r.graphic?.layer === nodeLayer);
          if (hit && hit.type === 'graphic') {
            const c = clustersRef.current.get(hit.graphic.attributes?.country as string);
            if (c) pick(c);
          } else { setPop(null); popRef.current = null; }
        }).catch(() => {});
      });

      // Throttled to a single in-flight hitTest — pointer-move fires far faster than
      // hitTest resolves, and queueing every move stalls the frame loop.
      let hitPending = false;
      const onMove = view.on('pointer-move', (e) => {
        if (hitPending) return;
        hitPending = true;
        view.hitTest(e, { include: nodeLayer }).then((res) => {
          hitPending = false;
          const hit = res.results.find((r) => r.type === 'graphic' && r.graphic?.layer === nodeLayer);
          setHover(hit && hit.type === 'graphic' ? (hit.graphic.attributes?.country as string) ?? null : null);
        }).catch(() => { hitPending = false; });
      });
      const onLeave = view.on('pointer-leave', () => setHover(null));

      const onDrag = view.on('drag', (e) => {
        spin.current.dragging = e.action !== 'end';
        spin.current.idleUntil = performance.now() + USER_IDLE_MS;
        if (e.action === 'start') { setPop(null); popRef.current = null; }
      });
      // Wheel zoom is SceneView's own default. It was previously unusable because
      // the frame loop reassigned `view.camera` every frame, which cancels the
      // in-flight zoom animation. Don't preventDefault here — only hold the spin off.
      const onWheel = view.on('mouse-wheel', () => { spin.current.idleUntil = performance.now() + USER_IDLE_MS; });

      const camWatch = reactiveUtils.watch(() => view.camera, () => {
        const c = view.center;
        if (coordRef.current && c) coordRef.current.textContent = fmtCenter(c.latitude ?? 0, c.longitude ?? 0);
        repositionPopover();
      });

      function frame(now: number) {
        const v = viewRef.current;
        const s = spin.current;
        const dt = Math.min(0.1, (now - s.last) / 1000);
        s.last = now;
        // Two kinds of stop. A hard stop means something else owns the camera
        // (a goTo flight, a drag) — writing to it would cancel that outright, so
        // drop the velocity to zero at once. A soft stop is a decision the user
        // made (paused, hovering a marker, just finished zooming); those ease out
        // and back in, so the globe never jerks to a halt.
        const hard = !v || s.animating || s.dragging || v.interacting || !!v.animation;
        const soft = s.paused || s.hovering || now < s.idleUntil;
        if (hard) s.vel = 0;
        else {
          s.vel += ((soft ? 0 : SPIN_DEG_PER_SEC) - s.vel) * Math.min(1, dt * SPIN_RAMP);
          if (v && s.vel > 0.002) {
            const cam = v.camera.clone();
            cam.position.longitude = normLng((cam.position.longitude ?? 0) + s.vel * dt);
            v.camera = cam;
          }
        }
        // Driven from the frame loop rather than a camera watcher so the labels stay
        // glued to their anchors during Esri's own navigation (wheel zoom, goTo),
        // not just during our own camera writes.
        layoutLabels();
        s.raf = requestAnimationFrame(frame);
      }

      function layoutLabels() {
        const v = viewRef.current;
        const cam = v?.camera?.position;
        if (!v || !cam) return;
        // Anything angularly closer to the camera than the horizon is visible; fade
        // the last few degrees so labels don't pop on and off at the limb.
        const cosHorizon = EARTH_R / (EARTH_R + Math.max(1, cam.z ?? 0));
        const eye = toVec(cam.longitude ?? 0, cam.latitude ?? 0);
        for (const [country, el] of labelElsRef.current) {
          const pt = labelPtsRef.current.get(country);
          if (!pt) { el.style.visibility = 'hidden'; continue; }
          const p = toVec(pt.longitude ?? 0, pt.latitude ?? 0);
          const fade = (p[0] * eye[0] + p[1] * eye[1] + p[2] * eye[2] - cosHorizon) / 0.08;
          if (fade <= 0) { el.style.visibility = 'hidden'; continue; }
          const sp = v.toScreen(pt);
          if (!sp) { el.style.visibility = 'hidden'; continue; }
          el.style.visibility = 'visible';
          el.style.opacity = fade >= 1 ? '1' : fade.toFixed(2);
          el.style.transform = `translate3d(${Math.round(sp.x)}px, ${Math.round(sp.y)}px, 0)`;
        }
      }
      layoutRef.current = layoutLabels;

      function repositionPopover() {
        const c = popRef.current;
        if (!c) return;
        if (!frontFacing(view, c.lng, c.lat)) { setPop(null); popRef.current = null; return; }
        const sp = view.toScreen(new Point({ longitude: c.lng, latitude: c.lat }));
        if (sp) setPop({ cluster: c, x: sp.x, y: sp.y });
      }

      teardown = () => {
        cancelAnimationFrame(spin.current.raf);
        camWatch.remove(); onClick.remove(); onDrag.remove();
        onMove.remove(); onLeave.remove(); onWheel.remove();
        view.destroy();
        viewRef.current = null;
        layoutRef.current = null;
      };
    })();

    // Unmount before the basemap fetch resolves → disposed short-circuits the IIFE and
    // teardown is still null; after → teardown tears the view down normally.
    return () => { disposed = true; teardown?.(); };
  }, [pick, setHover]);

  // keep spin paused state synced to props / popover
  useEffect(() => { spin.current.paused = paused || !autorotate || !!pop; }, [paused, autorotate, pop]);

  // keep the click-handler's cluster lookup and the label anchors current
  useEffect(() => {
    clustersRef.current = new Map(clusters.map((c) => [c.country, c]));
    labelPtsRef.current = new Map(clusters.map((c) => [c.country, new Point({ longitude: c.lng, latitude: c.lat })]));
  }, [clusters]);

  // position freshly mounted labels before the next camera tick, so they don't
  // flash at 0,0 on first paint
  useEffect(() => { layoutRef.current?.(); }, [clusters, labels, ready]);

  // ── nodes: built only when the data changes ──
  useEffect(() => {
    if (!ready) return;
    const nodeLayer = nodeLayerRef.current!;
    nodeLayer.removeAll();
    nodeGraphicsRef.current.clear();
    for (const c of clusters) {
      const g = new Graphic({
        geometry: new Point({ longitude: c.lng, latitude: c.lat }),
        symbol: nodeSymbol(false, hoverRef.current === c.country),
        attributes: { country: c.country, selected: false },
      });
      nodeLayer.add(g);
      nodeGraphicsRef.current.set(c.country, g);
    }
  }, [clusters, ready]);

  // ── selection restyles the markers in place. Rebuilding the layer here (which
  //    is what it used to do) made every diamond on the globe blink out and back
  //    on each pick — the single biggest reason selecting a country felt broken. ──
  useEffect(() => {
    if (!ready) return;
    for (const [country, g] of nodeGraphicsRef.current) {
      const sel = country === selectedCountry;
      g.attributes = { ...g.attributes, selected: sel };
      g.symbol = nodeSymbol(sel, hoverRef.current === country);
    }
  }, [selectedCountry, clusters, ready]);


  // ── lineage arcs between country ANCHORS — endpoints share the node anchors so
  //    arcs stay attached to markers; intra-country descents collapse into the
  //    single country node. Rebuilt only on data change, never on selection. ──
  useEffect(() => {
    if (!ready) return;
    const routeLayer = routeLayerRef.current!;
    routeLayer.removeAll();
    routeMetaRef.current = [];
    if (!routes) return;
    const anchor = new Map(clusters.map((c) => [c.country, { lat: c.lat, lng: c.lng }]));
    const idset = new Set(records.map((r) => r.id));
    const byId = new Map(records.map((r) => [r.id, r]));
    const seen = new Set<string>();
    for (const r of records) {
      for (const toId of r.lineageTo) {
        if (!idset.has(toId)) continue;
        const t = byId.get(toId)!;
        if (r.country === t.country) continue;
        const key = [r.country, t.country].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        const a = anchor.get(r.country), b = anchor.get(t.country);
        if (!a || !b) continue;
        const graphic = new Graphic({
          geometry: new Polyline({ paths: [greatCircle(a.lng, a.lat, b.lng, b.lat, 48)], spatialReference: { wkid: 4326 }, hasZ: true }),
          symbol: routeSymbol(false),
        });
        routeLayer.add(graphic);
        routeMetaRef.current.push({ graphic, a: r.country, b: t.country });
      }
    }
  }, [clusters, records, routes, ready]);

  // ── emphasize arcs touching the selected style's country (symbol swap only) ──
  useEffect(() => {
    if (!ready) return;
    for (const rm of routeMetaRef.current) {
      rm.graphic.symbol = routeSymbol(selectedCountry != null && (rm.a === selectedCountry || rm.b === selectedCountry));
    }
  }, [selectedCountry, clusters, routes, ready]);

  // ── fly the camera to the selected art, but ONLY when it isn't already on
  //    screen. Recentring a marker the user just clicked slides the whole globe
  //    sideways under them for no information gain — that lateral drag is the
  //    "swipe". Picks made from the codex or lineage views, or an explicit
  //    "centre on map", still fly, because there the target really can be on the
  //    far side of the planet. ──
  const flownFor = useRef(0);
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !ready || !selectedId) return;
    const r = records.find((s) => s.id === selectedId);
    if (!r) return;
    setPop(null); popRef.current = null;

    const forced = centerSignal !== flownFor.current;
    flownFor.current = centerSignal;
    // `paused` is already true on this commit when the dossier is opening, so the
    // panel's footprint counts as off-screen.
    if (!forced && onScreen(view, r.lng, r.lat, paused ? PANEL_W : 0)) return;

    spin.current.animating = true;
    // The camera is moving across the screen rather than entering it, so it wants
    // an in-out curve. `out-expo` decelerated so hard the last third read as a stall.
    view.goTo({ center: [r.lng, r.lat] }, { duration: 800, easing: 'in-out-cubic' })
      .catch(() => {}).finally(() => { spin.current.animating = false; });
  }, [selectedId, centerSignal, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  function zoomBy(dir: number) {
    const view = viewRef.current; if (!view) return;
    spin.current.idleUntil = performance.now() + USER_IDLE_MS;
    spin.current.animating = true;
    view.goTo({ zoom: view.zoom + dir }, { duration: 250 })
      .catch(() => {}).finally(() => { spin.current.animating = false; });
  }
  function resetView() {
    const view = viewRef.current; if (!view) return;
    spin.current.idleUntil = performance.now() + USER_IDLE_MS;
    spin.current.animating = true;
    view.goTo({ position: { longitude: 25, latitude: 12, z: 2.4e7 }, heading: 0, tilt: 0 }, { duration: 500 })
      .catch(() => {}).finally(() => { spin.current.animating = false; });
  }

  return (
    <div className="map">
      <div className="map__view" ref={boxRef} />
      <div className="map__atmo" />
      <div className="map__vignette" />

      {ready && labels ? (
        <div className="glabels">
          {clusters.map((c) => (
            <button
              key={c.country}
              type="button"
              ref={(el) => { if (el) labelElsRef.current.set(c.country, el); else labelElsRef.current.delete(c.country); }}
              className={'glabel' + (selectedCountry === c.country ? ' is-on' : '')}
              style={{ visibility: 'hidden' }}
              onPointerEnter={() => setHover(c.country)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(c.country)}
              onBlur={() => setHover(null)}
              onClick={() => pick(c)}
            >
              <span className="glabel__box">
                <span className="glabel__n">{c.country}</span>
                <span className="glabel__c">{c.styles.length}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {!ready ? <div className="map-loading"><Icon name="compass" size={26} color="var(--bone-700)" /> Summoning the globe…</div> : null}
      {ready && records.length === 0 ? <div className="map-empty"><Icon name="compass" size={26} color="var(--bone-700)" /> No records match — the trail goes cold.</div> : null}

      {pop ? (
        <div className="gpop" style={{ left: pop.x, top: pop.y }} onPointerDown={(e) => e.stopPropagation()}>
          <div className="gpop__h">{pop.cluster.country} · {pop.cluster.styles.length} styles</div>
          {pop.cluster.styles.map((s) => (
            <button key={s.id} className="gpop__i" onClick={() => { handlers.current.onSelect(s.id); setPop(null); popRef.current = null; }}>
              <span className="nm">{s.name}</span>
              <span className="dc">{s.discipline}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="legend">
        <span className="legend__t">Legend</span>
        <div className="legend__row"><span className="sw gold" /> Living style</div>
        <div className="legend__row"><span className="sw red" /> Selected</div>
        <div className="legend__row"><span className="sw route" /> Lineage route</div>
      </div>

      <div className="coordread"><Icon name="crosshair" size={12} color="var(--bone-600)" /> <span ref={coordRef}>—</span></div>
      <div className="hint">Drag to rotate · scroll to zoom · click a country</div>

      <div className="zoom">
        <button
          className={'zoom__spin' + (autorotate ? ' on' : '')}
          onClick={() => onAutorotate(!autorotate)}
          aria-pressed={autorotate}
          title={autorotate ? 'Stop the globe' : 'Spin the globe'}
          aria-label="Auto-rotate globe"
        >
          <Icon name={autorotate ? 'pause' : 'play'} size={15} />
        </button>
        <button onClick={() => zoomBy(1)} title="Zoom in" aria-label="Zoom in"><Icon name="plus" size={15} /></button>
        <button onClick={() => zoomBy(-1)} title="Zoom out" aria-label="Zoom out"><Icon name="minus" size={15} /></button>
        <button onClick={resetView} title="Reset view" aria-label="Reset view"><Icon name="compass" size={15} /></button>
      </div>
    </div>
  );
}

// Whether a lng/lat is already comfortably in view: facing the camera, and inside
// the viewport with a margin, excluding the strip the dossier panel covers. The
// margin keeps targets that are technically visible but jammed against an edge
// from counting, since those do deserve a flight.
function onScreen(view: SceneView, lng: number, lat: number, rightPad: number): boolean {
  if (!frontFacing(view, lng, lat)) return false;
  const sp = view.toScreen(new Point({ longitude: lng, latitude: lat }));
  const w = view.width, h = view.height;
  if (!sp || !w || !h) return false;
  const mx = w * 0.12, my = h * 0.12;
  return sp.x > mx && sp.x < w - rightPad - mx && sp.y > my && sp.y < h - my;
}

// Whether a lng/lat sits on the camera-facing hemisphere (for popover culling).
function frontFacing(view: SceneView, lng: number, lat: number): boolean {
  const cam = view.camera?.position;
  if (!cam) return true;
  const p = toVec(lng, lat);
  const c = toVec(cam.longitude ?? 0, cam.latitude ?? 0);
  return p[0] * c[0] + p[1] * c[1] + p[2] * c[2] > 0.12;
}

// ── Esri basemap: real vector tiles, recolored to the ember palette ──
// Dark Gray Canvas is the closest stock Esri basemap to the palette, but stock is still
// neutral grey, which would gut the design. So the style JSON is fetched, recolored, and
// handed to the VectorTileLayer at CONSTRUCTION via its `style` property. Building the
// style up front is the only restyling route documented as safe in a SceneView — the
// live setters (setPaintProperties/deleteStyleLayer/setLayoutProperties) are documented
// against 2D MapView, so they are deliberately not used here.
type StyleLayer = { id: string; type: string; 'source-layer'?: string; paint?: Record<string, unknown> };
type BasemapStyle = { layers: StyleLayer[] };

const COLOR_PROPS = ['background-color', 'fill-color', 'line-color', 'fill-outline-color'] as const;
const WATER_RE = /water|marine|bathymetry/;
const BOUNDARY_RE = /boundary/;
const CLUTTER_RE = /road|railroad|ferry|trail|tunnel|runway|building/;

interface StyleSource { label: string; url: string; keyed: boolean }

// Style sources, best first.
//
// 1. The keyed Basemap Styles v2 service — the one the project is built to use.
// 2. The public style resource describing the same Dark Gray Canvas tiles. This item, its
//    tiles and its sprite sheet are ALL anonymously readable, so this source is fetched
//    and rendered with no key at all. That is not just tidiness: an invalid token makes
//    these otherwise-public requests fail with 498, so a fallback that stays anonymous
//    still works in exactly the case that sent us to the fallback — a broken key.
//
// The two styles are equivalent: 121 layers, identical layer ids, same underlying
// World_Basemap_v2 tile service, same sprite sheet. Recoloured, they render the same. So
// the ONLY way to tell which one is live is the network — hence recordBasemapSource below
// and scripts/check-basemap.mjs.
function styleSources(key: string): StyleSource[] {
  return [
    {
      label: 'Basemap Styles v2 (arcgis/dark-gray)',
      url: `https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/styles/arcgis/dark-gray/base?token=${encodeURIComponent(key)}`,
      keyed: true,
    },
    {
      label: 'public Dark Gray Canvas style item (keyless)',
      url: 'https://www.arcgis.com/sharing/rest/content/items/5e9b3685f4c24d8781073dd928ebda50/resources/styles/root.json',
      keyed: false,
    },
  ];
}

// Which source the running app actually drew with. Exposed on window so a browser check
// can assert it, because the two sources are visually identical once recoloured — the
// failure this catches is invisible by construction.
export type BasemapSourceState = { label: string; keyed: boolean; degraded: boolean };
function recordBasemapSource(state: BasemapSourceState) {
  (window as unknown as { __waBasemap?: BasemapSourceState }).__waBasemap = state;
}

// The ember color a style layer paints with; null drops it from the style entirely.
function emberColor(layer: StyleLayer): string | null {
  const key = `${layer['source-layer'] ?? ''} ${layer.id}`.toLowerCase();
  if (layer.type === 'background') return LACQUER;
  if (WATER_RE.test(key)) return LACQUER;      // ocean and lakes = lacquer black
  if (BOUNDARY_RE.test(key)) return GOLD;      // borders = lantern gold, like the old coastlines
  if (CLUTTER_RE.test(key)) return null;       // no streets or buildings on a world atlas
  return LAND_BROWN;                           // everything terrestrial = warm brown
}

// Esri paints with either a plain hex or a {stops:[[zoom,color],…]} zoom function.
function recolor(value: unknown, next: string): unknown {
  const stops = (value as { stops?: [number, string][] } | null)?.stops;
  if (Array.isArray(stops)) return { ...(value as object), stops: stops.map(([zoom]) => [zoom, next]) };
  return next;
}

// Immutably rewrite a fetched Esri style into the ember palette.
function toEmberStyle(style: BasemapStyle): BasemapStyle {
  const layers = style.layers.flatMap((layer) => {
    const next = emberColor(layer);
    if (next === null) return [];
    const paint: Record<string, unknown> = { ...(layer.paint ?? {}) };
    for (const prop of COLOR_PROPS) if (prop in paint) paint[prop] = recolor(paint[prop], next);
    if ('text-color' in paint) paint['text-color'] = BONE;
    if ('text-halo-color' in paint) paint['text-halo-color'] = LACQUER;
    return [{ ...layer, paint }];
  });
  return { ...style, layers };
}

// Returns null when no key is configured or every style source fails, so the caller can
// fall back to the keyless Natural Earth path rather than show a bare sphere.
async function loadEmberBasemap(): Promise<Basemap | null> {
  if (!ARCGIS_KEY) return null;
  const sources = styleSources(ARCGIS_KEY);
  for (const source of sources) {
    let res: Response;
    try {
      res = await fetch(source.url);
    } catch (err) {
      console.warn(`[warrior-atlas] basemap style source unreachable: ${source.label}`, err);
      continue;
    }
    if (!res.ok) {
      // Esri answers an under-privileged key with 401/498 "Token Invalid" rather than a
      // 403, so this reads as a bad key when the key is fine and simply lacks the
      // Basemap Styles privilege. Say so, because the next source looks identical.
      console.warn(
        `[warrior-atlas] basemap style source "${source.label}" returned ${res.status}. ` +
        (source.keyed
          ? 'The API key is being rejected by the Basemap Styles v2 service. Run ' +
            '`npm run check:basemap` — it separates an unrecognised key (498, needs regenerating) ' +
            'from an under-privileged one (403, needs the "Basemap styles" privilege). ' +
            'Falling back to the public style; the globe will look the same but is NOT using v2.'
          : 'Falling back to the keyless Natural Earth land layer.'),
      );
      continue;
    }
    const style = await res.json().catch(() => null);
    if (!Array.isArray(style?.layers)) {
      console.warn(`[warrior-atlas] basemap style source "${source.label}" returned no layers.`);
      continue;
    }
    // Only a keyed source gets the key. Handing one to the public item's sprite sheet is
    // what produced the 498s — see styleSources.
    if (source.keyed) esriConfig.apiKey = ARCGIS_KEY;
    recordBasemapSource({ label: source.label, keyed: source.keyed, degraded: source !== sources[0] });
    return new Basemap({
      id: 'ember',
      title: 'Ember',
      baseLayers: [new VectorTileLayer({
        id: 'ember-base',
        style: toEmberStyle(style),
        ...(source.keyed ? { apiKey: ARCGIS_KEY } : {}),
      })],
    });
  }
  recordBasemapSource({ label: 'none — keyless Natural Earth', keyed: false, degraded: true });
  return null;
}

// Load Natural Earth country outlines (world-atlas topojson, public domain) into a
// GraphicsLayer — warm-brown landmasses with a faint gold coastline draped on the
// globe. This is the KEYLESS fallback — it runs when NEXT_PUBLIC_ARCGIS_API_KEY is
// absent or the Esri basemap could not be built, so a fork or CI build still gets a
// readable globe. Rings are REVERSED: GeoJSON winds exterior rings counter-clockwise,
// but ArcGIS expects clockwise exterior / counter-clockwise holes, so a uniform reverse
// converts both correctly. Fails gracefully offline (ember globe still renders).
async function loadLand(layer: GraphicsLayer) {
  try {
    const res = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json');
    const topo = await res.json();
    const geo = feature(topo, topo.objects.countries) as unknown as {
      features: { geometry: { type: string; coordinates: number[][][] | number[][][][] } | null }[];
    };
    const fill = new SimpleFillSymbol({ color: [74, 52, 24, 0.95], outline: { color: [242, 191, 43, 0.5], width: 0.5 } });
    for (const f of geo.features) {
      const g = f.geometry;
      if (!g) continue;
      const rings: number[][][] = [];
      const add = (ring: number[][]) => rings.push([...ring].reverse());
      if (g.type === 'Polygon') for (const ring of g.coordinates as number[][][]) add(ring);
      else if (g.type === 'MultiPolygon') for (const poly of g.coordinates as number[][][][]) for (const ring of poly) add(ring);
      if (!rings.length) continue;
      layer.add(new Graphic({ geometry: new Polygon({ rings, spatialReference: { wkid: 4326 } }), symbol: fill }));
    }
  } catch { /* offline — the ember globe surface still renders */ }
}
