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
| `mannschaften.html` | 12 Mannschaften, Links zu click-TT (BTTV) |
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

**Automatisch:** Jede Änderung auf `main` wird von GitHub Actions
(`.github/workflows/deploy.yml`) geprüft und veröffentlicht, meist in unter zwei
Minuten. Schlägt die Prüfung fehl, bleibt der alte Stand online. Nötig sind zwei
Repository-Secrets (Settings → Secrets and variables → Actions):
`CLOUDFLARE_API_TOKEN` (Custom Token: Account → Cloudflare Pages → Edit) und
`CLOUDFLARE_ACCOUNT_ID`.

**Von Hand** (Rechner mit Wrangler-Login), mit derselben Auswahl und Prüfung:

    bash scripts/build.sh
    npx wrangler pages deploy _dist --project-name=esv-tischtennis --branch=main

`scripts/build.sh` stellt `_dist` jedes Mal neu zusammen. Online gehen nur die
HTML-Seiten, `styles.css`, `robots.txt`, `sitemap.xml`, `assets/` und die
IndexNow-Schlüsseldatei. Wie man Inhalte ändert, steht in `ANLEITUNG.md`.

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
