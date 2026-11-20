#!/usr/bin/env node
// Abnahmepunkt 4 – Robustheit. Baut in einer Wegwerf-Kopie des Repos mit absichtlich kaputtem Inhalt:
// leere Bausteine, fehlende Bilder, kaputte/fehlende Excel-Datei, unbekannter _block, gefährliches HTML,
// kaputte JSON-Datei, kaputte Startseite, Design-Varianten. Prüft: Bau läuft durch, Ausgabe ist sauber.
// Aufruf: node tools/robustheit.mjs

import { writeFileSync, readFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { kopieRepo, baue, WURZEL } from './testumgebung.mjs';

let ok = 0;
let fehl = 0;
function pruefe(bed, text) {
  if (bed) { ok++; console.log('  ✓ ' + text); } else { fehl++; console.log('  ✗ ' + text); }
}

const ARTEN = ['text_mit_kasten', 'karten', 'zahlenband', 'aufruf', 'zeitleiste', 'ehrentafel', 'turnierarchiv', 'kontakt',
  'zwei_spalten', 'freitext', 'tabelle', 'bilder'];

const BOESE = '<p onclick="alert(1)">Hallo <script>alert(2)</script><a href="javascript:alert(3)">böse</a> ' +
  '<a href=" JaVa&#x09;script:alert(4)">auch</a> <img src=x onerror=alert(5)> <iframe src="https://evil.example"></iframe>' +
  '<a href="https://example.org" onclick="x()" style="color:red" class="gross">gut</a> <style>body{display:none}</style>' +
  '<b style="color:red">fett</b> <a href="data:text/html;base64,PHNjcmlwdD5hbGVydCg4KTwvc2NyaXB0Pg==">daten</a> ' +
  '<a href="vbscript:msgbox(9)">vb</a> <span onmouseover="alert(10)">span</span></p><svg onload=alert(6)><script>alert(7)</script></svg>' +
  '<h1 class="x">Große Überschrift</h1><ul><li><p>Punkt <em>eins</em></p></li><li>zwei</li></ul><p></p><p>   </p>' +
  '<!-- Kommentar --><p>Ende &amp; aus &lt;script&gt;</p>';

function main() {
  const dir = kopieRepo('esv-robust-');
  console.log(`Wegwerf-Kopie: ${dir}\n`);
  const ws = join(dir, 'inhalt', 'weitere-seiten');
  mkdirSync(join(dir, 'medien', 'tabellen'), { recursive: true });
  // kaputte Excel-Datei: ZIP-Kopf, danach Binärmüll (reiner Text würde als CSV gelesen)
  const muell = Buffer.alloc(600);
  for (let i = 0; i < muell.length; i++) muell[i] = (i * 73 + 11) % 256;
  writeFileSync(join(dir, 'medien', 'tabellen', 'kaputt.xlsx'), Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), muell]));

  // Seite 1: nur leere Bausteine (jede Art einmal) + Müll-Einträge
  writeFileSync(join(ws, 'leer.json'), JSON.stringify({
    browsertitel: 'Leer', beschreibung: 'Nur leere Bausteine', menue_titel: 'Leer',
    kopf: { ueberschrift: 'Leere Bausteine' },
    bausteine: [...ARTEN.map((a) => ({ _block: a })), null, 'quatsch', 42, [], {}, { _block: 'gibtsnicht', text: 'x' },
      { _block: 'karten', karten: [{}, {}], hinweise: ['', '<p></p>'] }, { _block: 'zahlenband', zahlen: [{ zahl: '', text: '' }] }],
  }, null, 2));

  // Seite 2: kaputte Inhalte
  writeFileSync(join(ws, 'kaputt-inhalt.json'), JSON.stringify({
    browsertitel: 'Kaputt <script>alert("titel")</script>', beschreibung: 'Test "Anführung" & <b>',
    menue_titel: 'Kaputt', im_menue: true, sitemap_prioritaet: 'viel',
    kopf: { ueberschrift: 'Überschrift <script>alert(1)</script>', text: BOESE, bild: '/medien/bilder/gibt-es-nicht.jpg' },
    bausteine: [
      { _block: 'freitext', text: BOESE, hinweis: '<p onclick="x()">Hinweis <a href="javascript:void(0)">weg</a></p>' },
      { _block: 'bilder', ueberschrift: 'Bilder', bilder: [{ bild: '/medien/bilder/fehlt.jpg', beschreibung: 'fehlt' }, { bild: '../../etc/passwd' }, { bild: 'https://evil.example/x.png' }] },
      { _block: 'tabelle', ueberschrift: 'Kaputte Excel', excel: '/medien/tabellen/kaputt.xlsx', suchfeld: true },
      { _block: 'tabelle', ueberschrift: 'Fehlende Excel', excel: '/medien/tabellen/gibt-es-nicht.xlsx' },
      { _block: 'tabelle', ueberschrift: 'Eingefügt mit HTML', eingefuegt: 'Name\tWert\n<script>alert(1)</script>\t<b>fett</b>\n"Zitat"\t&amp;' },
      { _block: 'karten', ueberschrift: 'Karten', karten: [{ titel: 'Karte', bild: '/medien/bilder/fehlt.png', link_text: 'Link', link_ziel: 'javascript:alert(1)' }] },
      { _block: 'text_mit_kasten', text: '<p>Text</p>', button_text: 'Knopf', button_ziel: 'javascript:alert(1)', kasten: { infos: [{ begriff: 'B', wert: BOESE }] } },
      { _block: 'kontakt', infos: [{ begriff: 'X', wert: 'Y' }], formular_titel: 'F', formular_empfaenger: 'keine-adresse"><script>' },
      { _block: 'zwei_spalten', spalten: [{ anker: 'a"b<c', kicker: 'K', ueberschrift: 'Ü' }, null, 'x'] },
      { _block: 'turnierarchiv', ueberschrift: 'Archiv', weitere_reiter: [{ titel: 'Kaputt', excel: '/medien/tabellen/kaputt.xlsx' }] },
      { _block: 'aufruf', ueberschrift: 'Aufruf', button_text: 'Los', button_ziel: 'vbscript:x' },
    ],
  }, null, 2));

  // Seite 3: ungültiges JSON, ungültiger Dateiname
  writeFileSync(join(ws, 'kaputt-json.json'), '{ "browsertitel": "x", ');
  writeFileSync(join(ws, 'Falscher Name.json'), '{}');

  console.log('1) Bau mit kaputtem Inhalt');
  const r1 = baue(dir, ['--pruefen']);
  pruefe(r1.code === 0, `Exit-Code 0 (ist ${r1.code})`);
  const site = join(dir, '_site');
  for (const s of ['index', 'mannschaften', 'training', 'historie', 'vereinsmeisterschaft', 'kontakt', 'impressum', 'datenschutz', 'leer', 'kaputt-inhalt']) {
    pruefe(existsSync(join(site, `${s}.html`)), `${s}.html gebaut`);
  }
  pruefe(!existsSync(join(site, 'kaputt-json.html')), 'kaputt-json.json übersprungen');
  for (const m of ['unbekannte Art "gibtsnicht"', 'kaputt-json.json ist kein gültiges JSON', 'gibt-es-nicht.jpg', 'fehlt.jpg',
    'Tabellendatei "/medien/tabellen/gibt-es-nicht.xlsx" nicht gefunden', 'Tabelle "Kaputte Excel": ', 'Falscher Name.json',
    'keine gültige E-Mail-Adresse', 'unzulässiger Pfad']) {
    pruefe(r1.ausgabe.includes(m), `Warnung enthält: ${m}`);
  }

  // Erlaubte Skripte = genau die aus den echten Seiten
  const skripte = (h) => [...h.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[0]);
  const erlaubt = new Set([...skripte(readFileSync(join(site, 'index.html'), 'utf8')), ...skripte(readFileSync(join(site, 'vereinsmeisterschaft.html'), 'utf8'))]);
  for (const s of ['leer', 'kaputt-inhalt']) {
    const h = readFileSync(join(site, `${s}.html`), 'utf8');
    pruefe(skripte(h).every((x) => erlaubt.has(x)), `${s}: nur die eigenen Skripte (${skripte(h).length})`);
    pruefe(!/\son[a-z]+\s*=/i.test(h), `${s}: keine on…=-Attribute`);
    pruefe(!/(java|vb)script:|data:text/i.test(h), `${s}: kein javascript:/vbscript:/data:`);
    pruefe(!/<(iframe|svg|object|embed|img src=x)/i.test(h), `${s}: kein iframe/svg/object/eingeschleustes img`);
    // sauber escapte Attributwerte (ohne rohes < oder ") sind harmlos und werden vorher entfernt
    pruefe(!/<[^>]*alert\(/.test(h.replace(/="[^"<>]*"/g, '=""')), `${s}: kein alert( in Tags/Attributen (nur als escapter Text)`);
    pruefe(!/<style/i.test(h), `${s}: kein <style>`);
    pruefe(!/class="(x|gross)"|style="color:red"/.test(h), `${s}: fremde class/style-Attribute entfernt`);
  }
  const k = readFileSync(join(site, 'kaputt-inhalt.html'), 'utf8');
  const main = k.slice(k.indexOf('<main'), k.indexOf('</main>'));
  pruefe(main.includes('<a class="textlink" href="https://example.org" target="_blank" rel="noopener">gut</a>'), 'erlaubter fremder Link bleibt (textlink, target=_blank)');
  pruefe(main.includes('<b>fett</b>') && main.includes('Hallo') && main.includes('böse'), 'Text bleibt erhalten, Tags gesäubert');
  pruefe(main.includes('<h2>Große Überschrift</h2>'), 'h1 im Fließtext wird zu h2');
  pruefe(main.includes('<li>Punkt <em>eins</em></li>'), '<li><p>…</p></li> wird ausgepackt');
  pruefe(main.includes('Ende &amp; aus &lt;script&gt;'), 'Entitäten korrekt escaped');
  pruefe(k.includes('<title>Kaputt &lt;script&gt;alert("titel")&lt;/script&gt;</title>'), 'Browsertitel escaped');
  pruefe(main.includes('Überschrift &lt;script&gt;alert(1)&lt;/script&gt;'), 'Überschrift escaped');
  pruefe((main.match(/Diese Tabelle konnte nicht gelesen werden – bitte die Datei prüfen\./g) || []).length === 3,
    'Fehlersatz bei kaputter/fehlender Excel (2 Tabellen + 1 Reiter)');
  pruefe(main.includes('<td>&lt;script&gt;alert(1)&lt;/script&gt;</td>') && main.includes('<td>&lt;b&gt;fett&lt;/b&gt;</td>'), 'Tabellenzellen escaped');
  pruefe(!main.includes('page-head-bild'), 'fehlendes Kopfbild weggelassen');
  pruefe(!/<img|<figure/.test(main), 'fehlende/unzulässige Bilder weggelassen');
  pruefe(!main.includes('Knopf</a>') && !main.includes('>Los</a>') && !main.includes('>Link</a>'), 'Knöpfe/Links mit unzulässigem Ziel weggelassen');
  pruefe(!main.includes('<form'), 'Formular mit ungültigem Empfänger weggelassen');
  pruefe(main.includes('id="a-b-c"'), 'Anker gesäubert');
  pruefe(k.includes('<a href="kaputt-inhalt.html" aria-current="page">Kaputt</a>'), 'im_menue: Seite hängt im Menü');
  const leer = readFileSync(join(site, 'leer.html'), 'utf8');
  const leerMain = leer.slice(leer.indexOf('<main'), leer.indexOf('</main>'));
  // Erwartung: Seitenkopf + Turnierarchiv (zeigt auch ohne eigene Felder die festen Reiter aus inhalt/turniere/)
  pruefe((leerMain.match(/<section/g) || []).length === 2 && leerMain.includes('id="panel-vm"') && !leerMain.includes('statband')
    && !leerMain.includes('class="card"') && !leerMain.includes('cta-band'),
  'leere Bausteine erzeugen keine Abschnitte (nur Seitenkopf + Turnierarchiv mit festen Reitern)');
  const sm = readFileSync(join(site, 'sitemap.xml'), 'utf8');
  pruefe(sm.includes('/kaputt-inhalt</loc><priority>0.5</priority>'), 'ungültige Sitemap-Priorität → 0.5');
  pruefe(r1.ausgabe.includes('Inhaltsprüfung:') && r1.ausgabe.includes('sitemap_prioritaet: Wert "viel" ist nicht erlaubt'), '--pruefen meldet Inhaltsprobleme');

  console.log('\n2) Design-Varianten');
  const einstPfad = join(dir, 'inhalt', 'einstellungen.json');
  const einst = JSON.parse(readFileSync(einstPfad, 'utf8'));
  einst.design = { farbschema: 'nachtblau', akzentfarbe: '#3FA7D6' };
  writeFileSync(einstPfad, JSON.stringify(einst));
  const r2 = baue(dir);
  const idx2 = readFileSync(join(site, 'index.html'), 'utf8');
  pruefe(r2.code === 0 && /<style>:root\{--ink-900:#0B1626;.*--gold:#3FA7D6;--gold-l:#[0-9A-F]{6};--gold-d:#[0-9A-F]{6}\}/.test(idx2), 'nachtblau + Akzent → <style> mit Variablen');
  einst.design = { farbschema: 'pink', akzentfarbe: 'rot' };
  writeFileSync(einstPfad, JSON.stringify(einst));
  const r3 = baue(dir);
  const idx3 = readFileSync(join(site, 'index.html'), 'utf8');
  pruefe(r3.code === 0 && !idx3.includes('<style>') && r3.ausgabe.includes('Unbekanntes Farbschema "pink"') && r3.ausgabe.includes('keine Hex-Farbe'), 'ungültige Werte → Standard + Warnung');
  einst.design = { farbschema: 'petrol', akzentfarbe: '' };
  writeFileSync(einstPfad, JSON.stringify(einst));
  const r4 = baue(dir);
  pruefe(r4.code === 0 && !readFileSync(join(site, 'index.html'), 'utf8').includes('<style>'), 'Standard (petrol, leer) → kein zusätzliches CSS');

  console.log('\n3) Startseite kaputt');
  writeFileSync(join(dir, 'inhalt', 'seiten', 'index.json'), '{ kaputt');
  const r5 = baue(dir);
  pruefe(r5.code !== 0, `Exit-Code ≠ 0 bei kaputter Startseite (ist ${r5.code})`);
  pruefe(existsSync(join(site, 'training.html')), 'andere Seiten werden trotzdem gebaut');
  rmSync(join(dir, 'inhalt', 'seiten', 'impressum.json'));
  const r6 = baue(dir);
  pruefe(r6.ausgabe.includes('Datei fehlt: inhalt') && r6.ausgabe.includes('impressum.json'), 'fehlende Pflichtseite wird gemeldet');

  console.log('\n4) Turnier-Jahrgänge: Sortierung');
  const fpPfad = join(dir, 'inhalt', 'turniere', 'facklerpokal.json');
  const fp = JSON.parse(readFileSync(fpPfad, 'utf8'));
  const eintrag = (jahr, sieger) => ({ jahr, sieger, zweiter: 'Z' });
  const zeilenVon = (panel) => {
    const h = readFileSync(join(site, 'vereinsmeisterschaft.html'), 'utf8');
    const a = h.indexOf(`id="panel-${panel}"`);
    const tab = h.slice(a, h.indexOf('</table>', a));
    return { caption: (tab.match(/<caption>([^<]*)<\/caption>/) || [])[1] || '', namen: [...tab.matchAll(/<tr data-s="[^"]*"><td class="(?:year|none)">([^<]*)<\/td><td class="win">([^<]*)<\/td>/g)].map((m) => m[2]) };
  };
  fp.excel = '';
  fp.jahrgaenge = [eintrag('2020', 'A20'), eintrag('2024', 'A24'), eintrag('', 'OhneJahr1'), eintrag('2022', 'A22'),
    eintrag('2024', 'B24'), eintrag('Quatsch', 'OhneJahr2'), eintrag('2021', 'A21')];
  writeFileSync(fpPfad, JSON.stringify(fp));
  baue(dir); // Startseite ist ab Punkt 3 absichtlich kaputt: Exit-Code hier egal
  const fz = zeilenVon('fp');
  pruefe(fz.namen.join(',') === 'A24,B24,A22,A21,A20,OhneJahr1,OhneJahr2',
    `unsortierte Liste → absteigend; gleiches Jahr bleibt in Reihenfolge; ohne Jahr am Ende (ist: ${fz.namen.join(',')})`);
  pruefe(fz.namen.indexOf('A24') < fz.namen.indexOf('B24'), 'zwei Einträge mit gleichem Jahr behalten ihre Reihenfolge');
  pruefe(fz.namen.slice(-2).join(',') === 'OhneJahr1,OhneJahr2', 'Einträge ohne Jahr stehen am Ende (Reihenfolge unverändert)');
  pruefe(fz.caption.includes('2020–2024') && fz.caption.includes('7 Einträge'), `Unterschrift stimmt trotz Sortierung (ist: ${fz.caption})`);
  writeFileSync(join(dir, 'medien', 'tabellen', 'fp.csv'), 'Jahr;Sieger;Zweiter\n2020;E20;Z\n2024;E24;Z\n2022;E22;Z\n');
  fp.excel = '/medien/tabellen/fp.csv';
  writeFileSync(fpPfad, JSON.stringify(fp));
  baue(dir);
  const ez = zeilenVon('fp');
  pruefe(ez.namen.join(',') === 'E20,E24,E22', `Excel-Reihenfolge bleibt unverändert (ist: ${ez.namen.join(',')})`);

  if (process.env.BEHALTEN) console.log(`(Kopie behalten: ${dir})`); else rmSync(dir, { recursive: true, force: true });
  console.log(`\nErgebnis Robustheit: ${ok} bestanden, ${fehl} fehlgeschlagen.`);
  process.exitCode = fehl ? 1 : 0;
}

main();
void WURZEL;
