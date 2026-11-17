#!/usr/bin/env bash
# Stellt den Veroeffentlichungs-Ordner _dist zusammen und prueft ihn.
# Benutzt von GitHub Actions (.github/workflows/deploy.yml) und beim
# Veroeffentlichen von Hand. Die Seite ist reines HTML/CSS - hier wird nichts
# uebersetzt, nur ausgewaehlt und geprueft.
set -euo pipefail
cd "$(dirname "$0")/.."

OUT=_dist
PAGES="index mannschaften training historie vereinsmeisterschaft kontakt impressum datenschutz"

rm -rf "$OUT"
mkdir -p "$OUT"

# Nur das hier geht online - sonst nichts aus dem Projektordner.
cp ./*.html styles.css robots.txt sitemap.xml "$OUT"/
cp -r assets "$OUT"/

# IndexNow-Schluesseldatei (Name = 32 Zeichen + .txt), damit Suchmaschinen
# Aenderungen gemeldet bekommen koennen.
for f in ./*.txt; do
  [ "$(basename "$f")" = "robots.txt" ] || cp "$f" "$OUT"/
done

# Optionale Cloudflare-Steuerdateien, falls spaeter angelegt.
for f in _redirects _headers; do
  if [ -f "$f" ]; then cp "$f" "$OUT"/; fi
done

# Pruefung: Jede Kernseite ist da, vollstaendig und hat Titel und Seitenfuss.
fail=0
for p in $PAGES; do
  f="$OUT/$p.html"
  if [ ! -s "$f" ]; then
    echo "FEHLER: $p.html fehlt oder ist leer"; fail=1; continue
  fi
  grep -q "</html>" "$f"           || { echo "FEHLER: $p.html ist unvollstaendig (</html> fehlt)"; fail=1; }
  grep -q "<title>" "$f"           || { echo "FEHLER: $p.html hat keinen <title>"; fail=1; }
  grep -q 'class="site-foot"' "$f" || { echo "FEHLER: $p.html hat keinen Seitenfuss mehr"; fail=1; }
done
[ -s "$OUT/styles.css" ] || { echo "FEHLER: styles.css fehlt oder ist leer"; fail=1; }

if [ "$fail" -ne 0 ]; then
  echo "Abbruch: Es wird nichts veroeffentlicht, die Live-Seite bleibt unveraendert."
  exit 1
fi
echo "OK: $(find "$OUT" -type f | wc -l | tr -d ' ') Dateien in $OUT bereit."
