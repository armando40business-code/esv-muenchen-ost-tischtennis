// Tabellenleser: liest .xlsx- und .csv-Dateien sowie aus Excel kopierten Text
// ohne fremde Abhängigkeiten (nur node:fs und node:zlib).
//
// Schnittstelle:
//   leseTabellenDatei(pfad) -> { ok: true, zeilen: string[][], hinweise: string[] }
//                              | { ok: false, fehler: string }
//   leseTabellenText(text)  -> gleiches Ergebnis
// Beide Funktionen arbeiten synchron und werfen nie.

import { readFileSync, statSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

export const GRENZEN = Object.freeze({
  maxDateiBytes: 5 * 1024 * 1024,
  maxZeilen: 2000,
  maxSpalten: 60,
  maxEntpacktJeTeil: 50 * 1024 * 1024,
  maxEntpacktGesamt: 100 * 1024 * 1024,
});

const MELDUNG_ALLGEMEIN =
  "Die Datei konnte nicht gelesen werden. Bitte die Datei in Excel öffnen, als .xlsx speichern und erneut hochladen.";
const MELDUNG_BESCHAEDIGT =
  "Die Excel-Datei ist beschädigt oder unvollständig (vielleicht wurde das Hochladen abgebrochen). Bitte die Datei in Excel öffnen, erneut als .xlsx speichern und noch einmal hochladen.";

class LeseFehler extends Error {
  constructor(meldung) {
    super(meldung);
    this.laienMeldung = meldung;
  }
}

function fehler(meldung) {
  return { ok: false, fehler: meldung };
}

function sicher(fn) {
  try {
    return fn();
  } catch (e) {
    if (e instanceof LeseFehler) return fehler(e.laienMeldung);
    return fehler(MELDUNG_ALLGEMEIN);
  }
}

// ---------------------------------------------------------------------------
// Öffentliche Funktionen
// ---------------------------------------------------------------------------

export function leseTabellenDatei(pfad) {
  return sicher(() => {
    if (typeof pfad !== "string" || pfad === "") {
      return fehler("Es wurde keine Datei angegeben.");
    }
    let info;
    try {
      info = statSync(pfad);
    } catch {
      return fehler("Die Datei wurde nicht gefunden.");
    }
    if (!info.isFile()) return fehler("Die Datei wurde nicht gefunden.");
    if (info.size > GRENZEN.maxDateiBytes) {
      return fehler(
        "Die Datei ist größer als 5 MB und kann nicht übernommen werden. Bitte nur die benötigte Tabelle in eine eigene, kleinere Datei kopieren."
      );
    }
    if (info.size === 0) return fehler("Die Datei ist leer.");
    const daten = readFileSync(pfad);
    if (daten.length > GRENZEN.maxDateiBytes) {
      return fehler(
        "Die Datei ist größer als 5 MB und kann nicht übernommen werden. Bitte nur die benötigte Tabelle in eine eigene, kleinere Datei kopieren."
      );
    }
    const endung = (pfad.match(/\.([^./\\]+)$/) || ["", ""])[1].toLowerCase();
    return leseBuffer(daten, endung);
  });
}

export function leseTabellenText(text) {
  return sicher(() => {
    if (typeof text !== "string") return fehler("Es wurde kein Text übergeben.");
    if (Buffer.byteLength(text, "utf8") > GRENZEN.maxDateiBytes) {
      return fehler(
        "Der eingefügte Text ist größer als 5 MB und kann nicht übernommen werden. Bitte nur die benötigte Tabelle einfügen."
      );
    }
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    return leseCsvText(text, []);
  });
}

// ---------------------------------------------------------------------------
// Erkennung nach Inhalt
// ---------------------------------------------------------------------------

function beginntMit(buf, bytes) {
  if (buf.length < bytes.length) return false;
  for (let i = 0; i < bytes.length; i++) if (buf[i] !== bytes[i]) return false;
  return true;
}

function leseBuffer(buf, endung) {
  if (beginntMit(buf, [0x50, 0x4b])) {
    return leseXlsx(buf);
  }
  if (beginntMit(buf, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    if (buf.includes(Buffer.from("EncryptionInfo", "utf16le"))) {
      return fehler(
        "Die Excel-Datei ist mit einem Kennwort geschützt. Bitte in Excel den Kennwortschutz entfernen (Datei → Informationen → Arbeitsmappe schützen), als .xlsx speichern und erneut hochladen."
      );
    }
    return fehler(
      "Die Datei ist im alten Excel-Format (.xls). Bitte in Excel als .xlsx speichern (Datei → Speichern unter → „Excel-Arbeitsmappe (*.xlsx)“) und erneut hochladen."
    );
  }
  const text = dekodiereText(buf);
  if (text === null) {
    if (endung === "xlsx" || endung === "xlsm" || endung === "xls") {
      return fehler(
        "Die Datei hat die Endung ." +
          endung +
          ", ist aber keine gültige Excel-Datei. Bitte die Datei in Excel öffnen, als .xlsx speichern und erneut hochladen."
      );
    }
    return fehler(
      "Die Datei ist weder eine Excel-Datei (.xlsx) noch eine CSV-Datei. Bitte die Tabelle in Excel als .xlsx speichern und erneut hochladen."
    );
  }
  const anfang = text.replace(/^﻿/, "").trimStart().slice(0, 200).toLowerCase();
  if (anfang.startsWith("<")) {
    return fehler(
      "Die Datei enthält eine Webseite bzw. XML statt einer Tabelle (manche Programme speichern so unter der Endung .xls). Bitte die Datei in Excel öffnen, als .xlsx speichern und erneut hochladen."
    );
  }
  const hinweise = [];
  if (endung === "xlsx" || endung === "xlsm" || endung === "xls") {
    hinweise.push(
      "Die Datei hat die Endung ." + endung + ", enthält aber reinen Text; sie wurde als CSV-Datei gelesen."
    );
  }
  return leseCsvText(text, hinweise);
}

// ---------------------------------------------------------------------------
// Textdekodierung (UTF-8, UTF-16, Windows-1252)
// ---------------------------------------------------------------------------

const CP1252 = [
  0x20ac, 0x81, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x8d,
  0x017d, 0x8f, 0x90, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a,
  0x0153, 0x9d, 0x017e, 0x0178,
];

function dekodiereWindows1252(buf) {
  const teile = [];
  const STUECK = 8192;
  for (let s = 0; s < buf.length; s += STUECK) {
    const ende = Math.min(buf.length, s + STUECK);
    const codes = new Array(ende - s);
    for (let i = s; i < ende; i++) {
      const b = buf[i];
      codes[i - s] = b >= 0x80 && b <= 0x9f ? CP1252[b - 0x80] : b;
    }
    teile.push(String.fromCharCode.apply(null, codes));
  }
  return teile.join("");
}

function istBinaer(text) {
  if (text.indexOf("\u0000") !== -1) return true;
  let steuer = 0;
  const n = Math.min(text.length, 65536);
  for (let i = 0; i < n; i++) {
    const c = text.charCodeAt(i);
    if ((c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d && c !== 0x0c) || c === 0x7f) steuer++;
  }
  return n > 0 && steuer / n > 0.01;
}

// Liefert den Text oder null, wenn der Inhalt offensichtlich binär ist.
function dekodiereText(buf) {
  let text;
  if (beginntMit(buf, [0xef, 0xbb, 0xbf])) {
    text = buf.subarray(3).toString("utf8");
  } else if (beginntMit(buf, [0xff, 0xfe])) {
    text = buf.subarray(2, buf.length - ((buf.length - 2) % 2)).toString("utf16le");
  } else if (beginntMit(buf, [0xfe, 0xff])) {
    const b = Buffer.from(buf.subarray(2, buf.length - ((buf.length - 2) % 2)));
    b.swap16();
    text = b.toString("utf16le");
  } else if (siehtAusWieUtf16le(buf)) {
    text = buf.subarray(0, buf.length - (buf.length % 2)).toString("utf16le");
  } else {
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
    } catch {
      text = dekodiereWindows1252(buf);
    }
  }
  if (istBinaer(text)) return null;
  return text;
}

function siehtAusWieUtf16le(buf) {
  const n = Math.min(buf.length - (buf.length % 2), 2000);
  if (n < 4) return false;
  let nullUngerade = 0;
  let nullGerade = 0;
  for (let i = 0; i < n; i += 2) {
    if (buf[i] === 0) nullGerade++;
    if (buf[i + 1] === 0) nullUngerade++;
  }
  return nullUngerade / (n / 2) > 0.9 && nullGerade / (n / 2) < 0.1;
}

// ---------------------------------------------------------------------------
// CSV / eingefügter Text
// ---------------------------------------------------------------------------

function escapeRegex(z) {
  return z.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseCsv(text, trenner, mitAnfuehrung) {
  const zeilen = [];
  let zeile = [];
  let feld = "";
  let begonnen = false;
  let i = 0;
  const n = text.length;
  const suche = new RegExp("[" + escapeRegex(trenner) + (mitAnfuehrung ? '"' : "") + "\\r\\n]", "g");
  let offen = false;
  while (i < n) {
    const ch = text[i];
    if (mitAnfuehrung && ch === '"' && !begonnen) {
      // Feld in Anführungszeichen
      begonnen = true;
      i++;
      for (;;) {
        const q = text.indexOf('"', i);
        if (q === -1) {
          feld += text.slice(i);
          i = n;
          offen = true;
          break;
        }
        feld += text.slice(i, q);
        if (text[q + 1] === '"') {
          feld += '"';
          i = q + 2;
        } else {
          i = q + 1;
          break;
        }
      }
      continue;
    }
    if (ch === trenner) {
      zeile.push(feld);
      feld = "";
      begonnen = false;
      i++;
      continue;
    }
    if (ch === "\r" || ch === "\n") {
      zeile.push(feld);
      zeilen.push(zeile);
      zeile = [];
      feld = "";
      begonnen = false;
      i += ch === "\r" && text[i + 1] === "\n" ? 2 : 1;
      continue;
    }
    // normales Zeichen: bis zum nächsten Sonderzeichen springen
    suche.lastIndex = i + 1;
    const m = suche.exec(text);
    let ende = m ? m.index : n;
    // Ein Anführungszeichen mitten im Feld ist ein normales Zeichen
    if (m && text[ende] === '"') {
      const naechster = new RegExp("[" + escapeRegex(trenner) + "\\r\\n]", "g");
      naechster.lastIndex = ende;
      const m2 = naechster.exec(text);
      ende = m2 ? m2.index : n;
    }
    feld += text.slice(i, ende);
    begonnen = true;
    i = ende;
  }
  if (begonnen || feld !== "" || zeile.length > 0) {
    zeile.push(feld);
    zeilen.push(zeile);
  }
  return { zeilen, offen };
}

function erkenneTrenner(text) {
  const probe = text.length > 65536 ? text.slice(0, 65536) : text;
  const abgeschnitten = probe.length < text.length;
  const kandidaten = ["\t", ";", ","];
  let bester = null;
  let besteWertung = 0;
  kandidaten.forEach((t, rang) => {
    if (probe.indexOf(t) === -1) return;
    let { zeilen } = parseCsv(probe, t, true);
    if (abgeschnitten && zeilen.length > 1) zeilen = zeilen.slice(0, -1);
    zeilen = zeilen.filter((z) => z.some((f) => f.trim() !== "")).slice(0, 200);
    if (zeilen.length === 0) return;
    const haeufigkeit = new Map();
    for (const z of zeilen) haeufigkeit.set(z.length, (haeufigkeit.get(z.length) || 0) + 1);
    let modus = 1;
    let modusAnzahl = 0;
    for (const [laenge, anzahl] of haeufigkeit) {
      if (laenge > 1 && (anzahl > modusAnzahl || (anzahl === modusAnzahl && laenge > modus))) {
        modus = laenge;
        modusAnzahl = anzahl;
      }
    }
    if (modus <= 1) return;
    // Konsistenz zählt am meisten, bei Gleichstand gewinnt Tab vor Semikolon vor Komma.
    const wertung = modusAnzahl * 10 + (2 - rang);
    if (wertung > besteWertung) {
      besteWertung = wertung;
      bester = t;
    }
  });
  return bester;
}

function leseCsvText(text, hinweise) {
  let trenner = null;
  const sep = text.match(/^sep=(.)[ \t]*(\r\n|\n|\r|$)/i);
  if (sep) {
    trenner = sep[1];
    text = text.slice(sep[0].length);
  }
  if (text.trim() === "") return fehler("Die Datei bzw. der eingefügte Text enthält keine Daten.");
  if (trenner === null) trenner = erkenneTrenner(text) || ";";
  let { zeilen, offen } = parseCsv(text, trenner, true);
  if (offen) {
    zeilen = parseCsv(text, trenner, false).zeilen;
    hinweise.push(
      "Ein Anführungszeichen wurde nicht geschlossen; die Anführungszeichen wurden deshalb als normale Zeichen gelesen. Bitte das Ergebnis prüfen."
    );
  }
  return raeumeAuf(zeilen, hinweise, {});
}

// ---------------------------------------------------------------------------
// Aufräumen und Grenzen
// ---------------------------------------------------------------------------

function istLeer(zeile) {
  for (const z of zeile) if (z !== "") return false;
  return true;
}

function raeumeAuf(roh, hinweise, flags) {
  let zeilen = roh.map((z) =>
    z.map((zelle) => (zelle == null ? "" : String(zelle)).replace(/\r\n?/g, "\n").trim())
  );
  let anfang = 0;
  while (anfang < zeilen.length && istLeer(zeilen[anfang])) anfang++;
  let ende = zeilen.length;
  while (ende > anfang && istLeer(zeilen[ende - 1])) ende--;
  zeilen = zeilen.slice(anfang, ende);

  let zeilenGekuerzt = !!flags.zeilenUeber;
  if (zeilen.length > GRENZEN.maxZeilen) {
    zeilen = zeilen.slice(0, GRENZEN.maxZeilen);
    zeilenGekuerzt = true;
  }
  let spaltenGekuerzt = !!flags.spaltenUeber;
  let breite = 0;
  for (const z of zeilen) {
    for (let c = z.length - 1; c >= 0; c--) {
      if (z[c] !== "") {
        if (c + 1 > breite) breite = c + 1;
        break;
      }
    }
  }
  if (breite > GRENZEN.maxSpalten) {
    breite = GRENZEN.maxSpalten;
    spaltenGekuerzt = true;
  }
  zeilen = zeilen.map((z) => {
    const neu = z.slice(0, breite);
    while (neu.length < breite) neu.push("");
    return neu;
  });
  while (zeilen.length > 0 && istLeer(zeilen[zeilen.length - 1])) zeilen.pop();

  if (zeilenGekuerzt) {
    hinweise.push(
      `Die Tabelle hat mehr als ${GRENZEN.maxZeilen} Zeilen; übernommen wurden nur die ersten ${GRENZEN.maxZeilen}.`
    );
  }
  if (spaltenGekuerzt) {
    hinweise.push(
      `Die Tabelle hat mehr als ${GRENZEN.maxSpalten} Spalten; übernommen wurden nur die ersten ${GRENZEN.maxSpalten}.`
    );
  }
  if (zeilen.length === 0) {
    return fehler("Die Tabelle ist leer – es wurden keine Daten gefunden.");
  }
  return { ok: true, zeilen, hinweise };
}

// ---------------------------------------------------------------------------
// ZIP-Leser
// ---------------------------------------------------------------------------

const MELDUNG_ZIP64 =
  "Die Datei verwendet ein Sonderformat (ZIP64), das hier nicht unterstützt wird. Bitte die Datei in Excel öffnen, als .xlsx speichern und erneut hochladen.";
const MELDUNG_KENNWORT =
  "Die Excel-Datei ist mit einem Kennwort geschützt. Bitte in Excel den Kennwortschutz entfernen, als .xlsx speichern und erneut hochladen.";
const MELDUNG_BOMBE =
  "Die Datei enthält ungewöhnlich große Datenmengen und wurde aus Sicherheitsgründen nicht gelesen. Bitte nur die benötigte Tabelle in eine neue Datei kopieren.";

function leseZipVerzeichnis(buf) {
  const len = buf.length;
  if (len < 22) throw new LeseFehler(MELDUNG_BESCHAEDIGT);
  let eocd = -1;
  const unten = Math.max(0, len - 22 - 65535);
  for (let i = len - 22; i >= unten; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new LeseFehler(MELDUNG_BESCHAEDIGT);
  if (eocd >= 20 && buf.readUInt32LE(eocd - 20) === 0x07064b50) throw new LeseFehler(MELDUNG_ZIP64);
  const anzahl = buf.readUInt16LE(eocd + 10);
  const cdGroesse = buf.readUInt32LE(eocd + 12);
  const cdStart = buf.readUInt32LE(eocd + 16);
  if (anzahl === 0xffff || cdGroesse === 0xffffffff || cdStart === 0xffffffff) throw new LeseFehler(MELDUNG_ZIP64);
  if (cdStart + cdGroesse > eocd) throw new LeseFehler(MELDUNG_BESCHAEDIGT);

  const eintraege = new Map();
  let p = cdStart;
  for (let k = 0; k < anzahl; k++) {
    if (p + 46 > eocd || buf.readUInt32LE(p) !== 0x02014b50) throw new LeseFehler(MELDUNG_BESCHAEDIGT);
    const flags = buf.readUInt16LE(p + 8);
    const methode = buf.readUInt16LE(p + 10);
    const komprimiert = buf.readUInt32LE(p + 20);
    const entpackt = buf.readUInt32LE(p + 24);
    const nameLaenge = buf.readUInt16LE(p + 28);
    const extraLaenge = buf.readUInt16LE(p + 30);
    const kommentarLaenge = buf.readUInt16LE(p + 32);
    const lokal = buf.readUInt32LE(p + 42);
    if (p + 46 + nameLaenge > eocd) throw new LeseFehler(MELDUNG_BESCHAEDIGT);
    const name = buf
      .subarray(p + 46, p + 46 + nameLaenge)
      .toString(flags & 0x800 ? "utf8" : "latin1")
      .replace(/\\/g, "/")
      .replace(/^\/+/, "");
    const schluessel = name.toLowerCase();
    if (!eintraege.has(schluessel)) {
      eintraege.set(schluessel, { name, flags, methode, komprimiert, entpackt, lokal });
    }
    p += 46 + nameLaenge + extraLaenge + kommentarLaenge;
  }
  return eintraege;
}

function entpacke(buf, eintrag, kontext) {
  if (eintrag.flags & 0x1) throw new LeseFehler(MELDUNG_KENNWORT);
  if (eintrag.komprimiert === 0xffffffff || eintrag.entpackt === 0xffffffff || eintrag.lokal === 0xffffffff) {
    throw new LeseFehler(MELDUNG_ZIP64);
  }
  const p = eintrag.lokal;
  if (p + 30 > buf.length || buf.readUInt32LE(p) !== 0x04034b50) throw new LeseFehler(MELDUNG_BESCHAEDIGT);
  const start = p + 30 + buf.readUInt16LE(p + 26) + buf.readUInt16LE(p + 28);
  const ende = start + eintrag.komprimiert;
  if (ende > buf.length) throw new LeseFehler(MELDUNG_BESCHAEDIGT);
  const rest = Math.min(GRENZEN.maxEntpacktJeTeil, GRENZEN.maxEntpacktGesamt - kontext.entpackt);
  if (eintrag.entpackt > rest) throw new LeseFehler(MELDUNG_BOMBE);
  const roh = buf.subarray(start, ende);
  let daten;
  if (eintrag.methode === 0) {
    daten = roh;
  } else if (eintrag.methode === 8) {
    try {
      daten = inflateRawSync(roh, { maxOutputLength: Math.max(1, rest) });
    } catch (e) {
      if (e && (e.code === "ERR_BUFFER_TOO_LARGE" || e instanceof RangeError)) throw new LeseFehler(MELDUNG_BOMBE);
      throw new LeseFehler(MELDUNG_BESCHAEDIGT);
    }
  } else if (eintrag.methode === 99) {
    throw new LeseFehler(MELDUNG_KENNWORT);
  } else {
    throw new LeseFehler(MELDUNG_ALLGEMEIN);
  }
  if (daten.length > rest) throw new LeseFehler(MELDUNG_BOMBE);
  kontext.entpackt += daten.length;
  return daten;
}

// ---------------------------------------------------------------------------
// Minimaler XML-Leser (ereignisbasiert, ohne Entitäten-Definitionen)
// ---------------------------------------------------------------------------

function xmlText(daten) {
  if (beginntMit(daten, [0xff, 0xfe])) return daten.subarray(2).toString("utf16le");
  if (beginntMit(daten, [0xfe, 0xff])) {
    const b = Buffer.from(daten.subarray(2, daten.length - (daten.length % 2)));
    b.swap16();
    return b.toString("utf16le");
  }
  const t = daten.toString("utf8");
  return t.charCodeAt(0) === 0xfeff ? t.slice(1) : t;
}

const ENTITAETEN = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };

function entitaeten(s) {
  if (s.indexOf("&") === -1) return s;
  return s.replace(/&(#[xX][0-9a-fA-F]+|#[0-9]+|[A-Za-z]+);/g, (ganz, e) => {
    if (e[0] === "#") {
      const cp = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return "";
      return String.fromCodePoint(cp);
    }
    return Object.prototype.hasOwnProperty.call(ENTITAETEN, e) ? ENTITAETEN[e] : ganz;
  });
}

function lokalName(n) {
  const i = n.indexOf(":");
  return i === -1 ? n : n.slice(i + 1);
}

const TAG_RE = /<([^\s>\/!?]+)((?:\s+[^\s=>\/]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/y;
const ATTR_RE = /([^\s=>\/]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

function parseXml(xml, aufAuf, aufZu, aufText) {
  let pos = 0;
  const n = xml.length;
  while (pos < n) {
    const lt = xml.indexOf("<", pos);
    const textEnde = lt === -1 ? n : lt;
    if (textEnde > pos && aufText) aufText(entitaeten(xml.slice(pos, textEnde)));
    if (lt === -1) break;
    if (xml.startsWith("<!--", lt)) {
      const e = xml.indexOf("-->", lt + 4);
      pos = e === -1 ? n : e + 3;
      continue;
    }
    if (xml.startsWith("<![CDATA[", lt)) {
      const e = xml.indexOf("]]>", lt + 9);
      if (aufText) aufText(xml.slice(lt + 9, e === -1 ? n : e));
      pos = e === -1 ? n : e + 3;
      continue;
    }
    if (xml.startsWith("<?", lt)) {
      const e = xml.indexOf("?>", lt + 2);
      pos = e === -1 ? n : e + 2;
      continue;
    }
    if (xml.startsWith("<!", lt)) {
      const e = xml.indexOf(">", lt + 2);
      pos = e === -1 ? n : e + 1;
      continue;
    }
    if (xml.startsWith("</", lt)) {
      const e = xml.indexOf(">", lt + 2);
      if (e === -1) break;
      if (aufZu) aufZu(lokalName(xml.slice(lt + 2, e).trim()));
      pos = e + 1;
      continue;
    }
    TAG_RE.lastIndex = lt;
    const m = TAG_RE.exec(xml);
    if (!m) {
      const e = xml.indexOf(">", lt + 1);
      pos = e === -1 ? n : e + 1;
      continue;
    }
    const attrs = {};
    if (m[2]) {
      ATTR_RE.lastIndex = 0;
      let a;
      while ((a = ATTR_RE.exec(m[2])) !== null) {
        attrs[lokalName(a[1])] = entitaeten(a[2] !== undefined ? a[2] : a[3]);
      }
    }
    const name = lokalName(m[1]);
    const leer = m[3] === "/";
    if (aufAuf) aufAuf(name, attrs, leer);
    if (leer && aufZu) aufZu(name);
    pos = TAG_RE.lastIndex;
  }
}

// Excel kodiert Steuerzeichen in Texten als _xHHHH_
function excelEscapes(s) {
  if (s.indexOf("_x") === -1) return s;
  return s.replace(/_x([0-9A-Fa-f]{4})_/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

// ---------------------------------------------------------------------------
// XLSX
// ---------------------------------------------------------------------------

function verzeichnisVon(pfad) {
  const i = pfad.lastIndexOf("/");
  return i === -1 ? "" : pfad.slice(0, i + 1);
}

function loesePfad(basis, ziel) {
  if (ziel.startsWith("/")) return ziel.replace(/^\/+/, "");
  const teile = (verzeichnisVon(basis) + ziel).split("/");
  const aus = [];
  for (const t of teile) {
    if (t === "" || t === ".") continue;
    if (t === "..") aus.pop();
    else aus.push(t);
  }
  return aus.join("/");
}

function relsPfad(teil) {
  return verzeichnisVon(teil) + "_rels/" + teil.slice(verzeichnisVon(teil).length) + ".rels";
}

function leseRels(zip, buf, teil, kontext) {
  const eintrag = zip.get(relsPfad(teil).toLowerCase());
  const rels = [];
  if (!eintrag) return rels;
  parseXml(xmlText(entpacke(buf, eintrag, kontext)), (name, a) => {
    if (name === "Relationship" && a.Target && a.TargetMode !== "External") {
      rels.push({ id: a.Id || "", typ: a.Type || "", ziel: loesePfad(teil, a.Target) });
    }
  });
  return rels;
}

function holeTeil(zip, buf, pfad, kontext) {
  const e = zip.get(String(pfad).toLowerCase());
  return e ? xmlText(entpacke(buf, e, kontext)) : null;
}

function leseXlsx(buf) {
  const zip = leseZipVerzeichnis(buf);
  const kontext = { entpackt: 0 };
  const hinweise = [];

  // Arbeitsmappe finden
  let wbPfad = "xl/workbook.xml";
  const wurzelRels = leseRels(zip, buf, "", kontext);
  const office = wurzelRels.find((r) => /\/officeDocument$/.test(r.typ));
  if (office) wbPfad = office.ziel;
  if (!zip.has(wbPfad.toLowerCase())) {
    if (zip.has("content.xml") && zip.has("mimetype")) {
      return fehler(
        "Die Datei ist eine LibreOffice/OpenOffice-Tabelle (.ods). Bitte in LibreOffice „Speichern unter“ → „Excel 2007-365 (.xlsx)“ wählen und erneut hochladen."
      );
    }
    if (zip.has("word/document.xml")) {
      return fehler("Die Datei ist ein Word-Dokument, keine Excel-Tabelle. Bitte eine .xlsx- oder .csv-Datei hochladen.");
    }
    return fehler(
      "Die Datei ist eine ZIP-Datei, aber keine Excel-Arbeitsmappe. Bitte die Tabelle in Excel als .xlsx speichern und erneut hochladen."
    );
  }
  const wbXml = holeTeil(zip, buf, wbPfad, kontext);
  const blaetter = [];
  let datum1904 = false;
  parseXml(wbXml, (name, a) => {
    if (name === "sheet") blaetter.push({ name: a.name || "", rid: a.id || "", state: a.state || "visible" });
    else if (name === "workbookPr") datum1904 = a.date1904 === "1" || a.date1904 === "true";
  });
  const wbRels = leseRels(zip, buf, wbPfad, kontext);
  const relNachId = new Map(wbRels.map((r) => [r.id, r]));

  // Erstes sichtbares Arbeitsblatt
  let gewaehlt = null;
  let versteckteDavor = 0;
  let sichtbare = 0;
  for (const b of blaetter) {
    if (b.state === "hidden" || b.state === "veryHidden") {
      if (!gewaehlt) versteckteDavor++;
      continue;
    }
    const rel = relNachId.get(b.rid);
    if (!rel || !/\/worksheet$/.test(rel.typ) || !zip.has(rel.ziel.toLowerCase())) continue;
    sichtbare++;
    if (!gewaehlt) gewaehlt = { name: b.name, pfad: rel.ziel };
  }
  if (!gewaehlt && blaetter.length === 0) {
    // Notfall: Arbeitsblatt-Dateien direkt suchen
    const kandidaten = [...zip.values()]
      .map((e) => e.name)
      .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(n))
      .sort((x, y) => parseInt(x.match(/(\d+)\.xml$/i)[1], 10) - parseInt(y.match(/(\d+)\.xml$/i)[1], 10));
    if (kandidaten.length) {
      gewaehlt = { name: "", pfad: kandidaten[0] };
      sichtbare = 1;
    }
  }
  if (!gewaehlt) {
    return fehler(
      "In der Excel-Datei wurde kein sichtbares Tabellenblatt gefunden. Bitte das Blatt mit den Daten einblenden, speichern und erneut hochladen."
    );
  }
  if (versteckteDavor > 0) {
    hinweise.push(`Ausgeblendete Tabellenblätter wurden übersprungen; gelesen wurde das Blatt „${gewaehlt.name}“.`);
  } else if (sichtbare > 1) {
    hinweise.push(`Die Datei hat mehrere Tabellenblätter; gelesen wurde nur das erste („${gewaehlt.name}“).`);
  }

  // Gemeinsame Texte und Formate
  const typPfad = (endung, standard) => {
    const r = wbRels.find((x) => x.typ.endsWith("/" + endung));
    return r ? r.ziel : standard;
  };
  const sst = leseSharedStrings(holeTeil(zip, buf, typPfad("sharedStrings", "xl/sharedStrings.xml"), kontext));
  const formate = leseStyles(holeTeil(zip, buf, typPfad("styles", "xl/styles.xml"), kontext));
  const blattXml = holeTeil(zip, buf, gewaehlt.pfad, kontext);
  const ctx = { sst, formate, datum1904 };
  const { zeilen, flags } = leseArbeitsblatt(blattXml, ctx);
  return raeumeAuf(zeilen, hinweise, flags);
}

function leseSharedStrings(xml) {
  const liste = [];
  if (!xml) return liste;
  let inSi = false;
  let rph = 0;
  let inT = false;
  let aktuell = "";
  parseXml(
    xml,
    (name, a, leer) => {
      if (name === "si") {
        inSi = true;
        aktuell = "";
      } else if (name === "rPh") rph++;
      else if (name === "t" && inSi && rph === 0 && !leer) inT = true;
    },
    (name) => {
      if (name === "t") inT = false;
      else if (name === "rPh") rph = Math.max(0, rph - 1);
      else if (name === "si") {
        liste.push(excelEscapes(aktuell));
        inSi = false;
      }
    },
    (text) => {
      if (inT) aktuell += text;
    }
  );
  return liste;
}

// Eingebaute Zahlenformate (Teilmenge, die für die Anzeige zählt)
const EINGEBAUT = {
  0: "General",
  1: "0",
  2: "0.00",
  3: "#,##0",
  4: "#,##0.00",
  5: "#,##0",
  6: "#,##0",
  7: "#,##0.00",
  8: "#,##0.00",
  9: "0%",
  10: "0.00%",
  11: "0.00E+00",
  12: "General",
  13: "General",
  14: "dd.mm.yyyy",
  15: "d-mmm-yy",
  16: "d-mmm",
  17: "mmm-yy",
  18: "h:mm AM/PM",
  19: "h:mm:ss AM/PM",
  20: "h:mm",
  21: "h:mm:ss",
  22: "dd.mm.yyyy h:mm",
  37: "#,##0",
  38: "#,##0",
  39: "#,##0.00",
  40: "#,##0.00",
  45: "mm:ss",
  46: "[h]:mm:ss",
  47: "mm:ss.0",
  48: "General",
  49: "@",
};
for (const id of [27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 50, 51, 52, 53, 54, 55, 56, 57, 58]) {
  EINGEBAUT[id] = "yyyy-mm-dd";
}

function ersterAbschnitt(code) {
  let inQ = false;
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (c === '"') inQ = !inQ;
    else if (c === "\\" && !inQ) i++;
    else if (c === ";" && !inQ) return code.slice(0, i);
  }
  return code;
}

function klassifiziere(code) {
  if (!code || /^general$/i.test(code.trim())) return { art: "allgemein" };
  const roh = ersterAbschnitt(code);
  const euro = roh.indexOf("€") !== -1;
  const ohneText = roh
    .replace(/"[^"]*"/g, "")
    .replace(/\\./g, "")
    .replace(/[_*]./g, "");
  const verstrichen = /\[(h+|m+|s+)\]/i.test(ohneText);
  const k = ohneText.replace(/\[[^\]]*\]/g, "");
  if (k.trim() === "@") return { art: "allgemein" };
  const hatDatum = /[yd]/i.test(k);
  const hatZeit = /[hs]/i.test(k) || /am\/pm|a\/p/i.test(k) || verstrichen;
  if (hatDatum || hatZeit) {
    const sekunden = /s/i.test(k);
    if (hatDatum && hatZeit) return { art: "datumzeit", sekunden };
    if (hatDatum) return { art: "datum" };
    return { art: "zeit", sekunden, verstrichen };
  }
  if (/e[+-]/i.test(k)) return { art: "allgemein" };
  const prozent = k.indexOf("%") !== -1;
  let stellen = null;
  if (/[0#?]/.test(k)) {
    const nachKomma = k.match(/\.([0#?]+)/);
    stellen = nachKomma ? (nachKomma[1].match(/0/g) || []).length : 0;
    if (nachKomma && /#/.test(nachKomma[1]) && stellen === 0) stellen = null;
  }
  return { art: prozent ? "prozent" : "zahl", stellen, euro };
}

function leseStyles(xml) {
  const eigene = new Map();
  const xfs = [];
  if (xml) {
    let inCellXfs = false;
    parseXml(
      xml,
      (name, a) => {
        if (name === "numFmt" && a.numFmtId !== undefined) eigene.set(parseInt(a.numFmtId, 10), a.formatCode || "");
        else if (name === "cellXfs") inCellXfs = true;
        else if (name === "xf" && inCellXfs) xfs.push(parseInt(a.numFmtId || "0", 10) || 0);
      },
      (name) => {
        if (name === "cellXfs") inCellXfs = false;
      }
    );
  }
  const cache = new Map();
  return (stilIndex) => {
    const id = xfs[stilIndex] !== undefined ? xfs[stilIndex] : 0;
    if (cache.has(id)) return cache.get(id);
    const code = eigene.has(id) ? eigene.get(id) : EINGEBAUT[id];
    const k = klassifiziere(code || "General");
    cache.set(id, k);
    return k;
  };
}

function zweistellig(n) {
  return n < 10 ? "0" + n : String(n);
}

export function formatiereZahl(n) {
  if (!Number.isFinite(n)) return "";
  if (Number.isInteger(n)) return String(n);
  return String(Number(n.toPrecision(15))).replace(".", ",");
}

function runde(n, stellen) {
  const vorzeichen = n < 0 ? -1 : 1;
  const r = Number(Math.round(Number(Math.abs(n) + "e" + stellen)) + "e-" + stellen);
  return vorzeichen * r;
}

function formatiereMitStellen(n, stellen) {
  if (stellen === null || stellen === undefined || Math.abs(n) >= 1e15) return formatiereZahl(n);
  const r = runde(n, stellen);
  if (!Number.isFinite(r)) return formatiereZahl(n);
  let s = r.toFixed(stellen);
  if (s === "-0" || /^-0[.,]0*$/.test(s)) s = s.slice(1);
  return s.replace(".", ",");
}

function zeitText(sekundeDesTages, mitSekunden) {
  const h = Math.floor(sekundeDesTages / 3600);
  const m = Math.floor((sekundeDesTages % 3600) / 60);
  const s = sekundeDesTages % 60;
  return zweistellig(h) + ":" + zweistellig(m) + (mitSekunden ? ":" + zweistellig(s) : "");
}

function datumText(seriell, datum1904) {
  const tag = Math.floor(seriell);
  if (!datum1904 && tag === 60) return "29.02.1900";
  if (!datum1904 && tag === 0) return "00.01.1900";
  let ms;
  if (datum1904) ms = Date.UTC(1904, 0, 1) + tag * 86400000;
  else if (tag < 60) ms = Date.UTC(1899, 11, 31) + tag * 86400000;
  else ms = Date.UTC(1899, 11, 30) + tag * 86400000;
  const d = new Date(ms);
  return zweistellig(d.getUTCDate()) + "." + zweistellig(d.getUTCMonth() + 1) + "." + d.getUTCFullYear();
}

function formatiereSeriell(wert, f, datum1904) {
  if (wert < 0 || wert > 2958466) return formatiereZahl(wert);
  const gesamtSek = Math.round(wert * 86400);
  const tag = Math.floor(gesamtSek / 86400);
  const sek = gesamtSek - tag * 86400;
  if (f.art === "zeit") {
    if (f.verstrichen) {
      const h = Math.floor(gesamtSek / 3600);
      const rest = gesamtSek - h * 3600;
      return zweistellig(h) + ":" + zweistellig(Math.floor(rest / 60)) + (f.sekunden ? ":" + zweistellig(rest % 60) : "");
    }
    return zeitText(sek, f.sekunden);
  }
  const d = datumText(tag, datum1904);
  if (f.art === "datumzeit") return d + " " + zeitText(sek, f.sekunden);
  return d;
}

function formatiereIsoDatum(s) {
  const m = String(s).trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return String(s).trim();
  const zeit = m[4] !== undefined ? m[4] + ":" + m[5] : null;
  if ((m[1] === "1899" && m[2] === "12" && (m[3] === "30" || m[3] === "31")) || (m[1] === "1904" && m[2] === "01" && m[3] === "01" && zeit && zeit !== "00:00")) {
    return zeit || "00:00";
  }
  const datum = m[3] + "." + m[2] + "." + m[1];
  return zeit && zeit !== "00:00" ? datum + " " + zeit : datum;
}

function zellwert(zelle, ctx) {
  const t = zelle.t;
  if (t === "inlineStr") return excelEscapes(zelle.inline);
  if (!zelle.hatV) return "";
  const v = zelle.v;
  switch (t) {
    case "s": {
      const i = parseInt(v.trim(), 10);
      return Number.isInteger(i) && i >= 0 && i < ctx.sst.length ? ctx.sst[i] : "";
    }
    case "str":
      return excelEscapes(v);
    case "b":
      return v.trim() === "1" || v.trim().toLowerCase() === "true" ? "WAHR" : "FALSCH";
    case "e":
      return "";
    case "d":
      return formatiereIsoDatum(v);
    default: {
      const roh = v.trim();
      if (roh === "") return "";
      const n = Number(roh);
      if (!Number.isFinite(n)) return excelEscapes(v);
      const f = ctx.formate(zelle.s);
      switch (f.art) {
        case "datum":
        case "zeit":
        case "datumzeit":
          return formatiereSeriell(n, f, ctx.datum1904);
        case "prozent":
          return formatiereMitStellen(n * 100, f.stellen) + " %";
        case "zahl": {
          const s = formatiereMitStellen(n, f.stellen);
          return f.euro ? s + " €" : s;
        }
        default:
          return formatiereZahl(n);
      }
    }
  }
}

function spalteAusBuchstaben(b) {
  let n = 0;
  for (let i = 0; i < b.length; i++) n = n * 26 + (b.toUpperCase().charCodeAt(i) - 64);
  return n - 1;
}

function parseZellbezug(ref) {
  const m = /^\$?([A-Za-z]{1,3})\$?(\d{1,7})$/.exec(String(ref || "").trim());
  if (!m) return null;
  return { spalte: spalteAusBuchstaben(m[1]), zeile: parseInt(m[2], 10) - 1 };
}

function leseArbeitsblatt(xml, ctx) {
  const daten = new Map(); // zeile -> Map(spalte -> wert)
  const verbunden = [];
  const flags = { zeilenUeber: false, spaltenUeber: false };
  let ersteZeile = Infinity;
  let inSheetData = false;
  let aktZeile = -1;
  let letzteSpalte = -1;
  let zelle = null;
  let inV = false;
  let inIs = false;
  let inT = false;
  let rph = 0;

  const speichere = (z, s, wert) => {
    if (wert === "" || wert.trim() === "") return;
    if (s >= GRENZEN.maxSpalten) {
      flags.spaltenUeber = true;
      return;
    }
    if (z < ersteZeile) ersteZeile = z;
    if (z >= ersteZeile + GRENZEN.maxZeilen) {
      flags.zeilenUeber = true;
      return;
    }
    let reihe = daten.get(z);
    if (!reihe) {
      reihe = new Map();
      daten.set(z, reihe);
    }
    reihe.set(s, wert);
  };

  parseXml(
    xml,
    (name, a, leer) => {
      if (name === "sheetData") {
        inSheetData = !leer;
      } else if (!inSheetData) {
        if (name === "mergeCell" && a.ref) {
          const [von, bis] = a.ref.split(":");
          const p1 = parseZellbezug(von);
          const p2 = parseZellbezug(bis || von);
          if (p1 && p2) verbunden.push({ z1: p1.zeile, s1: p1.spalte, z2: p2.zeile, s2: p2.spalte });
        }
      } else if (name === "row") {
        const r = parseInt(a.r, 10);
        aktZeile = Number.isInteger(r) && r >= 1 ? r - 1 : aktZeile + 1;
        letzteSpalte = -1;
      } else if (name === "c") {
        let z = aktZeile < 0 ? 0 : aktZeile;
        let s = letzteSpalte + 1;
        const ref = parseZellbezug(a.r);
        if (ref) {
          s = ref.spalte;
          z = ref.zeile;
          if (aktZeile < 0) aktZeile = z;
        }
        letzteSpalte = s;
        zelle = leer ? null : { z, s, t: a.t || "n", stil: parseInt(a.s || "0", 10) || 0, v: "", hatV: false, inline: "" };
      } else if (zelle) {
        if (name === "v" && !leer) {
          inV = true;
          zelle.hatV = true;
        } else if (name === "is") inIs = !leer;
        else if (name === "rPh") rph++;
        else if (name === "t" && inIs && rph === 0 && !leer) inT = true;
      }
    },
    (name) => {
      if (name === "sheetData") inSheetData = false;
      else if (name === "v") inV = false;
      else if (name === "t") inT = false;
      else if (name === "rPh") rph = Math.max(0, rph - 1);
      else if (name === "is") inIs = false;
      else if (name === "c" && zelle) {
        const z = zelle;
        zelle = null;
        const wert = zellwert({ t: z.t, v: z.v, hatV: z.hatV, inline: z.inline, s: z.stil }, ctx);
        speichere(z.z, z.s, wert);
      }
    },
    (text) => {
      if (!zelle) return;
      if (inV) zelle.v += text;
      else if (inT) zelle.inline += text;
    }
  );

  // Verbundene Zellen: nur oben links behält den Wert
  if (verbunden.length) {
    for (const [z, reihe] of daten) {
      for (const b of verbunden) {
        if (z < b.z1 || z > b.z2) continue;
        for (const s of [...reihe.keys()]) {
          if (s >= b.s1 && s <= b.s2 && !(z === b.z1 && s === b.s1)) reihe.delete(s);
        }
      }
    }
  }

  const zeilen = [];
  if (daten.size) {
    const schluessel = [...daten.keys()].sort((x, y) => x - y);
    const von = schluessel[0];
    const bis = schluessel[schluessel.length - 1];
    let breite = 0;
    for (const reihe of daten.values()) for (const s of reihe.keys()) if (s + 1 > breite) breite = s + 1;
    for (let z = von; z <= bis; z++) {
      const zeile = new Array(breite).fill("");
      const reihe = daten.get(z);
      if (reihe) for (const [s, w] of reihe) zeile[s] = w;
      zeilen.push(zeile);
    }
  }
  return { zeilen, flags };
}
