// Breite/Höhe eines Bildes aus dem Dateikopf lesen (png, jpg, webp, gif, svg). Ohne Abhängigkeiten.

import { readFileSync } from 'node:fs';

export function bildGroesse(pfad) {
  let buf;
  try {
    buf = readFileSync(pfad);
  } catch {
    return null;
  }
  try {
    return ausPuffer(buf);
  } catch {
    return null;
  }
}

export function ausPuffer(b) {
  if (b.length < 10) return null;
  // PNG
  if (b[0] === 0x89 && b.toString('ascii', 1, 4) === 'PNG') {
    return { breite: b.readUInt32BE(16), hoehe: b.readUInt32BE(20) };
  }
  // GIF
  if (b.toString('ascii', 0, 3) === 'GIF') {
    return { breite: b.readUInt16LE(6), hoehe: b.readUInt16LE(8) };
  }
  // WebP
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const art = b.toString('ascii', 12, 16);
    if (art === 'VP8 ') {
      return { breite: b.readUInt16LE(26) & 0x3fff, hoehe: b.readUInt16LE(28) & 0x3fff };
    }
    if (art === 'VP8L') {
      const bits = b.readUInt32LE(21);
      return { breite: (bits & 0x3fff) + 1, hoehe: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (art === 'VP8X') {
      return { breite: b.readUIntLE(24, 3) + 1, hoehe: b.readUIntLE(27, 3) + 1 };
    }
    return null;
  }
  // JPEG
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      if (marker === 0xff) { i++; continue; }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      const laenge = b.readUInt16BE(i + 2);
      const sof = (marker >= 0xc0 && marker <= 0xcf) && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (sof) return { hoehe: b.readUInt16BE(i + 5), breite: b.readUInt16BE(i + 7) };
      i += 2 + laenge;
    }
    return null;
  }
  // SVG
  const kopf = b.toString('utf8', 0, Math.min(b.length, 4096));
  const svg = /<svg\b[^>]*>/i.exec(kopf);
  if (svg) {
    const tag = svg[0];
    const zahl = (name) => {
      const m = new RegExp(`\\s${name}\\s*=\\s*["']\\s*([0-9.]+)\\s*(px)?\\s*["']`, 'i').exec(tag);
      return m ? Math.round(parseFloat(m[1])) : null;
    };
    let breite = zahl('width');
    let hoehe = zahl('height');
    if (!breite || !hoehe) {
      const vb = /\sviewBox\s*=\s*["']\s*[-0-9.]+[\s,]+[-0-9.]+[\s,]+([0-9.]+)[\s,]+([0-9.]+)\s*["']/i.exec(tag);
      if (vb) {
        const vw = parseFloat(vb[1]);
        const vh = parseFloat(vb[2]);
        if (breite && !hoehe) hoehe = Math.round((breite * vh) / vw);
        else if (hoehe && !breite) breite = Math.round((hoehe * vw) / vh);
        else { breite = Math.round(vw); hoehe = Math.round(vh); }
      }
    }
    return breite && hoehe ? { breite, hoehe } : null;
  }
  return null;
}
