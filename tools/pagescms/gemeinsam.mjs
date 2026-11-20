// Gemeinsame Hilfen der beiden Prüfwerkzeuge für .pages.yml (Pages CMS).
// Nachbau der Schritte, die Pages CMS 2.1.8 beim Lesen der Konfiguration macht
// (lib/config.ts: normalizeConfig / resolveComponent) – nur soweit die Prüfungen sie brauchen.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

export const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CONFIG_PFAD = join(WURZEL, '.pages.yml');

export const istObjekt = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

/** .pages.yml lesen und so parsen wie Pages CMS (yaml, strict: false). */
export function ladeConfig(pfad = CONFIG_PFAD) {
  const text = readFileSync(pfad, 'utf8');
  const dokument = YAML.parseDocument(text, { strict: false, prettyErrors: false });
  return { text, dokument, json: dokument.errors.length ? null : dokument.toJSON(), parseFehler: dokument.errors };
}

// Wie lodash.mergeWith({}, a, b, (o, s) => Array.isArray(s) ? s : undefined):
// Objekte werden tief gemischt, Listen vom späteren Wert ersetzt, undefined übersprungen.
function mischen(a, b) {
  const aus = {};
  for (const quelle of [a, b]) {
    for (const [k, v] of Object.entries(quelle ?? {})) {
      if (v === undefined) continue;
      if (Array.isArray(v)) aus[k] = JSON.parse(JSON.stringify(v));
      else if (istObjekt(v)) aus[k] = mischen(istObjekt(aus[k]) ? aus[k] : {}, v);
      else aus[k] = v;
    }
  }
  return aus;
}

/** Komponenten-Verweise auflösen (wie resolveComponent in Pages CMS). Meldet Fehler in `meldungen`. */
export function loeseFeld(feld, komponenten, meldungen, pfad, kette = []) {
  let r = JSON.parse(JSON.stringify(feld));
  if (typeof r.component === 'string') {
    const schluessel = r.component;
    const def = komponenten?.[schluessel];
    if (!def) {
      meldungen.push(`${pfad}: Komponente "${schluessel}" gibt es nicht (Verweis wird von Pages CMS stillschweigend entfernt).`);
      delete r.component;
    } else if (kette.includes(schluessel)) {
      meldungen.push(`${pfad}: Komponente "${schluessel}" verweist auf sich selbst (${[...kette, schluessel].join(' -> ')}).`);
      delete r.component;
    } else {
      const name = r.name;
      const typ = def.type;
      delete r.component;
      r = mischen(JSON.parse(JSON.stringify(def)), r);
      r.name = name;
      r.type = typ;
      kette = [...kette, schluessel];
    }
  }
  if (Array.isArray(r.fields) && r.fields.length > 0 && r.type === undefined) r.type = 'object';
  if (Array.isArray(r.fields)) r.fields = r.fields.map((f, i) => loeseFeld(f, komponenten, meldungen, `${pfad}.${f?.name ?? i}`, kette));
  if (Array.isArray(r.blocks)) r.blocks = r.blocks.map((b, i) => loeseFeld(b, komponenten, meldungen, `${pfad}.${b?.name ?? i}`, kette));
  return r;
}

/** Medien-Einträge und Seitenleisten-Einträge (Gruppen aufgelöst) mit aufgelösten Feldern. */
export function normalisiere(json) {
  const meldungen = [];
  const komponenten = json.components ?? {};
  const medien = (Array.isArray(json.media) ? json.media : json.media ? [{ name: 'default', ...json.media }] : []).map((m) => ({ ...m }));
  const eintraege = [];
  const gehe = (liste, gruppe) => {
    for (const e of liste ?? []) {
      if (e?.type === 'group') { gehe(e.items, [...gruppe, e.label ?? e.name]); continue; }
      const k = JSON.parse(JSON.stringify(e));
      k.gruppe = gruppe;
      if (Array.isArray(k.fields)) k.fields = k.fields.map((f) => loeseFeld(f, komponenten, meldungen, `${k.name}.${f?.name}`));
      eintraege.push(k);
    }
  };
  gehe(json.content, []);
  return { eintraege, medien, komponenten, meldungen };
}

/** Alle Felder (rekursiv, auch in Bausteinen) als flache Liste { pfad, feld }. */
export function alleFelder(felder, pfad = '', aus = []) {
  for (const f of felder ?? []) {
    const p = pfad ? `${pfad}.${f.name}` : f.name;
    aus.push({ pfad: p, feld: f });
    if (Array.isArray(f.fields)) alleFelder(f.fields, p, aus);
    if (Array.isArray(f.blocks)) for (const b of f.blocks) alleFelder(b.fields, `${p}<${b.name}>`, aus);
  }
  return aus;
}

/** Inhaltsdateien (.json) eines Ordners, ohne Unterordner. */
export function jsonDateien(ordner) {
  const abs = join(WURZEL, ordner);
  if (!existsSync(abs) || !statSync(abs).isDirectory()) return [];
  return readdirSync(abs).filter((d) => d.toLowerCase().endsWith('.json')).sort().map((d) => `${ordner}/${d}`);
}

export const lies = (rel) => readFileSync(join(WURZEL, rel), 'utf8');
export const gibtEs = (rel) => existsSync(join(WURZEL, rel));
