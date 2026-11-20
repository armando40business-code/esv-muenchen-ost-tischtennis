// Gemeinsame Hilfen für Abschnitte (<section>): Einrücken, Anker, Kicker/Überschrift.

import { esc, txt, leer } from './html.mjs';

/** Einrücken eines mehrzeiligen Blocks. */
export function ein(s, n) {
  const p = ' '.repeat(n);
  return s.split('\n').map((z) => (z ? p + z : z)).join('\n');
}

/** Anker (id) säubern: nur A-Z a-z 0-9 _ - */
export function sauberId(wert) {
  return txt(wert).trim().replace(/^#/, '').replace(/[^A-Za-z0-9_-]/g, '-').replace(/^-+|-+$/g, '');
}

/** Abschnitt (<section>) mit den gemeinsamen Feldern hintergrund/anker. */
export function sektion(b, innen, { wrapKlasse = '', wrapAttr = '' } = {}) {
  const id = sauberId(b.anker);
  const abgesetzt = txt(b.hintergrund) === 'abgesetzt';
  const attrs = (id ? ` id="${id}"` : '') + (abgesetzt ? ' class="abgesetzt"' : '');
  return `<section${attrs}>\n  <div class="wrap${wrapKlasse ? ' ' + wrapKlasse : ''}"${wrapAttr}>\n${ein(innen, 4)}\n  </div>\n</section>`;
}

/** Kicker + Überschrift (h2) als Zeilen. */
export function titelzeilen(b) {
  const z = [];
  if (!leer(b.kicker)) z.push(`<p class="kicker">${esc(b.kicker)}</p>`);
  if (!leer(b.ueberschrift)) z.push(`<h2>${esc(b.ueberschrift)}</h2>`);
  return z;
}
