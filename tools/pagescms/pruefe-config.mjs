// Prüft .pages.yml gegen das offizielle Konfigurations-Schema von Pages CMS (config-schema.ts, Zod)
// und ein paar Regeln, die das Schema nicht kennt (Verweise, Ordner, Beschriftungen, Standardwerte).
//
//   node tools/pagescms/pruefe-config.mjs [pfad/zur/.pages.yml]
//
// Exit 0 = 0 Fehler. Exit 1 = mindestens ein Fehler.

import { join } from 'node:path';
import { existsSync, statSync } from 'node:fs';
import { ConfigSchema } from './config-schema.ts';
import { ladeConfig, normalisiere, alleFelder, WURZEL, CONFIG_PFAD, gibtEs, istObjekt } from './gemeinsam.mjs';

const fehler = [];
const hinweise = [];
const f = (s) => fehler.push(s);

const { dokument, json, parseFehler } = ladeConfig(process.argv[2] ?? CONFIG_PFAD);

// 1. YAML lesbar? ---------------------------------------------------------------------------------
for (const e of parseFehler) f(`YAML: ${e.message}`);

// 2. Offizielles Schema -----------------------------------------------------------------------------
function zodMeldungen(issue, aus, vorlauf = []) {
  const pfad = [...vorlauf, ...issue.path].join('.');
  if (issue.code === 'invalid_union' && Array.isArray(issue.unionErrors)) {
    // wie Pages CMS: die Fehler der Union-Zweige einzeln zeigen; ist es ein reiner Typfehler, die Union-Meldung
    const eigene = [];
    for (const u of issue.unionErrors) for (const i of u.issues) {
      if (i.path.length === issue.path.length) eigene.push(i); else zodMeldungen(i, aus);
    }
    if (eigene.length === issue.unionErrors.length) aus.push(`${pfad || '(Wurzel)'}: ${eigene[eigene.length - 1].message}`);
    return;
  }
  if (issue.code === 'unrecognized_keys') { aus.push(`${pfad || '(Wurzel)'}: unbekannte Schlüssel ${issue.keys.map((k) => `"${k}"`).join(', ')} – Pages CMS würde sie ignorieren.`); return; }
  aus.push(`${pfad || '(Wurzel)'}: ${issue.message}`);
}
let schemaFehler = 0;
if (json) {
  const erg = ConfigSchema.safeParse(json);
  if (!erg.success) {
    const l = [];
    for (const i of erg.error.issues) zodMeldungen(i, l);
    const einmalig = [...new Set(l)];
    schemaFehler = einmalig.length;
    for (const m of einmalig) f(`Schema: ${m}`);
  }
}

// 3. Eigene Prüfungen ---------------------------------------------------------------------------------
let norm = null;
if (json && istObjekt(json)) {
  norm = normalisiere(json);
  for (const m of norm.meldungen) f(`Komponenten: ${m}`);

  // Medien: Ordner vorhanden, Namen eindeutig
  const medienNamen = new Set();
  for (const m of norm.medien) {
    if (medienNamen.has(m.name)) f(`Medien: Name "${m.name}" kommt doppelt vor.`);
    medienNamen.add(m.name);
    if (!existsSync(join(WURZEL, m.input)) || !statSync(join(WURZEL, m.input)).isDirectory()) f(`Medien "${m.name}": Ordner "${m.input}" gibt es nicht im Repository.`);
    if (m.output !== `/${m.input}`) hinweise.push(`Medien "${m.name}": Ausgabepfad ${m.output} weicht vom Ordner ${m.input} ab (Bauskript kopiert medien/ nach _site/medien/).`);
  }

  // Seitenleiste: eindeutige Namen, Dateien/Ordner vorhanden
  const namen = new Set();
  for (const e of norm.eintraege) {
    if (namen.has(e.name)) f(`Seitenleiste: Name "${e.name}" kommt doppelt vor.`);
    namen.add(e.name);
    if (!e.label) f(`Seitenleiste "${e.name}": Beschriftung (label) fehlt.`);
    if (e.type === 'file' && !gibtEs(e.path)) f(`Seitenleiste "${e.name}": Datei ${e.path} gibt es nicht.`);
    if (e.type === 'collection' && !gibtEs(e.path)) f(`Seitenleiste "${e.name}": Ordner ${e.path} gibt es nicht.`);
    if (e.path === 'inhalt/technik.json' || e.path?.endsWith('/technik.json')) f(`Seitenleiste "${e.name}": inhalt/technik.json darf nicht ins CMS.`);
    if (e.type === 'file' && !(e.operations && e.operations.delete === false)) f(`Seitenleiste "${e.name}": Datei kann im CMS gelöscht werden (operations.delete: false fehlt).`);
    if (e.type === 'file' && !(e.operations && e.operations.rename === false)) f(`Seitenleiste "${e.name}": operations.rename: false fehlt.`);
    if (!Array.isArray(e.fields) || e.fields.length === 0) f(`Seitenleiste "${e.name}": keine Felder definiert (Pages CMS zeigte einen Quelltext-Editor).`);
    if (e.format !== 'json') f(`Seitenleiste "${e.name}": format muss json sein.`);
    if (e.type === 'collection') {
      if (e.operations?.create === false || e.operations?.delete === false) f(`Seitenleiste "${e.name}": Sammlung soll Anlegen und Löschen erlauben.`);
      if (typeof e.filename !== 'string' || !e.filename.endsWith('.json')) f(`Seitenleiste "${e.name}": filename muss auf .json enden.`);
    }
  }
  const gruppenFehlt = norm.eintraege.filter((e) => e.gruppe.length === 0).map((e) => e.name);
  hinweise.push(`Oberste Ebene der Seitenleiste ohne Gruppe: ${gruppenFehlt.join(', ') || '–'}`);

  // Felder: Beschriftung, Namen, Verweise auf Medien, Standardwerte, Fachwörter
  const FACHWOERTER = [/\bjson\b/i, /\bslug\b/i, /\brepository\b/i, /\brepo\b/i, /\byaml\b/i, /\bmarkdown\b/i, /\bcommit\b/i, /\bbranch\b/i, /(?<![.\w])html(?![\w])/i, /\bcms\b/i, /\bblock\b/i, /\bkicker\b/i, /\bhex\b/i];
  const ENGLISCH = /\b(the|and|please|enter|click|your|this|field|upload|image|title)\b/i;
  let felderGesamt = 0;
  let ohneBeschreibung = 0;
  const pruefeFeld = (feld, wo, istBlockDef = false) => {
    felderGesamt += 1;
    const w = `${wo}.${feld.name}`;
    if (!feld.label && !feld.hidden) f(`${w}: Beschriftung (label) fehlt.`);
    if (!feld.description && !feld.hidden && !['object', 'block'].includes(feld.type) && !feld.list) ohneBeschreibung += 1;
    for (const [art, text] of [['Beschriftung', feld.label], ['Hilfetext', feld.description]]) {
      if (typeof text !== 'string') continue;
      for (const re of FACHWOERTER) if (re.test(text)) f(`${w}: ${art} enthält ein Fachwort (${re.source}): "${text.slice(0, 70)}…"`);
      if (ENGLISCH.test(text)) f(`${w}: ${art} klingt englisch: "${text.slice(0, 70)}…"`);
      if (/\s{2,}$|^\s/.test(text)) f(`${w}: ${art} beginnt/endet mit Leerraum.`);
    }
    if (feld.type === 'select') {
      const werte = (feld.options?.values ?? []).map((x) => (istObjekt(x) ? String(x.value ?? x.name) : String(x)));
      if (werte.length === 0) f(`${w}: Auswahlfeld ohne Werte.`);
      for (const x of feld.options?.values ?? []) if (istObjekt(x) && !x.label) f(`${w}: Auswahlwert "${x.value}" hat keine deutsche Beschriftung.`);
      if (feld.default !== undefined && !werte.includes(String(feld.default))) f(`${w}: default "${feld.default}" ist kein erlaubter Wert.`);
    }
    if (feld.default !== undefined && ['string', 'text', 'rich-text'].includes(feld.type) && !feld.hidden) {
      f(`${w}: Standardtext "${String(feld.default).slice(0, 30)}" – Pages CMS setzt Standardwerte in JEDES leere Feld ein (initializeState), ein bewusst leeres Feld käme beim nächsten Speichern mit dem Text zurück. Nur bei Auswahl/Ja-Nein/versteckten Feldern erlaubt.`);
    }
    if (feld.type === 'rich-text') {
      if (feld.options?.format !== 'html') f(`${w}: rich-text ohne options.format: html (Standard wäre Markdown).`);
      if (feld.options?.switcher !== false) hinweise.push(`${w}: Quelltext-Umschalter ist an.`);
    }
    if (feld.type === 'image' || feld.type === 'file' || feld.type === 'rich-text') {
      const m = feld.options?.media;
      if (feld.type === 'rich-text') {
        if (m !== false && m !== undefined && !medienNamen.has(m)) f(`${w}: options.media "${m}" gibt es nicht.`);
      } else if (!m || !medienNamen.has(m)) f(`${w}: options.media fehlt oder ist unbekannt ("${m ?? ''}").`);
      if (feld.type === 'image' && m !== 'bilder') f(`${w}: Bildfeld muss options.media: bilder haben.`);
      if (feld.type === 'file' && m !== 'tabellen') f(`${w}: Dateifeld muss options.media: tabellen haben.`);
      if (feld.type === 'file') {
        const ext = [...(feld.options?.extensions ?? [])].sort().join(',');
        if (ext !== 'csv,xlsx') f(`${w}: Dateifeld darf nur xlsx und csv erlauben (hat: ${ext || 'alles'}).`);
      }
    }
    if (feld.type === 'block') {
      if (!(feld.list)) f(`${w}: Baustein-Feld muss eine Liste sein (list).`);
      if ((feld.blockKey ?? '_block') !== '_block') f(`${w}: blockKey muss _block sein.`);
      const namen2 = new Set();
      for (const b of feld.blocks ?? []) {
        if (namen2.has(b.name)) f(`${w}: Baustein "${b.name}" doppelt.`);
        namen2.add(b.name);
        if (!b.label) f(`${w}.${b.name}: Baustein ohne deutschen Namen (label).`);
        for (const sub of b.fields ?? []) {
          if (sub.type === 'block') f(`${w}.${b.name}.${sub.name}: Baustein in Baustein ist nicht erlaubt.`);
          pruefeFeld(sub, `${w}.${b.name}`);
        }
        if (JSON.stringify(b.fields ?? []).includes('"type":"block"')) f(`${w}.${b.name}: enthält verschachtelte Bausteine.`);
      }
    }
    // doppelte Feldnamen
    if (Array.isArray(feld.fields)) {
      const n = new Set();
      for (const s of feld.fields) {
        if (n.has(s.name)) f(`${w}: Feldname "${s.name}" doppelt.`);
        n.add(s.name);
        pruefeFeld(s, w);
      }
    }
    if (feld.list && typeof feld.list === 'object' && feld.list.collapsible && !['object', 'block'].includes(feld.type)) {
      f(`${w}: collapsible gilt nur für Objekt-/Baustein-Listen.`);
    }
    if ((feld.type === 'object' || feld.type === 'block') && feld.list && typeof feld.list === 'object') {
      const sum = feld.list.collapsible?.summary;
      if (feld.type === 'object' && feld.list.collapsible && !sum) hinweise.push(`${w}: einklappbar ohne summary (Zeile zeigt „Item #n“).`);
      if (sum) {
        const bekannt = new Set(['index', ...(feld.type === 'object' ? (feld.fields ?? []).map((x) => x.name) : (feld.blocks ?? []).flatMap((b) => (b.fields ?? []).map((x) => x.name)))]);
        for (const m of sum.matchAll(/\{(?:fields\.)?([A-Za-z0-9_-]+)\}/g)) if (!bekannt.has(m[1])) f(`${w}: summary nennt unbekanntes Feld {${m[1]}}.`);
      }
    }
  };
  for (const e of norm.eintraege) {
    const n = new Set();
    for (const feld of e.fields ?? []) {
      if (n.has(feld.name)) f(`${e.name}: Feldname "${feld.name}" doppelt.`);
      n.add(feld.name);
      pruefeFeld(feld, e.name);
    }
  }

  // Komponenten, die nirgends benutzt werden
  const text = JSON.stringify(json.content ?? []) + JSON.stringify(json.components ?? {});
  for (const k of Object.keys(json.components ?? {})) if (!text.includes(`"component":"${k}"`)) hinweise.push(`Komponente "${k}" wird nirgends benutzt.`);

  // Einstellungen
  if (json.settings?.content?.merge === true) f('settings.content.merge steht auf true – das verhindert, dass sich Objekte vollständig leeren lassen (siehe Kommentar in .pages.yml).');
  hinweise.push(`${felderGesamt} Felder geprüft; ${ohneBeschreibung} einfache Felder ohne Hilfetext.`);

  // Blockarten vorhanden?
  const bausteineFeld = alleFelder(norm.eintraege.find((e) => e.name === 'seite-startseite')?.fields ?? []).find((x) => x.feld.type === 'block');
  if (!bausteineFeld) f('Startseite: kein Baustein-Feld gefunden.');
  else hinweise.push(`${bausteineFeld.feld.blocks.length} Baustein-Arten: ${bausteineFeld.feld.blocks.map((b) => b.label).join(' · ')}`);
}

// Ausgabe ---------------------------------------------------------------------------------------------
console.log(`Prüfung von ${process.argv[2] ?? '.pages.yml'}`);
console.log(`  Schema von Pages CMS (config-schema.ts): ${json ? (schemaFehler === 0 ? 'gültig' : `${schemaFehler} Fehler`) : 'nicht prüfbar (YAML-Fehler)'}`);
if (norm) console.log(`  Seitenleiste: ${norm.eintraege.length} Einträge, Medien: ${norm.medien.map((m) => m.name).join(', ')}`);
for (const h of hinweise) console.log(`  Info: ${h}`);
if (fehler.length) {
  console.log(`\n${fehler.length} Fehler:`);
  for (const x of fehler) console.log(`  - ${x}`);
  process.exit(1);
}
console.log('\n0 Fehler.');
