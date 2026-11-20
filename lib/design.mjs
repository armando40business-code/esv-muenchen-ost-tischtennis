// Design-Varianten: Farbschema + Akzentfarbe. Standard (petrol, Akzent leer) -> kein zusätzliches CSS.

import { txt } from './html.mjs';

export const FARBSCHEMATA = {
  petrol: null, // heutiger Stand aus styles.css
  nachtblau: {
    'ink-900': '#0B1626', 'ink-850': '#0E1B2E', 'ink-800': '#12233A', 'ink-700': '#172C47', 'ink-600': '#1A3150',
    line: '#263D5E', 'line-2': '#34507A', teal: '#6FA3D8',
  },
  tannengruen: {
    'ink-900': '#0B1F17', 'ink-850': '#0E261C', 'ink-800': '#122F23', 'ink-700': '#173A2C', 'ink-600': '#1A4131',
    line: '#24503D', 'line-2': '#31614C', teal: '#6DB58F',
  },
  anthrazit: {
    'ink-900': '#15181B', 'ink-850': '#1A1E22', 'ink-800': '#20252A', 'ink-700': '#282E34', 'ink-600': '#2D343B',
    line: '#3A424A', 'line-2': '#4A535C', teal: '#8FA9B8',
  },
};

function hexZuRgb(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbZuHex(rgb) {
  return '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function mischen(rgb, ziel, anteil) {
  return rgb.map((v, i) => v + (ziel[i] - v) * anteil);
}

/**
 * Liefert das zusätzliche <style>-Element für den <head> (oder '' beim Standard).
 * warnen(text) meldet ungültige Werte.
 */
export function designCss(design, warnen = () => {}) {
  const d = design && typeof design === 'object' ? design : {};
  let schema = txt(d.farbschema).trim() || 'petrol';
  if (!Object.prototype.hasOwnProperty.call(FARBSCHEMATA, schema)) {
    warnen(`Unbekanntes Farbschema "${schema}" – es gilt "petrol".`);
    schema = 'petrol';
  }
  let akzent = txt(d.akzentfarbe).trim();
  if (akzent && !hexZuRgb(akzent)) {
    warnen(`Akzentfarbe "${akzent}" ist keine Hex-Farbe (#RRGGBB) – es gilt Gold.`);
    akzent = '';
  }
  const farben = FARBSCHEMATA[schema];
  if (!farben && !akzent) return '';

  const vars = [];
  const regeln = [];
  if (farben) {
    for (const [k, v] of Object.entries(farben)) vars.push(`--${k}:${v}`);
    const i9 = hexZuRgb(farben['ink-900']).join(',');
    const i8 = hexZuRgb(farben['ink-850']).join(',');
    const i7 = hexZuRgb(farben['ink-700']).join(',');
    regeln.push(
      `.site-head{background:rgba(${i9},.94)}`,
      `.page-head,.cta-band{background:linear-gradient(160deg,var(--ink-700),var(--ink-850))}`,
      `.hero-card{background:rgba(${i7},.9)}`,
      `.hero::after{background:linear-gradient(100deg,rgba(${i9},.94) 0%,rgba(${i9},.80) 34%,rgba(${i8},.42) 66%,rgba(${i7},.30) 100%),` +
        `linear-gradient(180deg,rgba(${i9},.55) 0%,rgba(${i9},0) 26%,rgba(${i9},.55) 100%)}`,
      `.hero-card h2{color:var(--teal)}`,
    );
  }
  if (akzent) {
    const rgb = hexZuRgb(akzent);
    vars.push(`--gold:${rgbZuHex(rgb)}`, `--gold-l:${rgbZuHex(mischen(rgb, [255, 255, 255], 0.28))}`,
      `--gold-d:${rgbZuHex(mischen(rgb, [0, 0, 0], 0.2))}`);
    regeln.push(
      `.textlink{border-bottom-color:rgba(${rgb.join(',')},.35)}`,
      `.textlink:hover{border-bottom-color:var(--gold)}`,
      `table.data tbody tr:hover{background:rgba(${rgb.join(',')},.07)}`,
    );
  }
  return `<style>:root{${vars.join(';')}}\n${regeln.join('\n')}</style>`;
}
