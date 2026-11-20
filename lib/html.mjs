// Kleine HTML-Hilfen: Escaping, Attribute, Text-Normalisierung.

/** Wert als Text lesen: null/undefined/Objekte -> "" ; Zahlen/Booleans -> String. */
export function txt(wert) {
  if (wert === null || wert === undefined) return '';
  if (typeof wert === 'string') return wert;
  if (typeof wert === 'number' || typeof wert === 'boolean') return String(wert);
  return '';
}

/** Ist ein Feld (nach Trimmen) leer? */
export function leer(wert) {
  return txt(wert).trim() === '';
}

/** Reiner Text -> HTML. Geschütztes Leerzeichen bleibt als &nbsp; erhalten. */
export function esc(wert) {
  return txt(wert)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/ /g, '&nbsp;');
}

/** Reiner Text -> Attributwert (in doppelten Anführungszeichen). */
export function escAttr(wert) {
  return txt(wert)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/ /g, '&nbsp;');
}

/** Liste sicher lesen (kein Array -> []), leere Einträge (null) entfernen. */
export function liste(wert) {
  return Array.isArray(wert) ? wert.filter((x) => x !== null && x !== undefined) : [];
}

/** Objekt sicher lesen. */
export function obj(wert) {
  return wert && typeof wert === 'object' && !Array.isArray(wert) ? wert : {};
}

/** Ja/Nein-Feld lesen mit Standardwert. */
export function janein(wert, standard) {
  if (wert === true || wert === false) return wert;
  if (wert === 'true' || wert === 'ja') return true;
  if (wert === 'false' || wert === 'nein') return false;
  return standard;
}

/** Link-Ziel prüfen (auch für Knöpfe/Menü). Gibt '' zurück, wenn unzulässig. */
export function sicheresZiel(ziel) {
  const z = txt(ziel).trim();
  if (!z) return '';
  // Steuer- und Leerzeichen entfernen, um "java\tscript:" o. ä. zu erkennen
  const kompakt = z.replace(/[\u0000- \u007f-\u009f]/g, '').toLowerCase();
  const schema = /^([a-z][a-z0-9+.-]*):/.exec(kompakt);
  if (schema) {
    return ['http', 'https', 'mailto', 'tel'].includes(schema[1]) ? z : '';
  }
  if (kompakt.startsWith('//')) return ''; // protokoll-relative fremde Adressen nicht zulassen
  return z;
}

/** Ist das Ziel eine fremde http(s)-Adresse (bekommt target=_blank)? */
export function istExtern(ziel, basisUrl) {
  const z = txt(ziel).trim();
  if (!/^https?:\/\//i.test(z)) return false;
  if (basisUrl) {
    try {
      const a = new URL(z);
      const b = new URL(basisUrl);
      if (a.host === b.host) return false;
    } catch {
      return true;
    }
  }
  return true;
}

/** Attribute für einen Link: href (+ target/rel bei fremden Adressen). */
export function linkAttr(ziel, basisUrl) {
  const z = sicheresZiel(ziel);
  if (!z) return null;
  let a = `href="${escAttr(z)}"`;
  if (istExtern(z, basisUrl)) a += ' target="_blank" rel="noopener"';
  return a;
}
