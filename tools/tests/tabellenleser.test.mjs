import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { leseTabellenDatei, leseTabellenText, formatiereZahl } from "../../lib/tabellenleser.mjs";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const fx = (name) => join(FIX, name);

function ok(ergebnis) {
  assert.equal(ergebnis.ok, true, "erwartet ok:true, erhalten: " + JSON.stringify(ergebnis));
  return ergebnis;
}
function nichtOk(ergebnis, muster) {
  assert.equal(ergebnis.ok, false, "erwartet ok:false, erhalten: " + JSON.stringify(ergebnis).slice(0, 300));
  assert.equal(typeof ergebnis.fehler, "string");
  if (muster) assert.match(ergebnis.fehler, muster);
  return ergebnis;
}
function rechteckig(zeilen) {
  const breite = zeilen[0].length;
  for (const z of zeilen) assert.equal(z.length, breite);
}

function mitTempDatei(name, daten, fn) {
  const dir = mkdtempSync(join(tmpdir(), "tabellenleser-"));
  try {
    const p = join(dir, name);
    writeFileSync(p, daten);
    return fn(p);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ------------------------------------------------------------------ XLSX

test("xlsx: Texte mit Umlauten, Zahlen, Dezimal, Prozent, Datum, Uhrzeit, Währung, Wahrheitswerte", () => {
  const r = ok(leseTabellenDatei(fx("grundtypen.xlsx")));
  const z = r.zeilen;
  rechteckig(z);
  assert.deepEqual(z[0], ["Name", "Ort", "Punkte", "Dezimal", "Quote", "Datum", "Uhrzeit", "Betrag", "Aktiv"]);
  assert.deepEqual(z[1], ["Jürgen Müßig", "Größenbach", "42", "3,5", "12,5 %", "14.03.2026", "19:30", "12,50 €", "WAHR"]);
  // Trimmen, Entities, keine Gleitkomma-Artefakte (0.1+0.2), Schalttag
  assert.deepEqual(z[2], ["Ärger & <Spaß>", "Öhringen", "-7", "0,3", "50,0 %", "29.02.2024", "08:05", "1234,57 €", "FALSCH"]);
  assert.equal(z[3][0], "Zeile\nzwei");
  assert.equal(z[3][2], "1000000");
  assert.equal(z[3][5], "31.12.1999");
  assert.equal(z[3][6], "23:59");
  assert.equal(z[3][8], "");
  assert.deepEqual(z[4], new Array(9).fill(""), "leere Zeile in der Mitte bleibt erhalten");
  // 1900-System mit Excels Schaltjahr-Fehler
  assert.equal(z[5][1], "28.02.1900");
  assert.equal(z[6][1], "29.02.1900");
  assert.equal(z[7][1], "01.03.1900");
  assert.equal(z[8][1], "01.11.2026", "eigenes Datumsformat mit Text und Gebietsschema");
  assert.equal(z[9][1], "01.05.2026 14:45");
  assert.equal(z[10][1], "02.01.2026", "eingebautes Format 14");
  assert.deepEqual(r.hinweise, []);
});

test("xlsx: leere Zellen, Lücken, führende/abschließende Leerzeilen", () => {
  const r = ok(leseTabellenDatei(fx("luecken.xlsx")));
  assert.deepEqual(r.zeilen, [
    ["", "Mannschaft", "", "Liga", ""],
    ["", "", "", "", ""],
    ["", "Herren I", "", "", ""],
    ["", "", "", "", ""],
    ["", "", "", "", "ganz rechts"],
  ]);
});

test("xlsx: verstecktes erstes Blatt wird übersprungen", () => {
  const r = ok(leseTabellenDatei(fx("versteckt.xlsx")));
  assert.deepEqual(r.zeilen, [["sichtbar", "1"]]);
  assert.equal(r.hinweise.length, 1);
  assert.match(r.hinweise[0], /Tabelle/);
});

test("xlsx: verbundene Zellen – Wert oben links, Rest leer", () => {
  const r = ok(leseTabellenDatei(fx("verbunden.xlsx")));
  assert.deepEqual(r.zeilen, [
    ["Überschrift", "", ""],
    ["a", "b", "c"],
    ["senkrecht", "", ""],
    ["", "daneben", ""],
  ]);
});

test("xlsx: Formel ohne zwischengespeicherten Wert wird leer (openpyxl)", () => {
  const r = ok(leseTabellenDatei(fx("formel_ohne_wert.xlsx")));
  assert.deepEqual(r.zeilen, [["Summe"]]);
});

test("xlsx (von Hand): Rich-Text, inlineStr, Entities, rPh, Bool, Fehler, Formeln, Zellen ohne r, Stile", () => {
  const r = ok(leseTabellenDatei(fx("handgebaut.xlsx")));
  assert.deepEqual(r.zeilen, [
    ["einfach", "Fett und kursiv", "Tom & Jerry <3 über Ä", "Zeile\n2", "", ""],
    ["inline Ä", "teilweise", "WAHR", "FALSCH", "", ""],
    ["3", "", "ab", "", "", ""],
    ["ohne r 1", "2,5", "", "", "7", "8"],
    ["", "", "", "", "", ""],
    ["15.03.2023", "12:00", "12,34 %", "04.07.2026", "", ""],
  ]);
});

test("xlsx: 1904-Datumssystem und unkomprimierte Einträge (stored)", () => {
  const r = ok(leseTabellenDatei(fx("datum1904.xlsx")));
  assert.deepEqual(r.zeilen, [["01.01.1904", "23.09.2021"]]);
});

test("xlsx: Namensraum-Präfixe (x:) werden verstanden", () => {
  const r = ok(leseTabellenDatei(fx("praefix.xlsx")));
  assert.deepEqual(r.zeilen, [["präfix", "1,5"]]);
});

test("xlsx: mit echtem Excel gespeicherte Datei", () => {
  const r = ok(leseTabellenDatei(fx("excel_echt.xlsx")));
  assert.deepEqual(r.zeilen, [
    ["Mannschaft", "Datum", "Uhrzeit", "Quote", "Wert", "Summe"],
    ["Herren Überlingen", "15.11.2026", "19:30", "12,5 %", "2,5", "5"],
    ["Größe", "", "", "", "", ""],
    ["verbunden", "", "", "", "", ""],
  ]);
});

test("xlsx: zu große Tabelle wird auf 2000 Zeilen und 60 Spalten gekürzt", () => {
  const r = ok(leseTabellenDatei(fx("gross.xlsx")));
  assert.equal(r.zeilen.length, 2000);
  assert.equal(r.zeilen[0].length, 60);
  assert.equal(r.zeilen[0][0], "101");
  assert.equal(r.zeilen[1999][59], "200060");
  assert.equal(r.hinweise.length, 2);
  assert.match(r.hinweise.join(" "), /2000 Zeilen/);
  assert.match(r.hinweise.join(" "), /60 Spalten/);
});

// ------------------------------------------------------------------ kaputte Dateien

test("abgeschnittene xlsx wird mit verständlicher Meldung abgelehnt", () => {
  nichtOk(leseTabellenDatei(fx("abgeschnitten.xlsx")), /beschädigt|unvollständig/);
});

test("jede Kürzung und viele Bytefehler führen nie zu einer Ausnahme", () => {
  const voll = readFileSync(fx("grundtypen.xlsx"));
  const dir = mkdtempSync(join(tmpdir(), "tabellenleser-"));
  try {
    const p = join(dir, "x.xlsx");
    for (let laenge = 0; laenge < voll.length; laenge += 97) {
      writeFileSync(p, voll.subarray(0, laenge));
      const r = leseTabellenDatei(p);
      assert.equal(typeof r.ok, "boolean");
    }
    let saat = 12345;
    const zufall = () => (saat = (saat * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let k = 0; k < 150; k++) {
      const kopie = Buffer.from(voll);
      for (let j = 0; j < 5; j++) kopie[Math.floor(zufall() * kopie.length)] = Math.floor(zufall() * 256);
      writeFileSync(p, kopie);
      const r = leseTabellenDatei(p);
      assert.equal(typeof r.ok, "boolean");
      if (r.ok) rechteckig(r.zeilen.length ? r.zeilen : [[]]);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Nicht-ZIP mit Endung .xlsx wird abgelehnt", () => {
  nichtOk(leseTabellenDatei(fx("kein_zip.xlsx")), /keine gültige Excel-Datei/);
});

test("Text mit Endung .xlsx wird als CSV gelesen (Entscheidung nach Inhalt)", () => {
  const r = ok(leseTabellenDatei(fx("text_als.xlsx")));
  assert.deepEqual(r.zeilen, [["Name", "Wert"], ["Anna", "1"]]);
  assert.match(r.hinweise[0], /als CSV/);
});

test("alte .xls wird mit klarem Satz abgelehnt", () => {
  nichtOk(leseTabellenDatei(fx("alt.xls")), /\.xlsx speichern/);
});

test("kennwortgeschützte Excel-Datei (OLE-Container mit EncryptionInfo)", () => {
  const kopf = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  const daten = Buffer.concat([kopf, Buffer.alloc(100), Buffer.from("EncryptionInfo", "utf16le"), Buffer.alloc(100)]);
  mitTempDatei("geschuetzt.xlsx", daten, (p) => nichtOk(leseTabellenDatei(p), /Kennwort/));
});

test("Webseite mit Endung .xls wird abgelehnt", () => {
  nichtOk(leseTabellenDatei(fx("webseite.xls")), /Webseite/);
});

test("LibreOffice-Datei (.ods) wird mit Hinweis abgelehnt", () => {
  nichtOk(leseTabellenDatei(fx("libreoffice.ods")), /LibreOffice/);
});

test("ZIP-Bombe (ehrlich angegebene Größe) wird abgelehnt", () => {
  nichtOk(leseTabellenDatei(fx("bombe.xlsx")), /Sicherheitsgründen/);
});

test("ZIP-Bombe (gelogene Größe) wird beim Entpacken gestoppt", () => {
  nichtOk(leseTabellenDatei(fx("bombe_gelogen.xlsx")), /Sicherheitsgründen/);
});

function findeAlle(buf, sig) {
  const treffer = [];
  let i = buf.indexOf(sig);
  while (i !== -1) {
    treffer.push(i);
    i = buf.indexOf(sig, i + 1);
  }
  return treffer;
}

test("verschlüsselter ZIP-Eintrag wird abgelehnt", () => {
  const buf = Buffer.from(readFileSync(fx("grundtypen.xlsx")));
  for (const i of findeAlle(buf, Buffer.from([0x50, 0x4b, 0x01, 0x02]))) buf[i + 8] |= 1;
  mitTempDatei("verschluesselt.xlsx", buf, (p) => nichtOk(leseTabellenDatei(p), /Kennwort/));
});

test("ZIP64 wird abgelehnt", () => {
  const buf = Buffer.from(readFileSync(fx("grundtypen.xlsx")));
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  buf.writeUInt32LE(0xffffffff, eocd + 16);
  mitTempDatei("zip64.xlsx", buf, (p) => nichtOk(leseTabellenDatei(p), /ZIP64/));
});

test("Datei größer als 5 MB wird abgelehnt", () => {
  const daten = Buffer.alloc(5 * 1024 * 1024 + 1, 0x41);
  mitTempDatei("riesig.csv", daten, (p) => nichtOk(leseTabellenDatei(p), /5 MB/));
});

test("fehlende, leere und ungültige Pfade", () => {
  nichtOk(leseTabellenDatei(fx("gibt_es_nicht.xlsx")), /nicht gefunden/);
  nichtOk(leseTabellenDatei(FIX), /nicht gefunden/);
  nichtOk(leseTabellenDatei(""));
  nichtOk(leseTabellenDatei(undefined));
  mitTempDatei("leer.csv", Buffer.alloc(0), (p) => nichtOk(leseTabellenDatei(p), /leer/));
});

// ------------------------------------------------------------------ CSV-Dateien

test("csv: Semikolon (deutsches Excel) mit BOM, Komma im Text, CRLF", () => {
  const r = ok(leseTabellenDatei(fx("semikolon.csv")));
  assert.deepEqual(r.zeilen, [["Name", "Punkte", "Quote"], ["Müller, Hans", "12", "1,5"], ["Özdemir", "7", "0,25"]]);
});

test("csv: Komma", () => {
  const r = ok(leseTabellenDatei(fx("komma.csv")));
  assert.deepEqual(r.zeilen, [["Name", "Punkte", "Ort"], ["Anna", "3", "Köln"], ["Bert", "4", "Düsseldorf"]]);
});

test("csv: Tab", () => {
  const r = ok(leseTabellenDatei(fx("tab.csv")));
  assert.deepEqual(r.zeilen, [["Name", "Punkte"], ["Anna", "3"], ["", "leer davor"]]);
});

test("csv: Anführungszeichen, verdoppelte Anführungszeichen, Zeilenumbruch im Feld", () => {
  const r = ok(leseTabellenDatei(fx("anfuehrung.csv")));
  assert.deepEqual(r.zeilen, [
    ["Name", "Bemerkung", "Zahl"],
    ["Meier; Karl", 'Er sagte "Hallo"', "1"],
    ["Zwei\nZeilen", "x", "2"],
  ]);
});

test("csv: Windows-1252", () => {
  const r = ok(leseTabellenDatei(fx("cp1252.csv")));
  assert.deepEqual(r.zeilen, [["Name", "Größe", "Preis"], ["Jürgen", "groß", "5 €"], ["Änne", "klein", "3 €"]]);
});

test("Text in UTF-16 (Excel „Unicode-Text“)", () => {
  const r = ok(leseTabellenDatei(fx("utf16.txt")));
  assert.deepEqual(r.zeilen, [["A", "B"], ["Ä", "ß"]]);
});

// ------------------------------------------------------------------ eingefügter Text

test("Text: aus Excel kopiert (Tab, abschließender Umbruch, Zelle mit Umbruch in Anführungszeichen)", () => {
  const r = ok(leseTabellenText('Spieler\tBilanz\r\n"Max\nMustermann"\t5:3\r\nÜlkü\t\r\n'));
  assert.deepEqual(r.zeilen, [["Spieler", "Bilanz"], ["Max\nMustermann", "5:3"], ["Ülkü", ""]]);
});

test("Text: Semikolon mit deutschen Dezimalzahlen", () => {
  const r = ok(leseTabellenText("a;b\n1,5;2,5\n3,25;4\n"));
  assert.deepEqual(r.zeilen, [["a", "b"], ["1,5", "2,5"], ["3,25", "4"]]);
});

test("Text: Komma-getrennt, ungleich lange Zeilen werden aufgefüllt, leere Spalten rechts entfernt", () => {
  const r = ok(leseTabellenText("\n\nx,y,,\nz,,,\n,,,\n\n"));
  assert.deepEqual(r.zeilen, [["x", "y"], ["z", ""]]);
});

test("Text: einspaltig, BOM, sep=-Zeile", () => {
  assert.deepEqual(ok(leseTabellenText("﻿eins\nzwei")).zeilen, [["eins"], ["zwei"]]);
  assert.deepEqual(ok(leseTabellenText("sep=,\na;b,c\n")).zeilen, [["a;b", "c"]]);
});

test("Text: nicht geschlossenes Anführungszeichen führt zu Hinweis statt Datenverlust", () => {
  const r = ok(leseTabellenText('a;"b\nc;d\n'));
  assert.deepEqual(r.zeilen, [["a", '"b'], ["c", "d"]]);
  assert.equal(r.hinweise.length, 1);
});

test("Text: leer, nur Leerzeichen, kein String", () => {
  nichtOk(leseTabellenText(""));
  nichtOk(leseTabellenText("  \n\t\n"));
  nichtOk(leseTabellenText(null));
  nichtOk(leseTabellenText(42));
});

test("Text: Grenzen für Zeilen und Spalten", () => {
  const viele = Array.from({ length: 2500 }, (_, i) => `z${i};${i}`).join("\n");
  const r = ok(leseTabellenText(viele));
  assert.equal(r.zeilen.length, 2000);
  assert.equal(r.zeilen[1999][0], "z1999");
  assert.match(r.hinweise[0], /2000/);

  const breit = Array.from({ length: 70 }, (_, i) => `s${i}`).join("\t");
  const r2 = ok(leseTabellenText(breit + "\n" + breit));
  assert.equal(r2.zeilen[0].length, 60);
  assert.match(r2.hinweise[0], /60 Spalten/);
});

test("Text: größer als 5 MB wird abgelehnt", () => {
  nichtOk(leseTabellenText("a;b\n".repeat(1400000)), /5 MB/);
});

test("Zahlenformatierung ohne Gleitkomma-Artefakte", () => {
  assert.equal(formatiereZahl(0.1 + 0.2), "0,3");
  assert.equal(formatiereZahl(42), "42");
  assert.equal(formatiereZahl(-1.5), "-1,5");
  assert.equal(formatiereZahl(1 / 3), "0,333333333333333");
  assert.equal(formatiereZahl(NaN), "");
});
