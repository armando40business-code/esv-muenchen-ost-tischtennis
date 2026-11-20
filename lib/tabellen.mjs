// Turnierarchiv (Reiter + Suche) und frei gepflegte Tabellen (aus Excel/CSV oder eingefügtem Text).

import { existsSync } from 'node:fs';
import { esc, escAttr, txt, leer, liste, obj, janein } from './html.mjs';
import { ein, sektion, titelzeilen } from './abschnitt.mjs';

export const FEHLER_SATZ = 'Diese Tabelle konnte nicht gelesen werden – bitte die Datei prüfen.';

export const TURNIERE = [
  {
    datei: 'vereinsmeisterschaft', id: 'vm', felder: ['jahr', 'platz1', 'platz2', 'platz3', 'doppel'], sieger: [1, 4],
    spaltentitel: { jahr: 'Jahr', platz1: 'Einzel 1. Platz', platz2: '2. Platz', platz3: '3. Platz', doppel: 'Doppel-Sieger' },
  },
  {
    datei: 'facklerpokal', id: 'fp', felder: ['jahr', 'sieger', 'zweiter'], sieger: [1],
    spaltentitel: { jahr: 'Jahr', sieger: 'Siegerdoppel', zweiter: '2. Platz' },
  },
];

/**
 * Tabellenquelle lesen. Vorrang: excel > eingefuegt.
 * Ergebnis: { ok:true, zeilen:string[][] } | { ok:false, fehler } | { leer:true }
 */
export async function leseQuelle(excel, eingefuegt, ctx, wo) {
  const leser = ctx.leser;
  const melde = (fehler) => {
    ctx.warn(`${wo}: ${fehler}`);
    return { ok: false, fehler };
  };
  try {
    if (!leer(excel)) {
      const pfad = ctx.dateiPfad(excel);
      if (!pfad || !existsSync(pfad)) return melde(`Tabellendatei "${txt(excel)}" nicht gefunden.`);
      if (!leser || typeof leser.leseTabellenDatei !== 'function') return melde('Tabellenleser (lib/tabellenleser.mjs) fehlt – Tabelle nicht lesbar.');
      return pruefe(await leser.leseTabellenDatei(pfad), melde, ctx, wo);
    }
    if (!leer(eingefuegt)) {
      if (!leser || typeof leser.leseTabellenText !== 'function') return melde('Tabellenleser (lib/tabellenleser.mjs) fehlt – Tabelle nicht lesbar.');
      return pruefe(await leser.leseTabellenText(txt(eingefuegt)), melde, ctx, wo);
    }
  } catch (e) {
    return melde(`Tabelle konnte nicht gelesen werden (${e.message}).`);
  }
  return { leer: true };
}

function pruefe(r, melde, ctx, wo) {
  if (!r || r.ok !== true || !Array.isArray(r.zeilen)) return melde(txt(r && r.fehler) || 'Tabelle konnte nicht gelesen werden.');
  for (const h of liste(r.hinweise)) ctx.hinweis(`${wo}: ${txt(h)}`);
  const zeilen = r.zeilen
    .filter(Array.isArray)
    .map((z) => z.map((c) => txt(c)))
    .filter((z) => z.some((c) => c.trim() !== ''));
  return { ok: true, zeilen };
}

/** Zelleninhalt: Zeilenumbruch -> <br>. */
function zelle(wert) {
  return txt(wert).split(/\r?\n/).map((s) => esc(s.trim())).filter(Boolean).join('<br>');
}

function suchtext(zellen) {
  return zellen.map((c) => txt(c).replace(/\s*\r?\n\s*/g, ' ').trim()).filter(Boolean).join(' ').toLowerCase();
}

function zeileHtml(zellen, klassen, leerStrich) {
  const tds = zellen.map((c, i) => {
    const inhalt = zelle(c);
    if (!inhalt && leerStrich) return '<td class="none">—</td>';
    const k = klassen(i);
    return `<td${k ? ` class="${k}"` : ''}>${inhalt}</td>`;
  });
  return `<tr data-s="${escAttr(suchtext(zellen))}">${tds.join('')}</tr>`;
}

function tabellenHtml({ caption, kopf, zeilen, klassen, leerStrich }) {
  const z = ['<div class="table-wrap">', '  <table class="data">'];
  if (caption) z.push(`    <caption>${esc(caption)}</caption>`);
  if (kopf && kopf.length) z.push(`    <thead><tr>${kopf.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>`);
  z.push('    <tbody>', ...zeilen.map((r) => '      ' + zeileHtml(r, klassen, leerStrich)), '    </tbody>', '  </table>', '</div>');
  return z.join('\n');
}

function jahrgangText(n) {
  return `${n} ${n === 1 ? 'Jahrgang' : 'Jahrgänge'}`;
}

/** Tabellenunterschrift: „Titel 1979–2026 · Zusatz · 49 Jahrgänge“. */
export function unterschrift(titel, zusatz, zeilen) {
  const jahre = zeilen.map((r) => txt(r[0]).trim()).filter((j) => /^\d{4}$/.test(j)).map(Number);
  let s = txt(titel).trim();
  if (jahre.length) {
    const von = Math.min(...jahre);
    const bis = Math.max(...jahre);
    s += ` ${von === bis ? von : `${von}–${bis}`}`;
  }
  const teile = [s];
  if (!leer(zusatz)) teile.push(txt(zusatz).trim());
  teile.push(jahre.length === zeilen.length ? jahrgangText(zeilen.length) : `${zeilen.length} Einträge`);
  return teile.filter(Boolean).join(' · ');
}

/** Erste vierstellige Zahl im Feld „jahr“ (z. B. „2026“ oder „2025/26“ → 2025); sonst null. */
function jahrAlsZahl(v) {
  const m = txt(v).match(/\d{4}/);
  return m ? Number(m[0]) : null;
}

/** Daten eines festen Turniers (aus JSON oder Excel). */
async function turnierDaten(def, ctx) {
  const t = obj(ctx.turniere[def.datei]);
  const titel = leer(t.titel) ? def.datei : txt(t.titel);
  const st = obj(t.spaltentitel);
  let kopf = def.felder.map((f) => (leer(st[f]) ? def.spaltentitel[f] : txt(st[f])));
  let zeilen;
  if (!leer(t.excel)) {
    const r = await leseQuelle(t.excel, '', ctx, `Turnier "${titel}" (Excel)`);
    if (!r.ok) return { titel, fehler: true };
    kopf = r.zeilen[0] || kopf;
    zeilen = r.zeilen.slice(1);
  } else {
    // Reihenfolge in der Liste ist egal: stabil nach Jahr absteigend sortieren, Einträge ohne lesbares Jahr ans Ende.
    zeilen = liste(t.jahrgaenge)
      .map((j) => ({ r: def.felder.map((f) => txt(obj(j)[f])), jahr: jahrAlsZahl(obj(j).jahr) }))
      .filter((e) => e.r.some((c) => c.trim() !== ''))
      .sort((a, b) => (a.jahr === null) - (b.jahr === null) || (a.jahr !== null ? b.jahr - a.jahr : 0))
      .map((e) => e.r);
  }
  return { titel, zusatz: t.zusatz, kopf, zeilen };
}

// 7. turnierarchiv -------------------------------------------------------------
export async function turnierarchiv(b, ctx) {
  ctx.zaehler.archiv = (ctx.zaehler.archiv || 0) + 1;
  const nr = ctx.zaehler.archiv;
  const suffix = nr === 1 ? '' : `-${nr}`;
  const reiter = [];
  for (const def of TURNIERE) {
    if (!ctx.turniere[def.datei]) continue;
    const d = await turnierDaten(def, ctx);
    reiter.push({ id: def.id + suffix, ...d, klassen: (i) => (i === 0 ? 'year' : def.sieger.includes(i) ? 'win' : '') });
  }
  let n = 0;
  for (const r of liste(b.weitere_reiter)) {
    n++;
    if (leer(r.titel) && leer(r.excel) && leer(r.eingefuegt)) continue;
    const titel = leer(r.titel) ? `Tabelle ${n}` : txt(r.titel);
    const q = await leseQuelle(r.excel, r.eingefuegt, ctx, `Turnierarchiv, Reiter "${titel}"`);
    const id = `r${n}${suffix}`;
    if (q.leer) continue;
    if (!q.ok) { reiter.push({ id, titel, fehler: true }); continue; }
    reiter.push({ id, titel, kopf: q.zeilen[0] || [], zeilen: q.zeilen.slice(1),
      klassen: (i) => (i === 0 ? 'year' : i === 1 ? 'win' : '') });
  }
  if (!reiter.length) return '';
  ctx.brauchtSuche = true;

  const z = titelzeilen(b);
  const platzhalter = leer(b.suchfeld_text) ? 'Name oder Jahr suchen …' : txt(b.suchfeld_text);
  const keinTreffer = leer(b.kein_treffer_text) ? 'Kein Treffer – probier einen anderen Namen oder ein anderes Jahr.' : txt(b.kein_treffer_text);
  z.push('', `<div class="toolbar${z.length ? ' toolbar-abstand' : ''}">`,
    '  <div class="tabs" role="tablist" aria-label="Turnier wählen">',
    ...reiter.map((r, i) => `    <button class="tab" role="tab" id="tab-${r.id}" aria-controls="panel-${r.id}" aria-selected="${i === 0 ? 'true' : 'false'}" data-panel="panel-${r.id}">${esc(r.titel)}</button>`),
    '  </div>', '  <div class="search">', `    <label class="skip" for="q${suffix}">Nach Name oder Jahr suchen</label>`,
    `    <input id="q${suffix}" type="search" placeholder="${escAttr(platzhalter)}" autocomplete="off">`, '  </div>', '</div>');
  reiter.forEach((r, i) => {
    z.push('', `<div id="panel-${r.id}" role="tabpanel" aria-labelledby="tab-${r.id}" data-tafel${i === 0 ? '' : ' hidden'}>`);
    if (r.fehler) {
      z.push(`  <p class="hint">${esc(FEHLER_SATZ)}</p>`);
    } else {
      z.push(ein(tabellenHtml({ caption: unterschrift(r.titel, r.zusatz, r.zeilen), kopf: r.kopf, zeilen: r.zeilen, klassen: r.klassen, leerStrich: true }), 2),
        `  <p class="no-hits" hidden>${esc(keinTreffer)}</p>`);
    }
    z.push('</div>');
  });
  const h = ctx.zl(b.hinweis);
  if (h) z.push('', `<p class="hint">${h}</p>`);
  return sektion(b, z.join('\n'), { wrapAttr: ' data-suche' });
}

// 11. tabelle ------------------------------------------------------------------
export async function tabelle(b, ctx) {
  ctx.zaehler.tafel = (ctx.zaehler.tafel || 0) + 1;
  const nr = ctx.zaehler.tafel;
  const z = titelzeilen(b);
  const text = ctx.ft(b.text);
  if (text) z.push(z.length ? `<div class="block-text">\n${ein(text, 2)}\n</div>` : text);
  const wo = `Tabelle${leer(b.ueberschrift) ? ` Nr. ${nr}` : ` "${txt(b.ueberschrift)}"`}`;
  const q = await leseQuelle(b.excel, b.eingefuegt, ctx, wo);
  const suche = janein(b.suchfeld, false);
  let wrapAttr = '';
  if (q.ok === false) {
    z.push(`<p class="hint">${esc(FEHLER_SATZ)}</p>`);
  } else if (q.ok) {
    const breite = Math.max(0, ...q.zeilen.map((r) => r.length));
    const zeilen = q.zeilen.map((r) => r.concat(Array(breite - r.length).fill('')));
    const mitKopf = janein(b.kopfzeile, true);
    const kopf = mitKopf ? zeilen[0] : null;
    const daten = mitKopf ? zeilen.slice(1) : zeilen;
    const fett = janein(b.erste_spalte_fett, false);
    const html = tabellenHtml({ kopf, zeilen: daten, klassen: (i) => (i === 0 && fett ? 'win' : ''), leerStrich: false });
    if (suche) {
      ctx.brauchtSuche = true;
      wrapAttr = ' data-suche';
      z.push(`<div class="toolbar${z.length ? ' toolbar-abstand' : ''}">`, '  <div class="search">',
        `    <label class="skip" for="q-t${nr}">In der Tabelle suchen</label>`,
        `    <input id="q-t${nr}" type="search" placeholder="Suchen …" autocomplete="off">`, '  </div>', '</div>');
      z.push(`<div id="tafel-${nr}" data-tafel>`, ein(html, 2), '  <p class="no-hits" hidden>Kein Treffer – probier einen anderen Suchbegriff.</p>', '</div>');
    } else {
      z.push(`<div class="tabelle${z.length ? ' tabelle-abstand' : ''}">`, ein(html, 2), '</div>');
    }
  }
  const h = ctx.zl(b.hinweis);
  if (h) z.push(`<p class="hint">${h}</p>`);
  if (!z.length) return '';
  return sektion(b, z.join('\n'), { wrapAttr });
}
