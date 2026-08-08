# ESV München-Ost · Abteilung Tischtennis

Statische Website der Tischtennis-Abteilung des ESV München-Ost e.V.
Design "V3 Petrol": dunkles Petrol/Gold, Inter (selbst gehostet).

## Aufbau
- Reines HTML/CSS, kein Build-Schritt, kein Framework.
- `styles.css` enthält Design-Tokens (`:root`) und alle Komponenten.
- Schriften liegen unter `assets/fonts/` und werden **selbst gehostet** –
  keine Verbindung zu Google Fonts (DSGVO).
- Keine Cookies, kein Tracking, keine eingebetteten Drittinhalte.

## Seiten
| Datei | Inhalt |
|---|---|
| `index.html` | Startseite |
| `mannschaften.html` | 12 Mannschaften, Links zu myTischtennis |
| `training.html` | Trainingszeiten, beide Hallen |
| `historie.html` | Abteilungsgeschichte, Turnier-Kurzüberblick |
| `vereinsmeisterschaft.html` | Ehrentafel: alle Sieger seit 1979 + Facklerpokal seit 1980 |
| `kontakt.html` | Kontakt, Formular (mailto), Sponsoring |
| `impressum.html`, `datenschutz.html` | Rechtliches |

## Turnierdaten
`vereinsmeisterschaft.html` enthält die Daten statisch im HTML (gut für Google).
JavaScript dient nur zum Umschalten und Filtern – ohne JS bleibt alles lesbar.
Quelle: Turnierarchiv der Abteilung, zeilengenau übernommen.
Zum Aktualisieren die Tabellen direkt im HTML ergänzen.

## Deployment
Cloudflare Pages, Projekt `esv-tischtennis`. Live unter
https://esv-tischtennis.pages.dev

Deploy vom Rechner aus:

    npx wrangler pages deploy _dist --project-name=esv-tischtennis --branch=main

`_dist` ist eine Kopie der Seite ohne `.git` (per `.gitignore` ausgenommen).
Nach Änderungen: `_dist` neu befüllen, dann deployen.

GitHub Pages ist für dieses Repo bewusst abgeschaltet — sonst läuft die Seite
unter der Domain des `armando40business-code.github.io`-Repos (heydani.de) mit.

## Rechtliches
- Impressum mit echten Registerdaten (AG München, VR 4843) und Vorstand.
- Datenschutzerklärung nach Art. 13 DSGVO inkl. GitHub-Pages-Hosting,
  Drittlandübermittlung (SCC) und Widerspruch gegen Namensnennung.
- Keine Cookies, kein Tracking, Fonts selbst gehostet.

## Offen
- Echte Fotos aus Halle und Training (aktuell ein Stimmungsbild im Hero).
- Rechtstexte vor dem Livegang einmal vom Hauptverein gegenlesen lassen.
