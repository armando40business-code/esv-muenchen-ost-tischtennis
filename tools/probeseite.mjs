#!/usr/bin/env node
// Abnahmepunkt 5 – Probe-Seite. Legt tools/probe/probe.json als weitere Seite in eine Wegwerf-Kopie des Repos
// (mit echter Excel-Datei tools/probe/mannschaftsaufstellung.xlsx und einer SVG-Grafik), baut, prüft das Ergebnis
// und speichert Ansichten bei 1280/390 px nach tools/_vergleich/probe-*.png. Der echte Inhalt bleibt unberührt.
// Aufruf: node tools/probeseite.mjs   (braucht `npm install` in tools/ für die Bildschirmfotos)

import { copyFileSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { kopieRepo, baue, WURZEL } from './testumgebung.mjs';

let ok = 0;
let fehl = 0;
const pruefe = (bed, text) => { if (bed) { ok++; console.log('  ✓ ' + text); } else { fehl++; console.log('  ✗ ' + text); } };

const dir = kopieRepo('esv-probe-');
const probe = join(WURZEL, 'tools', 'probe');
copyFileSync(join(probe, 'probe.json'), join(dir, 'inhalt', 'weitere-seiten', 'probe.json'));
mkdirSync(join(dir, 'medien', 'tabellen'), { recursive: true });
copyFileSync(join(probe, 'mannschaftsaufstellung.xlsx'), join(dir, 'medien', 'tabellen', 'mannschaftsaufstellung.xlsx'));
copyFileSync(join(probe, 'probe-grafik.svg'), join(dir, 'medien', 'bilder', 'probe-grafik.svg'));

console.log(`Wegwerf-Kopie: ${dir}\n`);
const r = baue(dir, ['--pruefen']);
console.log(r.ausgabe.split('\n').map((z) => '    | ' + z).join('\n'));
pruefe(r.code === 0, `Bau Exit-Code 0 (ist ${r.code})`);
pruefe(!/Warnungen \(/.test(r.ausgabe), 'keine Warnungen');
pruefe(/Inhaltsprüfung: keine Auffälligkeiten/.test(r.ausgabe), 'Inhaltsprüfung ohne Auffälligkeiten');
const site = join(dir, '_site');
const h = readFileSync(join(site, 'probe.html'), 'utf8');
const main = h.slice(h.indexOf('<main'), h.indexOf('</main>'));
pruefe(existsSync(join(site, 'medien', 'tabellen', 'mannschaftsaufstellung.xlsx')), 'Excel-Datei liegt unter _site/medien/tabellen/');
pruefe(main.includes('<th scope="col">Einsätze</th>') && main.includes('<td>Wolfgang Braunisch (Kapitän)</td>') && main.includes('<td>02.11.2026</td>'),
  'Excel-Tabelle: Kopfzeile, Umlaute, Datum als Anzeigetext');
pruefe(!main.includes('Wird ignoriert'), 'Vorrang excel > eingefuegt');
pruefe((main.match(/<tr data-s=/g) || []).length === 5 + 4 + 2 + 49 + 46, 'Zeilenzahl: 5 (Excel) + 4 (eingefügt) + 2 (Zusatzreiter) + 49 + 46');
pruefe(main.includes('<td class="win">Montag</td>'), 'erste_spalte_fett → td.win');
pruefe(main.includes('id="q-t1"') && main.includes('id="tafel-1"'), 'Suchfeld der Excel-Tabelle');
pruefe(main.includes('data-panel="panel-r1">Jugendpokal</button>') && main.includes('<td class="none">—</td>'), 'Zusatzreiter aus eingefügtem Text (Semikolon), leere Zelle = —');
pruefe(/<img src="\/medien\/bilder\/esv-logo\.png" alt="Wappen des ESV München-Ost" width="112" height="131" loading="lazy">/.test(main), 'PNG mit Breite/Höhe');
pruefe(/<picture><source srcset="\/medien\/bilder\/hero-halle\.webp" type="image\/webp"><img src="\/medien\/bilder\/hero-halle\.jpg" alt="Tischtennis in der Halle" width="1376" height="768"/.test(main), 'JPG mit WebP-Quelle und Größe');
pruefe(main.includes('width="640" height="360"'), 'SVG-Größe aus Datei');
pruefe(main.includes('page-head-bild') && main.includes("--kopfbild:image-set(url('/medien/bilder/hero-halle.webp')"), 'Kopfbild als Hintergrund');
pruefe(main.includes('<li>Training auch <em>dienstags</em> in der Vereinshalle</li>'), 'Freitext-Liste sauber');
pruefe(main.includes('<a class="textlink" href="https://bttv.click-tt.de/" target="_blank" rel="noopener">click-TT</a>'), 'Freitext-Link fremd → target=_blank');
pruefe(h.includes('<a href="probe.html" aria-current="page">Probe</a>') && readFileSync(join(site, 'index.html'), 'utf8').includes('<a href="probe.html">Probe</a>'), 'im_menue: im Hauptmenü aller Seiten');
pruefe(readFileSync(join(site, 'sitemap.xml'), 'utf8').includes('<loc>https://esv-tischtennis.pages.dev/probe</loc><priority>0.3</priority>'), 'Sitemap-Eintrag');

// Bildschirmfotos + Verhalten im Browser
try {
  const { server, browserStarten } = await import('./bildvergleich.mjs');
  const s = await server(site);
  const { browser, channel } = await browserStarten();
  const ausgabe = join(WURZEL, 'tools', '_vergleich');
  mkdirSync(ausgabe, { recursive: true });
  for (const breite of [1280, 390]) {
    const ctx = await browser.newContext({ viewport: { width: breite, height: 900 }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    const fehler = [];
    p.on('response', (x) => { if (x.status() >= 400) fehler.push(`${x.status()} ${x.url()}`); });
    p.on('pageerror', (e) => fehler.push('JS: ' + e.message));
    await p.goto(`http://127.0.0.1:${s.address().port}/probe.html`, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    const masse = await p.evaluate(() => ({ innen: window.innerWidth, scroll: document.documentElement.scrollWidth }));
    pruefe(fehler.length === 0, `${breite}px: keine Lade-/Skriptfehler ${fehler.join(', ')}`);
    pruefe(masse.scroll <= masse.innen, `${breite}px: kein waagrechtes Scrollen der Seite (scrollWidth ${masse.scroll} ≤ ${masse.innen})`);
    // lazy geladene Bilder vor dem Foto laden lassen
    await p.evaluate(async () => { window.scrollTo(0, document.body.scrollHeight); await new Promise((r) => setTimeout(r, 400)); window.scrollTo(0, 0); });
    await p.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; })))));
    const bilderOk = await p.evaluate(() => [...document.querySelectorAll('.bilder-raster img')].every((i) => i.naturalWidth > 0));
    pruefe(bilderOk, `${breite}px: alle Bilder im Bilder-Baustein geladen`);
    await p.screenshot({ path: join(ausgabe, `probe-${breite}.png`), fullPage: true });
    if (breite === 1280) {
      await p.fill('#q-t1', 'grande');
      const sichtbar = await p.evaluate(() => [...document.querySelectorAll('#tafel-1 tbody tr')].filter((t) => !t.hidden).length);
      pruefe(sichtbar === 1, `Suche "grande" in Excel-Tabelle → 1 Zeile (ist ${sichtbar})`);
      await p.click('#tab-r1');
      const reiter = await p.evaluate(() => [!document.getElementById('panel-r1').hidden, document.getElementById('panel-vm').hidden]);
      pruefe(reiter[0] && reiter[1], 'Zusatzreiter lässt sich anklicken (Reiter-Skript mit 3 Reitern)');
      await p.fill('#q', 'huber');
      const r1 = await p.evaluate(() => [...document.querySelectorAll('#panel-r1 tbody tr')].filter((t) => !t.hidden).length);
      pruefe(r1 === 1, `Suche im Zusatzreiter → 1 Zeile (ist ${r1})`);
    }
    await ctx.close();
  }
  await browser.close();
  s.close();
  console.log(`  (Browser: ${channel}; Ansichten: tools/_vergleich/probe-1280.png, probe-390.png)`);
} catch (e) {
  console.log('  ! Bildschirmfotos nicht möglich (tools: npm install?): ' + e.message);
  fehl++;
}

if (process.env.BEHALTEN) console.log(`(Kopie behalten: ${dir})`); else rmSync(dir, { recursive: true, force: true });
console.log(`\nErgebnis Probe-Seite: ${ok} bestanden, ${fehl} fehlgeschlagen.`);
process.exitCode = fehl ? 1 : 0;
void writeFileSync;
