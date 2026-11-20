// Nachbildung dessen, was Pages CMS (2.1.x) beim Öffnen und Speichern einer Inhaltsdatei schreibt.
//
// Belegt durch echte Speicherungen auf dem Wegwerf-Zweig cms-probe (Test tools/pagescms/tests/speichern.test.mjs)
// und den Quelltext von Pages CMS:
//   1. Öffnen:   initializeState(fields, sanitizeObject(inhalt))           (components/entry/entry-form.tsx)
//                -> jedes Formularfeld bekommt einen Wert, fehlende Auswahl-/Ja-Nein-Felder ihren Standardwert.
//   2. Editor:   Jeder leere Fließtext-Editor (rich-text, keine Liste) meldet beim Laden "<p></p>" zurück
//                (TipTap) – auch in eingeklappten Einträgen, weil die nur per CSS versteckt sind.
//   3. Speichern: sanitizeObject(deepMap(zod(werte), fields, write))      (app/api/.../files/[path]/route.ts)
//                -> Schlüssel in der Reihenfolge der Formularfelder (Baustein-Schlüssel zuerst), Schlüssel ohne
//                Formularfeld fallen weg, leere Texte "" / leere Listen / leere Objekte fallen weg.
//   4. Datei:    JSON.stringify(objekt, null, 2) – 2 Leerzeichen, jedes Objekt mehrzeilig, KEIN Zeilenumbruch am Ende.
//
// Nicht nachgebildet: wie TipTap nicht-leeren Fließtext umformt (bei unserem Inhalt im Test unverändert).

const istDatum = (v) => v instanceof Date;
const leer = (v) => v == null || v === '';

/** Wörtlicher Nachbau von sanitizeObject (lib/schema.ts). */
export function sanitize(object) {
  if (Array.isArray(object)) {
    return object.map((val) => (val && typeof val === 'object' && !istDatum(val) ? sanitize(val) : val)).filter((val) => !leer(val));
  }
  if (object && typeof object === 'object' && !istDatum(object)) {
    const kopie = { ...object };
    for (const key of Object.keys(kopie)) {
      const val = kopie[key];
      if (val && typeof val === 'object' && !istDatum(val)) kopie[key] = sanitize(val);
      if ((Array.isArray(kopie[key]) && kopie[key].every(leer))
        || (typeof kopie[key] === 'object' && !Array.isArray(kopie[key]) && !istDatum(kopie[key]) && kopie[key] != null && !Object.keys(kopie[key]).length)
        || leer(kopie[key])) delete kopie[key];
    }
    return kopie;
  }
  return object;
}

/** Nachbau von deepMap (lib/schema.ts): Ergebnis enthält genau die Formularfelder, in deren Reihenfolge. */
export function deepMap(inhalt, felder, apply) {
  const traverse = (daten, schema) => {
    const aus = {};
    const akt = daten || {};
    for (const feld of schema ?? []) {
      const wert = akt[feld.name];
      if (feld.list) {
        if (wert === undefined) aus[feld.name] = apply(wert, feld);
        else {
          aus[feld.name] = Array.isArray(wert)
            ? wert.map((item) => {
              if (feld.type === 'object') return traverse(item, feld.fields);
              if (feld.type === 'block') {
                const key = feld.blockKey || '_block';
                const def = feld.blocks?.find((b) => b.name === item?.[key]);
                return def ? { [key]: item[key], ...traverse(item, def.fields) } : item;
              }
              return apply(item, feld);
            })
            : [];
        }
      } else if (feld.type === 'object') {
        aus[feld.name] = traverse(wert, feld.fields);
      } else if (feld.type === 'block') {
        const key = feld.blockKey || '_block';
        const def = feld.blocks?.find((b) => b.name === wert?.[key]);
        aus[feld.name] = def && wert ? { [key]: wert[key], ...traverse(wert, def.fields) } : wert;
      } else {
        aus[feld.name] = apply(wert, feld);
      }
    }
    return aus;
  };
  return traverse(inhalt, felder);
}

const typStandard = (feld) => {
  if (feld.default !== undefined) return feld.default;
  if (feld.type === 'object') return initialisiere(feld.fields, {});
  if (feld.type === 'block') return null;
  if (feld.type === 'boolean') return false;
  return '';
};

/** Nachbau von initializeState (lib/schema.ts). */
export function initialisiere(felder, inhalt = {}) {
  return deepMap(inhalt || {}, felder, (wert, feld) => {
    if (wert === undefined) {
      return feld.list ? (typeof feld.list === 'object' && feld.list.default !== undefined ? feld.list.default : []) : typStandard(feld);
    }
    if (wert === null && feld.type !== 'object' && !feld.list) return typStandard(feld);
    return wert;
  });
}

/** Leere Fließtext-Editoren melden "<p></p>" zurück (nur sichtbare Felder; keine Listen-Felder selbst). */
export function editorenLaden(werte, felder) {
  return deepMap(werte, felder, (wert, feld) => {
    if (feld.type === 'rich-text' && !feld.hidden && !feld.list && (wert == null || wert === '')) return '<p></p>';
    return wert;
  });
}

/** Öffnen + ungeändert Speichern: das Objekt, das Pages CMS in die Datei schreibt. */
export function speichere(inhalt, felder) {
  const geladen = editorenLaden(initialisiere(felder, sanitize(inhalt)), felder);
  // zod + write-Funktionen ändern bei unseren Feldtypen nichts (Bild/Datei: input <-> output hin und zurück),
  // deepMap verwirft Schlüssel ohne Formularfeld und legt die Reihenfolge fest.
  return sanitize(deepMap(geladen, felder, (w) => w));
}

/** Dateitext so, wie Pages CMS ihn schreibt (JSON.stringify mit 2 Leerzeichen, ohne Zeilenumbruch am Ende). */
export const alsDateitext = (objekt) => JSON.stringify(objekt, null, 2);

/** Formularfelder (aufgelöst) zu einer Inhaltsdatei, oder null, wenn die Datei nicht im CMS steht. */
export function felderFuer(eintraege, datei) {
  for (const e of eintraege) {
    if (e.type === 'file' && e.path === datei) return e.fields ?? [];
    if (e.type === 'collection' && datei.startsWith(`${e.path}/`) && !datei.slice(e.path.length + 1).includes('/')) return e.fields ?? [];
  }
  return null;
}
