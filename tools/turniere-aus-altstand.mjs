#!/usr/bin/env node
// Einmal-Werkzeug: holt die Turniertabellen aus der alten vereinsmeisterschaft.html (Commit 05db18e)
// und schreibt inhalt/turniere/vereinsmeisterschaft.json und facklerpokal.json.
// Aufruf: node tools/turniere-aus-altstand.mjs [--schreiben]
// Ohne --schreiben wird nur geprüft und gezählt.

import { execFileSync } from 'node:child_process';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const ALT = '05db18e';
const html = execFileSync('git', ['show', `${ALT}:vereinsmeisterschaft.html`], { cwd: WURZEL, encoding: 'utf8' });

const ent = (s) => s.replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');

function panel(id) {
  const start = html.indexOf(`<div id="${id}"`);
  if (start < 0) throw new Error(`Panel ${id} nicht gefunden`);
  const ende = html.indexOf('</table>', start);
  const teil = html.slice(start, ende);
  const caption = ent(/<caption>([\s\S]*?)<\/caption>/.exec(teil)[1]);
  const kopf = [.../<thead>([\s\S]*?)<\/thead>/.exec(teil)[1].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => ent(m[1]));
  const tbody = /<tbody>([\s\S]*?)<\/tbody>/.exec(teil)[1];
  const zeilen = [...tbody.matchAll(/<tr data-s="([^"]*)">([\s\S]*?)<\/tr>/g)].map((m) => ({
    s: ent(m[1]),
    zellen: [...m[2].matchAll(/<td(?: class="([^"]*)")?>([\s\S]*?)<\/td>/g)].map((c) => ({
      klasse: c[1] || '',
      text: c[1] === 'none' ? '' : ent(c[2]).split(/<br\s*\/?>/).map((x) => x.trim()).join('\n'),
    })),
  }));
  return { caption, kopf, zeilen };
}

const vm = panel('panel-vm');
const fp = panel('panel-fp');

function pruefe(name, p, felder, erwartet) {
  const fehler = [];
  if (p.zeilen.length !== erwartet) fehler.push(`${name}: ${p.zeilen.length} Zeilen statt ${erwartet}`);
  for (const z of p.zeilen) {
    if (z.zellen.length !== felder.length) fehler.push(`${name} ${z.zellen[0]?.text}: ${z.zellen.length} Zellen`);
  }
  return fehler;
}

const fehler = [
  ...pruefe('Vereinsmeisterschaft', vm, ['jahr', 'platz1', 'platz2', 'platz3', 'doppel'], 49),
  ...pruefe('Facklerpokal', fp, ['jahr', 'sieger', 'zweiter'], 46),
];

const vmJson = {
  titel: 'Vereinsmeisterschaft',
  zusatz: 'Einzel und Doppel',
  excel: '',
  spaltentitel: { jahr: vm.kopf[0], platz1: vm.kopf[1], platz2: vm.kopf[2], platz3: vm.kopf[3], doppel: vm.kopf[4] },
  jahrgaenge: vm.zeilen.map((z) => ({
    jahr: z.zellen[0].text, platz1: z.zellen[1].text, platz2: z.zellen[2].text, platz3: z.zellen[3].text, doppel: z.zellen[4].text,
  })),
};
const fpJson = {
  titel: 'Facklerpokal',
  zusatz: 'Doppelturnier',
  excel: '',
  spaltentitel: { jahr: fp.kopf[0], sieger: fp.kopf[1], zweiter: fp.kopf[2] },
  jahrgaenge: fp.zeilen.map((z) => ({ jahr: z.zellen[0].text, sieger: z.zellen[1].text, zweiter: z.zellen[2].text })),
};

console.log(`Vereinsmeisterschaft: ${vm.zeilen.length} Zeilen (erwartet 49) – alte Unterschrift: ${vm.caption}`);
console.log(`Facklerpokal:         ${fp.zeilen.length} Zeilen (erwartet 46) – alte Unterschrift: ${fp.caption}`);
if (fehler.length) {
  console.error('FEHLER:\n  ' + fehler.join('\n  '));
  process.exit(1);
}

if (process.argv.includes('--schreiben')) {
  const ziel = join(WURZEL, 'inhalt', 'turniere');
  writeFileSync(join(ziel, 'vereinsmeisterschaft.json'), JSON.stringify(vmJson, null, 2) + '\n', 'utf8');
  writeFileSync(join(ziel, 'facklerpokal.json'), JSON.stringify(fpJson, null, 2) + '\n', 'utf8');
  console.log('geschrieben: inhalt/turniere/vereinsmeisterschaft.json, facklerpokal.json');
} else {
  for (const [datei, j] of [['vereinsmeisterschaft', vmJson], ['facklerpokal', fpJson]]) {
    const pfad = join(WURZEL, 'inhalt', 'turniere', `${datei}.json`);
    if (!existsSync(pfad)) { console.log(`${datei}.json fehlt noch`); continue; }
    const jetzt = JSON.parse(readFileSync(pfad, 'utf8'));
    const gleich = JSON.stringify(jetzt.jahrgaenge) === JSON.stringify(j.jahrgaenge);
    console.log(`${datei}.json: Jahrgänge ${gleich ? 'identisch mit Altstand' : 'WEICHEN AB vom Altstand'} (${liste(jetzt.jahrgaenge)} Einträge)`);
  }
}

function liste(x) { return Array.isArray(x) ? x.length : 0; }
