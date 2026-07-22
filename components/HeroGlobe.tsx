'use client';
import { useEffect, useRef } from 'react';
import { feature } from 'topojson-client';

// Decorative orthographic wire-globe for the hero gate. Canvas 2D, no ArcGIS —
// the real SceneView is already booting behind the overlay and this must stay cheap.

const RAD = Math.PI / 180;
const TILT = -18 * RAD; // lean the north pole away so we read the globe from slightly above
const SPIN_DEG_PER_SEC = 4;
const BOOST_MAX = 16; // spin multiplier at the peak of the enter transition
const BOOST_RAMP_MS = 900;
const LAND_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json';

const GRATICULE = 'rgba(242, 191, 43, 0.13)';
const LAND = 'rgba(226, 211, 176, 0.30)';
const RIM = 'rgba(242, 191, 43, 0.26)';
const DOT = '#F2BF2B';
const DOT_GLOW = 'rgba(226, 59, 51, 0.55)';

type Ring = [number, number][];

// Module-level cache: the gate can remount (StrictMode) without refetching.
let landPromise: Promise<Ring[]> | null = null;

function loadLand(): Promise<Ring[]> {
  landPromise ??= fetch(LAND_URL)
    .then((res) => {
      if (!res.ok) throw new Error(`world-atlas ${res.status}`);
      return res.json();
    })
    .then((topo) => {
      const fc = feature(topo, topo.objects.countries) as unknown as {
        features: { geometry: { type: string; coordinates: number[][][] | number[][][][] } | null }[];
      };
      const rings: Ring[] = [];
      for (const f of fc.features) {
        const g = f.geometry;
        if (!g) continue;
        const polys = (g.type === 'Polygon' ? [g.coordinates] : g.coordinates) as number[][][][];
        for (const poly of polys) for (const ring of poly) rings.push(ring as Ring);
      }
      return rings;
    })
    .catch(() => {
      // ponytail: the outlines are decoration — the graticule sphere alone is a fine
      // fallback, so a CDN hiccup degrades the hero instead of breaking the entrance.
      landPromise = null;
      return [] as Ring[];
    });
  return landPromise;
}

interface Projected {
  sx: number;
  sy: number;
  z: number; // > 0 = facing the camera
}

function project(lng: number, lat: number, rot: number, cx: number, cy: number, r: number): Projected {
  const la = lat * RAD;
  const lo = (lng + rot) * RAD;
  const x = Math.cos(la) * Math.sin(lo);
  const y0 = Math.sin(la);
  const z0 = Math.cos(la) * Math.cos(lo);
  const y = y0 * Math.cos(TILT) - z0 * Math.sin(TILT);
  const z = y0 * Math.sin(TILT) + z0 * Math.cos(TILT);
  return { sx: cx + x * r, sy: cy - y * r, z };
}

/** Adds the visible (front-hemisphere) runs of a ring to the current path. */
function tracePath(
  ctx: CanvasRenderingContext2D,
  ring: Ring,
  rot: number,
  cx: number,
  cy: number,
  r: number,
) {
  let pen = false;
  for (const [lng, lat] of ring) {
    const p = project(lng, lat, rot, cx, cy, r);
    if (p.z <= 0) {
      pen = false;
      continue;
    }
    if (pen) ctx.lineTo(p.sx, p.sy);
    else {
      ctx.moveTo(p.sx, p.sy);
      pen = true;
    }
  }
}

function buildGraticule(): Ring[] {
  const rings: Ring[] = [];
  for (let lng = -180; lng < 180; lng += 30) {
    const meridian: Ring = [];
    for (let lat = -90; lat <= 90; lat += 4) meridian.push([lng, lat]);
    rings.push(meridian);
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const parallel: Ring = [];
    for (let lng = -180; lng <= 180; lng += 4) parallel.push([lng, lat]);
    rings.push(parallel);
  }
  return rings;
}

const GRATICULE_RINGS = buildGraticule();

export interface HeroGlobePoint {
  lat: number;
  lng: number;
}

interface HeroGlobeProps {
  points: HeroGlobePoint[];
  /** True once the enter transition starts — the globe accelerates into the reveal. */
  boost: boolean;
  reduced: boolean;
}

export function HeroGlobe({ points, boost, reduced }: HeroGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landRef = useRef<Ring[]>([]);
  const boostRef = useRef(false);
  const pointsRef = useRef(points);

  pointsRef.current = points;
  boostRef.current = boost;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let raf = 0;
    let rot = 0;
    let last = 0;
    let boostStart = 0;
    let alive = true;

    function resize() {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw() {
      if (!canvas || !ctx) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(w, h) * 0.42;
      ctx.clearRect(0, 0, w, h);

      // sphere body — barely-there sunken disc so the wires read as a solid volume
      const body = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
      body.addColorStop(0, 'rgba(42, 29, 18, 0.55)');
      body.addColorStop(1, 'rgba(8, 5, 5, 0.85)');
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.lineWidth = 1;
      ctx.strokeStyle = GRATICULE;
      ctx.beginPath();
      for (const ring of GRATICULE_RINGS) tracePath(ctx, ring, rot, cx, cy, r);
      ctx.stroke();

      if (landRef.current.length) {
        ctx.strokeStyle = LAND;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        for (const ring of landRef.current) tracePath(ctx, ring, rot, cx, cy, r);
        ctx.stroke();
      }

      ctx.strokeStyle = RIM;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      for (const p of pointsRef.current) {
        const q = project(p.lng, p.lat, rot, cx, cy, r);
        if (q.z <= 0.02) continue;
        ctx.globalAlpha = 0.35 + 0.65 * q.z;
        ctx.fillStyle = DOT_GLOW;
        ctx.beginPath();
        ctx.arc(q.sx, q.sy, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = DOT;
        ctx.beginPath();
        ctx.arc(q.sx, q.sy, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function frame(now: number) {
      if (!alive) return;
      const dt = last ? Math.min(now - last, 64) : 16;
      last = now;

      let speed = SPIN_DEG_PER_SEC;
      if (boostRef.current) {
        if (!boostStart) boostStart = now;
        const t = Math.min((now - boostStart) / BOOST_RAMP_MS, 1);
        speed *= 1 + (BOOST_MAX - 1) * t * t; // ease-in ramp: the rush builds, never snaps
      }
      rot = (rot + (speed * dt) / 1000) % 360;

      draw();
      raf = requestAnimationFrame(frame);
    }

    resize();
    draw();

    const ro = new ResizeObserver(() => {
      resize();
      draw();
    });
    ro.observe(canvas);

    loadLand().then((rings) => {
      if (!alive) return;
      landRef.current = rings;
      draw();
    });

    if (!reduced) raf = requestAnimationFrame(frame);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [reduced]);

  return <canvas ref={canvasRef} className="hero__canvas" aria-hidden="true" />;
}
