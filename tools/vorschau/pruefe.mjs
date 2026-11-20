#!/usr/bin/env node
// Prüft die Vorschau im echten Browser (installiertes Chrome/Edge über playwright-core) und macht die Bildschirmfotos
// nach tools/_vorschau/_fotos/. Voraussetzung: node tools/vorschau.mjs ist gelaufen.
// Aufruf: node tools/vorschau/pruefe.mjs [--url http://127.0.0.1:4311]   (ohne --url: eigener kleiner Server auf tools/_vorschau)

import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { server, browserStarten } from '../bildvergleich.mjs';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const VORSCHAU = join(WURZEL, 'tools', '_vorschau');
const FOTOS = join(VORSCHAU, '_fotos');
mkdirSync(FOTOS, { recursive: true });
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };

let ok = 0; let fehl = 0;
const pruefe = (bed, t) => { if (bed) { ok++; console.log('  ✓ ' + t); } else { fehl++; console.log('  ✗ ' + t); } };

let eigener = null;
let basis = arg('--url');
if (!basis) { eigener = await server(VORSCHAU); basis = `http://127.0.0.1:${eigener.address().port}`; }
const { browser, channel } = await browserStarten();
console.log(`Browser: ${channel}, Adresse: ${basis}`);

async function seite(breite, hoehe, url) {
  const ctx = await browser.newContext({ viewport: { width: breite, height: hoehe }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  const probleme = [];
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') probleme.push(`${m.type()}: ${m.text()}`); });
  p.on('pageerror', (e) => probleme.push('JS: ' + e.message));
  p.on('requestfailed', (r) => probleme.push('Anfrage fehlgeschlagen: ' + r.url()));
  p.on('response', (r) => { if (r.status() >= 400) probleme.push(`${r.status()} ${r.url()}`); });
  p.setDefaultTimeout(8000);
  await p.goto(url, { waitUntil: 'networkidle' });
  return { ctx, p, probleme };
}

const zeigeEintrag = async (p, id, breite) => {
  const inLeiste = await p.evaluate((i) => !!document.querySelector('#seitenleiste a[data-ziel="' + i + '"]'), id);
  if (!inLeiste) await p.evaluate((i) => { location.hash = '#' + i; }, id); // Unterseiten einer Sammlung: Verweis aus der Liste
  else if (breite <= 700) await p.selectOption('#auswahl', id);
  else await p.click(`#seitenleiste a[data-ziel="${id}"]`);
  await p.waitForFunction((i) => !document.getElementById(i).hidden, id);
};

for (const breite of [1280, 390]) {
  console.log(`\n--- formulare.html bei ${breite} px ---`);
  const { ctx, p, probleme } = await seite(breite, breite > 700 ? 1000 : 844, `${basis}/formulare.html`);
  const mass = await p.evaluate(() => ({ innen: window.innerWidth, scroll: document.documentElement.scrollWidth }));
  pruefe(mass.innen === breite, `Viewport wirklich ${breite} px breit (ist ${mass.innen})`);
  pruefe(await p.locator('.banner').innerText().then((t) => t.includes('Nachbildung zur Ansicht – nichts wird gespeichert. Die echte Oberfläche (Pages CMS) sieht ähnlich aus, aber nicht genau so.')), 'Hinweisband mit dem vorgegebenen Wortlaut');
  pruefe(await p.locator('#seitenleiste').isVisible() === (breite > 700), `Seitenleiste ${breite > 700 ? 'sichtbar' : 'zu Auswahlmenü eingeklappt'}`);
  pruefe(await p.locator('#auswahl').isVisible() === (breite <= 700), `Auswahlmenü ${breite <= 700 ? 'sichtbar' : 'verborgen'}`);

  const ids = await p.evaluate(() => [...document.querySelectorAll('.formular')].map((s) => s.id));
  const sidebarIds = await p.evaluate(() => [...document.querySelectorAll('#seitenleiste a[data-ziel]')].map((a) => a.dataset.ziel));
  pruefe(sidebarIds.length === 13, `Seitenleiste hat 13 Einträge (ist ${sidebarIds.length})`);
  for (const id of ids) {
    await zeigeEintrag(p, id, breite);
    const z = await p.evaluate((i) => {
      const s = document.getElementById(i);
      return { felder: s.querySelectorAll('input,textarea,select,[contenteditable],.schalter,table,.dateien,.bildfeld').length, titel: s.querySelector('h2')?.textContent, sichtbar: !s.hidden && s.getBoundingClientRect().height > 50 };
    }, id);
    pruefe(z.sichtbar && z.felder > 0, `Eintrag „${z.titel}“ (${id}) öffnet und zeigt ${z.felder} Eingabe-/Listenelemente`);
    const m = await p.evaluate(() => ({ s: document.documentElement.scrollWidth, i: window.innerWidth }));
    if (m.s > m.i) pruefe(false, `${id}: waagrechtes Scrollen (${m.s} > ${m.i})`);
  }

  // Liste auf-/zuklappen: Jahrgänge Vereinsmeisterschaft
  await zeigeEintrag(p, 'turnier-vereinsmeisterschaft', breite);
  const liste = p.locator('#turnier-vereinsmeisterschaft > .feld details.zeile, #turnier-vereinsmeisterschaft details.zeile').first();
  const kopfText = await liste.locator('> summary .sum').innerText();
  pruefe(kopfText.trim() === '2026 · Erb C.', `Eingeklappte Zeile zeigt Vorlage „{jahr} · {platz1}“ → „${kopfText.trim()}“`);
  pruefe(!(await liste.evaluate((d) => d.open)), 'Listenzeile startet eingeklappt');
  await liste.locator('> summary').click();
  pruefe(await liste.evaluate((d) => d.open) && await liste.locator('input[type=text]').first().isVisible(), 'Klick klappt die Zeile auf, Felder sichtbar');
  const wert = await liste.locator('input[type=text]').first().inputValue();
  pruefe(wert === '2026', `Feld „Jahr“ mit echtem Wert gefüllt (${wert})`);
  const mehr = await p.locator('#turnier-vereinsmeisterschaft .mehr').first().innerText();
  pruefe(/^… und \d+ weitere$/.test(mehr.trim()), `Lange Liste endet mit „${mehr.trim()}“`);
  pruefe(await p.locator('#turnier-vereinsmeisterschaft details.zeile').count() === 8, 'Genau 8 Einträge ausgegeben');
  pruefe((await p.locator('#turnier-vereinsmeisterschaft button:has-text("Add an item")').count()) >= 1, 'Knopf „Add an item“ unter der Liste');
  if (breite > 700) {
    await p.setViewportSize({ width: 1280, height: 1500 });
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.screenshot({ path: join(FOTOS, 'formulare-1280.png') });
    await p.setViewportSize({ width: 1280, height: 1000 });
  }
  await liste.locator('> summary').click();
  pruefe(!(await liste.evaluate((d) => d.open)), 'Zweiter Klick klappt die Zeile wieder zu');

  // Seite „Training“ mit Abschnitt
  await zeigeEintrag(p, 'seite-training', breite);
  const abschnitt = p.locator('#seite-training details.zeile').first();
  const abschnittKopf = (await abschnitt.locator('> summary').innerText()).replace(/\s+/g, ' ');
  pruefe(/^\S* ?1\. /.test(abschnittKopf) && (breite <= 700 || abschnittKopf.includes('Karten')), 'Abschnittszeile mit Nummer' + (breite > 700 ? ' und Plakette der Art' : ' (Plakette am Handy ausgeblendet)') + ': „' + abschnittKopf + '“');
  await abschnitt.locator('> summary').click();
  pruefe(await abschnitt.evaluate((d) => d.open), 'Abschnitt lässt sich aufklappen');
  const felderImAbschnitt = await abschnitt.locator('input, textarea, select, [contenteditable]').count();
  pruefe(felderImAbschnitt > 5, `Aufgeklappter Abschnitt zeigt ${felderImAbschnitt} Felder`);
  // zweite Ebene: erste Karte aufklappen (für das Foto)
  const karte = abschnitt.locator('details.zeile').first();
  await karte.locator('> summary').click();
  if (breite > 700) {
    await p.setViewportSize({ width: 1280, height: 1500 });
    await p.evaluate(() => { const d = document.querySelector('#seite-training details.zeile'); window.scrollTo(0, d.getBoundingClientRect().top + window.scrollY - 230); });
    await p.screenshot({ path: join(FOTOS, 'formulare-1280-seite.png') });
    await p.setViewportSize({ width: 1280, height: 1000 });
  }
  await abschnitt.locator('> summary').click();
  pruefe(!(await abschnitt.evaluate((d) => d.open)), 'Abschnitt lässt sich wieder zuklappen');

  // Auswahlfenster der Abschnitts-Arten
  await p.locator('#seite-training button[data-aktion="arten"]').first().click();
  const arten = await p.locator('#arten-dialog li').count();
  pruefe(arten === 12 && await p.locator('#arten-dialog').evaluate((d) => d.open), `„Add an item“ im Abschnitte-Feld öffnet die Übersicht mit ${arten} Arten`);
  await p.keyboard.press('Escape');
  pruefe(!(await p.locator('#arten-dialog').evaluate((d) => d.open)), 'Esc schließt die Übersicht');

  // Schalter und Tippen
  await zeigeEintrag(p, 'weitere-seiten--probe', breite);
  const schalter = p.locator('#weitere-seiten--probe .schalter').first();
  const vorher = await schalter.getAttribute('aria-checked');
  await schalter.click();
  pruefe((await schalter.getAttribute('aria-checked')) !== vorher, 'Ja/Nein-Schalter lässt sich umlegen');
  const eingabe = p.locator('#weitere-seiten--probe input[type=text]').first();
  await eingabe.fill('Test');
  pruefe((await eingabe.inputValue()) === 'Test', 'Einzeiliges Textfeld ist tippbar');

  // Tastatur: Tab erreicht die Seitenleiste bzw. das Menü
  if (breite > 700) {
    await p.focus('#seitenleiste a');
    await p.keyboard.press('Tab');
    pruefe(await p.evaluate(() => document.activeElement?.matches('#seitenleiste a')), 'Tab springt von Eintrag zu Eintrag der Seitenleiste');
  }

  // Foto Handy
  if (breite <= 700) {
    await zeigeEintrag(p, 'turnier-vereinsmeisterschaft', breite);
    const l2 = p.locator('#turnier-vereinsmeisterschaft details.zeile').first();
    await l2.locator('> summary').click();
    await p.evaluate(() => { const d = document.querySelector('#turnier-vereinsmeisterschaft details.zeile'); window.scrollTo(0, d.getBoundingClientRect().top + window.scrollY - 140); });
    await p.screenshot({ path: join(FOTOS, 'formulare-390.png') });
    await p.screenshot({ path: join(FOTOS, 'formulare-390-lang.png'), fullPage: true });
  }
  const m2 = await p.evaluate(() => ({ s: document.documentElement.scrollWidth, i: window.innerWidth }));
  pruefe(m2.s <= m2.i, `${breite} px: kein waagrechtes Scrollen (scrollWidth ${m2.s} ≤ ${m2.i})`);
  pruefe(probleme.length === 0, `${breite} px: keine Konsolenfehler/Ladefehler ${probleme.join(' | ')}`);
  await ctx.close();
}

// Als Datei geöffnet (Doppelklick) – ohne Server
{
  console.log('\n--- formulare.html per Doppelklick (file://) ---');
  const url = pathToFileURL(join(VORSCHAU, 'formulare.html')).href;
  const { ctx, p, probleme } = await seite(1280, 900, url);
  await p.click('#seitenleiste a[data-ziel="turnier-facklerpokal"]');
  pruefe(await p.locator('#turnier-facklerpokal').isVisible(), 'läuft ohne Server, Eintrag öffnet');
  const bildOk = await p.evaluate(() => { const s = document.querySelector('.vorschau[class*=bild-]'); return s ? getComputedStyle(s).backgroundImage.startsWith('url("data:') : null; });
  pruefe(bildOk !== false, 'Bild-Vorschauen sind eingebettet (data-URI)');
  pruefe(probleme.length === 0, `keine Konsolenfehler ${probleme.join(' | ')}`);
  await ctx.close();
}

// Startseite
{
  console.log('\n--- vorschau.html ---');
  const { ctx, p, probleme } = await seite(1280, 900, `${basis}/vorschau.html`);
  const hrefs = await p.evaluate(() => [...document.querySelectorAll('a.karte')].map((a) => a.getAttribute('href')));
  pruefe(JSON.stringify(hrefs) === JSON.stringify(['index.html', 'probe.html', 'formulare.html']), `drei Verweise: ${hrefs.join(', ')}`);
  for (const h of hrefs) {
    const r = await p.request.get(`${basis}/${h}`);
    pruefe(r.status() === 200, `${h} erreichbar (${r.status()})`);
  }
  await p.screenshot({ path: join(FOTOS, 'vorschau-1280.png') });
  pruefe(probleme.length === 0, `keine Konsolenfehler ${probleme.join(' | ')}`);
  await ctx.close();
}

// Website und Probe-Seite
{
  console.log('\n--- Website und Probe-Seite ---');
  for (const s of ['index.html', 'probe.html']) {
    const { ctx, p, probleme } = await seite(1280, 900, `${basis}/${s}`);
    await p.evaluate(async () => { window.scrollTo(0, document.body.scrollHeight); await new Promise((r) => setTimeout(r, 600)); window.scrollTo(0, 0); }); // Lazy-Bilder laden lassen
    await p.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 8000 }).catch(() => {});
    const bilder = await p.evaluate(() => [...document.images].filter((i) => i.naturalWidth === 0).length);
    pruefe(bilder === 0, `${s}: alle Bilder laden`);
    pruefe(probleme.length === 0, `${s}: keine Ladefehler ${probleme.join(' | ')}`);
    await ctx.close();
  }
}

await browser.close();
if (eigener) eigener.close();
console.log(`\nErgebnis: ${ok} bestanden, ${fehl} fehlgeschlagen. Fotos: tools/_vorschau/_fotos/`);
process.exitCode = fehl ? 1 : 0;
