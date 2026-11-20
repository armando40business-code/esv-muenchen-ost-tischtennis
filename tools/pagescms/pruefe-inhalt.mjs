// Gleicht JEDE Inhaltsdatei (inhalt/**.json) mit den Formularen in .pages.yml ab – damit beim Speichern in
// Pages CMS nichts verloren geht und nichts abgelehnt wird.
//
//   node tools/pagescms/pruefe-inhalt.mjs
//
// Warum das nötig ist (Quelle: Pages CMS 2.1.8, lib/schema.ts + app/api/.../files/[path]/route.ts):
//   * Pages CMS liest eine Datei NUR über die Felder der Formulare (deepMap) und schreibt beim Speichern nur diese
//     Felder zurück. Ein JSON-Schlüssel ohne Formularfeld ist nach dem nächsten Speichern weg.
//   * Die Formulare prüfen die Werte streng (Text muss Text sein, Auswahl nur erlaubte Werte, Bildpfade im
//     Medien-Ordner mit erlaubter Endung) – abweichende Inhalte ließen sich nicht mehr speichern.
//
// Prüft:
//   A. Inhalt -> Formular: jeder Schlüssel hat ein Feld (auch in Listen, Objekten, Bausteinen), Typen,
//      Auswahlwerte, Pflichtfelder, Bild-/Dateipfade (Ordner, Endung), jeder _block ist bekannt, Fließtext ohne <img>.
//   B. Formular <-> Bauskript: Feldlisten und Arten gleichen lib/schema.mjs (die Liste, gegen die auch
//      `node build.mjs --pruefen` prüft).
//   C. Formular <-> docs/INHALTSMODELL.md: jedes Formularfeld kommt im passenden Abschnitt vor und umgekehrt.
//   D. Abdeckung: jede Inhaltsdatei ist im CMS erreichbar, inhalt/technik.json ausdrücklich nicht.
//
// Exit 0 = 0 Abweichungen.

import { join } from 'node:path';
import { ladeConfig, normalisiere, alleFelder, jsonDateien, lies, gibtEs, istObjekt, WURZEL } from './gemeinsam.mjs';
import { EINSTELLUNGEN, TECHNIK, SEITE, KOPF_GROSS, KOPF_EINFACH, BAUSTEINE, TURNIER } from '../../lib/schema.mjs';

const abw = []; // Abweichungen (zählen)
const infos = [];
const a = (abschnitt, text) => abw.push(`[${abschnitt}] ${text}`);

const { json, parseFehler } = ladeConfig();
if (!json) { console.log('.pages.yml nicht lesbar:', parseFehler.map((e) => e.message).join('; ')); process.exit(1); }
const norm = normalisiere(json);
const medien = Object.fromEntries(norm.medien.map((m) => [m.name, m]));

// ---------------------------------------------------------------------------------------------
// A. Inhalt -> Formular
// ---------------------------------------------------------------------------------------------
const NEUTRALE_STANDARDS = { hintergrund: 'normal', button_stil: 'gold', stil: 'gold', spalten: '3', raster: 'standard', farbschema: 'petrol', kopfzeile: true, erste_spalte_fett: false, suchfeld: false, im_menue: false, sitemap_prioritaet: '0.5' };
let werteGeprueft = 0;
const bildDateien = new Set();

function endung(p) { const m = /\.([A-Za-z0-9]+)$/.exec(p); return m ? m[1] : ''; }
function medienPruefen(wert, feld, wo, datei) {
  if (typeof wert !== 'string') return;
  if (wert === '') return;
  const m = medien[feld.options?.media];
  if (!m) { a('A', `${datei} ${wo}: Medien-Ordner "${feld.options?.media}" des Formularfeldes gibt es nicht.`); return; }
  if (!wert.startsWith(`${m.output}/`)) {
    a('A', `${datei} ${wo}: Pfad "${wert}" liegt nicht in ${m.output}/ – Pages CMS würde das Feld ablehnen ("Path must start with the media directory: ${m.input}").`);
  }
  let erlaubt = m.extensions;
  if (Array.isArray(feld.options?.extensions)) erlaubt = feld.options.extensions.filter((x) => !m.extensions || m.extensions.includes(x));
  if (erlaubt && !erlaubt.includes(endung(wert))) a('A', `${datei} ${wo}: Endung ".${endung(wert)}" nicht erlaubt (erlaubt: ${erlaubt.join(', ')}).`);
  const rel = wert.startsWith(`${m.output}/`) ? `${m.input}/${wert.slice(m.output.length + 1)}` : wert.replace(/^\//, '');
  if (!gibtEs(rel)) infos.push(`${datei} ${wo}: Datei ${rel} existiert nicht (Bauskript lässt die Stelle weg und warnt).`);
  else bildDateien.add(rel);
}

function pruefeEinzel(w, feld, wo, datei) {
  werteGeprueft += 1;
  switch (feld.type) {
    case 'object': {
      if (!istObjekt(w)) { a('A', `${datei} ${wo}: sollte ein Objekt sein.`); return; }
      pruefeObjekt(w, feld.fields ?? [], wo, datei);
      return;
    }
    case 'block': {
      if (!istObjekt(w)) { a('A', `${datei} ${wo}: sollte ein Baustein-Objekt sein.`); return; }
      const schluessel = feld.blockKey ?? '_block';
      const art = w[schluessel];
      const def = (feld.blocks ?? []).find((b) => b.name === art);
      if (!def) { a('A', `${datei} ${wo}: Baustein-Art "${art}" ist im Formular nicht bekannt (Pages CMS lehnt das Speichern ab: "Invalid discriminator value").`); return; }
      pruefeObjekt(w, def.fields ?? [], wo, datei, schluessel);
      return;
    }
    case 'string': case 'text': case 'rich-text': {
      if (typeof w !== 'string') { a('A', `${datei} ${wo}: ist ${Array.isArray(w) ? 'eine Liste' : typeof w}, das Formular erwartet Text (Pages CMS: "Expected string").`); return; }
      if (feld.pattern) {
        const p = typeof feld.pattern === 'string' ? feld.pattern : feld.pattern.regex;
        if (!new RegExp(p).test(w)) a('A', `${datei} ${wo}: "${w.slice(0, 40)}" passt nicht zum Muster des Formularfelds.`);
      }
      if (feld.type === 'rich-text' && /<\s*img\b/i.test(w)) a('A', `${datei} ${wo}: Fließtext enthält <img> – das Bauskript entfernt Bilder aus Fließtext.`);
      return;
    }
    case 'select': {
      const werte = (feld.options?.values ?? []).map((x) => String(istObjekt(x) ? (x.value ?? x.name) : x));
      if (typeof w !== 'string') { a('A', `${datei} ${wo}: Auswahlwert ${JSON.stringify(w)} muss Text sein (Zahlen werden von Pages CMS abgelehnt).`); return; }
      if (w !== '' && !werte.includes(w)) a('A', `${datei} ${wo}: Auswahlwert "${w}" ist nicht erlaubt (erlaubt: ${werte.join(', ')}).`);
      return;
    }
    case 'boolean': {
      if (typeof w !== 'boolean') a('A', `${datei} ${wo}: sollte true/false sein.`);
      return;
    }
    case 'image': case 'file': {
      if (typeof w !== 'string') { a('A', `${datei} ${wo}: Pfad sollte Text sein.`); return; }
      medienPruefen(w, feld, wo, datei);
      return;
    }
    default:
      a('A', `${datei} ${wo}: Formularfeld-Typ "${feld.type}" wird von dieser Prüfung nicht verstanden.`);
  }
}

function pruefeWert(w, feld, wo, datei) {
  if (w === undefined || w === null) return;
  if (feld.list) {
    if (!Array.isArray(w)) { a('A', `${datei} ${wo}: sollte eine Liste sein.`); return; }
    w.forEach((x, i) => pruefeEinzel(x, feld, `${wo}[${i + 1}]`, datei));
  } else {
    pruefeEinzel(w, feld, wo, datei);
  }
}

function pruefeObjekt(o, felder, wo, datei, blockSchluessel = null) {
  const namen = new Set(felder.map((x) => x.name));
  for (const k of Object.keys(o)) {
    if (k === blockSchluessel) continue;
    if (!namen.has(k)) a('A', `${datei} ${wo}.${k}: JSON-Schlüssel ohne Formularfeld – ginge beim nächsten Speichern in Pages CMS verloren.`);
  }
  for (const feld of felder) {
    const v = o[feld.name];
    if (feld.required) {
      const leer = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
      if (leer) a('A', `${datei} ${wo}.${feld.name}: Pflichtfeld im Formular, im Inhalt leer – Speichern wäre blockiert.`);
    }
    if (feld.default !== undefined && !feld.hidden && (v === undefined || v === null || v === '')) {
      const std = NEUTRALE_STANDARDS[feld.name];
      if (std === undefined || String(std) !== String(feld.default)) a('A', `${datei} ${wo}.${feld.name}: Standardwert "${feld.default}" entspricht keinem dokumentierten Standard und würde in leere Felder geschrieben.`);
    }
    pruefeWert(v, feld, `${wo}.${feld.name}`, datei);
  }
}

// Zuordnung Datei -> Formular
const eintraege = norm.eintraege;
const abgedeckt = new Set();
for (const e of eintraege) {
  const dateien = e.type === 'file' ? [e.path] : jsonDateien(e.path);
  for (const d of dateien) {
    abgedeckt.add(d);
    if (!gibtEs(d)) { a('A', `${d}: Datei fehlt (Formular "${e.name}").`); continue; }
    let daten;
    try { daten = JSON.parse(lies(d)); } catch (err) { a('A', `${d}: kein gültiges JSON (${err.message}).`); continue; }
    if (!istObjekt(daten)) { a('A', `${d}: oberste Ebene muss ein Objekt sein.`); continue; }
    pruefeObjekt(daten, e.fields ?? [], '', d);
  }
}
infos.push(`A: ${abgedeckt.size} Inhaltsdateien, ${werteGeprueft} Werte gegen die Formulare geprüft.`);

// ---------------------------------------------------------------------------------------------
// B. Formular <-> Bauskript (lib/schema.mjs)
// ---------------------------------------------------------------------------------------------
const SEITENFELD_NUR_WEITERE = new Set(['im_menue']);
function setGleich(x, y) { return x.length === y.length && x.every((v) => y.includes(v)); }

function vergleicheArt(feld, art, wo) {
  const istText = ['string', 'text'].includes(feld.type);
  const einfach = (ok, erwartet) => { if (!ok) a('B', `${wo}: Bauskript erwartet ${erwartet}, Formular hat Typ "${feld.type}${feld.list ? ' (Liste)' : ''}".`); };
  if (typeof art === 'string') {
    if (art.startsWith('liste:')) {
      if (!feld.list) { a('B', `${wo}: Bauskript erwartet eine Liste, Formular ist keine Liste.`); return; }
      vergleicheArt({ ...feld, list: false }, art.slice(6), wo);
      return;
    }
    if (art === 'bausteine') { einfach(feld.type === 'block' && !!feld.list, 'Bausteinliste'); return; }
    if (feld.list) { a('B', `${wo}: Formular ist eine Liste, Bauskript erwartet einen einzelnen Wert (${art}).`); return; }
    if (art === 'text') einfach(istText, 'Text');
    else if (art === 'fliesstext') {
      einfach(feld.type === 'rich-text', 'Fließtext (rich-text)');
      if (feld.type === 'rich-text' && feld.options?.format !== 'html') a('B', `${wo}: Fließtext muss als html gespeichert werden.`);
    } else if (art === 'bild') { einfach(feld.type === 'image', 'Bild'); if (feld.options?.media !== 'bilder') a('B', `${wo}: Bildfeld nicht auf Medien "bilder".`); }
    else if (art === 'datei') { einfach(feld.type === 'file', 'Datei'); if (feld.options?.media !== 'tabellen') a('B', `${wo}: Dateifeld nicht auf Medien "tabellen".`); }
    else if (art === 'janein') einfach(feld.type === 'boolean', 'Ja/Nein');
    else if (art.startsWith('auswahl:')) {
      einfach(feld.type === 'select', 'Auswahl');
      if (feld.type === 'select') {
        const werte = (feld.options?.values ?? []).map((x) => String(istObjekt(x) ? (x.value ?? x.name) : x));
        const erwartet = art.slice(8).split('|');
        if (!setGleich(werte, erwartet)) a('B', `${wo}: Auswahlwerte [${werte.join(', ')}] weichen vom Bauskript [${erwartet.join(', ')}] ab.`);
      }
    } else if (art === 'json') a('B', `${wo}: technisches Feld (json) darf nicht im CMS stehen.`);
    else if (art === 'objekt') einfach(feld.type === 'object', 'Objekt');
    else a('B', `${wo}: Bauskript-Art "${art}" wird von dieser Prüfung nicht verstanden.`);
    return;
  }
  if (Array.isArray(art)) {
    if (feld.type !== 'object' || !feld.list) { a('B', `${wo}: Bauskript erwartet eine Objekt-Liste, Formular hat "${feld.type}${feld.list ? ' (Liste)' : ''}".`); return; }
    vergleicheFelder(feld.fields ?? [], art[0], wo);
    return;
  }
  if (feld.type !== 'object' || feld.list) { a('B', `${wo}: Bauskript erwartet ein Objekt, Formular hat "${feld.type}${feld.list ? ' (Liste)' : ''}".`); return; }
  vergleicheFelder(feld.fields ?? [], art, wo);
}

function vergleicheFelder(felder, spec, wo, ausnahmenFormularOhneSpec = new Set(), ausnahmenSpecOhneFormular = new Set()) {
  const fk = felder.map((x) => x.name);
  const sk = Object.keys(spec).filter((k) => k !== '_block');
  for (const k of fk) if (!sk.includes(k) && !ausnahmenFormularOhneSpec.has(k)) a('B', `${wo}.${k}: Formularfeld, das das Bauskript (lib/schema.mjs) nicht kennt.`);
  for (const k of sk) if (!fk.includes(k) && !ausnahmenSpecOhneFormular.has(k)) a('B', `${wo}.${k}: Bauskript liest dieses Feld, im Formular fehlt es (nicht pflegbar, ginge beim Speichern verloren).`);
  const dup = fk.filter((k, i) => fk.indexOf(k) !== i);
  for (const k of dup) a('B', `${wo}.${k}: Formularfeld doppelt.`);
  for (const feld of felder) {
    if (!(feld.name in spec)) continue;
    const art = spec[feld.name];
    if (art === 'objekt') { vergleicheArt(feld, art, `${wo}.${feld.name}`); continue; }
    vergleicheArt(feld, art, `${wo}.${feld.name}`);
    if (art === 'bausteine' && feld.type === 'block') vergleicheBausteine(feld, `${wo}.${feld.name}`);
  }
}

const schonVerglichen = new Set();
function vergleicheBausteine(feld, wo) {
  const schluessel = JSON.stringify(feld);
  if (schonVerglichen.has(schluessel)) return; // identische Komponente auf mehreren Seiten: einmal genügt
  schonVerglichen.add(schluessel);
  const formNamen = (feld.blocks ?? []).map((b) => b.name);
  const specNamen = Object.keys(BAUSTEINE);
  if (!setGleich(formNamen, specNamen)) a('B', `${wo}: Baustein-Arten [${formNamen.join(', ')}] weichen vom Bauskript [${specNamen.join(', ')}] ab.`);
  for (const b of feld.blocks ?? []) {
    if (!BAUSTEINE[b.name]) continue;
    vergleicheFelder(b.fields ?? [], BAUSTEINE[b.name], `${wo}<${b.name}>`);
  }
}

for (const e of eintraege) {
  const dateien = e.type === 'file' ? [e.path] : [`${e.path}/(neue Seite)`];
  const datei = dateien[0];
  const name = datei.split('/').pop().replace(/\.json$/, '');
  const wo = e.name;
  if (datei === 'inhalt/einstellungen.json') vergleicheFelder(e.fields, EINSTELLUNGEN, wo);
  else if (datei.startsWith('inhalt/turniere/')) {
    if (!TURNIER[name]) a('B', `${wo}: Bauskript kennt kein Turnier "${name}".`);
    else vergleicheFelder(e.fields, TURNIER[name], wo);
  } else if (datei.startsWith('inhalt/seiten/') || datei.startsWith('inhalt/weitere-seiten/')) {
    const fest = datei.startsWith('inhalt/seiten/');
    vergleicheFelder(e.fields, SEITE, wo, new Set(), fest ? SEITENFELD_NUR_WEITERE : new Set());
    const kopf = e.fields.find((x) => x.name === 'kopf');
    if (kopf && !schonVerglichen.has(`kopf:${name === 'index'}`)) {
      schonVerglichen.add(`kopf:${name === 'index'}`);
      vergleicheFelder(kopf.fields ?? [], name === 'index' ? KOPF_GROSS : KOPF_EINFACH, `${wo}.kopf`);
    }
  } else a('B', `${wo}: Pfad ${datei} ist weder Einstellungen, Seite noch Turnier – keine Vergleichsliste im Bauskript.`);
}
infos.push(`B: ${eintraege.length} Formulare gegen lib/schema.mjs verglichen (${Object.keys(BAUSTEINE).length} Baustein-Arten).`);
for (const k of Object.keys(TECHNIK)) {
  if (eintraege.some((e) => alleFelder(e.fields).some((x) => x.feld.name === k))) a('B', `technik.json-Feld "${k}" steht im CMS – das soll nicht sein.`);
}

// ---------------------------------------------------------------------------------------------
// C. Formular <-> docs/INHALTSMODELL.md
// ---------------------------------------------------------------------------------------------
const mdRoh = lies('docs/INHALTSMODELL.md').replace(/\r\n/g, '\n');
const md = mdRoh.replace(/```[\s\S]*?```/g, '').split('\n'); // Code-Zäune stören die Backtick-Paare
// Abschnitte: Überschrift (## oder ###) bis zur nächsten Überschrift gleicher oder höherer Ebene
const abschnitte = [];
{
  let akt = null;
  for (const zeile of md) {
    const m = /^(#{2,3}) (.*)$/.exec(zeile);
    if (m) { akt = { ebene: m[1].length, titel: m[2], zeilen: [] }; abschnitte.push(akt); }
    else if (akt) akt.zeilen.push(zeile);
  }
}
const abschnitt = (re) => abschnitte.find((s) => re.test(s.titel));
const IDENT = /[A-Za-z_][A-Za-z0-9_-]*/g;
function mdTokens(sec) {
  const alle = new Set(); // alles, was in Backticks steht
  const ersteSpalte = new Set(); // Feldnamen in der ersten Tabellenspalte
  for (const z of sec.zeilen) {
    for (const m of z.matchAll(/`([^`]+)`/g)) for (const t of m[1].match(IDENT) ?? []) alle.add(t);
    const zelle = /^\|\s*([^|]+?)\s*\|/.exec(z);
    if (zelle && z.includes('`')) {
      for (const m of zelle[1].matchAll(/`([^`]+)`/g)) {
        const ids = m[1].match(IDENT) ?? [];
        if (ids.length) ersteSpalte.add(ids[ids.length - 1]); // Pfad `kasten.infos[].begriff` -> Feld "begriff"
      }
    }
  }
  return { alle, ersteSpalte };
}
function blattNamen(felder, aus = new Set()) {
  for (const f of felder ?? []) {
    aus.add(f.name);
    blattNamen(f.fields, aus);
    for (const b of f.blocks ?? []) blattNamen(b.fields, aus);
  }
  return aus;
}
// Wörter in der ersten Spalte, die keine Feldnamen sind (Dateinamen, Werte)
const KEINE_FELDER = new Set(['json', 'mjs', 'html', 'inhalt', 'einstellungen', 'technik', 'seiten', 'turniere']);

function vergleicheMd(titelRe, felder, bezeichnung, optionen = {}) {
  const sec = abschnitt(titelRe);
  if (!sec) { a('C', `INHALTSMODELL.md: Abschnitt für ${bezeichnung} nicht gefunden.`); return; }
  const { alle, ersteSpalte } = mdTokens(sec);
  const gemeinsam = optionen.gemeinsam ?? new Set();
  const form = blattNamen(felder);
  for (const n of form) {
    if (n === '_block') continue;
    if (!alle.has(n) && !gemeinsam.has(n)) a('C', `${bezeichnung}: Formularfeld "${n}" kommt in INHALTSMODELL.md (Abschnitt "${sec.titel}") nicht vor.`);
  }
  for (const n of ersteSpalte) {
    if (KEINE_FELDER.has(n) || n === '_block') continue;
    if (optionen.ohne?.has(n)) continue;
    if (!form.has(n)) a('C', `${bezeichnung}: INHALTSMODELL.md beschreibt "${n}", im Formular fehlt das Feld.`);
  }
}
const gemeinsamBlock = (() => { const s = abschnitt(/^Bausteine$/); return s ? mdTokens(s).alle : new Set(); })();
const seitenZusammen = {};
for (const e of eintraege) {
  if (e.path === 'inhalt/einstellungen.json') vergleicheMd(/^inhalt\/einstellungen\.json$/, e.fields, 'Einstellungen');
  if (e.path === 'inhalt/turniere/vereinsmeisterschaft.json') vergleicheMd(/^inhalt\/turniere\/vereinsmeisterschaft\.json$/, e.fields, 'Turnier Vereinsmeisterschaft');
  if (e.path === 'inhalt/turniere/facklerpokal.json') vergleicheMd(/^inhalt\/turniere\/facklerpokal\.json$/, e.fields, 'Turnier Facklerpokal');
}
// Seitenfelder (ohne kopf/bausteine-Inneres) und Köpfe
{
  const startseite = eintraege.find((x) => x.name === 'seite-startseite');
  const training = eintraege.find((x) => x.name === 'seite-training');
  const weitere = eintraege.find((x) => x.name === 'weitere-seiten');
  const kopfFelder = (e) => e.fields.find((f) => f.name === 'kopf')?.fields ?? [];
  const obere = (e) => e.fields.filter((f) => !['kopf', 'bausteine'].includes(f.name));
  vergleicheMd(/^Seite \(/, [...obere(weitere), { name: 'kopf' }, { name: 'bausteine' }], 'Seitenfelder', { ohne: new Set(['kopf', 'bausteine']) });
  vergleicheMd(/^Großer Kopf/, kopfFelder(startseite), 'Großer Kopf');
  vergleicheMd(/^Einfacher Kopf/, kopfFelder(training), 'Einfacher Kopf');
  const bst = startseite.fields.find((f) => f.name === 'bausteine');
  for (const b of bst?.blocks ?? []) {
    const re = new RegExp(`^\\d+\\. \`${b.name}\``);
    vergleicheMd(re, b.fields ?? [], `Baustein ${b.name}`, { gemeinsam: gemeinsamBlock });
  }
  seitenZusammen.ok = true;
}
// Auswahlwerte sind im Inhaltsmodell erwähnt?
{
  const alles = new Set(md.join('\n').match(/`[^`]+`/g)?.map((x) => x.slice(1, -1)) ?? []);
  for (const { pfad, feld } of eintraege.flatMap((e) => alleFelder(e.fields))) {
    if (feld.type !== 'select') continue;
    for (const x of feld.options?.values ?? []) {
      const v = String(istObjekt(x) ? (x.value ?? x.name) : x);
      if (!alles.has(v) && ![...alles].some((t) => t.includes(v))) a('C', `${pfad}: Auswahlwert "${v}" kommt in INHALTSMODELL.md nicht vor.`);
    }
  }
}
infos.push(`C: ${abschnitte.length} Abschnitte von docs/INHALTSMODELL.md ausgewertet.`);

// ---------------------------------------------------------------------------------------------
// D. Abdeckung
// ---------------------------------------------------------------------------------------------
{
  const alle = [...jsonDateien('inhalt'), ...jsonDateien('inhalt/seiten'), ...jsonDateien('inhalt/weitere-seiten'), ...jsonDateien('inhalt/turniere')];
  for (const d of alle) {
    if (d === 'inhalt/technik.json') continue;
    if (!abgedeckt.has(d)) a('D', `${d}: kein Eintrag in der Seitenleiste des CMS – nicht pflegbar.`);
  }
  if (abgedeckt.has('inhalt/technik.json')) a('D', 'inhalt/technik.json ist im CMS erreichbar – das soll nicht sein.');
  const ohneTechnik = alle.filter((d) => d !== 'inhalt/technik.json');
  infos.push(`D: ${ohneTechnik.length} Inhaltsdateien, alle im CMS erreichbar; technik.json bewusst nicht.`);
}

// ---------------------------------------------------------------------------------------------
// E. Trockenlauf "Öffnen und ungeändert Speichern" (Nachbau von initializeState + sanitizeObject aus
//    Pages CMS 2.1.8, lib/schema.ts): die Datei darf sich inhaltlich nicht ändern. Erlaubt ist nur,
//    dass neutrale Standardwerte (z. B. hintergrund: normal) ergänzt werden.
//    Nicht nachgebildet: Umformatierung von Fließtext durch den Editor (TipTap) – erst in der echten Oberfläche prüfbar.
// ---------------------------------------------------------------------------------------------
{
  const leerWert = (v) => v == null || v === '';
  const istDatum = (v) => v instanceof Date;
  // wörtlicher Nachbau von sanitizeObject
  const sanitize = (object) => {
    if (Array.isArray(object)) {
      return object.map((val) => (val && typeof val === 'object' && !istDatum(val) ? sanitize(val) : val)).filter((val) => !leerWert(val));
    }
    if (object && typeof object === 'object' && !istDatum(object)) {
      const kopie = { ...object };
      for (const key of Object.keys(kopie)) {
        const val = kopie[key];
        if (val && typeof val === 'object' && !istDatum(val)) kopie[key] = sanitize(val);
        if ((Array.isArray(kopie[key]) && kopie[key].every(leerWert))
          || (typeof kopie[key] === 'object' && !Array.isArray(kopie[key]) && !istDatum(kopie[key]) && kopie[key] != null && !Object.keys(kopie[key]).length)
          || leerWert(kopie[key])) delete kopie[key];
      }
      return kopie;
    }
    return object;
  };
  const typStandard = (feld) => (feld.default !== undefined ? feld.default : feld.type === 'boolean' ? false : feld.type === 'object' ? zustandObjekt({}, feld.fields) : feld.type === 'block' ? null : '');
  function zustandObjekt(daten, felder) {
    const aus = {};
    for (const f of felder ?? []) aus[f.name] = zustandFeld(daten?.[f.name], f);
    return aus;
  }
  function zustandEinzeln(w, feld) {
    if (feld.type === 'object') return zustandObjekt(w, feld.fields);
    if (feld.type === 'block') {
      const key = feld.blockKey ?? '_block';
      const def = (feld.blocks ?? []).find((b) => b.name === w?.[key]);
      return def && w ? { [key]: w[key], ...zustandObjekt(w, def.fields) } : w;
    }
    return w === undefined || w === null ? typStandard(feld) : w;
  }
  function zustandFeld(w, feld) {
    if (feld.list) return w === undefined ? [] : Array.isArray(w) ? w.map((x) => zustandEinzeln(x, feld)) : [];
    return zustandEinzeln(w, feld);
  }
  const unterschiede = (alt, neu, pfad, aus) => {
    if (Array.isArray(alt) && Array.isArray(neu)) {
      if (alt.length !== neu.length) aus.push(`${pfad}: Liste hatte ${alt.length} Einträge, danach ${neu.length}.`);
      for (let i = 0; i < Math.min(alt.length, neu.length); i++) unterschiede(alt[i], neu[i], `${pfad}[${i + 1}]`, aus);
    } else if (istObjekt(alt) && istObjekt(neu)) {
      for (const k of Object.keys(alt)) {
        if (!(k in neu)) aus.push(`${pfad}.${k}: ging verloren.`);
        else unterschiede(alt[k], neu[k], `${pfad}.${k}`, aus);
      }
      for (const k of Object.keys(neu)) if (!(k in alt)) aus.push({ ergaenzt: `${pfad}.${k}`, wert: neu[k] });
    } else if (alt !== neu) aus.push(`${pfad}: Wert ${JSON.stringify(alt)?.slice(0, 40)} wird zu ${JSON.stringify(neu)?.slice(0, 40)}.`);
  };
  let dateienE = 0;
  let ergaenzt = 0;
  const ergaenztListe = [];
  for (const e of eintraege) {
    const dateien = e.type === 'file' ? [e.path] : jsonDateien(e.path);
    for (const d of dateien) {
      if (!gibtEs(d)) continue;
      let daten;
      try { daten = JSON.parse(lies(d)); } catch { continue; }
      dateienE += 1;
      const vorher = sanitize(daten);
      const nachher = sanitize(zustandObjekt(vorher, e.fields));
      const diff = [];
      unterschiede(vorher, nachher, '', diff);
      for (const x of diff) {
        if (typeof x === 'string') { a('E', `${d} ${x}`); continue; }
        // ergänztes Feld: nur erlaubt, wenn es ein neutraler Standardwert ist
        ergaenzt += 1;
        ergaenztListe.push(`${d.split('/').pop()}${x.ergaenzt}=${JSON.stringify(x.wert)}`);
        const feldName = x.ergaenzt.split('.').pop();
        const std = NEUTRALE_STANDARDS[feldName];
        if (std === undefined || String(std) !== String(x.wert)) a('E', `${d} ${x.ergaenzt}: wird beim Speichern neu angelegt (${JSON.stringify(x.wert)?.slice(0, 40)}) – kein neutraler Standardwert.`);
      }
    }
  }
  infos.push(`E: Trockenlauf Öffnen+Speichern an ${dateienE} Dateien: nichts geht verloren, nichts ändert sich (außer ${ergaenzt} ergänzte neutrale Standardwerte${ergaenzt ? `: ${ergaenztListe.join(', ')}` : ''}).`);
}

// ---------------------------------------------------------------------------------------------
// Ausgabe
// ---------------------------------------------------------------------------------------------
for (const i of infos) console.log(`  ${i}`);
if (abw.length) {
  console.log(`\n${abw.length} Abweichungen:`);
  for (const x of abw) console.log(`  - ${x}`);
  process.exit(1);
}
console.log('\n0 Abweichungen.');
