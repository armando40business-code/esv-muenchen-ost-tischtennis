// Abgleich der Speicher-Nachbildung (tools/pagescms/speichern.mjs) mit dem, was Pages CMS beim echten Speichern
// geschrieben hat: Wegwerf-Zweig cms-probe, 9 Commits über d951173. Die Dateien liegen byte-genau unter
// tools/tests/fixtures/cms-probe/vorher (Stand d951173) und …/nachher (Stand origin/cms-probe).
//
// Erwartung: Nachbildung(vorher) + die absichtlichen Testeingaben == nachher, Zeichen für Zeichen.
//
// Braucht das Paket "yaml" aus tools/node_modules (cd tools && npm install). Fehlt es (z. B. im
// Veröffentlichen-Workflow, der nichts installiert), wird der Test übersprungen.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const FIX = join(HIER, 'fixtures', 'cms-probe');
const lies = (teil, datei) => readFileSync(join(FIX, teil, datei), 'utf8');

let werkzeug = null;
try {
  await import('yaml');
  const g = await import('../pagescms/gemeinsam.mjs');
  const s = await import('../pagescms/speichern.mjs');
  werkzeug = { eintraege: g.normalisiere(g.ladeConfig().json).eintraege, ...s };
} catch { /* yaml fehlt: Tests werden übersprungen */ }
const ohneYaml = werkzeug ? false : 'Paket "yaml" fehlt (cd tools && npm install)';

// Die absichtlichen Eingaben aus dem Test in der echten Oberfläche – alles andere muss die Nachbildung liefern.
const TESTEINGABEN = {
  'inhalt/seiten/index.json': (o) => { o.kopf.ueberschrift = 'Tischtennis mitten in München-Ost (Probe).'; },
  'inhalt/seiten/training.json': (o) => {
    assert.equal(o.bausteine[0].hinweise[1], '<p>Gute ESV-Tradition: Nach dem Training geht es meist noch in eine nahegelegene Wirtschaft oder in unsere Gemeinschaftsräume – zum geselligen Ausklang.</p>');
    o.bausteine[0].hinweise[1] = '<p>Gute ESV-Tradition: Nach dem Training geht es meist noch in eine nahegelegene <strong>Wirtschaft </strong>oder in unsere Gemeinschaftsräume – zum geselligen Ausklang. Probewort</p>';
  },
  'inhalt/seiten/impressum.json': (o) => {
    const b = o.bausteine[0];
    assert.ok(b.text.endsWith('teilzunehmen.</p>'));
    b.text = b.text.replace(/teilzunehmen\.<\/p>$/, 'teilzunehmen. Dies ist ein Probesatz aus Pages CMS.</p>');
  },
  'inhalt/einstellungen.json': (o) => { o.fusszeile.text += ' Probe'; },
  'inhalt/turniere/vereinsmeisterschaft.json': (o) => {
    o.jahrgaenge.push({ jahr: '2027', platz1: 'Probe A', doppel: 'Probe B / Probe C\nProbe D / Probe E' });
  },
};

for (const [datei, eingeben] of Object.entries(TESTEINGABEN)) {
  test(`Speicher-Nachbildung = echte Speicherung (cms-probe): ${datei}`, { skip: ohneYaml }, () => {
    const felder = werkzeug.felderFuer(werkzeug.eintraege, datei);
    assert.ok(felder, `${datei} steht nicht im CMS`);
    const vorher = JSON.parse(lies('vorher', datei));
    const nachgebildet = werkzeug.speichere(vorher, felder);
    eingeben(nachgebildet);
    assert.equal(werkzeug.alsDateitext(nachgebildet), lies('nachher', datei));
  });
}

test('Speicher-Nachbildung: zweimal speichern ändert nichts mehr', { skip: ohneYaml }, () => {
  for (const datei of Object.keys(TESTEINGABEN)) {
    const felder = werkzeug.felderFuer(werkzeug.eintraege, datei);
    const einmal = werkzeug.speichere(JSON.parse(lies('vorher', datei)), felder);
    assert.equal(werkzeug.alsDateitext(werkzeug.speichere(einmal, felder)), werkzeug.alsDateitext(einmal), datei);
  }
});

test('Speicher-Nachbildung: Einzelregeln wie in der echten Oberfläche', { skip: ohneYaml }, () => {
  const felder = [
    { name: 'titel', type: 'string' },
    { name: 'text', type: 'rich-text', options: { format: 'html' } },
    { name: 'stil', type: 'select', default: 'gold', options: { values: ['gold', 'rahmen'] } },
    { name: 'an', type: 'boolean', default: false },
    { name: 'punkte', type: 'rich-text', list: true },
    { name: 'liste', type: 'object', list: true, fields: [{ name: 'a', type: 'string' }, { name: 'b', type: 'string' }] },
  ];
  const aus = werkzeug.speichere({ unbekannt: 1, liste: [{ b: 'x', a: '' }], titel: '', punkte: [] }, felder);
  assert.deepEqual(aus, { text: '<p></p>', stil: 'gold', an: false, liste: [{ b: 'x' }] });
  assert.deepEqual(Object.keys(aus), ['text', 'stil', 'an', 'liste'], 'Reihenfolge der Formularfelder');
  assert.equal(werkzeug.alsDateitext({ a: [{ b: 1 }] }), '{\n  "a": [\n    {\n      "b": 1\n    }\n  ]\n}', 'kein Zeilenumbruch am Ende');
});
