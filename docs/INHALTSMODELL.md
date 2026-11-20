# Inhaltsmodell der ESV-Website (verbindlich)

Alle Inhalte der Website liegen als JSON-Dateien unter `inhalt/`. `node build.mjs` erzeugt daraus die fertige
Seite in `_site/`. Diese Beschreibung ist die Grundlage für die CMS-Formulare (Pages CMS, `.pages.yml`):
**jedes Feld, das das Bauskript liest, steht hier – und nur diese.** Die maschinenlesbare Fassung derselben
Liste steht in `lib/schema.mjs`; `node build.mjs --pruefen` meldet Felder, die dort nicht vorkommen.

## Allgemeine Regeln

| Regel | Bedeutung |
|---|---|
| Format | JSON, UTF-8 ohne BOM, Zeilenende LF – genau so, wie Pages CMS beim Speichern schreibt: 2 Leerzeichen Einrückung, jedes Objekt mehrzeilig, Schlüssel in der Reihenfolge der Formularfelder, **kein** Zeilenumbruch am Dateiende. Von Hand geänderte Dateien danach mit `node tools/pagescms/normalisiere-inhalt.mjs` in diese Form bringen, sonst zeigt die nächste Speicherung im CMS lauter Formatierungs-Änderungen. |
| Feldnamen | nur `a-z`, `A-Z`, `0-9`, `_`, `-`; deutsch, klein, ASCII (`ueberschrift`, `link_ziel`). |
| Leer = weglassen | Fehlt ein Feld oder ist es leer (`""`, `[]`, `null`), wird die Stelle weggelassen – nie ein Absturz. Leerer Fließtext aus dem CMS (`"<p></p>"`, `"<p><br></p>"`, nur Leerraum/`&nbsp;`) gilt ebenso als leer. |
| Speichern im CMS | Pages CMS lässt Schlüssel mit leerem Text `""` weg, schreibt leere Fließtextfelder als `"<p></p>"` und setzt in Auswahl-/Ja-Nein-Felder ihren Standardwert. Das ändert die gebaute Seite nicht (nachgebildet in `tools/pagescms/speichern.mjs`, belegt durch Test `tools/tests/pagescms-speichern.test.mjs`). |
| Bausteinlisten | `bausteine` ist ein Array von Objekten; jedes hat den Schlüssel `_block` (Art des Bausteins). Keine Bausteine in Bausteinen – nur Listen einfacher Objekte. |
| Unbekanntes | Unbekannte `_block`-Arten werden mit Warnung übersprungen; unbekannte Felder werden ignoriert (`--pruefen` meldet sie). |

### Feldarten

| Art | Speicherung | Ausgabe |
|---|---|---|
| **Text** | Zeichenkette ohne HTML | wird HTML-escaped; geschütztes Leerzeichen (U+00A0) bleibt und wird als `&nbsp;` ausgegeben. |
| **Fließtext** | HTML wie von einem WYSIWYG-Editor (TipTap) geschrieben: `<p>`, `<strong>`, `<em>`, `<a href>`, `<ul>/<ol><li><p>…`, `<br>`, `<h2>`/`<h3>` – ohne Klassen, ohne `style`. | wird gesäubert (s. u.). |
| **Fließtext (einzeilig)** | wie Fließtext | ein einzelnes `<p>` wird ausgepackt, mehrere Absätze werden mit `<br>` verbunden (für Hinweis, Listenpunkt, Wert/Zusatz). |
| **Bildpfad** | Pfad mit führendem Schrägstrich, z. B. `/medien/bilder/halle.jpg` | Datei muss unter `medien/`, `assets/` oder `statisch/` liegen. Breite/Höhe werden aus der Datei gelesen (png, jpg, webp, gif, svg). Liegt daneben eine gleichnamige `.webp`, wird sie zusätzlich angeboten. Fehlt die Datei: Stelle weg + Warnung. |
| **Dateipfad** | Pfad mit führendem Schrägstrich, z. B. `/medien/tabellen/aufstellung.xlsx` | `.xlsx` oder `.csv`; gelesen über `lib/tabellenleser.mjs`. |
| **Linkziel** | Text: `training.html`, `kontakt.html#sponsoring`, `#anker`, `https://…`, `mailto:…`, `tel:…` | andere Schemata (z. B. `javascript:`) → Link/Knopf entfällt. Fremde `http(s)`-Adressen öffnen in neuem Tab (`target="_blank" rel="noopener"`). |
| **Auswahl** | einer der genannten Werte (Text) | ungültiger Wert → Standard. |
| **Ja/Nein** | `true` / `false` | fehlt → Standard. |
| **Liste** | Array | leere Einträge werden übersprungen. |

### Säuberung von Fließtext

- Erlaubte Tags: `p`, `br`, `strong`/`b` (→ `<b>`), `em`/`i` (→ `<em>`), `a`, `ul`, `ol`, `li`, `h2`, `h3`, `h4`
  (`h1` → `h2`, `h5`/`h6` → `h4`). Einziges erlaubtes Attribut: `href` an `a`.
- Andere Tags werden entfernt, ihr Text bleibt (`div`/`blockquote` werden zu Absätzen). `script`, `style`,
  `iframe`, `object`, `embed`, `svg`, `form`, `button`, `video`, `audio` u. ä. fliegen samt Inhalt raus.
- `href` nur `http(s):`, `mailto:`, `tel:`, relative Pfade, `#anker`; sonst wird der Link entfernt (Text bleibt).
- Links bekommen `class="textlink"`; fremde `http(s)`-Adressen zusätzlich `target="_blank" rel="noopener"`.
- Leere Absätze werden entfernt, `<li><p>x</p></li>` wird zu `<li>x</li>`.
- Leerraum am Rand von Fett, Kursiv und Link wird nach außen gezogen (`<strong>Wirtschaft </strong>oder` →
  `<b>Wirtschaft</b> oder`; entsteht, wenn ein Doppelklick das Leerzeichen mitmarkiert).

## Dateien

```
inhalt/einstellungen.json        Verein, Menü, Fußzeile, Design          (pflegt Heinz)
inhalt/technik.json              Basis-Adresse, JSON-LD                  (pflegt Heinz NICHT)
inhalt/seiten/<name>.json        die 8 festen Seiten                      (pflegt Heinz)
inhalt/weitere-seiten/<name>.json  neue Seiten (Dateiname = Adresse)     (pflegt Heinz)
inhalt/turniere/vereinsmeisterschaft.json, facklerpokal.json  Jahrgänge  (pflegt Heinz)
medien/bilder/                   Bild-Uploads
medien/tabellen/                 Excel-/CSV-Uploads
statisch/                        wird 1:1 in die Wurzel von _site kopiert (IndexNow-Schlüssel)
```

Feste Seiten (Name → Datei `inhalt/seiten/<name>.json` → Ausgabe `<name>.html`):
`index`, `mannschaften`, `training`, `historie`, `vereinsmeisterschaft`, `kontakt`, `impressum`, `datenschutz`.
Weitere Seiten: Dateiname nur `a-z`, `0-9`, `-` (z. B. `jugend-news.json` → `jugend-news.html`); Namen der
festen Seiten sind nicht erlaubt.

---

## inhalt/einstellungen.json

| Feld | Art | Bedeutung | Standard |
|---|---|---|---|
| `verein.name` | Text | Vereinsname im Seitenkopf (fett) | – |
| `verein.abteilung` | Text | Zeile unter dem Namen im Seitenkopf | – |
| `verein.logo` | Bildpfad | Wappen im Seitenkopf, in der Fußzeile und als Favicon | – (ohne Logo kein Bild) |
| `verein.logo_alt` | Text | Alternativtext des Logos im Seitenkopf | – |
| `kopf_button.text` | Text | goldener Knopf rechts im Seitenkopf | – (ohne Text kein Knopf) |
| `kopf_button.ziel` | Linkziel | Ziel des Knopfs | – |
| `menue` | Liste | Hauptnavigation, Reihenfolge = Anzeige | – |
| `menue[].titel` | Text | Menüpunkt | – |
| `menue[].ziel` | Linkziel | Ziel; ist es `<seite>.html` der gerade gebauten Seite, bekommt der Punkt `aria-current="page"` | – |
| `fusszeile.text` | Text | Satz unter dem Logo in der Fußzeile | – |
| `fusszeile.logo_alt` | Text | Alternativtext des Logos in der Fußzeile | – |
| `fusszeile.spalten` | Liste | Linkspalten der Fußzeile | – |
| `fusszeile.spalten[].titel` | Text | Spaltenüberschrift | – |
| `fusszeile.spalten[].links` | Liste | Einträge der Spalte | – |
| `fusszeile.spalten[].links[].text` | Text | angezeigter Text | – |
| `fusszeile.spalten[].links[].ziel` | Linkziel | leer = reiner Text ohne Link | `""` |
| `fusszeile.copyright` | Text | Zeile unten links; Platzhalter `{jahr}` = aktuelles Jahr beim Bauen | – |
| `fusszeile.rechtliche_links` | Liste | Links unten rechts, mit „ · “ verbunden (Impressum, Datenschutz) | – |
| `fusszeile.rechtliche_links[].text` | Text | angezeigter Text | – |
| `fusszeile.rechtliche_links[].ziel` | Linkziel | Ziel | – |
| `vorschaubild` | Bildpfad | Vorschaubild für soziale Netzwerke (`og:image`, absolut mit `basis_url`) | – |
| `design.farbschema` | Auswahl: `petrol`, `nachtblau`, `tannengruen`, `anthrazit` | Grundfarben der Seite; `petrol` = heutiger Stand | `petrol` |
| `design.akzentfarbe` | Text (Hex `#RRGGBB`) | Akzentfarbe (Knöpfe, Links, Linien); hellere/dunklere Variante wird berechnet. Leer = Gold wie heute | `""` |

Beim Standard (`petrol`, Akzent leer) wird **kein** zusätzliches CSS ausgegeben. Sonst steht im `<head>` ein
kleines `<style>` mit überschriebenen CSS-Variablen. Ungültige Werte → Standard + Warnung.

## inhalt/technik.json (nicht im CMS)

| Feld | Art | Bedeutung | Standard |
|---|---|---|---|
| `basis_url` | Text | Adresse der Seite ohne Schrägstrich am Ende; für canonical, og:image, Sitemap, robots.txt | `https://esv-tischtennis.pages.dev` |
| `theme_color` | Text | `<meta name="theme-color">` | – (weglassen) |
| `strukturierte_daten` | JSON-Objekt | JSON-LD, nur auf der Startseite ausgegeben (unverändert) | – |
| `impressum_zusatz_html` | HTML (unverändert, ohne Säuberung) | fester Abschnitt „Website“ (Hinweis auf den Ersteller); wird am Ende des letzten Freitext-Bausteins der Seite `impressum` angehängt; im CMS nicht änderbar | – |
| `sitemap_prioritaeten` | JSON-Objekt `{ "<seitenname>": "0.8" }` | Ersatzwert, falls eine Seite kein `sitemap_prioritaet` hat | – (dann `0.5`) |

## Seite (inhalt/seiten/*.json und inhalt/weitere-seiten/*.json)

| Feld | Art | Bedeutung | Standard |
|---|---|---|---|
| `browsertitel` | Text | kompletter `<title>`, zugleich `og:title` | `menue_titel` |
| `beschreibung` | Text | Meta-Description, zugleich `og:description` | – |
| `menue_titel` | Text | Kurzname für die Brotkrumen-Zeile „Start / …“ und – bei weiteren Seiten mit `im_menue` – der Menüpunkt. Der `menue_titel` der Startseite ist der Text des „Start“-Links. | – |
| `sitemap_prioritaet` | Auswahl: `1.0`, `0.9`, `0.8`, `0.7`, `0.6`, `0.5`, `0.4`, `0.3`, `0.2`, `0.1` | Priorität in `sitemap.xml` | `0.5` |
| `im_menue` | Ja/Nein | **nur weitere Seiten:** Seite ans Hauptmenü anhängen (falls nicht schon in `menue`) | `false` |
| `kopf` | Objekt | Kopfbereich – Startseite (`index`) = großer Kopf, alle anderen = einfacher Kopf | – |
| `bausteine` | Liste von Bausteinen | Inhalt der Seite in Reihenfolge | `[]` |

### Großer Kopf (nur `inhalt/seiten/index.json`)

| Feld | Art | Bedeutung |
|---|---|---|
| `kopf.kicker` | Text | kleine Zeile über der Überschrift |
| `kopf.ueberschrift` | Text | große Überschrift (h1) |
| `kopf.text` | Fließtext | Einleitung (jeder Absatz als `hero-lead`) |
| `kopf.buttons` | Liste | Knöpfe unter dem Text |
| `kopf.buttons[].text` | Text | Knopftext |
| `kopf.buttons[].ziel` | Linkziel | Ziel |
| `kopf.buttons[].stil` | Auswahl: `gold`, `rahmen` | gefüllt gold / nur Rahmen (Standard `gold`) |
| `kopf.fakten` | Liste | Faktenzeile unter den Knöpfen; jeder Eintrag ein Fakt |
| `kopf.fakten[].vor` | Text | Text vor dem fetten Teil (ohne `fett`: der ganze Fakt) |
| `kopf.fakten[].fett` | Text | fett hervorgehobener Teil |
| `kopf.fakten[].nach` | Text | Text nach dem fetten Teil |
| `kopf.bild` | Bildpfad | Hintergrundbild |
| `kopf.bild_beschreibung` | Text | Beschreibung des Hintergrundbilds (für Screenreader) |
| `kopf.karte.titel` | Text | Überschrift der Infokarte rechts |
| `kopf.karte.zeilen` | Liste | Zeilen der Karte |
| `kopf.karte.zeilen[].fett` | Text | fette Zeile (z. B. „Erwachsene“) |
| `kopf.karte.zeilen[].text` | Text | Zeile darunter |
| `kopf.karte.fuss_text` | Text | kleiner Text unten links in der Karte |
| `kopf.karte.fuss_link_text` | Text | Link unten rechts in der Karte |
| `kopf.karte.fuss_link_ziel` | Linkziel | Ziel dieses Links |

### Einfacher Kopf (alle anderen Seiten)

| Feld | Art | Bedeutung |
|---|---|---|
| `kopf.ueberschrift` | Text | Überschrift (h1); Brotkrumen-Zeile kommt automatisch aus `menue_titel` |
| `kopf.text` | Fließtext | Einleitung |
| `kopf.bild` | Bildpfad | optionales Hintergrundbild (abgedunkelt); leer = Farbverlauf wie heute |

---

## Bausteine

Gemeinsame Felder (wo in der Tabelle des Bausteins genannt):

| Feld | Art | Bedeutung | Standard |
|---|---|---|---|
| `_block` | Text (fest) | Art des Bausteins | – (Pflicht) |
| `hintergrund` | Auswahl: `normal`, `abgesetzt` | `abgesetzt` = dunklere Fläche mit Linien oben/unten | `normal` |
| `anker` | Text | id des Abschnitts zum Anspringen (`training.html#hallen`); nur `A-Z a-z 0-9 _ -` | – |
| `kicker` | Text | kleine goldene Zeile über der Überschrift | – |
| `ueberschrift` | Text | Abschnittsüberschrift (h2) | – |

### 1. `text_mit_kasten`
Fließtext, Punkteliste, Knopf; rechts ein Kasten. Ohne Kasten-Inhalt einspaltig.
Felder: `_block`, `hintergrund`, `anker`, `kicker`, `ueberschrift` und:

| Feld | Art | Bedeutung |
|---|---|---|
| `text` | Fließtext | Absätze |
| `punkte` | Liste von Fließtext (einzeilig) | Punkteliste mit goldenen Punkten |
| `button_text` | Text | Knopf unter dem Text |
| `button_ziel` | Linkziel | Ziel des Knopfs |
| `button_stil` | Auswahl: `gold`, `rahmen` | Standard `gold` |
| `kasten.kicker` | Text | kleine Zeile oben im Kasten |
| `kasten.infos` | Liste | Begriff/Wert-Paare |
| `kasten.infos[].begriff` | Text | kleine goldene Bezeichnung |
| `kasten.infos[].wert` | Fließtext (einzeilig) | Wert (fett) |
| `kasten.infos[].zusatz` | Fließtext (einzeilig) | kleine Zeile unter dem Wert |
| `kasten.liste` | Liste von Text | schlichte Liste (z. B. Partner) |
| `kasten.hinweis` | Fließtext (einzeilig) | kleiner Hinweis unten im Kasten |

### 2. `karten`
Kartenraster. Felder: `_block`, `hintergrund`, `anker`, `kicker`, `ueberschrift` und:

| Feld | Art | Bedeutung | Standard |
|---|---|---|---|
| `link_rechts_text` | Text | Link rechts neben der Überschrift | – |
| `link_rechts_ziel` | Linkziel | Ziel dieses Links | – |
| `spalten` | Auswahl: `2`, `3` | Karten pro Reihe (am Handy 1) | `3` |
| `raster` | Auswahl: `standard`, `turniere` | `turniere` = 2 breite Karten, schon ab Tablet untereinander (Historie) | `standard` |
| `karten` | Liste | die Karten | – |
| `karten[].zwischentitel_davor` | Text | beginnt vor dieser Karte eine neue Reihe mit eigener Zwischenüberschrift (z. B. „Damen & Jugend“) | – |
| `karten[].kicker` | Text | kleine goldene Zeile oben in der Karte | – |
| `karten[].titel` | Text | Kartenüberschrift (h3) | – |
| `karten[].unterzeile` | Text | kleine graue Zeile unter dem Titel | – |
| `karten[].fettzeile` | Text | hervorgehobene Zeile (z. B. Straße) | – |
| `karten[].zeile2` | Text | Zeile darunter (z. B. PLZ/Ort) | – |
| `karten[].text` | Fließtext | Kartentext | – |
| `karten[].zeilen` | Liste | Zeilen mit Trennlinie (z. B. Trainingszeiten) | – |
| `karten[].zeilen[].fett` | Text | fette Bezeichnung | – |
| `karten[].zeilen[].text` | Text | Text darunter | – |
| `karten[].rangliste_titel` | Text | Überschrift einer Rangliste (z. B. „Sieger Einzel 2026“) | – |
| `karten[].rangliste` | Liste von Text | Plätze 1, 2, 3 … (Nummer automatisch, Platz 1 gold) | – |
| `karten[].bild` | Bildpfad | Bild oben in der Karte | – |
| `karten[].bild_alt` | Text | Beschreibung des Bilds | – |
| `karten[].link_text` | Text | Link unten in der Karte | – |
| `karten[].link_ziel` | Linkziel | Ziel des Links | – |
| `hinweise` | Liste von Fließtext (einzeilig) | kleine Hinweise unter den Karten | – |

### 3. `zahlenband`
Band mit großen Zahlen. Felder: `_block`, `anker` und:

| Feld | Art | Bedeutung |
|---|---|---|
| `zahlen` | Liste | Einträge (auf großen Bildschirmen 5 pro Reihe) |
| `zahlen[].zahl` | Text | große Zahl („50+“) |
| `zahlen[].text` | Text | Beschriftung |

### 4. `aufruf`
Band am Seitenende. Felder: `_block`, `anker` und:

| Feld | Art | Bedeutung |
|---|---|---|
| `ueberschrift` | Text | Überschrift |
| `text` | Fließtext | kurzer Text |
| `button_text` | Text | goldener Knopf rechts |
| `button_ziel` | Linkziel | Ziel des Knopfs |

### 5. `zeitleiste`
Felder: `_block`, `hintergrund`, `anker`, `kicker`, `ueberschrift` und:

| Feld | Art | Bedeutung |
|---|---|---|
| `eintraege` | Liste | Einträge der Zeitleiste |
| `eintraege[].jahr` | Text | Jahr/Zeitraum links („bis 2020“) |
| `eintraege[].titel` | Text | fette Zeile |
| `eintraege[].text` | Fließtext | Text |

### 6. `ehrentafel`
Felder: `_block`, `hintergrund`, `anker`, `kicker`, `ueberschrift` und:

| Feld | Art | Bedeutung |
|---|---|---|
| `text` | Fließtext | Einleitung (grau, schmal) |
| `gruppen` | Liste | Gruppen von Kacheln |
| `gruppen[].titel` | Text | Gruppenüberschrift (gold) |
| `gruppen[].eintraege` | Liste | Kacheln |
| `gruppen[].eintraege[].zahl` | Text | große Zahl |
| `gruppen[].eintraege[].name` | Text | Name |
| `gruppen[].eintraege[].zusatz` | Text | kleine Zeile unter dem Namen („Einzeltitel“) |

### 7. `turnierarchiv`
Reiter mit Suchfeld. Die festen Reiter **Vereinsmeisterschaft** und **Facklerpokal** kommen immer aus
`inhalt/turniere/*.json` (fehlt eine Datei, fehlt der Reiter). Felder: `_block`, `hintergrund`, `anker`,
`kicker`, `ueberschrift` und:

| Feld | Art | Bedeutung | Standard |
|---|---|---|---|
| `suchfeld_text` | Text | Platzhalter im Suchfeld | „Name oder Jahr suchen …“ |
| `kein_treffer_text` | Text | Text, wenn die Suche nichts findet | „Kein Treffer – probier einen anderen Namen oder ein anderes Jahr.“ |
| `hinweis` | Fließtext (einzeilig) | Hinweis unter den Tabellen | – |
| `weitere_reiter` | Liste | zusätzliche Reiter | – |
| `weitere_reiter[].titel` | Text | Reiterbeschriftung | „Tabelle n“ |
| `weitere_reiter[].excel` | Dateipfad | Excel-/CSV-Datei (erste Zeile = Kopf, 1. Spalte gold, 2. Spalte fett) | – |
| `weitere_reiter[].eingefuegt` | Text (mehrzeilig) | aus Excel kopierter Text (Tab-, Semikolon- oder Komma-getrennt); nur wenn `excel` leer | – |

### 8. `kontakt`
Links Kontaktangaben, rechts Formular (öffnet das E-Mail-Programm, `mailto:`). Felder: `_block`,
`hintergrund`, `anker`, `kicker`, `ueberschrift` und:

| Feld | Art | Bedeutung | Standard |
|---|---|---|---|
| `infos` | Liste | Begriff/Wert-Paare im Kasten | – |
| `infos[].begriff` | Text | Bezeichnung | – |
| `infos[].wert` | Fließtext (einzeilig) | Wert | – |
| `infos[].zusatz` | Fließtext (einzeilig) | kleine Zeile(n) darunter | – |
| `formular_titel` | Text | Überschrift über dem Formular | – |
| `formular_text` | Fließtext (einzeilig) | Satz unter der Überschrift | – |
| `formular_empfaenger` | Text (E-Mail-Adresse) | Empfänger; leer/ungültig = kein Formular | – |
| `formular_button` | Text | Knopftext | „Nachricht senden“ |
| `formular_hinweis` | Fließtext (einzeilig) | kleiner Hinweis unter dem Formular | – |

### 9. `zwei_spalten`
Zwei (oder mehr) Spalten nebeneinander. Felder: `_block`, `hintergrund`, `anker` und:

| Feld | Art | Bedeutung | Standard |
|---|---|---|---|
| `spalten` | Liste | Spalten | – |
| `spalten[].anker` | Text | id zum Anspringen (sitzt auf dem Kicker, sonst auf der Überschrift) | – |
| `spalten[].kicker` | Text | kleine goldene Zeile | – |
| `spalten[].ueberschrift` | Text | Überschrift (h2) | – |
| `spalten[].einleitung` | Fließtext | grauer Einleitungstext | – |
| `spalten[].text` | Fließtext | normaler Text | – |
| `spalten[].button_text` | Text | Knopf | – |
| `spalten[].button_ziel` | Linkziel | Ziel des Knopfs | – |
| `spalten[].button_stil` | Auswahl: `gold`, `rahmen` | | `gold` |

### 10. `freitext`
Langer Text mit Überschriften und Listen (Impressum, Datenschutz, Neuigkeiten). Felder: `_block`,
`hintergrund`, `anker`, `kicker`, `ueberschrift` und:

| Feld | Art | Bedeutung |
|---|---|---|
| `text` | Fließtext | Inhalt (h2/h3, Absätze, Listen, Links) |
| `hinweis` | Fließtext (einzeilig) | kleiner Hinweis am Ende (z. B. „Stand: …“) |

### 11. `tabelle`
Tabelle im Stil der Turniertabellen. Felder: `_block`, `hintergrund`, `anker`, `kicker`, `ueberschrift` und:

| Feld | Art | Bedeutung | Standard |
|---|---|---|---|
| `text` | Fließtext | Text über der Tabelle | – |
| `excel` | Dateipfad | hochgeladene `.xlsx`/`.csv` (hat Vorrang vor `eingefuegt`) | – |
| `eingefuegt` | Text (mehrzeilig) | aus Excel kopierter Text (Tab-, Semikolon- oder Komma-getrennt) | – |
| `kopfzeile` | Ja/Nein | erste Zeile ist Spaltenkopf | `true` |
| `erste_spalte_fett` | Ja/Nein | erste Spalte hervorheben | `false` |
| `suchfeld` | Ja/Nein | Suchfeld über der Tabelle | `false` |
| `hinweis` | Fließtext (einzeilig) | kleiner Hinweis unter der Tabelle | – |

Kann die Tabelle nicht gelesen werden, steht an der Stelle „Diese Tabelle konnte nicht gelesen werden – bitte die
Datei prüfen.“ (die Bau-Ausgabe nennt den Grund); der Rest der Seite wird normal gebaut.

### 12. `bilder`
Bilderraster. Felder: `_block`, `hintergrund`, `anker`, `kicker`, `ueberschrift` und:

| Feld | Art | Bedeutung | Standard |
|---|---|---|---|
| `text` | Fließtext | Text über den Bildern | – |
| `spalten` | Auswahl: `1`, `2`, `3` | Bilder pro Reihe (am Handy 1) | `3` |
| `bilder` | Liste | Bilder | – |
| `bilder[].bild` | Bildpfad | Bild (wird nie größer als die Originaldatei angezeigt) | – |
| `bilder[].beschreibung` | Text | Alternativtext (für Screenreader/Google) | – |
| `bilder[].unterschrift` | Text | sichtbare Bildunterschrift | – |

---

## Turnierdaten

### inhalt/turniere/vereinsmeisterschaft.json

| Feld | Art | Bedeutung | Standard |
|---|---|---|---|
| `titel` | Text | Reiterbeschriftung und Anfang der Tabellenunterschrift | – |
| `zusatz` | Text | Mittelteil der Unterschrift („Einzel und Doppel“) | – |
| `excel` | Dateipfad | gesetzt → die Datei ersetzt `jahrgaenge` (Spalten der Reihe nach: Jahr, 1., 2., 3. Platz, Doppel; erste Zeile = Kopf) | `""` |
| `spaltentitel.jahr` / `.platz1` / `.platz2` / `.platz3` / `.doppel` | Text | Spaltenköpfe | „Jahr“, „Einzel 1. Platz“, „2. Platz“, „3. Platz“, „Doppel-Sieger“ |
| `jahrgaenge` | Liste | Reihenfolge egal: der Bau sortiert stabil nach `jahr` absteigend (neuester oben; gleiche Jahre behalten ihre Reihenfolge; Einträge ohne lesbare Jahreszahl ans Ende). Eine Excel-Datei (`excel`) wird nicht sortiert | – |
| `jahrgaenge[].jahr` | Text | Jahr | – |
| `jahrgaenge[].platz1` | Text (mehrzeilig) | Einzel-Sieger (fett) | – |
| `jahrgaenge[].platz2` | Text (mehrzeilig) | 2. Platz | – |
| `jahrgaenge[].platz3` | Text (mehrzeilig) | 3. Platz | – |
| `jahrgaenge[].doppel` | Text (mehrzeilig) | Doppel-Sieger (fett) | – |

### inhalt/turniere/facklerpokal.json

| Feld | Art | Bedeutung | Standard |
|---|---|---|---|
| `titel` | Text | wie oben | – |
| `zusatz` | Text | wie oben („Doppelturnier“) | – |
| `excel` | Dateipfad | wie oben (Spalten: Jahr, Siegerdoppel, 2. Platz) | `""` |
| `spaltentitel.jahr` / `.sieger` / `.zweiter` | Text | Spaltenköpfe | „Jahr“, „Siegerdoppel“, „2. Platz“ |
| `jahrgaenge` | Liste | Reihenfolge egal: der Bau sortiert stabil nach `jahr` absteigend (neuester oben; gleiche Jahre behalten ihre Reihenfolge; Einträge ohne lesbare Jahreszahl ans Ende). Eine Excel-Datei (`excel`) wird nicht sortiert | – |
| `jahrgaenge[].jahr` | Text | Jahr | – |
| `jahrgaenge[].sieger` | Text (mehrzeilig) | Siegerdoppel (fett) | – |
| `jahrgaenge[].zweiter` | Text (mehrzeilig) | 2. Platz | – |

Regeln: leeres Feld = „—“ (Zelle mit Klasse `none`); Zeilenumbruch im Feld = zwei Paarungen untereinander (`<br>`).
Die Tabellenunterschrift wird berechnet: `<titel> <ältestes>–<neuestes Jahr> · <zusatz> · <Anzahl> Jahrgänge`.
Suchtext (`data-s`) und Klassen (`year`, `win`, `none`) entstehen automatisch.

## Bauen und Prüfen

```
node build.mjs             # baut _site/ (Exit 0 auch bei Warnungen; ≠ 0 nur, wenn die Startseite nicht baubar ist)
node build.mjs --pruefen   # zusätzlich: unbekannte Felder, falsche Werte, fehlende Dateien, tote interne Links
```

`_site/` enthält: je Seite `<name>.html`, `styles.css`, `assets/`, `medien/`, den Inhalt von `statisch/`,
`sitemap.xml` (saubere Adressen ohne `.html`) und `robots.txt`.

Schnittstelle des Tabellenlesers (`lib/tabellenleser.mjs`): `leseTabellenDatei(pfad)` und `leseTabellenText(text)`
liefern `{ ok: true, zeilen: string[][], hinweise: string[] }` oder `{ ok: false, fehler: "…" }`. Fehlt das Modul,
gilt jede Tabelle als „nicht lesbar“.
