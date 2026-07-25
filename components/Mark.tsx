// The Warrior Atlas wordmark glyph — crossed swords with rising bands.
// Original geometry from the design (no third-party logo). Renders in currentColor.
//
// The viewBox y-origin is 14.5 on purpose. The painted ink runs y 42 -> 249 (blade
// tips down to the round linecaps on the 22-wide handle strokes), so it centres at
// 145.5, not at the 131 midpoint of a 0-origin 262-tall box. Every lockup centres
// this svg's *box* (`align-items: center`), so a 0-origin box hangs the glyph ~5.5%
// of its height low beside the wordmark. Offsetting the box to 14.5 -> 276.5 puts
// the box centre on the ink centre, at any `size`. Note getBBox({stroke:true}) will
// not show this — Chromium returns the geometry box there and drops the linecaps.
export function Mark({ size = 30 }: { size?: number }) {
  const maskId = 'wa-mark-bands';
  return (
    <svg width={size} height={(size * 262) / 240} viewBox="0 14.5 240 262" className="wa-logo" aria-label="The Warrior Atlas" role="img">
      <defs>
        <mask id={maskId}>
          <rect x="0" y="0" width="240" height="262" fill="#fff" />
          <line x1="121.5" y1="123.0" x2="143.3" y2="149.0" stroke="#000" strokeWidth="5" strokeLinecap="round" />
          <line x1="107.7" y1="134.6" x2="129.5" y2="160.6" stroke="#000" strokeWidth="5" strokeLinecap="round" />
          <path d="M140,160 C108,128 78,92 52,52" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" />
          <polygon points="192,214.5 197,220.5 192,226.5 187,220.5" />
          <polygon points="180.8,200.5 185.8,206.5 180.8,212.5 175.8,206.5" />
          <polygon points="169.6,186.5 174.6,192.5 169.6,198.5 164.6,192.5" />
          <polygon points="158.4,172.5 163.4,178.5 158.4,184.5 153.4,178.5" />
          <path d="M100,160 C132,128 162,92 188,52" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" />
          <polygon points="48,214.5 43,220.5 48,226.5 53,220.5" />
          <polygon points="59.2,200.5 54.2,206.5 59.2,212.5 64.2,206.5" />
          <polygon points="70.4,186.5 65.4,192.5 70.4,198.5 75.4,192.5" />
          <polygon points="81.6,172.5 76.6,178.5 81.6,184.5 86.6,178.5" />
        </mask>
      </defs>
      <g mask={`url(#${maskId})`} fill="currentColor" stroke="currentColor">
        <line x1="34" y1="238" x2="90" y2="168" strokeWidth="22" strokeLinecap="round" />
        <ellipse cx="90" cy="168" rx="17" ry="7" transform="rotate(40 90 168)" stroke="none" />
        <path d="M87.2,156.1 C122,114 164,74 196,42 C168,92 130,140 100.8,167.9 Z" stroke="none" />
        <line x1="206" y1="238" x2="150" y2="168" strokeWidth="22" strokeLinecap="round" />
        <ellipse cx="150" cy="168" rx="17" ry="7" transform="rotate(-40 150 168)" stroke="none" />
        <path d="M152.8,156.1 C118,114 76,74 44,42 C72,92 110,140 139.2,167.9 Z" stroke="none" />
      </g>
    </svg>
  );
}
