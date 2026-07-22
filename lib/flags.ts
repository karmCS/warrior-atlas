// The Warrior Atlas — flag swatches (CSS-gradient approximations, muted to sit
// inside the ember duotone). The ISO code shown alongside is the source of truth;
// the swatch is an accent. Ported from the design system, extended for the codex.

export interface FlagDef {
  name: string;
  css: string;
}

const F: Record<string, FlagDef> = {
  TH: { name: 'Thailand', css: 'linear-gradient(to bottom,#A51931 0 20%,#EDECE6 20% 33%,#2D3561 33% 67%,#EDECE6 67% 80%,#A51931 80%)' },
  CN: { name: 'China', css: 'radial-gradient(circle at 22% 30%, #F2BF2B 0 7%, transparent 8%), #B22234' },
  HK: { name: 'Hong Kong', css: 'radial-gradient(circle at 50% 50%, #EDECE6 0 22%, transparent 23%), #B22234' },
  BR: { name: 'Brazil', css: 'radial-gradient(circle at 50% 50%, #2D3561 0 20%, transparent 21%), linear-gradient(135deg, transparent 30%, #F2BF2B 30% 70%, transparent 70%), #1F7A46' },
  IN: { name: 'India', css: 'radial-gradient(circle at 50% 50%, #2D3561 0 12%, transparent 13%), linear-gradient(to bottom,#D98A2B 0 33%,#EDECE6 33% 67%,#1F7A46 67%)' },
  JP: { name: 'Japan', css: 'radial-gradient(circle at 50% 50%, #B22234 0 26%, transparent 27%), #EDECE6' },
  PH: { name: 'Philippines', css: 'linear-gradient(to right, #EDECE6 0 30%, transparent 30%), linear-gradient(to bottom, #2D3561 0 50%, #B22234 50%)' },
  ID: { name: 'Indonesia', css: 'linear-gradient(to bottom,#B22234 0 50%,#EDECE6 50%)' },
  FR: { name: 'France', css: 'linear-gradient(to right,#2D3561 0 33%,#EDECE6 33% 67%,#B22234 67%)' },
  KR: { name: 'South Korea', css: 'radial-gradient(circle at 50% 50%, #B22234 0 12%, #2D3561 12% 22%, transparent 23%), #EDECE6' },
  US: { name: 'United States', css: 'linear-gradient(to right, #2D3561 0 40%, transparent 40%), repeating-linear-gradient(to bottom,#B22234 0 14.3%,#EDECE6 14.3% 28.6%)' },
  GR: { name: 'Greece', css: 'linear-gradient(to bottom,#2D3561 0 20%,#EDECE6 20% 40%,#2D3561 40% 60%,#EDECE6 60% 80%,#2D3561 80%)' },
  // ── extensions for the 22-record codex ──
  GB: { name: 'United Kingdom', css: 'linear-gradient(0deg, transparent 42%, #EDECE6 42% 58%, transparent 58%), linear-gradient(90deg, transparent 42%, #EDECE6 42% 58%, transparent 58%), linear-gradient(0deg, transparent 45%, #B22234 45% 55%, transparent 55%), linear-gradient(90deg, transparent 45%, #B22234 45% 55%, transparent 55%), #2D3561' },
  RU: { name: 'Russia', css: 'linear-gradient(to bottom,#EDECE6 0 33%,#2D3561 33% 67%,#B22234 67%)' },
  MY: { name: 'Malaysia', css: 'linear-gradient(to right,#2D3561 0 46%, transparent 46%), radial-gradient(circle at 24% 28%, #F2BF2B 0 8%, transparent 9%), repeating-linear-gradient(to bottom,#B22234 0 7.14%,#EDECE6 7.14% 14.28%)' },
};

export function flagFor(code: string): FlagDef {
  return F[code] || { name: code, css: 'var(--surface-raised)' };
}
