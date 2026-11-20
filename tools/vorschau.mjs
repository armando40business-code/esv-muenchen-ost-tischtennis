#!/usr/bin/env node
// Vorschau für den Auftraggeber – bevor irgendetwas zu GitHub hochgeladen wird.
// Erzeugt in tools/_vorschau/ (steht in .gitignore):
//   1. die Website samt Probe-Seite (gebaut in einer Wegwerf-Kopie; inhalt/ und medien/ bleiben unberührt),
//   2. formulare.html – Nachbildung der Pflege-Formulare (aus .pages.yml UND den echten Inhalten),
//   3. vorschau.html – kleine Startseite mit den drei Verweisen.
// Aufruf: node tools/vorschau.mjs      (Ausliefern: z. B. python -m http.server 4311 im Ordner tools/_vorschau)
// Prüfen der Ergebnisse im Browser: node tools/vorschau/pruefe.mjs

import { copyFileSync, cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { kopieRepo, baue, WURZEL } from './testumgebung.mjs';
import { formulareHtml } from './vorschau/formulare.mjs';

const ZIEL = join(WURZEL, 'tools', '_vorschau');
const lies = (rel) => readFileSync(join(WURZEL, rel), 'utf8');
const erzeugt = new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'medium', timeStyle: 'short' });

// ---- 1. Website samt Probe-Seite -----------------------------------------------------------------
const dir = kopieRepo('esv-vorschau-');
try {
  const probe = join(WURZEL, 'tools', 'probe');
  copyFileSync(join(probe, 'probe.json'), join(dir, 'inhalt', 'weitere-seiten', 'probe.json'));
  mkdirSync(join(dir, 'medien', 'tabellen'), { recursive: true });
  mkdirSync(join(dir, 'medien', 'bilder'), { recursive: true });
  copyFileSync(join(probe, 'mannschaftsaufstellung.xlsx'), join(dir, 'medien', 'tabellen', 'mannschaftsaufstellung.xlsx'));
  copyFileSync(join(probe, 'probe-grafik.svg'), join(dir, 'medien', 'bilder', 'probe-grafik.svg'));

  const r = baue(dir, ['--pruefen']);
  if (r.code !== 0) {
    console.error(r.ausgabe);
    throw new Error(`Bau der Probe-Seite fehlgeschlagen (Exit-Code ${r.code}).`);
  }
  if (/Warnungen \(/.test(r.ausgabe)) console.warn('Hinweis: der Bau meldet Warnungen:\n' + r.ausgabe);
  mkdirSync(ZIEL, { recursive: true });
  cpSync(join(dir, '_site'), ZIEL, { recursive: true, force: true });
  if (!existsSync(join(ZIEL, 'probe.html'))) throw new Error('probe.html fehlt im Ergebnis.');
  console.log(`1. Website gebaut und nach tools/_vorschau/ kopiert (inkl. probe.html).`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

// ---- 2. formulare.html ---------------------------------------------------------------------------
const f = formulareHtml({ css: lies('tools/vorschau/formulare.css'), js: lies('tools/vorschau/formulare.js'), erzeugt });
writeFileSync(join(ZIEL, 'formulare.html'), f.html, 'utf8');
for (const w of f.warnungen) console.warn('   Warnung: ' + w);
console.log(`2. formulare.html: ${f.anzahlPanels} Formulare, ${Math.round(statSync(join(ZIEL, 'formulare.html')).size / 1024)} KB.`);

// ---- 3. vorschau.html ----------------------------------------------------------------------------
const startseite = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<link rel="icon" href="data:,">
<title>Vorschau der neuen Vereinswebsite</title>
<style>
:root{color-scheme:light;--bg:#f3f4f6;--karte:#fff;--linie:#dde1e7;--text:#1c2430;--leise:#586373;--akzent:#2c5d86;--akzent-hell:#e4eef7}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:17px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;overflow-wrap:anywhere}
main{max-width:46rem;margin:0 auto;padding:2.2rem 16px 3rem}
h1{margin:0 0 .4rem;font-size:1.8rem;line-height:1.2}
.einleitung{margin:0 0 1.8rem;color:var(--leise)}
.karten{display:grid;gap:1rem}
a.karte{display:block;padding:1.2rem 1.3rem;background:var(--karte);border:1px solid var(--linie);border-left:6px solid var(--akzent);border-radius:10px;color:inherit;text-decoration:none}
a.karte:hover{background:var(--akzent-hell)}
a.karte:focus-visible{outline:3px solid #5b9bd5;outline-offset:2px}
a.karte h2{margin:0 0 .35rem;font-size:1.3rem;line-height:1.3;color:var(--akzent)}
a.karte p{margin:0}
a.karte .los{display:inline-block;margin-top:.6rem;font-weight:600;color:var(--akzent)}
.stand{margin:2rem 0 0;padding:1rem 1.2rem;background:var(--karte);border:1px solid var(--linie);border-radius:10px}
.stand h2{margin:0 0 .4rem;font-size:1rem;color:var(--leise);text-transform:uppercase;letter-spacing:.05em}
.stand ul{margin:0;padding:0;list-style:none}
.stand li{padding:.15rem 0}
.stand li::before{content:"\\2713\\00a0\\00a0";color:#2f7d4f;font-weight:700}
</style>
</head>
<body>
<main>
<h1>Vorschau der neuen Vereinswebsite</h1>
<p class="einleitung">Drei Dinge zum Anschauen, bevor irgendetwas veröffentlicht wird.</p>
<div class="karten">
<a class="karte" href="index.html">
<h2>Die Website (sieht aus wie heute)</h2>
<p>So sehen Besucher die Seite. Sie wird aus dem heutigen Inhalt neu gebaut und soll genauso aussehen wie die bisherige Seite.</p>
<span class="los">Website öffnen &rarr;</span>
</a>
<a class="karte" href="probe.html">
<h2>Probe-Seite mit den neuen Abschnitten</h2>
<p>Eine Test-Seite, die zeigt, was mit den neuen Abschnitten möglich ist: Tabelle aus Excel, Bilder, Freitext und mehr. Sie gehört nicht zum echten Inhalt und gibt es nur in dieser Vorschau.</p>
<span class="los">Probe-Seite öffnen &rarr;</span>
</a>
<a class="karte" href="formulare.html">
<h2>So pflegt Heinz die Seite (Formulare)</h2>
<p>Eine Nachbildung der Eingabeformulare, mit den echten heutigen Texten gefüllt. Man kann herumklicken und tippen, gespeichert wird nichts.</p>
<span class="los">Formulare ansehen &rarr;</span>
</a>
</div>
<div class="stand">
<h2>Stand</h2>
<ul>
<li>Lokal gebaut am ${erzeugt}.</li>
<li>Nichts wurde zu GitHub hochgeladen.</li>
<li>Die Live-Seite ist unverändert.</li>
</ul>
</div>
</main>
</body>
</html>
`;
writeFileSync(join(ZIEL, 'vorschau.html'), startseite, 'utf8');
console.log('3. vorschau.html geschrieben.');
console.log('\nFertig. Ansehen: http://127.0.0.1:4311/vorschau.html (Ordner tools/_vorschau muss ausgeliefert werden).');
