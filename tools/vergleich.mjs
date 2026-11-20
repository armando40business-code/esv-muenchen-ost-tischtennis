#!/usr/bin/env node
// Vergleich alt gegen neu (Abnahmepunkt 2), ohne npm-Abhängigkeiten.
// Holt den Altstand aus Commit 05db18e per `git archive` in ein Temp-Verzeichnis und vergleicht je Seite
//   (a) sichtbarer Text (Leerraum normalisiert; Beschriftungen wie alt/aria-label/placeholder separat),
//   (b) alle Linkziele und Bildquellen (einzige erlaubte Abweichung: assets/esv-logo.png und
//       assets/hero-halle.* heißen jetzt /medien/bilder/…),
//   (c) <title>, Description, canonical, theme-color, og:*, JSON-LD (inhaltsgleich).
// Aufruf: node tools/vergleich.mjs [--alt <verzeichnis>] [--neu <verzeichnis>]
// Exit-Code 0 = alles gleich, 1 = Abweichungen.

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const COMMIT = '05db18e';
const SEITEN = ['index', 'mannschaften', 'training', 'historie', 'vereinsmeisterschaft', 'kontakt', 'impressum', 'datenschutz'];

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : null;
}

/** Altstand aus Git holen. */
export function altstandHolen() {
  const dir = mkdtempSync(join(tmpdir(), 'esv-altstand-'));
  const tar = join(dir, '_alt.tar');
  execFileSync('git', ['archive', '--format=tar', '-o', tar, COMMIT], { cwd: WURZEL });
  execFileSync('tar', ['-xf', '_alt.tar'], { cwd: dir }); // relativ: GNU-tar hielte "C:" für einen Rechnernamen
  rmSync(tar);
  return dir;
}

// ---------- kleiner HTML-Zerleger ----------
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', middot: '·', rarr: '→', bdquo: '„', ldquo: '“', rdquo: '”' };
function dekodiere(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (g, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENT[e] ?? g;
  });
}
function attrs(s) {
  const a = {};
  for (const m of s.matchAll(/([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    a[m[1].toLowerCase()] = dekodiere(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return a;
}

export function analysiere(html) {
  const erg = { kopf: {}, og: {}, jsonld: [], text: [], beschriftungen: [], links: [] };
  const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+)/g;
  let imBody = false;
  let imTitel = false;
  let titel = '';
  let m;
  while ((m = re.exec(html))) {
    if (m[4] !== undefined) {
      const t = dekodiere(m[4]);
      if (imTitel) titel += t;
      else if (imBody) erg.text.push(t);
      continue;
    }
    if (!m[2]) continue;
    const name = m[2].toLowerCase();
    const zu = m[1] === '/';
    if (imBody) erg.text.push(' ');
    if (zu) {
      if (name === 'title') imTitel = false;
      continue;
    }
    const a = attrs(m[3] || '');
    if (name === 'body') imBody = true;
    if (name === 'title') { imTitel = true; titel = ''; }
    if (name === 'script' || name === 'style') {
      const ende = html.toLowerCase().indexOf(`</${name}`, re.lastIndex);
      const inhalt = html.slice(re.lastIndex, ende < 0 ? html.length : ende);
      if (name === 'script' && a.type === 'application/ld+json') {
        try { erg.jsonld.push(JSON.parse(inhalt)); } catch (e) { erg.jsonld.push({ FEHLER: e.message }); }
      }
      if (name === 'style') erg.links.push(...[...inhalt.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map((u) => `style url(${u[1]})`));
      re.lastIndex = ende < 0 ? html.length : ende;
      continue;
    }
    if (name === 'meta') {
      if (a.name === 'description') erg.kopf.description = a.content;
      if (a.name === 'theme-color') erg.kopf['theme-color'] = a.content;
      if (a.property && a.property.startsWith('og:')) erg.og[a.property] = a.content;
    }
    if (name === 'link' && a.rel === 'canonical') erg.kopf.canonical = a.href;
    for (const [tag, at] of [['a', 'href'], ['link', 'href'], ['img', 'src'], ['script', 'src'], ['form', 'action'], ['source', 'srcset'], ['iframe', 'src']]) {
      if (name === tag && a[at] !== undefined) erg.links.push(`${tag}[${at}]=${a[at]}${tag === 'a' && a.target ? ` target=${a.target}` : ''}`);
    }
    if (a.style) erg.links.push(...[...a.style.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map((u) => `${name} style url(${u[1]})`));
    for (const at of ['alt', 'aria-label', 'placeholder', 'title']) {
      if (imBody && a[at] !== undefined) erg.beschriftungen.push(`${name}[${at}]=${a[at]}`);
    }
  }
  erg.kopf.title = titel;
  erg.text = erg.text.join('').replace(/[ \t\r\n\f]+/g, ' ').trim();
  return erg;
}

/** Einzige erlaubte Abweichung: Logo/Hallenbild liegen jetzt unter /medien/bilder/. */
export function umbenennung(s) {
  return s.replace(/(^|\/|\(|=|'|")assets\/(esv-logo\.png|hero-halle\.(?:jpg|webp))/g, (g, vor, datei) => `${vor === '/' ? '' : vor}/medien/bilder/${datei}`);
}

function tief(x, f) {
  if (typeof x === 'string') return f(x);
  if (Array.isArray(x)) return x.map((y) => tief(y, f));
  if (x && typeof x === 'object') return Object.fromEntries(Object.keys(x).sort().map((k) => [k, tief(x[k], f)]));
  return x;
}

/** Folgen vergleichen (LCS), Unterschiede als Liste „- alt“ / „+ neu“. */
export function folgenDiff(a, b, max = 12) {
  const n = a.length;
  const m = b.length;
  if (n * m > 25e6) return a.join('\u0001') === b.join('\u0001') ? [] : ['(zu groß für Einzel-Diff, Folgen verschieden)'];
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const aus = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) { i++; j++; continue; }
    const kontext = a.slice(Math.max(0, i - 4), i).join(' ');
    if (j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])) aus.push(`+ neu: "${b[j++]}"   (nach: …${kontext})`);
    else aus.push(`- alt: "${a[i++]}"   (nach: …${kontext})`);
    if (aus.length >= max) { aus.push('…'); break; }
  }
  return aus;
}

function main() {
  const altDir = arg('--alt') || altstandHolen();
  const neuDir = arg('--neu') || join(WURZEL, '_site');
  console.log(`Altstand: ${altDir} (Commit ${COMMIT})\nNeu:      ${neuDir}\n`);
  let fehlerGesamt = 0;
  const zeilen = [];
  for (const s of SEITEN) {
    const altPfad = join(altDir, `${s}.html`);
    const neuPfad = join(neuDir, `${s}.html`);
    if (!existsSync(neuPfad)) { console.log(`✗ ${s}: neue Seite fehlt`); fehlerGesamt++; continue; }
    const alt = analysiere(readFileSync(altPfad, 'utf8'));
    const neu = analysiere(readFileSync(neuPfad, 'utf8'));
    const befunde = [];
    // (a) Text
    const tA = alt.text.split(' ');
    const tN = neu.text.split(' ');
    const textDiff = folgenDiff(tA, tN);
    if (textDiff.length) befunde.push('(a) sichtbarer Text weicht ab:', ...textDiff.map((x) => '      ' + x));
    const beschDiff = folgenDiff(alt.beschriftungen, neu.beschriftungen);
    if (beschDiff.length) befunde.push('(a) Beschriftungen (alt/aria-label/placeholder) weichen ab:', ...beschDiff.map((x) => '      ' + x));
    // (b) Links/Bilder
    const lA = alt.links.map(umbenennung);
    const lN = neu.links;
    const linkDiff = folgenDiff(lA, lN, 30);
    if (linkDiff.length) befunde.push('(b) Linkziele/Bildquellen weichen ab:', ...linkDiff.map((x) => '      ' + x));
    // (c) Kopf
    for (const k of ['title', 'description', 'canonical', 'theme-color']) {
      if ((alt.kopf[k] ?? null) !== (neu.kopf[k] ?? null)) befunde.push(`(c) ${k}: alt "${alt.kopf[k]}" ≠ neu "${neu.kopf[k]}"`);
    }
    const ogKeys = new Set([...Object.keys(alt.og), ...Object.keys(neu.og)]);
    for (const k of ogKeys) {
      const a = alt.og[k] === undefined ? undefined : umbenennung(alt.og[k]);
      if (a !== neu.og[k]) befunde.push(`(c) ${k}: alt "${alt.og[k]}" ≠ neu "${neu.og[k]}"`);
    }
    const jA = JSON.stringify(tief(alt.jsonld, umbenennung));
    const jN = JSON.stringify(tief(neu.jsonld, (x) => x));
    if (jA !== jN) befunde.push(`(c) JSON-LD nicht inhaltsgleich (alt ${alt.jsonld.length} Block/Blöcke, neu ${neu.jsonld.length})`);
    const kurz = `${tA.length} Wörter, ${lA.length} Links/Bilder, ${alt.beschriftungen.length} Beschriftungen, og:${Object.keys(alt.og).length}, JSON-LD:${alt.jsonld.length}`;
    if (befunde.length) {
      fehlerGesamt++;
      console.log(`✗ ${s}  (${kurz})`);
      for (const b of befunde) console.log('    ' + b);
    } else {
      console.log(`✓ ${s}  (${kurz}) – Text, Links/Bilder, Kopf identisch`);
    }
    zeilen.push(s);
  }
  console.log(`\nErgebnis: ${SEITEN.length - fehlerGesamt} von ${SEITEN.length} Seiten ohne Abweichung.`);
  if (!arg('--alt')) rmSync(altDir, { recursive: true, force: true });
  process.exitCode = fehlerGesamt ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
