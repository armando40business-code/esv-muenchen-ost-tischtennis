#!/usr/bin/env node
// Bauskript: liest inhalt/ und schreibt die fertige Website nach _site/.
// Aufruf: node build.mjs            -> bauen
//         node build.mjs --pruefen  -> bauen und zusätzlich Inhaltsprobleme auflisten
// Keine npm-Abhängigkeiten (nur Node-Bordmittel, Node >= 20).

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, cpSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { txt, leer, liste, obj, janein } from './lib/html.mjs';
import { fliesstext, zeile } from './lib/fliesstext.mjs';
import { bildGroesse } from './lib/bildgroesse.mjs';
import { designCss } from './lib/design.mjs';
import { head, seitenkopf, grosserKopf, einfacherKopf, fusszeile, SUCH_SKRIPT } from './lib/vorlagen.mjs';
import { baustein } from './lib/bausteine.mjs';
import { inhaltPruefen } from './lib/pruefung.mjs';

const WURZEL = dirname(fileURLToPath(import.meta.url));
const AUSGABE = join(WURZEL, '_site');
const PRUEFEN = process.argv.includes('--pruefen');
export const FESTE_SEITEN = ['index', 'mannschaften', 'training', 'historie', 'vereinsmeisterschaft', 'kontakt', 'impressum', 'datenschutz'];

const warnungen = [];
const hinweise = [];

function warn(msg) { warnungen.push(msg); }

function leseJson(pfad, pflicht = false) {
  if (!existsSync(pfad)) {
    if (pflicht) warn(`Datei fehlt: ${relative(WURZEL, pfad)}`);
    return null;
  }
  try {
    const roh = readFileSync(pfad, 'utf8').replace(/^﻿/, '');
    return JSON.parse(roh);
  } catch (e) {
    warn(`Datei ${relative(WURZEL, pfad)} ist kein gültiges JSON (${e.message}) – übersprungen.`);
    return null;
  }
}

/** CMS-Pfad (/medien/bilder/x.jpg) -> Dateipfad im Repo, oder null bei unzulässigem Pfad. */
function dateiPfad(pfad) {
  let p = txt(pfad).trim();
  if (!p || /^[a-z][a-z0-9+.-]*:/i.test(p) || p.startsWith('//')) return null;
  p = p.split(/[?#]/)[0];
  try { p = decodeURIComponent(p); } catch { /* unverändert */ }
  const abs = resolve(WURZEL, '.' + (p.startsWith('/') ? p : '/' + p));
  const rel = relative(WURZEL, abs);
  if (!rel || rel.startsWith('..') || rel.includes(':')) return null;
  const erstes = rel.split(sep)[0];
  if (!['medien', 'assets', 'statisch'].includes(erstes)) return null;
  return abs;
}

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.avif': 'image/avif' };
const bildCache = new Map();

/** Bild auflösen: { url, webpUrl, breite, hoehe, mime } oder null (fehlt -> Warnung). */
function bildAufloesen(pfad, wo, warnen) {
  const p = txt(pfad).trim();
  if (!p) return null;
  if (!bildCache.has(p)) {
    const abs = dateiPfad(p);
    let info = null;
    if (abs && existsSync(abs) && statSync(abs).isFile()) {
      const ext = extname(abs).toLowerCase();
      const rel = '/' + relative(WURZEL, abs).split(sep).join('/');
      const url = encodeURI(rel);
      let webpUrl = '';
      if (ext !== '.webp' && ext !== '.svg') {
        const webp = abs.slice(0, -ext.length) + '.webp';
        if (existsSync(webp)) webpUrl = encodeURI(rel.slice(0, -ext.length) + '.webp');
      }
      const g = bildGroesse(abs);
      info = { url, webpUrl, mime: MIME[ext] || 'image/jpeg', breite: g ? g.breite : 0, hoehe: g ? g.hoehe : 0, gefunden: true };
      if (!MIME[ext]) info.fehlt = `kein Bildformat (${ext || 'ohne Endung'})`;
    } else {
      info = { fehlt: abs ? 'Datei nicht gefunden' : 'unzulässiger Pfad' };
    }
    bildCache.set(p, info);
  }
  const info = bildCache.get(p);
  if (info.fehlt) {
    if (wo) warnen(`${wo}: Bild "${p}" – ${info.fehlt}; Stelle weggelassen.`);
    return null;
  }
  return info;
}

async function ladeLeser() {
  const datei = join(WURZEL, 'lib', 'tabellenleser.mjs');
  try {
    return await import(pathToFileURL(datei).href);
  } catch (e) {
    if (existsSync(datei)) warn(`lib/tabellenleser.mjs konnte nicht geladen werden (${e.message}) – Tabellen gelten als nicht lesbar.`);
    else hinweise.push('lib/tabellenleser.mjs fehlt – Excel-/Text-Tabellen gelten als nicht lesbar.');
    return null;
  }
}

function seitenLaden() {
  const seiten = [];
  for (const name of FESTE_SEITEN) {
    const daten = leseJson(join(WURZEL, 'inhalt', 'seiten', `${name}.json`), true);
    if (daten && typeof daten === 'object' && !Array.isArray(daten)) seiten.push({ name, daten, fest: true });
    else if (daten) warn(`inhalt/seiten/${name}.json: kein JSON-Objekt – übersprungen.`);
  }
  const ordner = join(WURZEL, 'inhalt', 'weitere-seiten');
  if (existsSync(ordner)) {
    for (const datei of readdirSync(ordner).filter((d) => d.toLowerCase().endsWith('.json')).sort()) {
      const name = datei.slice(0, -5);
      if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
        warn(`inhalt/weitere-seiten/${datei}: Dateiname nur aus Kleinbuchstaben, Ziffern und Bindestrich – übersprungen.`);
        continue;
      }
      if (FESTE_SEITEN.includes(name)) {
        warn(`inhalt/weitere-seiten/${datei}: Name ist schon eine feste Seite – übersprungen.`);
        continue;
      }
      const daten = leseJson(join(ordner, datei));
      if (daten && typeof daten === 'object' && !Array.isArray(daten)) seiten.push({ name, daten, fest: false });
    }
  }
  return seiten;
}

function kopiere(von, nach) {
  if (!existsSync(von)) return;
  cpSync(von, nach, {
    recursive: true,
    filter: (q) => !/(^|[\\/])\.gitkeep$/.test(q),
  });
}

async function seiteBauen(seite, basis) {
  const warnen = (m) => warn(`[${seite.name}] ${m}`);
  const ctx = {
    ...basis,
    seite,
    zaehler: {},
    brauchtSuche: false,
    warn: warnen,
    hinweis: (m) => hinweise.push(`[${seite.name}] ${m}`),
    bild: (pfad, wo) => bildAufloesen(pfad, wo, warnen),
  };
  const teile = [head(seite, ctx), '<body>', seitenkopf(seite, ctx), '', '<main id="main">'];
  teile.push(seite.name === 'index' ? grosserKopf(seite.daten.kopf, ctx) : einfacherKopf(seite, ctx));
  const bausteine = seite.daten.bausteine;
  // Impressum: fester HTML-Zusatz aus technik.json kommt ans Ende des letzten Freitext-Bausteins
  if (seite.name === 'impressum' && Array.isArray(bausteine)) {
    ctx.zusatzBlock = [...bausteine].reverse().find((x) => x && typeof x === 'object' && x._block === 'freitext') || null;
  }
  if (bausteine !== undefined && !Array.isArray(bausteine)) warnen('Feld "bausteine" ist keine Liste – ignoriert.');
  let nr = 0;
  for (const b of liste(bausteine)) {
    nr++;
    const html = await baustein(b, ctx, nr);
    if (html) teile.push(html);
  }
  if (ctx.brauchtSuche) teile.push(SUCH_SKRIPT);
  teile.push('</main>', '', fusszeile(ctx));
  return teile.join('\n');
}

function sitemap(seiten, basisUrl, technik) {
  const b = basisUrl.replace(/\/+$/, '');
  const prio = obj(technik.sitemap_prioritaeten);
  const z = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];
  for (const s of seiten) {
    if (s.gebaut !== true) continue;
    let p = txt(s.daten.sitemap_prioritaet).trim() || txt(prio[s.name]).trim() || '0.5';
    const zahl = Number(p);
    p = Number.isFinite(zahl) && zahl >= 0 && zahl <= 1 ? zahl.toFixed(1) : '0.5';
    const loc = s.name === 'index' ? `${b}/` : `${b}/${s.name}`;
    z.push(`  <url><loc>${loc}</loc><priority>${p}</priority></url>`);
  }
  z.push('</urlset>', '');
  return z.join('\n');
}

async function main() {
  const einst = obj(leseJson(join(WURZEL, 'inhalt', 'einstellungen.json'), true));
  const technik = obj(leseJson(join(WURZEL, 'inhalt', 'technik.json'), true));
  const basisUrl = txt(technik.basis_url).trim().replace(/\/+$/, '') || 'https://esv-tischtennis.pages.dev';
  const leser = await ladeLeser();
  const turniere = {};
  for (const t of ['vereinsmeisterschaft', 'facklerpokal']) {
    const d = leseJson(join(WURZEL, 'inhalt', 'turniere', `${t}.json`), true);
    if (d && typeof d === 'object') turniere[t] = d;
  }
  const seiten = seitenLaden();

  // Menü: feste Einträge + weitere Seiten mit im_menue
  const menue = liste(einst.menue).map(obj);
  for (const s of seiten) {
    if (s.fest || !janein(s.daten.im_menue, false)) continue;
    const ziel = `${s.name}.html`;
    if (!menue.some((m) => txt(m.ziel).trim() === ziel)) menue.push({ titel: txt(s.daten.menue_titel) || s.name, ziel });
  }
  const index = seiten.find((s) => s.name === 'index');

  const basis = {
    wurzel: WURZEL, einst, technik, basisUrl, leser, turniere, menue,
    startTitel: index ? txt(index.daten.menue_titel) : 'Start',
    designCss: designCss(einst.design, (m) => warn(`[Design] ${m}`)),
    dateiPfad,
    ft: (html, opts) => fliesstext(html, { basisUrl }, opts),
    zl: (html) => zeile(html, { basisUrl }),
  };

  // Ausgabe neu anlegen
  rmSync(AUSGABE, { recursive: true, force: true });
  mkdirSync(AUSGABE, { recursive: true });
  if (existsSync(join(WURZEL, 'styles.css'))) cpSync(join(WURZEL, 'styles.css'), join(AUSGABE, 'styles.css'));
  else warn('styles.css fehlt.');
  kopiere(join(WURZEL, 'assets'), join(AUSGABE, 'assets'));
  kopiere(join(WURZEL, 'medien'), join(AUSGABE, 'medien'));
  kopiere(join(WURZEL, 'statisch'), AUSGABE);

  let indexOk = false;
  for (const s of seiten) {
    try {
      const html = await seiteBauen(s, basis);
      writeFileSync(join(AUSGABE, `${s.name}.html`), html, 'utf8');
      s.gebaut = true;
      if (s.name === 'index') indexOk = true;
    } catch (e) {
      warn(`[${s.name}] Seite konnte nicht gebaut werden: ${e.stack || e.message}`);
    }
  }
  writeFileSync(join(AUSGABE, 'sitemap.xml'), sitemap(seiten, basisUrl, technik), 'utf8');
  writeFileSync(join(AUSGABE, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${basisUrl}/sitemap.xml\n`, 'utf8');

  const gebaut = seiten.filter((s) => s.gebaut).map((s) => s.name);
  console.log(`Gebaut: ${gebaut.length} Seiten nach _site/ (${gebaut.join(', ')})`);
  if (hinweise.length) {
    console.log(`\nHinweise (${hinweise.length}):`);
    for (const h of hinweise) console.log('  - ' + h);
  }
  if (warnungen.length) {
    console.log(`\nWarnungen (${warnungen.length}):`);
    for (const w of warnungen) console.log('  ! ' + w);
  }
  if (PRUEFEN) {
    const probleme = inhaltPruefen({ wurzel: WURZEL, einst, technik, seiten, turniere, gebaut, dateiPfad });
    console.log(`\nInhaltsprüfung: ${probleme.length ? probleme.length + ' Auffälligkeiten' : 'keine Auffälligkeiten'}`);
    for (const p of probleme) console.log('  ? ' + p);
  }
  if (!indexOk) {
    console.error('\nFEHLER: Die Startseite (inhalt/seiten/index.json) konnte nicht gebaut werden.');
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error('FEHLER beim Bauen:', e);
  process.exitCode = 1;
});
