#!/usr/bin/env node
// Bildvergleich alt gegen neu (Abnahmepunkt 3): jede Seite bei 1280 px und 390 px Breite als ganze Seite
// rendern (installiertes Chrome bzw. Edge über playwright-core, `channel`), Pixel vergleichen (pixelmatch).
// Bilder mit Abweichung (und die größte Abweichung) landen in tools/_vergleich/.
// Einmalig: cd tools && npm install
// Aufruf:   node tools/bildvergleich.mjs [--alt <verzeichnis>] [--neu <verzeichnis>] [--seiten a,b] [--breiten 1280,390]

import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { altstandHolen } from './vergleich.mjs';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const AUSGABE = join(WURZEL, 'tools', '_vergleich');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const SEITEN = (arg('--seiten') || 'index,mannschaften,training,historie,vereinsmeisterschaft,kontakt,impressum,datenschutz').split(',');
const BREITEN = (arg('--breiten') || '1280,390').split(',').map(Number);

const TYPEN = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain' };

/** Kleiner statischer Server (Wurzelpfade wie /medien/… müssen funktionieren). */
export function server(dir) {
  return new Promise((res) => {
    const s = createServer((req, antwort) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      const datei = normalize(join(dir, p));
      if (!datei.startsWith(normalize(dir)) || !existsSync(datei) || !statSync(datei).isFile()) {
        antwort.writeHead(404); antwort.end('nicht gefunden'); return;
      }
      antwort.writeHead(200, { 'content-type': TYPEN[extname(datei).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
      antwort.end(readFileSync(datei));
    });
    s.listen(0, '127.0.0.1', () => res(s));
  });
}

export async function browserStarten() {
  for (const channel of ['chrome', 'msedge']) {
    try {
      return { browser: await chromium.launch({ channel, headless: true }), channel };
    } catch { /* nächster */ }
  }
  throw new Error('Weder Chrome noch Edge konnten gestartet werden.');
}

export async function aufnahme(browser, url, breite) {
  const ctx = await browser.newContext({ viewport: { width: breite, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const fehler = [];
  page.on('response', (r) => { if (r.status() >= 400) fehler.push(`${r.status()} ${r.url()}`); });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
  });
  const innen = await page.evaluate(() => window.innerWidth);
  const png = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
  await ctx.close();
  return { png: PNG.sync.read(png), innen, fehler };
}

function aufGroesse(img, w, h) {
  if (img.width === w && img.height === h) return img;
  const neu = new PNG({ width: w, height: h });
  neu.data.fill(0);
  for (let i = 0; i < neu.data.length; i += 4) { neu.data[i] = 255; neu.data[i + 2] = 255; neu.data[i + 3] = 255; } // Magenta = fehlt
  PNG.bitblt(img, neu, 0, 0, img.width, img.height, 0, 0);
  return neu;
}

async function main() {
  const altDir = arg('--alt') || altstandHolen();
  const neuDir = arg('--neu') || join(WURZEL, '_site');
  mkdirSync(AUSGABE, { recursive: true });
  for (const s of SEITEN) for (const b of BREITEN) for (const t of ['alt', 'neu', 'diff']) rmSync(join(AUSGABE, `${s}-${b}-${t}.png`), { force: true });
  const sA = await server(altDir);
  const sN = await server(neuDir);
  const { browser, channel } = await browserStarten();
  console.log(`Browser: ${channel} · Altstand: ${altDir} · Neu: ${neuDir}\n`);
  const ergebnisse = [];
  for (const seite of SEITEN) {
    for (const breite of BREITEN) {
      const a = await aufnahme(browser, `http://127.0.0.1:${sA.address().port}/${seite}.html`, breite);
      const n = await aufnahme(browser, `http://127.0.0.1:${sN.address().port}/${seite}.html`, breite);
      const w = Math.max(a.png.width, n.png.width);
      const h = Math.max(a.png.height, n.png.height);
      const A = aufGroesse(a.png, w, h);
      const N = aufGroesse(n.png, w, h);
      const diff = new PNG({ width: w, height: h });
      const px = pixelmatch(A.data, N.data, diff.data, w, h, { threshold: 0.1 });
      const anteil = (px / (w * h)) * 100;
      const e = { seite, breite, innenAlt: a.innen, innenNeu: n.innen, hoeheAlt: a.png.height, hoeheNeu: n.png.height, px, anteil,
        fehler: [...a.fehler.map((x) => 'alt ' + x), ...n.fehler.map((x) => 'neu ' + x)], A, N, diff };
      ergebnisse.push(e);
      if (px > 0) {
        const name = `${seite}-${breite}`;
        writeFileSync(join(AUSGABE, `${name}-alt.png`), PNG.sync.write(A));
        writeFileSync(join(AUSGABE, `${name}-neu.png`), PNG.sync.write(N));
        writeFileSync(join(AUSGABE, `${name}-diff.png`), PNG.sync.write(diff));
      }
      delete e.A; delete e.N; delete e.diff;
      process.stdout.write('.');
    }
  }
  await browser.close();
  sA.close(); sN.close();
  if (!arg('--alt')) rmSync(altDir, { recursive: true, force: true });

  console.log('\n\n| Seite | Breite | Viewport alt/neu | Höhe alt/neu | Pixel abweichend | Anteil |');
  console.log('|---|---|---|---|---|---|');
  for (const e of ergebnisse) {
    console.log(`| ${e.seite} | ${e.breite} | ${e.innenAlt}/${e.innenNeu} | ${e.hoeheAlt}/${e.hoeheNeu} | ${e.px} | ${e.anteil.toFixed(4)} % |`);
  }
  const max = ergebnisse.reduce((m, e) => (e.anteil > m.anteil ? e : m), ergebnisse[0]);
  console.log(`\nGrößte Abweichung: ${max.seite} @ ${max.breite}px – ${max.px} Pixel (${max.anteil.toFixed(4)} %).`);
  if (max.px > 0) console.log(`Bilder: tools/_vergleich/${max.seite}-${max.breite}-{alt,neu,diff}.png`);
  const fehler = ergebnisse.flatMap((e) => e.fehler.map((f) => `${e.seite}@${e.breite}: ${f}`));
  if (fehler.length) console.log('\nLadefehler:\n  ' + [...new Set(fehler)].join('\n  '));
  writeFileSync(join(AUSGABE, 'ergebnis.json'), JSON.stringify(ergebnisse, null, 2));
  const schlecht = ergebnisse.filter((e) => e.anteil >= 0.1 || e.hoeheAlt !== e.hoeheNeu);
  process.exitCode = schlecht.length || fehler.length ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error(e); process.exitCode = 1; });
}
