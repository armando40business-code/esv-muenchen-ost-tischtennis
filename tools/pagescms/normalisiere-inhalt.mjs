// Bringt alle Inhaltsdateien, die im CMS pflegbar sind, in genau die Form, die Pages CMS beim Speichern schreibt
// (Nachbildung: tools/pagescms/speichern.mjs). Danach zeigt die erste echte Speicherung im CMS nur noch die gewollte
// Änderung statt hunderter Formatierungs-Zeilen.
//
//   node tools/pagescms/normalisiere-inhalt.mjs            -> Dateien umschreiben
//   node tools/pagescms/normalisiere-inhalt.mjs --pruefen  -> nur melden, was sich ändern würde (Exit 1, wenn etwas)
//
// Was sich ändert (alles ohne Wirkung auf die gebaute Seite): 2 Leerzeichen Einrückung, jedes Objekt mehrzeilig,
// Schlüssel in der Reihenfolge der Formularfelder, kein Zeilenumbruch am Dateiende, Schlüssel mit leerem Text ""
// entfallen, leere Fließtextfelder werden "<p></p>", Auswahl-/Ja-Nein-Felder bekommen ihren Standardwert.
// inhalt/technik.json steht nicht im CMS und bleibt unberührt.
// Danach prüfen: node tools/vergleich.mjs und node tools/bildvergleich.mjs (Seite muss gleich bleiben).

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ladeConfig, normalisiere, jsonDateien, lies, WURZEL } from './gemeinsam.mjs';
import { speichere, alsDateitext } from './speichern.mjs';

const NUR_PRUEFEN = process.argv.includes('--pruefen');
const { json, parseFehler } = ladeConfig();
if (!json) { console.error('.pages.yml nicht lesbar:', parseFehler.map((e) => e.message).join('; ')); process.exit(1); }
const { eintraege } = normalisiere(json);

let geaendert = 0;
let gesamt = 0;
for (const e of eintraege) {
  const dateien = e.type === 'file' ? [e.path] : e.type === 'collection' ? jsonDateien(e.path) : [];
  for (const d of dateien) {
    let text;
    try { text = lies(d); } catch { continue; }
    gesamt += 1;
    let daten;
    try { daten = JSON.parse(text); } catch (err) { console.error(`  ! ${d}: kein gültiges JSON (${err.message}) – übersprungen.`); continue; }
    const neu = alsDateitext(speichere(daten, e.fields ?? []));
    if (neu === text) continue;
    geaendert += 1;
    if (NUR_PRUEFEN) console.log(`  ~ ${d}: wäre umzuschreiben`);
    else { writeFileSync(join(WURZEL, d), neu, 'utf8'); console.log(`  ✓ ${d}: umgeschrieben`); }
  }
}
console.log(`\n${geaendert} von ${gesamt} Inhaltsdateien ${NUR_PRUEFEN ? 'wären umzuschreiben' : 'umgeschrieben'}.`);
if (NUR_PRUEFEN && geaendert) process.exitCode = 1;
