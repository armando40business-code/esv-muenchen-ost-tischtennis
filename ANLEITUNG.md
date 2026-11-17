# Anleitung: Inhalte der Website selbst ändern

Für alle, die Texte, Zeiten oder Mannschaften auf der Website aktualisieren
wollen. Es braucht kein Programm – nur den Browser und ein GitHub-Konto mit
Zugriff auf dieses Projekt.

## So geht eine Änderung

1. Dieses Projekt auf github.com öffnen und die passende Datei anklicken
   (Tabelle unten).
2. Oben rechts über dem Dateiinhalt auf das Stift-Symbol klicken.
3. Mit Strg+F die Textstelle suchen und nur den Text ändern.
4. Oben rechts auf „Commit changes…" klicken, in einem Satz beschreiben, was
   geändert wurde, und bestätigen.
5. Etwa zwei Minuten warten, dann die Website neu laden.

Ob die Veröffentlichung geklappt hat, zeigt der Reiter „Actions": Ein grüner
Haken heißt online. Ein rotes Kreuz heißt, es wurde nichts veröffentlicht und
die Website zeigt weiter den bisherigen Stand.

## Welche Datei ist welche Seite

| Datei | Seite |
|---|---|
| `index.html` | Startseite |
| `mannschaften.html` | Mannschaften |
| `training.html` | Trainingszeiten und Hallen |
| `historie.html` | Historie |
| `vereinsmeisterschaft.html` | Vereinsmeisterschaft und Facklerpokal |
| `kontakt.html` | Kontakt, Termine, Sponsoring |
| `impressum.html`, `datenschutz.html` | Rechtliches |

## Die wichtigste Regel

Sichtbarer Text steht zwischen spitzen Klammern:

    <p class="muted">Dieser Text ist auf der Seite zu sehen.</p>

Geändert wird nur der Text zwischen `>` und `<`. Die Klammern und alles, was
in ihnen steht, bleiben unverändert.

## Häufige Änderungen

- **Trainingszeit:** in `training.html` nach der alten Uhrzeit suchen. Zeiten
  stehen auch auf der Startseite (`index.html`) – beide Dateien anpassen.
- **Liga einer Mannschaft:** in `mannschaften.html` nach dem Namen suchen, zum
  Beispiel `Herren VII`. Direkt dahinter steht die Liga.
- **Link „Tabelle & Spielplan":** gilt immer für eine Saison. Zu Saisonbeginn
  (Jugend auch zur Rückrunde) die neue Tabelle beim Bayerischen
  Tischtennis-Verband im Browser öffnen, die Adresse kopieren und zwischen die
  Anführungszeichen von `href="…"` der jeweiligen Mannschaft setzen.
- **Neues Turnierergebnis:** in `vereinsmeisterschaft.html` die oberste Zeile
  der Tabelle kopieren (von `<tr` bis `</tr>`), darüber einfügen und Jahr und
  Namen anpassen. In `data-s="…"` stehen dieselben Namen noch einmal in
  Kleinbuchstaben – das ist der Suchtext für das Filterfeld.
- **Telefon, E-Mail, Adresse:** stehen im Seitenfuß jeder der acht Seiten und
  zusätzlich in `kontakt.html`. Jede Datei einzeln ändern, sonst zeigen die
  Seiten Unterschiedliches.
- **Fotos:** der einzige Fall, der mehr braucht (Bildgröße, zwei
  Dateiformate). Am einfachsten das Bild an den Betreuer der Website schicken.

Mit Claude Code oder ChatGPT Codex (jeweils mit verbundenem GitHub-Konto)
lassen sich Änderungen auch in normaler Sprache beauftragen. Das Ergebnis vor
dem Speichern kurz ansehen.

## Wenn etwas schiefgeht

- Nichts geht verloren: Über „History" (oben rechts bei jeder Datei) ist jede
  frühere Fassung einsehbar. Zum Zurücknehmen die alte Textstelle von dort
  wieder einsetzen.
- Fehlt nach einer Änderung ein Teil einer Seite, verweigert die automatische
  Prüfung die Veröffentlichung (rotes Kreuz unter „Actions"). Dann die letzte
  Änderung zurücknehmen.
- Im Zweifel den Betreuer der Website fragen (siehe Impressum).

## Bitte nicht anfassen

- die Ordner `.github` und `scripts` (automatische Veröffentlichung)
- `styles.css` (Aussehen der ganzen Website)
- die Datei mit dem langen Namen aus Buchstaben und Zahlen (Schlüssel für
  Suchmaschinen)

## Rechtliches in Kürze

- Impressum und Datenschutz nur nach Rücksprache mit dem Hauptverein ändern.
- Fotos nur veröffentlichen, wenn die abgebildeten Personen einverstanden
  sind, bei Kindern die Eltern.
- Tabellen und TTR-Werte nicht von myTischtennis kopieren – dessen
  Nutzungsbedingungen untersagen das. Stattdessen verlinken.
