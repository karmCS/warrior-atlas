'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import esriConfig from '@arcgis/core/config';
import EsriMap from '@arcgis/core/Map';
import SceneView from '@arcgis/core/views/SceneView';
import * as reactiveUtils from '@arcgis/core/core/reactiveUtils';
import Ground from '@arcgis/core/Ground';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Graphic from '@arcgis/core/Graphic';
import Point from '@arcgis/core/geometry/Point';
import Polyline from '@arcgis/core/geometry/Polyline';
import Polygon from '@arcgis/core/geometry/Polygon';
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import TextSymbol from '@arcgis/core/symbols/TextSymbol';
import { feature } from 'topojson-client';
import { Icon } from './Icon';
import type { ArtRecord } from '@/lib/types';

// Assets (icons, workers) load from the CDN — no local copy, no API key required.
esriConfig.assetsPath = 'https://js.arcgis.com/4.31/@arcgis/core/assets';

const GOLD = '#F2BF2B';
const RED = '#C22026';
const RED_HOT = '#E23B33';

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

function nodeSymbol(selected: boolean) {
  return new SimpleMarkerSymbol({
    style: 'diamond',
    color: selected ? RED : GOLD,
    size: selected ? 15 : 11,
    outline: { color: selected ? RED_HOT : [11, 7, 6, 0.9], width: selected ? 1.6 : 1 },
  });
}
function labelSymbol(text: string, selected: boolean) {
  return new TextSymbol({
    text,
    color: selected ? '#FF9A82' : '#E2D3B0',
    haloColor: '#0B0706',
    haloSize: 1.4,
    yoffset: 13,
    font: { family: 'Oswald, sans-serif', size: 9, weight: 'bold' },
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

export function Globe({ records, selectedId, onSelect, routes, labels, autorotate, paused, centerSignal }: {
  records: ArtRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  routes: boolean;
  labels: boolean;
  autorotate: boolean;
  paused: boolean;
  centerSignal: number;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<SceneView | null>(null);
  const nodeLayerRef = useRef<GraphicsLayer | null>(null);
  const routeLayerRef = useRef<GraphicsLayer | null>(null);
  const labelLayerRef = useRef<GraphicsLayer | null>(null);
  const coordRef = useRef<HTMLSpanElement>(null);
  const spin = useRef({ paused: false, dragging: false, animating: false, raf: 0 });
  const clustersRef = useRef<Map<string, Cluster>>(new Map());
  const routeMetaRef = useRef<{ graphic: Graphic; a: string; b: string }[]>([]);
  const handlers = useRef({ onSelect });
  handlers.current.onSelect = onSelect;

  const [ready, setReady] = useState(false);
  const [pop, setPop] = useState<{ cluster: Cluster; x: number; y: number } | null>(null);
  const popRef = useRef<Cluster | null>(null);
  const clusters = useMemo(() => clusterByCountry(records), [records]);

  // ── init the SceneView once ──
  useEffect(() => {
    if (!boxRef.current) return;
    const landLayer = new GraphicsLayer({ id: 'land' });
    const routeLayer = new GraphicsLayer({ id: 'routes', elevationInfo: { mode: 'absolute-height' } });
    const nodeLayer = new GraphicsLayer({ id: 'nodes' });
    const labelLayer = new GraphicsLayer({ id: 'labels' });
    routeLayerRef.current = routeLayer; nodeLayerRef.current = nodeLayer; labelLayerRef.current = labelLayer;

    const map = new EsriMap({
      ground: new Ground({ surfaceColor: [12, 8, 6] }),
      layers: [landLayer, routeLayer, nodeLayer, labelLayer],
    });
    const view = new SceneView({
      container: boxRef.current,
      map,
      viewingMode: 'global',
      qualityProfile: 'high',
      camera: { position: { longitude: 25, latitude: 12, z: 2.4e7 }, heading: 0, tilt: 0 },
      constraints: { altitude: { min: 6e6, max: 6e7 }, clipDistance: { mode: 'auto' } },
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
      loadLand(landLayer);
      spin.current.raf = requestAnimationFrame(frame);
    }).catch(() => {});

    const onClick = view.on('click', (e) => {
      view.hitTest(e, { include: nodeLayer }).then((res) => {
        const hit = res.results.find((r) => r.type === 'graphic' && r.graphic?.layer === nodeLayer);
        if (hit && hit.type === 'graphic') {
          const country = hit.graphic.attributes?.country as string;
          const c = clustersRef.current.get(country);
          if (!c) return;
          if (c.styles.length === 1) { handlers.current.onSelect(c.styles[0].id); setPop(null); popRef.current = null; }
          else openPopover(c);
        } else { setPop(null); popRef.current = null; }
      }).catch(() => {});
    });
    const onDrag = view.on('drag', (e) => {
      spin.current.dragging = e.action !== 'end';
      if (e.action === 'start') { setPop(null); popRef.current = null; }
    });
    const camWatch = view.watch('camera', () => {
      const c = view.center;
      if (coordRef.current && c) coordRef.current.textContent = fmtCenter(c.latitude ?? 0, c.longitude ?? 0);
      repositionPopover();
    });

    function frame() {
      const v = viewRef.current;
      if (v && !spin.current.paused && !spin.current.animating && !spin.current.dragging && !v.interacting) {
        const cam = v.camera.clone();
        cam.position.longitude = normLng((cam.position.longitude ?? 0) + 0.12);
        v.camera = cam;
      }
      spin.current.raf = requestAnimationFrame(frame);
    }
    function openPopover(c: Cluster) {
      popRef.current = c;
      const sp = view.toScreen(new Point({ longitude: c.lng, latitude: c.lat }));
      if (sp) setPop({ cluster: c, x: sp.x, y: sp.y });
    }
    function repositionPopover() {
      const c = popRef.current;
      if (!c) return;
      if (!frontFacing(view, c.lng, c.lat)) { setPop(null); popRef.current = null; return; }
      const sp = view.toScreen(new Point({ longitude: c.lng, latitude: c.lat }));
      if (sp) setPop({ cluster: c, x: sp.x, y: sp.y });
    }

    return () => {
      cancelAnimationFrame(spin.current.raf);
      camWatch.remove(); onClick.remove(); onDrag.remove();
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // keep spin paused state synced to props / popover
  useEffect(() => { spin.current.paused = paused || !autorotate || !!pop; }, [paused, autorotate, pop]);

  // keep the click-handler's cluster lookup current
  useEffect(() => { clustersRef.current = new Map(clusters.map((c) => [c.country, c])); }, [clusters]);

  // ── nodes + labels (cheap; restyled on selection) ──
  useEffect(() => {
    if (!ready) return;
    const nodeLayer = nodeLayerRef.current!, labelLayer = labelLayerRef.current!;
    nodeLayer.removeAll(); labelLayer.removeAll();
    for (const c of clusters) {
      const sel = selectedId != null && c.ids.includes(selectedId);
      nodeLayer.add(new Graphic({
        geometry: new Point({ longitude: c.lng, latitude: c.lat }),
        symbol: nodeSymbol(sel),
        attributes: { country: c.country },
      }));
      if (labels) {
        labelLayer.add(new Graphic({
          geometry: new Point({ longitude: c.lng, latitude: c.lat }),
          symbol: labelSymbol(`${c.country.toUpperCase()} ·${c.styles.length}`, sel),
        }));
      }
    }
  }, [clusters, labels, selectedId, ready]);

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
    const selCountry = selectedId ? records.find((r) => r.id === selectedId)?.country ?? null : null;
    for (const rm of routeMetaRef.current) {
      rm.graphic.symbol = routeSymbol(selCountry != null && (rm.a === selCountry || rm.b === selCountry));
    }
  }, [selectedId, clusters, routes, ready]);

  // ── fly the camera to the selected art (spec: view.goTo on select) ──
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !ready || !selectedId) return;
    const r = records.find((s) => s.id === selectedId);
    if (!r) return;
    setPop(null); popRef.current = null;
    spin.current.animating = true;
    view.goTo({ center: [r.lng, r.lat] }, { duration: 900, easing: 'out-expo' })
      .catch(() => {}).finally(() => { spin.current.animating = false; });
  }, [selectedId, centerSignal, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  function zoomBy(dir: number) {
    const view = viewRef.current; if (!view) return;
    spin.current.animating = true;
    view.goTo({ zoom: view.zoom + dir }, { duration: 250 })
      .catch(() => {}).finally(() => { spin.current.animating = false; });
  }
  function resetView() {
    const view = viewRef.current; if (!view) return;
    spin.current.animating = true;
    view.goTo({ position: { longitude: 25, latitude: 12, z: 2.4e7 }, heading: 0, tilt: 0 }, { duration: 500 })
      .catch(() => {}).finally(() => { spin.current.animating = false; });
  }

  return (
    <div className="map">
      <div className="map__view" ref={boxRef} />
      <div className="map__atmo" />
      <div className="map__vignette" />

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
      <div className="hint">Drag to rotate · scroll to zoom</div>

      <div className="zoom">
        <button onClick={() => zoomBy(1)} aria-label="Zoom in"><Icon name="plus" size={15} /></button>
        <button onClick={() => zoomBy(-1)} aria-label="Zoom out"><Icon name="minus" size={15} /></button>
        <button onClick={resetView} aria-label="Reset view"><Icon name="compass" size={15} /></button>
      </div>
    </div>
  );
}

// Whether a lng/lat sits on the camera-facing hemisphere (for popover culling).
function frontFacing(view: SceneView, lng: number, lat: number): boolean {
  const cam = view.camera?.position;
  if (!cam) return true;
  const p = toVec(lng, lat);
  const c = toVec(cam.longitude ?? 0, cam.latitude ?? 0);
  return p[0] * c[0] + p[1] * c[1] + p[2] * c[2] > 0.12;
}

// Load Natural Earth country outlines (world-atlas topojson, public domain) into a
// GraphicsLayer — warm-brown landmasses with a faint gold coastline draped on the
// globe. Rings are REVERSED: GeoJSON winds exterior rings counter-clockwise, but
// ArcGIS expects clockwise exterior / counter-clockwise holes, so a uniform reverse
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
