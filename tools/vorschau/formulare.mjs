// Erzeugt formulare.html: Nachbildung der Pflege-Formulare aus .pages.yml UND den echten Inhalten.
// Liest nur; schreibt nichts außerhalb des Rückgabewerts. Wiederverwendet tools/pagescms/gemeinsam.mjs
// (Komponenten auflösen) und lib/fliesstext.mjs (Säuberung von Fließtext).

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import { ladeConfig, normalisiere, WURZEL, istObjekt } from '../pagescms/gemeinsam.mjs';
import { fliesstext, nurText } from '../../lib/fliesstext.mjs';
import { esc, escAttr } from '../../lib/html.mjs';

const MAX_ZEILEN = 8;          // lange Listen: so viele Einträge zeigen, Rest als „… und N weitere“
const MAX_BILD_BYTES = 400 * 1024;
const PROBE_DIR = join(WURZEL, 'tools', 'probe');

// Ein Satz pro Abschnitts-Art (Schlüssel = name in .pages.yml, blocks:).
const ART_SATZ = {
  text_mit_kasten: 'Ein Text mit einem Info-Kasten daneben, zum Beispiel für Adresse, Zeiten oder Partner.',
  karten: 'Mehrere Karten nebeneinander, etwa für Mannschaften, Trainingszeiten oder Hallen.',
  zahlenband: 'Ein schmales Band mit großen Zahlen, zum Beispiel „50+ – Jahre im Verein“.',
  aufruf: 'Ein farbiges Band am Seitenende mit kurzem Text und einem Knopf.',
  zeitleiste: 'Die Stationen der Vereinsgeschichte, Jahr für Jahr von oben nach unten.',
  ehrentafel: 'Kacheln mit Rekordsiegern und Zahlen, in Gruppen geordnet.',
  turnierarchiv: 'Die Sieger aller Turniere als Tabellen mit Reitern und Suchfeld.',
  kontakt: 'Kontaktangaben links, rechts ein Formular, das das E-Mail-Programm öffnet.',
  zwei_spalten: 'Zwei Textspalten nebeneinander, am Handy untereinander.',
  freitext: 'Ein langer Text mit Überschriften, Listen und Links, zum Beispiel für Neuigkeiten.',
  tabelle: 'Eine Tabelle aus einer Excel-Datei oder aus eingefügten Zellen, auf Wunsch mit Suchfeld.',
  bilder: 'Ein oder mehrere Bilder nebeneinander, mit Bildunterschrift.',
};

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml' };
const BILD_ENDUNGEN = new Set(Object.keys(MIME));

const text = (w) => (typeof w === 'string' ? w : typeof w === 'number' || typeof w === 'boolean' ? String(w) : '');

function leseJson(abs) {
  try { return JSON.parse(readFileSync(abs, 'utf8')); } catch { return null; }
}

function dateiFuerPfad(pfad) {
  const p = text(pfad).trim();
  if (!p) return null;
  const rel = p.replace(/^\/+/, '');
  for (const kandidat of [join(WURZEL, rel), join(PROBE_DIR, basename(rel))]) {
    if (existsSync(kandidat) && statSync(kandidat).isFile()) return kandidat;
  }
  return null;
}

export function formulareHtml({ css, js, erzeugt }) {
  const cfg = ladeConfig();
  if (!cfg.json) throw new Error('.pages.yml lässt sich nicht lesen: ' + cfg.parseFehler.map((f) => f.message).join('; '));
  const { eintraege, medien, komponenten, meldungen } = normalisiere(cfg.json);

  let zaehler = 0;
  const neueId = (p = 'f') => `${p}${++zaehler}`;
  const warnungen = [...meldungen];

  // ---- Bilder: jede Datei höchstens einmal als CSS-Klasse einbetten --------------------------
  const bilder = new Map(); // pfad -> { klasse, css } | { status }
  function bildInfo(pfad) {
    const p = text(pfad).trim();
    if (bilder.has(p)) return bilder.get(p);
    let info;
    const abs = dateiFuerPfad(p);
    if (!abs) info = { status: 'fehlt' };
    else {
      const gr = statSync(abs).size;
      const art = MIME[extname(abs).toLowerCase()];
      if (!art) info = { status: 'kein-bild', groesse: gr };
      else if (gr > MAX_BILD_BYTES) info = { status: 'gross', groesse: gr };
      else {
        const klasse = `bild-${bilder.size + 1}`;
        info = {
          status: 'ok', groesse: gr, klasse,
          css: `.${klasse}{background-image:url(data:${art};base64,${readFileSync(abs).toString('base64')})}`,
        };
      }
    }
    bilder.set(p, info);
    return info;
  }
  const kb = (n) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`);

  // ---- Bausteine ---------------------------------------------------------------------------------
  const knopf = (aktion, beschriftung, extra = '') =>
    `<button type="button" class="knopf ${extra}" data-aktion="${aktion}">${esc(beschriftung)}</button>`;

  function kopfzeile(f, id, pflichtMarke = true) {
    return `<span class="lbl" id="${id}-l">${esc(f.label ?? f.name)}${f.required && pflichtMarke ? '<span class="pflicht" title="Pflichtfeld" aria-label="Pflichtfeld">*</span>' : ''}</span>`
      + (f.description ? `<p class="hilfe" id="${id}-h">${esc(f.description)}</p>` : '');
  }
  const beschr = (f, id) => (f.description ? ` aria-describedby="${id}-h"` : '');

  function bildHtml(pfad, id, f) {
    const p = text(pfad).trim();
    let vorschau; let name = '';
    if (!p) {
      vorschau = '<span class="vorschau leer">Kein Bild gewählt</span>';
    } else {
      const info = bildInfo(p);
      name = basename(p);
      if (info.status === 'ok') vorschau = `<span class="vorschau ${info.klasse}" role="img" aria-label="${escAttr('Vorschau: ' + name)}"></span>`;
      else if (info.status === 'gross') vorschau = `<span class="vorschau leer">Vorschau nicht eingebettet (${kb(info.groesse)})</span>`;
      else if (info.status === 'fehlt') vorschau = '<span class="vorschau leer">Datei nicht gefunden</span>';
      else vorschau = '<span class="vorschau leer">keine Vorschau</span>';
    }
    return `<div class="bildfeld" role="group" aria-labelledby="${id}-l"${beschr(f, id)}>${vorschau}<div>`
      + (name ? `<div class="dateiname">${esc(name)}<small>${esc(p)}</small></div>` : '')
      + `<div class="bildknoepfe">${knopf('bild', p ? 'Anderes Bild wählen' : 'Bild wählen', 'klein')}${p ? knopf('entfernen', 'Entfernen', 'klein') : ''}</div></div></div>`;
  }

  function dateiHtml(pfad, id, f) {
    const p = text(pfad).trim();
    const abs = p ? dateiFuerPfad(p) : null;
    return `<div class="bildfeld" role="group" aria-labelledby="${id}-l"${beschr(f, id)}>`
      + (p ? `<span class="vorschau datei" aria-hidden="true">&#128196;</span>` : '<span class="vorschau leer">Keine Datei gewählt</span>')
      + '<div>'
      + (p ? `<div class="dateiname">${esc(basename(p))}<small>${esc(p)}${abs ? ' · ' + kb(statSync(abs).size) : ' · Datei nicht gefunden'}</small></div>` : '')
      + `<div class="bildknoepfe">${knopf('datei', p ? 'Andere Datei wählen' : 'Datei wählen', 'klein')}${p ? knopf('entfernen', 'Entfernen', 'klein') : ''}</div></div></div>`;
  }

  function editorHtml(wert, id, f, klein = false, labelId = null) {
    const inhalt = fliesstext(text(wert));
    return `<div class="editor${klein ? ' klein' : ''}">`
      + '<div class="werkzeuge" role="toolbar" aria-label="Textformatierung (nur angedeutet)">'
      + `<button type="button" class="fett" data-aktion="werkzeug">Fett</button>`
      + `<button type="button" class="kursiv" data-aktion="werkzeug">Kursiv</button>`
      + `<button type="button" class="link" data-aktion="werkzeug">Link</button>`
      + `<button type="button" data-aktion="werkzeug">Liste</button></div>`
      + `<div class="inhalt" id="${id}" role="textbox" aria-multiline="true" contenteditable="true" spellcheck="false" aria-labelledby="${labelId ?? id + '-l'}"${beschr(f, id)}>${inhalt}</div></div>`;
  }

  function optionen(f) {
    const v = f.options?.values;
    return Array.isArray(v) ? v.map((o) => (istObjekt(o) ? { value: text(o.value), label: text(o.label ?? o.value) } : { value: text(o), label: text(o) })) : [];
  }

  // Einzelnes Eingabeelement (ohne Beschriftung) für Felder ohne Liste.
  function eingabe(f, wert, id) {
    switch (f.type) {
      case 'text': {
        const t = text(wert);
        const zeilen = Math.min(8, Math.max(3, t.split('\n').length + 1));
        return `<textarea id="${id}" rows="${zeilen}"${beschr(f, id)} spellcheck="false">\n${esc(t)}</textarea>`;
      }
      case 'rich-text': return editorHtml(wert, id, f);
      case 'image': return bildHtml(wert, id, f);
      case 'file': return dateiHtml(wert, id, f);
      case 'select': {
        const opt = optionen(f);
        const aktuell = text(wert);
        const bekannt = opt.some((o) => o.value === aktuell);
        const liste = bekannt || aktuell === '' ? opt : [{ value: aktuell, label: aktuell }, ...opt];
        return `<select id="${id}"${beschr(f, id)}>${liste.map((o) => `<option value="${escAttr(o.value)}"${o.value === aktuell ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
      }
      case 'boolean': {
        const an = wert === true || wert === 'true';
        return `<button type="button" class="schalter" role="switch" id="${id}" aria-checked="${an}" aria-labelledby="${id}-l"${beschr(f, id)}><span class="spur" aria-hidden="true"></span><span class="zustand">${an ? 'Ein' : 'Aus'}</span></button>`;
      }
      case 'number': return `<input type="number" id="${id}" value="${escAttr(text(wert))}"${beschr(f, id)}>`;
      default: return `<input type="text" id="${id}" value="${escAttr(text(wert))}"${beschr(f, id)} spellcheck="false">`;
    }
  }

  const mitStandard = (f, wert) => (wert === undefined || wert === null ? (f.default !== undefined ? f.default : undefined) : wert);

  function feld(f, wert) {
    if (f.hidden) return '';
    wert = mitStandard(f, wert);
    const id = neueId();
    if (f.type === 'block') return blockListe(f, wert, id);
    const istListe = f.list !== undefined && f.list !== false && f.list !== null;
    if (istListe) return (f.type === 'object' || Array.isArray(f.fields)) ? objektListe(f, wert, id) : einfacheListe(f, wert, id);
    if (f.type === 'object' || Array.isArray(f.fields)) {
      const o = istObjekt(wert) ? wert : {};
      return `<div class="gruppe" role="group" aria-labelledby="${id}-l">${kopfzeile(f, id)}${felder(f.fields, o)}</div>`;
    }
    if (f.type === 'boolean') {
      return `<div class="feld">${kopfzeile(f, id)}${eingabe(f, wert, id)}</div>`;
    }
    if (f.type === 'image' || f.type === 'file') {
      return `<div class="feld">${kopfzeile(f, id)}${eingabe(f, wert, id)}</div>`;
    }
    if (f.type === 'rich-text') {
      return `<div class="feld">${kopfzeile(f, id)}${eingabe(f, wert, id)}</div>`;
    }
    return `<div class="feld"><label class="lbl" for="${id}">${esc(f.label ?? f.name)}${f.required ? '<span class="pflicht" title="Pflichtfeld" aria-label="Pflichtfeld">*</span>' : ''}</label>`
      + (f.description ? `<p class="hilfe" id="${id}-h">${esc(f.description)}</p>` : '')
      + eingabe(f, wert, id) + '</div>';
  }

  function felder(liste, objekt) {
    return (liste ?? []).map((f) => feld(f, objekt?.[f.name])).join('');
  }

  // Zusammenfassung einer eingeklappten Zeile nach der summary-Vorlage der .pages.yml.
  function zusammenfassung(vorlage, objekt, index) {
    const roh = text(vorlage).replace(/\{([^}]+)\}/g, (_, n) => {
      if (n === 'index') return String(index + 1);
      const w = objekt?.[n];
      if (typeof w === 'string') return /<[a-z][\s\S]*>/i.test(w) ? nurText(w) : w;
      return typeof w === 'number' ? String(w) : '';
    });
    const t = roh.replace(/\s+/g, ' ').trim();
    const leerText = !t || /^[\d\s.:·|/\-–—]*$/.test(t);
    return { t, leerText };
  }

  function zeileKopf(t, leerText, ohne, plakette) {
    return `<summary><span class="griff" aria-hidden="true">&#8942;&#8942;</span>`
      + `<span class="sum">${esc(t)}${leerText ? `${t ? ' ' : ''}<span class="ohne">(${esc(ohne)})</span>` : ''}</span>`
      + (plakette ? `<span class="plakette">${esc(plakette)}</span>` : '') + '</summary>';
  }

  function listenRahmen(f, id, zeilenHtml, rest, gesamt, addAktion = 'neu', extra = '') {
    return `<div class="feld" role="group" aria-labelledby="${id}-l">${kopfzeile(f, id)}`
      + (gesamt === 0 ? '<p class="leere-liste">Noch keine Einträge.</p>' : `<ol class="zeilen">${zeilenHtml}</ol>`)
      + (rest > 0 ? `<p class="mehr">… und ${rest} weitere</p>` : '')
      + `<div class="listenfuss">${knopf(addAktion, 'Add an item', 'haupt')}${extra}</div></div>`;
  }

  function objektListe(f, wert, id) {
    const arr = Array.isArray(wert) ? wert.filter((x) => x !== null && x !== undefined) : [];
    const vorlage = f.list?.collapsible?.summary ?? '{index}';
    const zeilen = arr.slice(0, MAX_ZEILEN).map((o, i) => {
      const obj = istObjekt(o) ? o : {};
      const { t, leerText } = zusammenfassung(vorlage, obj, i);
      return `<li><details class="zeile">${zeileKopf(t, leerText, 'leer', '')}<div class="zeile-innen">${felder(f.fields, obj)}`
        + `<div class="zeile-fuss">${knopf('loeschen', 'Eintrag löschen', 'klein gefahr')}</div></div></details></li>`;
    }).join('');
    return listenRahmen(f, id, zeilen, arr.length - MAX_ZEILEN, arr.length);
  }

  function einfacheListe(f, wert, id) {
    const arr = Array.isArray(wert) ? wert.filter((x) => x !== null && x !== undefined) : [];
    const zeilen = arr.slice(0, MAX_ZEILEN).map((w) => {
      const sid = neueId();
      let el;
      if (f.type === 'rich-text') el = editorHtml(w, sid, { description: '' }, true, `${id}-l`);
      else el = `<input type="text" id="${sid}" value="${escAttr(text(w))}" aria-labelledby="${id}-l" spellcheck="false">`;
      return `<li class="einfach"><span class="griff" aria-hidden="true">&#8942;&#8942;</span>${el}${knopf('loeschen', 'Löschen', 'klein gefahr')}</li>`;
    }).join('');
    return listenRahmen(f, id, zeilen, arr.length - MAX_ZEILEN, arr.length);
  }

  // Abschnitte einer Seite (Baustein-Liste)
  function blockListe(f, wert, id) {
    const arr = Array.isArray(wert) ? wert.filter((x) => x !== null && x !== undefined) : [];
    const blocks = f.blocks ?? [];
    const key = f.blockKey ?? '_block';
    const vorlage = f.list?.collapsible?.summary ?? '{index}. {ueberschrift}';
    const zeilen = arr.slice(0, MAX_ZEILEN).map((o, i) => {
      const obj = istObjekt(o) ? o : {};
      const art = blocks.find((b) => b.name === obj[key]);
      const { t, leerText } = zusammenfassung(vorlage, obj, i);
      const inhalt = art ? felder(art.fields, obj) : `<p class="hilfe">Unbekannte Abschnitts-Art „${esc(obj[key])}“.</p>`;
      if (!art) warnungen.push(`Abschnitt ${i + 1}: unbekannte Art "${obj[key]}"`);
      return `<li><details class="zeile">${zeileKopf(t, leerText, 'ohne Überschrift', art?.label ?? text(obj[key]))}<div class="zeile-innen">${inhalt}`
        + `<div class="zeile-fuss">${knopf('loeschen', 'Abschnitt löschen', 'klein gefahr')}</div></div></details></li>`;
    }).join('');
    const extra = '<button type="button" class="knopf klein" data-aktion="arten">Welche Abschnitts-Arten gibt es?</button>';
    return listenRahmen(f, id, zeilen, arr.length - MAX_ZEILEN, arr.length, 'arten', extra);
  }

  // Auswahlfenster: alle Arten, genommen aus der ersten Baustein-Liste der Konfiguration
  function findeBlocks(felderListe) {
    for (const f of felderListe ?? []) if (f.type === 'block' && Array.isArray(f.blocks)) return f;
    return null;
  }
  const ersteBlockListe = eintraege.map((e) => findeBlocks(e.fields)).find(Boolean);
  const artenDialog = (() => {
    const bl = ersteBlockListe?.blocks ?? [];
    for (const name of Object.keys(ART_SATZ)) if (!bl.some((b) => b.name === name)) warnungen.push(`Abschnitts-Art "${name}" steht nicht (mehr) in .pages.yml`);
    return `<dialog id="arten-dialog" aria-labelledby="arten-titel"><div class="dlg-kopf"><div><h3 id="arten-titel">Diese Abschnitts-Arten kann man hinzufügen</h3>`
      + `<p>${bl.length} Arten. In der echten Oberfläche wählst du nach „Add an item“ eine davon aus.</p></div>${knopf('zu', 'Schließen', 'klein')}</div>`
      + `<ul class="arten">${bl.map((b) => `<li><strong>${esc(b.label ?? b.name)}</strong><span>${esc(ART_SATZ[b.name] ?? b.description ?? '')}</span></li>`).join('')}</ul></dialog>`;
  })();

  // ---- Formulare (Panels) ----------------------------------------------------------------------
  const panels = [];
  const nav = [];       // { gruppe, id, label }
  const optgruppen = new Map();
  const aufnehmen = (gruppe, id, label) => {
    nav.push({ gruppe, id, label });
    if (!optgruppen.has(gruppe)) optgruppen.set(gruppe, []);
    optgruppen.get(gruppe).push({ id, label });
  };

  function panel(id, titel, beschreibung, inhalt, eltern = null) {
    return `<section class="formular" id="${escAttr(id)}" data-titel="${escAttr(titel)}"${eltern ? ` data-eltern="${escAttr(eltern)}"` : ''} hidden>`
      + inhalt.vor
      + `<h2>${esc(titel)}</h2>${beschreibung ? `<p class="beschr">${esc(beschreibung)}</p>` : ''}${inhalt.html}</section>`;
  }

  for (const e of eintraege) {
    const gruppe = e.gruppe.join(' / ');
    aufnehmen(gruppe, e.name, e.label ?? e.name);
    if (e.type === 'collection') {
      const ordner = join(WURZEL, e.path);
      const dateien = existsSync(ordner) ? readdirSync(ordner).filter((d) => d.toLowerCase().endsWith('.json')).sort() : [];
      const eintragsliste = dateien.map((d) => ({ id: `${e.name}--${d.replace(/\.json$/i, '')}`, daten: leseJson(join(ordner, d)) ?? {}, probe: false }));
      if (existsSync(join(PROBE_DIR, 'probe.json'))) eintragsliste.push({ id: `${e.name}--probe`, daten: leseJson(join(PROBE_DIR, 'probe.json')) ?? {}, probe: true });
      const primaer = e.view?.primary ?? 'menue_titel';
      const spalte2 = (e.view?.fields ?? []).find((n) => n !== primaer) ?? 'browsertitel';
      const l2 = (e.fields ?? []).find((f) => f.name === spalte2)?.label ?? spalte2;
      const l1 = (e.fields ?? []).find((f) => f.name === primaer)?.label ?? primaer;
      const tab = `<table class="tabelle-liste"><thead><tr><th scope="col">${esc(l1)}</th><th scope="col">${esc(l2)}</th></tr></thead><tbody>`
        + eintragsliste.map((x) => `<tr><td><a href="#${escAttr(x.id)}">${esc(text(x.daten[primaer]) || x.id)}</a>${x.probe ? '<span class="vermerk">Probe – nur in dieser Vorschau</span>' : ''}</td><td>${esc(text(x.daten[spalte2]))}</td></tr>`).join('')
        + '</tbody></table>';
      panels.push(panel(e.name, e.label ?? e.name, e.description, {
        vor: '',
        html: (eintragsliste.length ? tab : '<p class="leere-liste">Noch keine eigenen Seiten angelegt.</p>')
          + `<div class="listenfuss">${knopf('seite', 'Add an entry', 'haupt')}</div>`,
      }));
      for (const x of eintragsliste) {
        panels.push(panel(x.id, text(x.daten[primaer]) || x.id, x.probe ? 'Probe-Seite aus tools/probe – gehört nicht zum echten Inhalt, hängt aber in dieser Vorschau als weitere Seite.' : '', {
          vor: `<a class="zurueck" href="#${escAttr(e.name)}">&larr; ${esc(e.label ?? e.name)}</a>`,
          html: felder(e.fields, x.daten),
        }, e.name));
      }
    } else {
      const daten = leseJson(join(WURZEL, e.path)) ?? {};
      panels.push(panel(e.name, e.label ?? e.name, e.description, { vor: '', html: felder(e.fields, daten) }));
    }
  }

  // Medien
  {
    aufnehmen('', 'medien', 'Medien');
    let html = '';
    for (const m of medien) {
      const ordner = join(WURZEL, m.input);
      const endungen = new Set((m.extensions ?? []).map((x) => `.${String(x).toLowerCase()}`));
      let dateien = existsSync(ordner) ? readdirSync(ordner).filter((d) => !endungen.size || endungen.has(extname(d).toLowerCase())).sort().map((d) => ({ name: d, abs: join(ordner, d), pfad: `${m.output}/${d}`, probe: false })) : [];
      for (const d of existsSync(PROBE_DIR) ? readdirSync(PROBE_DIR) : []) {
        if (endungen.has(extname(d).toLowerCase())) dateien.push({ name: d, abs: join(PROBE_DIR, d), pfad: `${m.output}/${d}`, probe: true });
      }
      html += `<h3 class="medien-titel">${esc(m.label ?? m.name)}</h3>`;
      if (!dateien.length) { html += '<p class="leere-liste">Noch keine Dateien.</p>'; continue; }
      html += '<ul class="dateien">' + dateien.map((d) => {
        let v;
        if (BILD_ENDUNGEN.has(extname(d.name).toLowerCase())) {
          const info = bildInfo(d.pfad);
          v = info.status === 'ok' ? `<span class="vorschau ${info.klasse}" role="img" aria-label="${escAttr('Vorschau: ' + d.name)}"></span>` : '<span class="vorschau leer">keine Vorschau</span>';
        } else v = '<span class="vorschau datei" aria-hidden="true">&#128196;</span>';
        return `<li>${v}<div class="dateiname">${esc(d.name)}<small>${kb(statSync(d.abs).size)}${d.probe ? ' · Probe' : ''}</small></div></li>`;
      }).join('') + '</ul>';
    }
    html += `<div class="listenfuss">${knopf('bild', 'Hochladen', 'haupt')}</div>`;
    panels.push(panel('medien', 'Medien', 'Alle hochgeladenen Bilder und Tabellen. Hier kann man neue Dateien hinzufügen.', { vor: '', html }));
  }

  // ---- Seitenleiste -----------------------------------------------------------------------------
  const reihenfolge = [];
  for (const n of nav) {
    const letzte = reihenfolge[reihenfolge.length - 1];
    if (letzte && letzte.gruppe === n.gruppe) letzte.punkte.push(n); else reihenfolge.push({ gruppe: n.gruppe, punkte: [n] });
  }
  const seitenleiste = '<nav id="seitenleiste" aria-label="Formulare">'
    + reihenfolge.map((g) => {
      const kopf = g.gruppe ? `<p class="gruppe-titel">${esc(g.gruppe)}</p>` : '<div class="trenner" role="presentation"></div>';
      return `${kopf}<ul>${g.punkte.map((p) => `<li><a href="#${escAttr(p.id)}" data-ziel="${escAttr(p.id)}">${esc(p.label)}</a></li>`).join('')}</ul>`;
    }).join('')
    + `<p class="stand">Werte aus den Dateien unter inhalt/, Stand ${esc(erzeugt)}.</p></nav>`;

  const auswahl = '<div class="auswahl"><label for="auswahl">Formular wählen</label><select id="auswahl">'
    + reihenfolge.map((g) => {
      const opts = g.punkte.map((p) => `<option value="${escAttr(p.id)}">${esc(p.label)}</option>`).join('');
      return g.gruppe ? `<optgroup label="${escAttr(g.gruppe)}">${opts}</optgroup>` : opts;
    }).join('')
    + '</select></div>';

  const bildCss = [...bilder.values()].filter((b) => b.css).map((b) => b.css).join('\n');

  const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<link rel="icon" href="data:,">
<title>Nachbildung der Formulare</title>
<style>
${css}
${bildCss}
</style>
</head>
<body>
<div class="banner" role="note"><strong>Nachbildung zur Ansicht – nichts wird gespeichert.</strong> Die echte Oberfläche (Pages CMS) sieht ähnlich aus, aber nicht genau so.</div>
${auswahl}
<div class="rahmen">
${seitenleiste}
<main id="inhalt">
${panels.join('\n')}
</main>
</div>
${artenDialog}
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script>
${js}
</script>
</body>
</html>
`;
  return { html, warnungen, anzahlPanels: panels.length, bilder: [...bilder.entries()].map(([p, b]) => `${p}:${b.status}`) };
}
