// Vorlagen für jeden Baustein des Katalogs. Jede Funktion liefert HTML oder '' (nichts anzeigen).

import { esc, escAttr, txt, leer, liste, obj, janein, linkAttr } from './html.mjs';
import { knopf } from './vorlagen.mjs';
import { nurText } from './fliesstext.mjs';
import { turnierarchiv, tabelle } from './tabellen.mjs';
import { ein, sauberId, sektion, titelzeilen } from './abschnitt.mjs';
import { bildTag } from './bildtag.mjs';

function hatTitel(b) {
  return !leer(b.kicker) || !leer(b.ueberschrift);
}

// 1. text_mit_kasten -------------------------------------------------------
function textMitKasten(b, ctx) {
  const links = titelzeilen(b);
  const text = ctx.ft(b.text);
  if (text) links.push(text);
  const punkte = liste(b.punkte).map((p) => ctx.zl(typeof p === 'object' ? p.text : p)).filter(Boolean);
  if (punkte.length) {
    links.push('<ul class="value-list">', ...punkte.map((p) => `  <li><div>${p}</div></li>`), '</ul>');
  }
  const k = knopf(b.button_text, b.button_ziel, b.button_stil, ctx);
  if (k) links.push(`<p>${k}</p>`);

  const kasten = obj(b.kasten);
  const rechts = [];
  if (!leer(kasten.kicker)) rechts.push(`<p class="kicker">${esc(kasten.kicker)}</p>`);
  const infos = infoListe(kasten.infos, ctx);
  if (infos) rechts.push(infos);
  const eintraege = liste(kasten.liste).map((x) => (typeof x === 'object' ? x.text : x)).filter((x) => !leer(x));
  if (eintraege.length) rechts.push('<ul class="aside-liste">', ...eintraege.map((x) => `  <li>${esc(x)}</li>`), '</ul>');
  const hinweis = ctx.zl(kasten.hinweis);
  if (hinweis) rechts.push(`<p class="dim aside-hinweis">${hinweis}</p>`);

  if (!links.length && !rechts.length) return '';
  if (!rechts.length) return sektion(b, links.join('\n'));
  const innen = `<div>\n${ein(links.join('\n'), 2)}\n</div>\n<aside class="aside">\n${ein(rechts.join('\n'), 2)}\n</aside>`;
  return sektion(b, innen, { wrapKlasse: 'split' });
}

/** <dl> mit begriff/wert/zusatz (Kasten, Kontakt). */
function infoListe(infos, ctx) {
  const z = [];
  for (const i of liste(infos)) {
    const wert = ctx.zl(i.wert);
    const zusatz = ctx.zl(i.zusatz);
    if (leer(i.begriff) && !wert && !zusatz) continue;
    if (!leer(i.begriff)) z.push(`  <dt>${esc(i.begriff)}</dt>`);
    z.push(`  <dd>${wert}${zusatz ? `<small>${zusatz}</small>` : ''}</dd>`);
  }
  return z.length ? `<dl>\n${z.join('\n')}\n</dl>` : '';
}

// 2. karten ------------------------------------------------------------------
function karte(k, ctx) {
  const t = [];
  const bild = ctx.bild(k.bild, 'Kartenbild');
  if (bild) t.push(bildTag(bild, k.bild_alt, 'karte-bild'));
  if (!leer(k.kicker)) t.push(`<p class="kicker">${esc(k.kicker)}</p>`);
  if (!leer(k.titel)) t.push(`<h3>${esc(k.titel)}</h3>`);
  if (!leer(k.unterzeile)) t.push(`<p class="dim karte-unterzeile">${esc(k.unterzeile)}</p>`);
  if (!leer(k.fettzeile)) t.push(`<p class="karte-fett">${esc(k.fettzeile)}</p>`);
  if (!leer(k.zeile2)) t.push(`<p class="karte-zeile2">${esc(k.zeile2)}</p>`);
  const text = ctx.ft(k.text);
  if (text) t.push(text.replace(/\n/g, ''));
  for (const z of liste(k.zeilen)) {
    if (leer(z.fett) && leer(z.text)) continue;
    t.push(`<div class="hc-item"><b>${esc(z.fett)}</b><span>${esc(z.text)}</span></div>`);
  }
  const rang = liste(k.rangliste).map((x) => (typeof x === 'object' ? x.text : x)).filter((x) => !leer(x));
  if (!leer(k.rangliste_titel)) t.push(`<p class="karte-fett karte-rangtitel">${esc(k.rangliste_titel)}</p>`);
  if (rang.length) {
    t.push('<ul class="winners">' + rang.map((x, i) => `<li><span class="rank${i === 0 ? ' r1' : ''}">${i + 1}</span>${esc(x)}</li>`).join('') + '</ul>');
  }
  const la = linkAttr(k.link_ziel, ctx.basisUrl);
  if (la && !leer(k.link_text)) t.push(`<a class="card-link" ${la}>${esc(k.link_text)}</a>`);
  return t.length ? `<div class="card">${t.join('')}</div>` : '';
}

function karten(b, ctx) {
  const z = [];
  if (!leer(b.kicker)) z.push(`<p class="kicker">${esc(b.kicker)}</p>`);
  const la = linkAttr(b.link_rechts_ziel, ctx.basisUrl);
  const rechtsLink = la && !leer(b.link_rechts_text) ? `<a class="textlink" ${la}>${esc(b.link_rechts_text)}</a>` : '';
  if (!leer(b.ueberschrift) && rechtsLink) {
    z.push('<div class="karten-kopf">', `  <h2>${esc(b.ueberschrift)}</h2>`, `  ${rechtsLink}`, '</div>');
  } else if (!leer(b.ueberschrift)) {
    z.push(`<h2>${esc(b.ueberschrift)}</h2>`);
  } else if (rechtsLink) {
    z.push(`<p>${rechtsLink}</p>`);
  }
  // Gruppen bilden (zwischentitel_davor beginnt eine neue Reihe)
  const gruppen = [];
  for (const k of liste(b.karten)) {
    const html = karte(k, ctx);
    const zt = txt(k.zwischentitel_davor).trim();
    if (zt || !gruppen.length) gruppen.push({ titel: zt, karten: [] });
    if (html) gruppen[gruppen.length - 1].karten.push(html);
  }
  const turniere = txt(b.raster) === 'turniere';
  const spalten = txt(b.spalten) === '2' ? 'g2' : 'g3';
  let erstes = true;
  for (const g of gruppen) {
    if (g.titel) z.push(`<p class="kicker kicker-zwischen">${esc(g.titel)}</p>`);
    if (!g.karten.length) { erstes = false; continue; }
    const abstand = erstes && !g.titel && !leer(b.ueberschrift) && !turniere ? ' grid-abstand' : '';
    const klasse = turniere ? 'turniere' : `grid ${spalten}${abstand}`;
    z.push(`<div class="${klasse}">`, ...g.karten.map((x) => '  ' + x), '</div>');
    erstes = false;
  }
  for (const h of liste(b.hinweise)) {
    const s = ctx.zl(typeof h === 'object' ? h.text : h);
    if (s) z.push(`<p class="hint">${s}</p>`);
  }
  const hatKarten = gruppen.some((g) => g.karten.length);
  if (!hatKarten && !hatTitel(b) && z.length === 0) return '';
  if (!z.length) return '';
  return sektion(b, z.join('\n'));
}

// 3. zahlenband ----------------------------------------------------------------
function zahlenband(b) {
  const zahlen = liste(b.zahlen).filter((x) => !leer(x.zahl) || !leer(x.text));
  if (!zahlen.length) return '';
  const id = sauberId(b.anker);
  // Bei genau 5 Zahlen bleibt das feste Raster (ohne Zusatzklasse); sonst füllt ein passendes Raster die Breite.
  const n = zahlen.length;
  const raster = n === 5 ? '' : ` stats-n ${[2, 3, 4, 6].includes(n) ? `stats-${n}` : 'stats-auto'}`;
  return [`<div class="statband"${id ? ` id="${id}"` : ''}>`, `  <div class="stats${raster}">`,
    ...zahlen.map((x) => `    <div class="stat"><b>${esc(x.zahl)}</b><span>${esc(x.text)}</span></div>`),
    '  </div>', '</div>'].join('\n');
}

// 4. aufruf --------------------------------------------------------------------
function aufruf(b, ctx) {
  const k = knopf(b.button_text, b.button_ziel, 'gold', ctx);
  const text = ctx.ft(b.text).replace(/\n/g, '');
  if (leer(b.ueberschrift) && !text && !k) return '';
  const id = sauberId(b.anker);
  const links = (leer(b.ueberschrift) ? '' : `<h2>${esc(b.ueberschrift)}</h2>`) + text;
  return [`<section class="cta-band"${id ? ` id="${id}"` : ''}>`, '  <div class="cta-in">',
    `    <div>${links}</div>`, ...(k ? [`    ${k}`] : []), '  </div>', '</section>'].join('\n');
}

// 5. zeitleiste ----------------------------------------------------------------
function zeitleiste(b, ctx) {
  const z = titelzeilen(b);
  const eintraege = [];
  for (const e of liste(b.eintraege)) {
    const text = ctx.ft(e.text);
    if (leer(e.jahr) && leer(e.titel) && !text) continue;
    eintraege.push(`  <div class="tl"><div class="tl-year">${esc(e.jahr)}</div><div class="tl-body">` +
      (leer(e.titel) ? '' : `<b>${esc(e.titel)}</b>\n`) + ein(text, 4).trimStart() + '</div></div>');
  }
  if (eintraege.length) z.push('<div class="timeline">', ...eintraege, '</div>');
  if (!z.length) return '';
  return sektion(b, z.join('\n'));
}

// 6. ehrentafel ----------------------------------------------------------------
function ehrentafel(b, ctx) {
  const z = titelzeilen(b);
  const text = ctx.ft(b.text, { pKlasse: 'muted ehrentafel-text' });
  if (text) z.push(text);
  for (const g of liste(b.gruppen)) {
    const eintraege = liste(g.eintraege).filter((e) => !leer(e.zahl) || !leer(e.name));
    if (leer(g.titel) && !eintraege.length) continue;
    z.push('');
    if (!leer(g.titel)) z.push(`<h3 class="ehren-titel">${esc(g.titel)}</h3>`);
    if (eintraege.length) {
      z.push('<div class="honours">', ...eintraege.map((e) =>
        `  <div class="hon"><b>${esc(e.zahl)}</b><span>${esc(e.name)}${leer(e.zusatz) ? '' : `<small>${esc(e.zusatz)}</small>`}</span></div>`), '</div>');
    }
  }
  if (!z.length) return '';
  return sektion(b, z.join('\n'));
}

// 8. kontakt -------------------------------------------------------------------
function kontakt(b, ctx) {
  const links = titelzeilen(b);
  const infos = infoListe(b.infos, ctx);
  if (infos) links.push(`<div class="aside${links.length ? ' aside-abstand' : ''}">\n${ein(infos, 2)}\n</div>`);
  const rechts = [];
  if (!leer(b.formular_titel)) rechts.push(`<h3>${esc(b.formular_titel)}</h3>`);
  const ftext = ctx.zl(b.formular_text);
  if (ftext) rechts.push(`<p class="muted">${ftext}</p>`);
  const empf = txt(b.formular_empfaenger).trim().replace(/^mailto:/i, '');
  if (empf) {
    if (!/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(empf)) {
      ctx.warn(`Kontakt-Formular: Empfänger "${empf}" ist keine gültige E-Mail-Adresse – Formular weggelassen.`);
    } else {
      const knopfText = leer(b.formular_button) ? 'Nachricht senden' : txt(b.formular_button);
      rechts.push(`<form class="form" action="mailto:${escAttr(empf)}" method="post" enctype="text/plain">`,
        '  <label for="n">Name</label><input id="n" name="Name" type="text" required>',
        '  <label for="e">E-Mail</label><input id="e" name="E-Mail" type="email" required>',
        '  <label for="m">Nachricht</label><textarea id="m" name="Nachricht" required></textarea>',
        `  <p class="form-knopf"><button class="btn btn-gold" type="submit">${esc(knopfText)}</button></p>`,
        '</form>');
    }
  }
  const fh = ctx.zl(b.formular_hinweis);
  if (fh) rechts.push(`<p class="dim">${fh}</p>`);
  if (!links.length && !rechts.length) return '';
  if (!rechts.length) return sektion(b, links.join('\n'));
  if (!links.length) return sektion(b, rechts.join('\n'));
  return sektion(b, `<div>\n${ein(links.join('\n'), 2)}\n</div>\n<div>\n${ein(rechts.join('\n'), 2)}\n</div>`, { wrapKlasse: 'split' });
}

// 9. zwei_spalten --------------------------------------------------------------
function zweiSpalten(b, ctx) {
  const spalten = [];
  for (const s of liste(b.spalten)) {
    const z = [];
    const id = sauberId(s.anker);
    let idVergeben = false;
    if (!leer(s.kicker)) { z.push(`<p class="kicker"${id ? ` id="${id}"` : ''}>${esc(s.kicker)}</p>`); idVergeben = true; }
    if (!leer(s.ueberschrift)) {
      z.push(`<h2${id && !idVergeben ? ` id="${id}"` : ''}>${esc(s.ueberschrift)}</h2>`);
      if (id) idVergeben = true;
    }
    const einl = ctx.ft(s.einleitung, { pKlasse: 'muted' });
    if (einl) z.push(einl);
    const text = ctx.ft(s.text);
    if (text) z.push(text);
    const k = knopf(s.button_text, s.button_ziel, s.button_stil, ctx);
    if (k) z.push(`<p>${k}</p>`);
    if (!z.length) continue;
    const divId = id && !idVergeben ? ` id="${id}"` : '';
    spalten.push(`<div${divId}>\n${ein(z.join('\n'), 2)}\n</div>`);
  }
  if (!spalten.length) return '';
  return sektion(b, spalten.join('\n'), { wrapKlasse: 'split' });
}

// 10. freitext -----------------------------------------------------------------
function freitext(b, ctx) {
  const z = titelzeilen(b);
  const text = ctx.ft(b.text);
  if (text) z.push(text);
  // Fester Zusatz aus technik.json (nicht über das CMS änderbar), unverändert am Ende des Impressum-Textbereichs
  if (ctx.zusatzBlock === b && !leer(ctx.technik.impressum_zusatz_html)) z.push(txt(ctx.technik.impressum_zusatz_html).trim());
  const h = ctx.zl(b.hinweis);
  if (h) z.push(`<p class="hint">${h}</p>`);
  if (!z.length) return '';
  return sektion(b, `<div class="prose">\n${z.join('\n')}\n</div>`);
}

// 12. bilder -------------------------------------------------------------------
function bilder(b, ctx) {
  const z = titelzeilen(b);
  const text = ctx.ft(b.text);
  if (text) z.push(z.length ? `<div class="block-text">\n${ein(text, 2)}\n</div>` : text);
  const fig = [];
  for (const e of liste(b.bilder)) {
    const bild = ctx.bild(e.bild, 'Bild im Baustein "bilder"');
    if (!bild) continue;
    const unter = leer(e.unterschrift) ? '' : `<figcaption>${esc(e.unterschrift)}</figcaption>`;
    fig.push(`  <figure class="bild">${bildTag(bild, e.beschreibung, '')}${unter}</figure>`);
  }
  if (fig.length) {
    const spalten = ['1', '2', '3'].includes(txt(b.spalten)) ? txt(b.spalten) : '3';
    const abstand = z.length ? ' grid-abstand' : '';
    z.push(`<div class="grid g${spalten} bilder-raster${abstand}">`, ...fig, '</div>');
  }
  if (!z.length) return '';
  return sektion(b, z.join('\n'));
}

const KATALOG = {
  text_mit_kasten: textMitKasten,
  karten,
  zahlenband,
  aufruf,
  zeitleiste,
  ehrentafel,
  turnierarchiv,
  kontakt,
  zwei_spalten: zweiSpalten,
  freitext,
  tabelle,
  bilder,
};

export const BAUSTEIN_ARTEN = Object.keys(KATALOG);

/** Einen Baustein rendern; unbekannte Arten werden gemeldet und übersprungen. */
export async function baustein(b, ctx, nr) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) {
    ctx.warn(`Baustein ${nr}: kein gültiger Eintrag – übersprungen.`);
    return '';
  }
  const art = txt(b._block);
  const fn = KATALOG[art];
  if (!fn) {
    ctx.warn(`Baustein ${nr}: unbekannte Art "${art}" – übersprungen.`);
    return '';
  }
  try {
    const html = await fn(b, ctx);
    if (!html) ctx.hinweis(`Baustein ${nr} (${art}) ist leer – nichts ausgegeben.`);
    return html;
  } catch (e) {
    ctx.warn(`Baustein ${nr} (${art}) konnte nicht gebaut werden: ${e.message} – übersprungen.`);
    return '';
  }
}

export { nurText, janein, obj };
