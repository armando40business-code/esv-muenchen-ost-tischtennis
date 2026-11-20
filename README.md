# ESV München-Ost · Abteilung Tischtennis

Website der Tischtennis-Abteilung des ESV München-Ost e.V. – live unter https://esv-tischtennis.pages.dev

Design "V3 Petrol": dunkles Petrol/Gold, Inter und Bricolage Grotesque (selbst gehostet).

Alle Inhalte liegen als JSON-Dateien unter `inhalt/`. Ein kleines Bauskript (`build.mjs`, ohne
Abhängigkeiten) erzeugt daraus die fertige Seite in `_site/`. Gepflegt wird alles über Formulare in
[Pages CMS](https://app.pagescms.org) (Konfiguration: `.pages.yml`); jede Speicherung dort ist ein Commit auf
`main` und löst über GitHub Actions automatisch Bauen und Veröffentlichen aus.

Anleitung für den Pfleger der Seite (kein Technik-Wissen nötig): [`docs/ANLEITUNG-PFLEGE.md`](docs/ANLEITUNG-PFLEGE.md).

## Aufbau des Repos

```
.pages.yml                   Formulare für Pages CMS (Seitenleiste, Felder, Medien-Ordner)
build.mjs                    Einstieg: liest inhalt/, schreibt _site/
lib/                         Bau-Module (Vorlagen je Baustein, Fließtext-Säuberung, Tabellenleser, Bildgrößen, Design)
  schema.mjs                 maschinenlesbare Feldliste des Inhaltsmodells (Abgleich für --pruefen und die CMS-Prüfung)
inhalt/
  einstellungen.json         Verein, Menü, Fußzeile, Farben
  technik.json               Basis-Adresse, strukturierte Daten (NICHT im CMS, nur im Repository pflegen)
  seiten/<name>.json         die 8 festen Seiten (index, mannschaften, training, historie,
                             vereinsmeisterschaft, kontakt, impressum, datenschutz)
  weitere-seiten/            neue Seiten, die im CMS angelegt werden (Dateiname = Adresse)
  turniere/                  Jahrgangslisten Vereinsmeisterschaft und Facklerpokal
medien/bilder/               Bild-Uploads (Logo, Hallenbild, …) – im CMS als Medien "Bilder"
medien/tabellen/             Excel-/CSV-Uploads – im CMS als Medien "Tabellen (Excel)"
statisch/                    wird 1:1 in die Wurzel von _site kopiert (z. B. IndexNow-Schlüsseldatei)
assets/fonts/                selbst gehostete Schriften
styles.css                   Design-Tokens (:root) und alle Komponenten
docs/INHALTSMODELL.md        verbindliche Beschreibung jedes JSON-Felds
docs/ANLEITUNG-PFLEGE.md     Anleitung für den Pfleger der Seite
tools/                       Prüfwerkzeuge (nur lokal, nicht Teil des Baus)
.github/workflows/           automatisches Bauen, Testen, Veröffentlichen
_site/                       Ergebnis des Baus (nicht im Git)
```

Inhaltliche Details zu jedem Feld: [`docs/INHALTSMODELL.md`](docs/INHALTSMODELL.md).

## Bauen

Voraussetzung: Node.js ab Version 20 (lokal und in der Automatik: 24). Kein `npm install` nötig.

```
node build.mjs             # baut _site/ (Exit 0 auch bei Warnungen; ≠ 0 nur, wenn die Startseite nicht baubar ist)
node build.mjs --pruefen   # zusätzlich: unbekannte Felder, falsche Werte, fehlende Dateien, tote interne Links
```

Warnungen (z. B. ein gelöschtes Bild, das noch auf einer Seite steht: die Stelle wird weggelassen) stehen zusätzlich
je Zeile in `bau-warnungen.txt` neben `_site/` (nicht im Git). Die Automatik zeigt sie in der Zusammenfassung des Laufs
und als Warnung-Anmerkung.

`_site/` enthält je Seite `<name>.html`, `styles.css`, `assets/`, `medien/`, den Inhalt von `statisch/`,
`sitemap.xml` und `robots.txt`. Zum Ansehen: `_site/index.html` im Browser öffnen oder `npx serve _site`.

## Prüfen

Die Werkzeuge unter `tools/` laufen nur lokal. Einmalig für alles mit Bildschirmfotos und die CMS-Prüfungen:
`cd tools && npm install`.

| Befehl | Was er prüft | `npm install` nötig |
|---|---|---|
| `node --test "tools/tests/**/*.test.mjs"` | Leser für Excel/CSV, Fließtext (leere CMS-Felder, Fett mit Leerzeichen), Speicher-Nachbildung gegen echte Speicherungen aus Pages CMS (Testdateien in `tools/tests/fixtures/`; der CMS-Teil wird ohne `npm install` übersprungen) | nein (CMS-Teil: ja) |
| `node tools/pagescms/pruefe-config.mjs` | `.pages.yml` gegen das offizielle Konfigurations-Schema von Pages CMS (Version 2.1.8) plus eigene Regeln (Verweise, Medien-Ordner, deutsche Beschriftungen, keine Standardtexte, Bausteinliste, kein Hilfetext an Listen, Zeilentitel nie leer, Namen in der Seitenleiste höchstens 20 Zeichen) | ja (`zod`, `yaml`) |
| `node tools/pagescms/pruefe-inhalt.mjs` | jede Datei unter `inhalt/` gegen die Formulare (kein JSON-Schlüssel ohne Formularfeld, Auswahlwerte, Bildpfade), Formulare gegen `lib/schema.mjs` und `docs/INHALTSMODELL.md`, Trockenlauf "Öffnen und unverändert speichern" wie in der echten Oberfläche (nichts geht verloren, jede Datei steht schon in der Form da, die Pages CMS schreibt) | ja (`zod`, `yaml`) |
| `node tools/pagescms/normalisiere-inhalt.mjs` | schreibt alle Inhaltsdateien in genau die Form, die Pages CMS beim Speichern schreibt (nach Änderungen von Hand; `--pruefen` meldet nur) | ja (`yaml`) |
| `node tools/vergleich.mjs` | alter Stand (Commit `05db18e`) gegen neu: sichtbarer Text, Links, Bildquellen, Titel/Meta, JSON-LD | nein |
| `node tools/bildvergleich.mjs` | Bildschirmfotos alt gegen neu bei 1280 und 390 px (installiertes Chrome/Edge), Ergebnis in `tools/_vergleich/` | ja |
| `node tools/robustheit.mjs` | Bau mit absichtlich kaputtem Inhalt (leere Bausteine, fehlende Bilder, kaputte Excel-Datei, gefährliches HTML) in einer Wegwerf-Kopie | nein |
| `node tools/probeseite.mjs` | Probe-Seite aus `tools/probe/` (Tabelle aus Excel und eingefügtem Text, Bilder, Freitext) in einer Wegwerf-Kopie | ja (für die Bildschirmfotos) |
| `node tools/turniere-aus-altstand.mjs` | Einmal-Werkzeug: Turnierlisten aus dem alten HTML (Commit `05db18e`) in `inhalt/turniere/` übertragen | nein |

(`tools/testumgebung.mjs` ist nur ein Hilfsmodul für die Wegwerf-Kopien.)

**Nach jeder Änderung an `.pages.yml`, `inhalt/` oder `lib/schema.mjs`** beide CMS-Prüfungen laufen lassen. Beide
müssen "0 Fehler" bzw. "0 Abweichungen" melden. Das Wichtigste daran: Pages CMS schreibt beim Speichern nur Felder
zurück, die in `.pages.yml` stehen. Ein JSON-Schlüssel ohne Formularfeld ginge beim nächsten Speichern verloren.
Außerdem formatiert Pages CMS jede gespeicherte Datei neu (2 Leerzeichen, jedes Objekt mehrzeilig, kein Zeilenumbruch
am Ende, leere Texte entfallen, leere Fließtexte werden `"<p></p>"`). Wer `inhalt/` von Hand ändert, lässt danach
`node tools/pagescms/normalisiere-inhalt.mjs` laufen – sonst meldet `pruefe-inhalt` Schritt E eine Abweichung und die
nächste Speicherung im CMS zeigt lauter Formatierungs-Änderungen.
Die CMS-Prüfungen laufen bewusst nicht in der Automatik: Eine Eingabe im CMS soll die Veröffentlichung nie blockieren.

## Veröffentlichen

Automatisch: `.github/workflows/veroeffentlichen.yml`.

- Bei **jedem Push** und bei **Pull Requests**: `node build.mjs` und die Leser-Tests.
- Zusätzlich **nur bei Push auf `main`** (also auch bei jeder Speicherung in Pages CMS) und bei manuellem Start
  (GitHub → Actions → "Veröffentlichen" → "Run workflow", Zweig `main`):
  `wrangler pages deploy _site --project-name=esv-tischtennis --branch=main` (Wrangler fest auf 4.164.0 gepinnt).
- Schlägt Bau oder Test fehl, wird nichts veröffentlicht; die alte Fassung bleibt online.
- Warnungen des Baus (z. B. fehlendes Bild – die Seite geht trotzdem online) stehen in der Zusammenfassung des Laufs
  und als gelbe Warnung-Anmerkung (Quelle: `bau-warnungen.txt`).
- Fehlen die Secrets, scheitert der Lauf mit einer deutschen Meldung ("Zugangsdaten fehlen …").
- Mehrere schnelle Speicherungen: ein laufendes Veröffentlichen wird fertig, von den wartenden bleibt nur der neueste Stand.

Dauer vom Speichern bis online: etwa 1–2 Minuten.

Von Hand (Notfall, mit eigener Cloudflare-Anmeldung):
`node build.mjs && npx wrangler@4.164.0 pages deploy _site --project-name=esv-tischtennis --branch=main`.

GitHub Pages ist für dieses Repo bewusst abgeschaltet – sonst läuft die Seite unter der Domain des
`armando40business-code.github.io`-Repos (heydani.de) mit.

## Neue Baustein-Art ergänzen

Eine Baustein-Art ist ein Abschnitt, den man auf einer Seite hinzufügen kann (z. B. "Tabelle (Excel)"). Vier Stellen
müssen zusammenpassen; `node tools/pagescms/pruefe-inhalt.mjs` meldet, wenn eine fehlt.

1. **Bauskript – Vorlage:** In `lib/bausteine.mjs` eine Funktion `meineArt(b, ctx)` schreiben (liefert HTML oder `''`,
   wenn nichts anzuzeigen ist; Felder mit `txt`/`leer`/`liste`/`obj` lesen, Text mit `esc` escapen, Fließtext
   mit `ctx.ft(...)` bzw. `ctx.zl(...)`) und im Objekt `KATALOG` unter dem Schlüssel `meine_art` eintragen.
   Neue CSS-Regeln ans Ende von `styles.css`.
2. **Schema:** In `lib/schema.mjs` unter `BAUSTEINE` den Eintrag `meine_art: { …Felder… }` ergänzen
   (Arten: `text`, `fliesstext`, `bild`, `datei`, `janein`, `auswahl:a|b`, `liste:<art>`, `[ { … } ]` für Objekt-Listen).
3. **Formular:** In `.pages.yml` unter `components` → `bausteine` → `blocks` einen Eintrag mit `name: meine_art`,
   einem deutschen `label` und denselben Feldern ergänzen. Wiederverwendbare Felder per `component:` einbinden
   (`kicker`, `ueberschrift`, `anker`, `hintergrund`, `fliesstext`, `bild`, `tabelle_datei`, `link_ziel`, `knopf_stil`,
   `infos`). Fließtext immer über die Komponente `fliesstext` (speichert HTML, nicht Markdown). Auswahlfelder mit
   deutschen Beschriftungen, aber dem Wert aus dem Inhaltsmodell. Standardwerte nur bei Auswahl/Ja-Nein und nur,
   wenn sie dem Standard des Bauskripts entsprechen (Pages CMS setzt Standardwerte in jedes leere Feld ein).
   Keine Bausteine in Bausteinen. Jedes Feld braucht `label` und `description` (Deutsch, "du", sagt, was bei
   leerem Feld passiert, kurz) – **außer Listen** (`list:`): Deren Hilfetext zeigt Pages CMS unter jedem einzelnen
   Eintrag; das Wichtigste kommt dort als kurzer Halbsatz ins `label`. Einklappbare Listen bekommen eine `summary`
   mit festem Wort (z. B. `"Karte {index}: {titel}"`), weil Pages CMS leere Platzhalter einfach weglässt; keine
   Fließtextfelder in der `summary` (zeigten HTML).
4. **Dokumentation:** In `docs/INHALTSMODELL.md` einen Abschnitt ``### 13. `meine_art` `` mit Tabelle der Felder
   ergänzen (erste Spalte = Feldname in Backticks); die Baustein-Liste in `docs/ANLEITUNG-PFLEGE.md` anpassen.

Danach: `node build.mjs --pruefen`, `node tools/pagescms/pruefe-config.mjs`, `node tools/pagescms/pruefe-inhalt.mjs`,
`node tools/robustheit.mjs`. Neues Feld in einer **bestehenden** Art: dieselben vier Stellen, nur ohne neuen Eintrag.

## Einrichtung

Einmalig, damit Pages CMS und die automatische Veröffentlichung funktionieren.

**Cloudflare-Zugang für die Automatik**

1. Im Cloudflare-Dashboard ein API-Token erstellen (My Profile → API Tokens → Create Token → Custom token) mit der
   Berechtigung *Account* → *Cloudflare Pages* → *Edit* für das Konto, in dem das Projekt `esv-tischtennis` liegt.
2. Token kopieren (wird nur einmal angezeigt). Die Konto-ID steht im Cloudflare-Dashboard in der rechten
   Seitenleiste ("Account ID").
3. Im GitHub-Repository: Settings → Secrets and variables → Actions → "New repository secret", zwei Secrets anlegen:
   `CLOUDFLARE_API_TOKEN` (der Token) und `CLOUDFLARE_ACCOUNT_ID` (die Konto-ID).
   Alternativ mit der GitHub-Konsole: `gh secret set CLOUDFLARE_API_TOKEN` und `gh secret set CLOUDFLARE_ACCOUNT_ID`.
4. Test: GitHub → Actions → "Veröffentlichen" → "Run workflow" (Zweig `main`). Grün = veröffentlicht.

**Pages CMS**

1. https://app.pagescms.org öffnen und mit dem GitHub-Konto anmelden, dem das Repository gehört (oder das Schreibrechte hat).
2. Die GitHub-App von Pages CMS für das Repository `esv-muenchen-ost-tischtennis` installieren bzw. erlauben
   (die Oberfläche führt durch den Schritt; Zugriff auf dieses eine Repository genügt).
3. Repository und Zweig `main` öffnen. Links erscheint die Seitenleiste aus `.pages.yml`:
   Seiten, Turniere, Einstellungen, Medien.
4. Pfleger einladen: im Repository den Menüpunkt für Mitarbeiter ("Collaborators") öffnen und die E-Mail-Adresse
   eintragen. Eingeladene brauchen laut Pages-CMS-Dokumentation kein GitHub-Konto und können `.pages.yml` nicht ändern.
5. Probe: eine Kleinigkeit ändern, "Save" klicken, in GitHub → Actions den Lauf "Veröffentlichen" abwarten, Seite neu laden.

Die Konfigurationsseite von Pages CMS ist ausgeblendet (`settings.hide: true`); `.pages.yml` wird nur im Repository bearbeitet.

## Rechtliches

- Impressum mit echten Registerdaten (AG München, VR 4843) und Vorstand.
- Datenschutzerklärung nach Art. 13 DSGVO inkl. GitHub-Pages-Hosting,
  Drittlandübermittlung (SCC) und Widerspruch gegen Namensnennung.
- Keine Cookies, kein Tracking, Fonts selbst gehostet, keine eingebetteten Drittinhalte.

## Offen

- Echte Fotos aus Halle und Training (aktuell ein Stimmungsbild im Hero).
- Rechtstexte vor dem Livegang einmal vom Hauptverein gegenlesen lassen.
