// Inhaltsprüfung für `node build.mjs --pruefen`: unbekannte Felder, falsche Arten, fehlende Dateien,
// Links auf nicht vorhandene Seiten, fehlende Pflichtangaben.

import { existsSync } from 'node:fs';
import { txt, leer, liste, obj } from './html.mjs';
import { EINSTELLUNGEN, TECHNIK, SEITE, KOPF_GROSS, KOPF_EINFACH, BAUSTEINE, TURNIER } from './schema.mjs';

export function inhaltPruefen({ einst, technik, seiten, turniere, gebaut, dateiPfad }) {
  const p = [];
  const seitenNamen = new Set(gebaut);

  const pruefeZiel = (ziel, wo) => {
    const z = txt(ziel).trim();
    if (!z || /^[a-z][a-z0-9+.-]*:/i.test(z) || z.startsWith('#')) return;
    const datei = z.split('#')[0].split('?')[0].replace(/^\.?\//, '');
    if (datei.endsWith('.html')) {
      const name = datei.slice(0, -5);
      if (!seitenNamen.has(name)) p.push(`${wo}: Link auf "${z}" – diese Seite gibt es nicht.`);
    }
  };

  const pruefeWert = (wert, art, wo) => {
    if (wert === null || wert === undefined) return;
    if (typeof art === 'string') {
      if (art === 'json' || art === 'objekt' || art === 'bausteine') return;
      if (art.startsWith('liste:')) {
        if (!Array.isArray(wert)) { p.push(`${wo}: sollte eine Liste sein.`); return; }
        wert.forEach((x, i) => pruefeWert(x, art.slice(6), `${wo}[${i + 1}]`));
        return;
      }
      if (art === 'janein') {
        if (typeof wert !== 'boolean') p.push(`${wo}: sollte ja/nein (true/false) sein.`);
        return;
      }
      if (typeof wert !== 'string' && typeof wert !== 'number') { p.push(`${wo}: sollte Text sein.`); return; }
      const s = txt(wert);
      if (art.startsWith('auswahl:') && s !== '' && !art.slice(8).split('|').includes(s)) {
        p.push(`${wo}: Wert "${s}" ist nicht erlaubt (erlaubt: ${art.slice(8).split('|').join(', ')}).`);
      }
      if ((art === 'bild' || art === 'datei') && s.trim()) {
        if (!s.startsWith('/')) p.push(`${wo}: Pfad "${s}" sollte mit "/" beginnen.`);
        const abs = dateiPfad(s);
        if (!abs || !existsSync(abs)) p.push(`${wo}: Datei "${s}" nicht gefunden.`);
      }
      if (/ziel$/.test(wo)) pruefeZiel(s, wo);
      return;
    }
    if (Array.isArray(art)) {
      if (!Array.isArray(wert)) { p.push(`${wo}: sollte eine Liste sein.`); return; }
      wert.forEach((x, i) => pruefeObjekt(x, art[0], `${wo}[${i + 1}]`));
      return;
    }
    pruefeObjekt(wert, art, wo);
  };

  const pruefeObjekt = (o, schema, wo) => {
    if (!o || typeof o !== 'object' || Array.isArray(o)) { p.push(`${wo}: sollte ein Objekt sein.`); return; }
    for (const [k, v] of Object.entries(o)) {
      if (!/^[a-zA-Z0-9_-]+$/.test(k)) p.push(`${wo}: Feldname "${k}" enthält unzulässige Zeichen.`);
      if (!(k in schema)) { p.push(`${wo}: unbekanntes Feld "${k}".`); continue; }
      pruefeWert(v, schema[k], `${wo}.${k}`);
    }
  };

  pruefeObjekt(einst, EINSTELLUNGEN, 'einstellungen');
  pruefeObjekt(technik, TECHNIK, 'technik');
  for (const t of Object.keys(TURNIER)) {
    if (turniere[t]) pruefeObjekt(turniere[t], TURNIER[t], `turniere/${t}`);
  }

  for (const s of seiten) {
    const wo = `${s.fest ? 'seiten' : 'weitere-seiten'}/${s.name}`;
    pruefeObjekt(s.daten, SEITE, wo);
    for (const f of ['browsertitel', 'beschreibung', 'menue_titel']) {
      if (leer(s.daten[f])) p.push(`${wo}: Pflichtangabe "${f}" fehlt.`);
    }
    if (s.fest && 'im_menue' in s.daten) p.push(`${wo}: "im_menue" gilt nur für weitere Seiten.`);
    pruefeObjekt(obj(s.daten.kopf), s.name === 'index' ? KOPF_GROSS : KOPF_EINFACH, `${wo}.kopf`);
    const anker = new Set();
    liste(s.daten.bausteine).forEach((b, i) => {
      const bwo = `${wo}.bausteine[${i + 1}]`;
      const schema = BAUSTEINE[txt(obj(b)._block)];
      if (!schema) { p.push(`${bwo}: unbekannte Baustein-Art "${txt(obj(b)._block)}".`); return; }
      pruefeObjekt(b, schema, `${bwo}(${b._block})`);
      const ids = [b.anker, ...liste(b.spalten).map((x) => obj(x).anker)].map((x) => txt(x).trim()).filter(Boolean);
      for (const id of ids) {
        if (anker.has(id)) p.push(`${bwo}: Anker "${id}" kommt auf der Seite mehrfach vor.`);
        anker.add(id);
      }
    });
  }
  return p;
}
