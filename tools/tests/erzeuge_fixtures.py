"""Erzeugt die Test-Fixtures für lib/tabellenleser.mjs.

Aufruf (openpyxl in einem venv außerhalb des Repos):
    python -m venv %TEMP%\\esv_fx_venv
    %TEMP%\\esv_fx_venv\\Scripts\\python -m pip install openpyxl
    %TEMP%\\esv_fx_venv\\Scripts\\python tools/tests/erzeuge_fixtures.py

Die erzeugten Dateien liegen in tools/tests/fixtures/ und werden eingecheckt,
damit die Node-Tests ohne Python laufen. excel_echt.xlsx stammt NICHT aus
diesem Skript (mit echtem Excel gespeichert) und wird hier nicht angefasst.
"""

import datetime as dt
import os
import zipfile

from openpyxl import Workbook

ZIEL = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures")
os.makedirs(ZIEL, exist_ok=True)


def pfad(name):
    return os.path.join(ZIEL, name)


def schreibe(name, daten):
    with open(pfad(name), "wb") as f:
        f.write(daten)


# ---------------------------------------------------------------- openpyxl

def grundtypen():
    wb = Workbook()
    ws = wb.active
    ws.title = "Ergebnisse"
    ws.append(["Name", "Ort", "Punkte", "Dezimal", "Quote", "Datum", "Uhrzeit", "Betrag", "Aktiv"])
    ws.append(["Jürgen Müßig", "Größenbach", 42, 3.5, 0.125, dt.date(2026, 3, 14), dt.time(19, 30), 12.5, True])
    ws.append(["  Ärger & <Spaß>  ", "Öhringen", -7, 0.1 + 0.2, 0.5, dt.datetime(2024, 2, 29), dt.time(8, 5), 1234.567, False])
    ws.append(["Zeile\nzwei", "Ünterort", 1000000, 2.675, 1, dt.date(1999, 12, 31), dt.time(23, 59, 59), 0, None])
    for zeile in range(2, 5):
        ws.cell(zeile, 5).number_format = "0.0%"
        ws.cell(zeile, 6).number_format = "DD.MM.YYYY"
        ws.cell(zeile, 7).number_format = "hh:mm"
        ws.cell(zeile, 8).number_format = "#,##0.00 €"
    # Sonderfälle 1900-System und eigene Datumsformate
    ws["A6"] = "Serie59"
    ws["B6"] = 59
    ws["B6"].number_format = "dd.mm.yyyy"
    ws["A7"] = "Serie60"
    ws["B7"] = 60
    ws["B7"].number_format = "dd.mm.yyyy"
    ws["A8"] = "Serie61"
    ws["B8"] = 61
    ws["B8"].number_format = "dd.mm.yyyy"
    ws["A9"] = "Langes Datum"
    ws["B9"] = dt.date(2026, 11, 1)
    ws["B9"].number_format = '[$-407]dddd", "d. mmmm yyyy'
    ws["A10"] = "Datum mit Zeit"
    ws["B10"] = dt.datetime(2026, 5, 1, 14, 45)
    ws["B10"].number_format = "dd.mm.yyyy hh:mm"
    ws["A11"] = "Eingebautes Datum"
    ws["B11"] = dt.date(2026, 1, 2)
    ws["B11"].number_format = "mm-dd-yy"  # entspricht numFmtId 14
    wb.save(pfad("grundtypen.xlsx"))


def luecken():
    wb = Workbook()
    ws = wb.active
    ws["B3"] = "Mannschaft"
    ws["D3"] = "Liga"
    ws["B5"] = "Herren I"
    ws["E7"] = "ganz rechts"
    ws["B9"] = "   "  # nur Leerzeichen -> leer
    wb.save(pfad("luecken.xlsx"))


def versteckt():
    wb = Workbook()
    geheim = wb.active
    geheim.title = "Geheim"
    geheim["A1"] = "nicht lesen"
    geheim.sheet_state = "hidden"
    sichtbar = wb.create_sheet("Tabelle")
    sichtbar["A1"] = "sichtbar"
    sichtbar["B1"] = 1
    wb.create_sheet("Zweites")["A1"] = "auch sichtbar"
    wb.active = 1
    wb.save(pfad("versteckt.xlsx"))


def verbunden():
    wb = Workbook()
    ws = wb.active
    ws["A1"] = "Überschrift"
    ws.merge_cells("A1:C1")
    ws["A2"] = "a"
    ws["B2"] = "b"
    ws["C2"] = "c"
    ws["A3"] = "senkrecht"
    ws.merge_cells("A3:A4")
    ws["B4"] = "daneben"
    wb.save(pfad("verbunden.xlsx"))


def formel_openpyxl():
    wb = Workbook()
    ws = wb.active
    ws["A1"] = "Summe"
    ws["B1"] = "=1+2"  # openpyxl speichert keinen Wert -> leer
    wb.save(pfad("formel_ohne_wert.xlsx"))


def gross():
    wb = Workbook()
    ws = wb.active
    for z in range(1, 2006):
        ws.append([z * 100 + s for s in range(1, 63)])
    wb.save(pfad("gross.xlsx"))


# ---------------------------------------------------------------- von Hand

CT = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>"""

WURZEL_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>"""

WB_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="/xl/worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>"""

NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'


def workbook(date1904=False):
    pr = '<workbookPr date1904="1"/>' if date1904 else ""
    return f'<?xml version="1.0" encoding="UTF-8"?><workbook {NS}>{pr}<sheets><sheet name="Blatt" sheetId="1" r:id="rId1"/></sheets></workbook>'


STYLES = f"""<?xml version="1.0" encoding="UTF-8"?>
<styleSheet {NS}>
<numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy;@"/></numFmts>
<cellStyleXfs count="1"><xf numFmtId="14"/></cellStyleXfs>
<cellXfs count="4"><xf numFmtId="0"/><xf numFmtId="164"/><xf numFmtId="20"/><xf numFmtId="10"/></cellXfs>
</styleSheet>"""


def baue_xlsx(name, sheet, shared=None, date1904=False, methode=zipfile.ZIP_DEFLATED):
    with zipfile.ZipFile(pfad(name), "w", methode) as z:
        z.writestr("[Content_Types].xml", CT)
        z.writestr("_rels/.rels", WURZEL_RELS)
        z.writestr("xl/workbook.xml", workbook(date1904))
        z.writestr("xl/_rels/workbook.xml.rels", WB_RELS)
        z.writestr("xl/styles.xml", STYLES)
        if shared is not None:
            z.writestr("xl/sharedStrings.xml", f'<?xml version="1.0" encoding="UTF-8"?><sst {NS}>{shared}</sst>')
        z.writestr("xl/worksheets/sheet1.xml", f'<?xml version="1.0" encoding="UTF-8"?><worksheet {NS}><sheetData>{sheet}</sheetData></worksheet>')


def handgebaut():
    shared = (
        "<si><t>einfach</t></si>"
        '<si><r><rPr><b/></rPr><t>Fett</t></r><r><t xml:space="preserve"> und </t></r><r><rPr><i/></rPr><t>kursiv</t></r></si>'
        "<si><t>Tom &amp; Jerry &lt;3 &#252;ber &#x00C4;</t><rPh sb=\"0\" eb=\"1\"><t>LESUNG</t></rPh></si>"
        "<si><t>Zeile_x000D_\n2</t></si>"
    )
    sheet = (
        # Zeile 1: gemeinsame Texte, Rich-Text
        '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c></row>'
        # Zeile 2: inlineStr, auch mit Läufen, Wahrheitswerte, Fehler
        '<row r="2"><c r="A2" t="inlineStr"><is><t>inline Ä</t></is></c>'
        '<c r="B2" t="inlineStr"><is><r><t>teil</t></r><r><t>weise</t></r></is></c>'
        '<c r="C2" t="b"><v>1</v></c><c r="D2" t="b"><v>0</v></c><c r="E2" t="e"><v>#DIV/0!</v></c></row>'
        # Zeile 3: Formeln: mit Wert, ohne Wert, Text-Ergebnis, Fehler-Ergebnis
        '<row r="3"><c r="A3"><f>1+2</f><v>3</v></c><c r="B3"><f>SUMME(A1:A2)</f></c>'
        '<c r="C3" t="str"><f>"a"&amp;"b"</f><v>ab</v></c><c r="D3" t="e"><f>1/0</f><v>#DIV/0!</v></c></row>'
        # Zeile ohne r, Zellen ohne r
        "<row><c t=\"inlineStr\"><is><t>ohne r 1</t></is></c><c><v>2.5</v></c><c r=\"E4\"><v>7</v></c><c><v>8</v></c></row>"
        # Zeile 6 (Lücke Zeile 5), Stile: eigenes Datum, Uhrzeit, Prozent mit 2 Stellen, ISO-Datum
        '<row r="6"><c r="A6" s="1"><v>45000</v></c><c r="B6" s="2"><v>0.5</v></c><c r="C6" s="3"><v>0.1234</v></c>'
        '<c r="D6" t="d"><v>2026-07-04T00:00:00</v></c></row>'
    )
    baue_xlsx("handgebaut.xlsx", sheet, shared)
    # 1904-Datumssystem, ohne sharedStrings und unkomprimiert (Methode "stored")
    baue_xlsx(
        "datum1904.xlsx",
        '<row r="1"><c r="A1" s="1"><v>0</v></c><c r="B1" s="1"><v>43000</v></c></row>',
        None,
        date1904=True,
        methode=zipfile.ZIP_STORED,
    )
    # Präfix-Namensraum (x:) wie bei manchen Exportprogrammen
    with zipfile.ZipFile(pfad("praefix.xlsx"), "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", CT)
        z.writestr("_rels/.rels", WURZEL_RELS)
        xns = 'xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
        z.writestr("xl/workbook.xml", f'<x:workbook {xns}><x:sheets><x:sheet name="P" sheetId="1" r:id="rId1"/></x:sheets></x:workbook>')
        z.writestr("xl/_rels/workbook.xml.rels", WB_RELS)
        z.writestr("xl/worksheets/sheet1.xml", f'<x:worksheet {xns}><x:sheetData><x:row r="1"><x:c r="A1" t="inlineStr"><x:is><x:t>präfix</x:t></x:is></x:c><x:c r="B1"><x:v>1.5</x:v></x:c></x:row></x:sheetData></x:worksheet>')


def zip_bombe():
    # 60 MB Nullen im Arbeitsblatt, ehrlich angegeben -> Größenprüfung vor dem Entpacken
    sheet = f'<?xml version="1.0"?><worksheet {NS}><sheetData>' + " " * (60 * 1024 * 1024) + "</sheetData></worksheet>"
    with zipfile.ZipFile(pfad("bombe.xlsx"), "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", CT)
        z.writestr("_rels/.rels", WURZEL_RELS)
        z.writestr("xl/workbook.xml", workbook())
        z.writestr("xl/_rels/workbook.xml.rels", WB_RELS)
        z.writestr("xl/worksheets/sheet1.xml", sheet)
    # Dieselbe Datei mit gelogener Größe im Central Directory -> Entpack-Grenze greift
    daten = bytearray(open(pfad("bombe.xlsx"), "rb").read())
    name = b"xl/worksheets/sheet1.xml"
    i = 0
    while True:
        i = daten.find(b"PK\x01\x02", i)
        if i == -1:
            break
        nlen = int.from_bytes(daten[i + 28:i + 30], "little")
        if bytes(daten[i + 46:i + 46 + nlen]) == name:
            daten[i + 24:i + 28] = (1000).to_bytes(4, "little")
        i += 4
    schreibe("bombe_gelogen.xlsx", bytes(daten))


def sonstige():
    voll = open(pfad("grundtypen.xlsx"), "rb").read()
    schreibe("abgeschnitten.xlsx", voll[: len(voll) // 2])
    schreibe("kein_zip.xlsx", bytes((i * 37 + 11) % 256 for i in range(3000)))
    schreibe("text_als.xlsx", "Name;Wert\nAnna;1\n".encode("utf-8"))
    schreibe("alt.xls", bytes([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]) + bytes(504))
    schreibe("webseite.xls", b"<html><body><table><tr><td>1</td></tr></table></body></html>")
    with zipfile.ZipFile(pfad("libreoffice.ods"), "w") as z:
        z.writestr("mimetype", "application/vnd.oasis.opendocument.spreadsheet")
        z.writestr("content.xml", "<office:document-content/>")

    # CSV
    schreibe("semikolon.csv", "﻿Name;Punkte;Quote\r\nMüller, Hans;12;1,5\r\nÖzdemir;7;0,25\r\n".encode("utf-8"))
    schreibe("komma.csv", "Name,Punkte,Ort\nAnna,3,Köln\nBert,4,Düsseldorf\n".encode("utf-8"))
    schreibe("tab.csv", "Name\tPunkte\nAnna\t3\n\tleer davor\n".encode("utf-8"))
    schreibe(
        "anfuehrung.csv",
        'Name;Bemerkung;Zahl\n"Meier; Karl";"Er sagte ""Hallo""";1\n"Zwei\nZeilen";x;2\n'.encode("utf-8"),
    )
    schreibe("cp1252.csv", "Name;Größe;Preis\nJürgen;groß;5 €\nÄnne;klein;3 €\n".encode("cp1252"))
    schreibe("utf16.txt", "﻿A\tB\nÄ\tß\n".encode("utf-16-le"))


if __name__ == "__main__":
    grundtypen()
    luecken()
    versteckt()
    verbunden()
    formel_openpyxl()
    gross()
    handgebaut()
    zip_bombe()
    sonstige()
    print("Fixtures erzeugt in", ZIEL)
