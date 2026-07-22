// Lucide icon wrapper — kebab-case name API (matches the design), explicit
// imports so it stays SSR-clean and tree-shaken (no whole-library import).
import {
  Search, Shuffle, Info, X, ChevronDown, Check, Plus, Minus, Compass, Crosshair,
  CornerLeftUp, ArrowRight, Route, Film, Tv, BookOpen, Clapperboard, Gamepad2,
  TriangleAlert, Map as MapIcon, ScrollText, GitBranch, MapPin,
  type LucideProps,
} from 'lucide-react';

const GLYPHS: Record<string, React.ComponentType<LucideProps>> = {
  search: Search, shuffle: Shuffle, info: Info, x: X, 'chevron-down': ChevronDown,
  check: Check, plus: Plus, minus: Minus, compass: Compass, crosshair: Crosshair,
  'corner-left-up': CornerLeftUp, 'arrow-right': ArrowRight, route: Route,
  film: Film, tv: Tv, 'book-open': BookOpen, clapperboard: Clapperboard,
  'gamepad-2': Gamepad2, 'triangle-alert': TriangleAlert, map: MapIcon,
  'scroll-text': ScrollText, 'git-branch': GitBranch, 'map-pin': MapPin,
};

export function Icon({ name, size = 16, color = 'currentColor', strokeWidth = 2 }: {
  name: string; size?: number; color?: string; strokeWidth?: number;
}) {
  const G = GLYPHS[name] || Compass;
  return <G size={size} color={color} strokeWidth={strokeWidth} style={{ display: 'inline-flex', flex: 'none' }} aria-hidden="true" />;
}
