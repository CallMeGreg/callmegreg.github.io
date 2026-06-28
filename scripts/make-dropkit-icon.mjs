// Generates public/images/dropkit.svg — DropKit's homepage icon.
//
// Concept: a harmonic mixing wheel (the Camelot-style color wheel DJs use to
// match keys) with a glowing vinyl record at the hub. This is deliberately
// different from Wubdle's equalizer-bar mark and speaks to what DropKit does:
// build key- and BPM-matched sets. Run with `node scripts/make-dropkit-icon.mjs`.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../public/images/dropkit.svg', import.meta.url));

const cx = 256;
const cy = 232;
const SEG = 12;
const gap = 2.4; // degrees of breathing room between wedges

const rad = (deg) => (deg * Math.PI) / 180;
const pt = (r, deg) => [
  +(cx + r * Math.cos(rad(deg))).toFixed(2),
  +(cy + r * Math.sin(rad(deg))).toFixed(2),
];

// Annular wedge (sector of a ring) path.
function wedge(ri, ro, a0, a1) {
  const [x0o, y0o] = pt(ro, a0);
  const [x1o, y1o] = pt(ro, a1);
  const [x1i, y1i] = pt(ri, a1);
  const [x0i, y0i] = pt(ri, a0);
  return (
    `M${x0o} ${y0o} A${ro} ${ro} 0 0 1 ${x1o} ${y1o} ` +
    `L${x1i} ${y1i} A${ri} ${ri} 0 0 0 ${x0i} ${y0i} Z`
  );
}

const outer = { ri: 122, ro: 172 };
const inner = { ri: 72, ro: 116 };

let wheel = '';
for (let i = 0; i < SEG; i++) {
  const hue = i * (360 / SEG);
  const a0 = -90 + i * (360 / SEG) + gap / 2;
  const a1 = -90 + (i + 1) * (360 / SEG) - gap / 2;
  // Outer ring = bright/"B" major; inner ring = deeper/"A" minor.
  wheel += `    <path d="${wedge(outer.ri, outer.ro, a0, a1)}" fill="hsl(${hue} 95% 60%)"/>\n`;
  wheel += `    <path d="${wedge(inner.ri, inner.ro, a0, a1)}" fill="hsl(${hue} 80% 45%)"/>\n`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="DropKit harmonic mixing wheel">
  <defs>
    <radialGradient id="dk-bg" cx="0.5" cy="0.42" r="0.75">
      <stop offset="0" stop-color="#241046"/>
      <stop offset="0.55" stop-color="#0d0820"/>
      <stop offset="1" stop-color="#03020a"/>
    </radialGradient>
    <linearGradient id="dk-neon" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#00f6ff"/>
      <stop offset="0.5" stop-color="#a64bff"/>
      <stop offset="1" stop-color="#ff2bd6"/>
    </linearGradient>
    <radialGradient id="dk-label" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ff2bd6"/>
      <stop offset="0.55" stop-color="#a64bff"/>
      <stop offset="1" stop-color="#00f6ff"/>
    </radialGradient>
    <filter id="dk-glow" x="-25%" y="-25%" width="150%" height="150%">
      <feGaussianBlur stdDeviation="5" result="b"/>
      <feMerge>
        <feMergeNode in="b"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <rect width="512" height="512" rx="64" fill="url(#dk-bg)"/>

  <!-- harmonic mixing wheel: two concentric rings of 12 key wedges -->
  <g filter="url(#dk-glow)">
${wheel}  </g>

  <!-- vinyl record at the hub -->
  <g filter="url(#dk-glow)">
    <circle cx="${cx}" cy="${cy}" r="64" fill="#07060f"/>
    <circle cx="${cx}" cy="${cy}" r="58" fill="none" stroke="#2a2540" stroke-width="2"/>
    <circle cx="${cx}" cy="${cy}" r="48" fill="none" stroke="#231f38" stroke-width="2"/>
    <circle cx="${cx}" cy="${cy}" r="38" fill="none" stroke="#1d1a30" stroke-width="2"/>
    <circle cx="${cx}" cy="${cy}" r="26" fill="url(#dk-label)"/>
    <circle cx="${cx}" cy="${cy}" r="6" fill="#07060f"/>
    <!-- specular sheen sweeping across the record -->
    <path d="M${cx - 52} ${cy - 30} A64 64 0 0 1 ${cx + 30} ${cy - 56}" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity="0.35"/>
  </g>

  <text x="256" y="476" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="54" font-weight="900" letter-spacing="3" fill="url(#dk-neon)" filter="url(#dk-glow)">DropKit</text>
</svg>
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, svg);
console.log(`Wrote ${OUT} (${svg.length} bytes)`);
