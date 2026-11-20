// Fließtext säubern: HTML aus dem WYSIWYG-Editor (TipTap) -> sauberes HTML im Stil der Seite.
// Erlaubt-Liste für Tags/Attribute; Links bekommen class="textlink", fremde http(s)-Adressen
// target="_blank" rel="noopener"; <strong> wird <b>. Ohne Abhängigkeiten.

import { esc, escAttr, txt, sicheresZiel, istExtern } from './html.mjs';

const VOID = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'source', 'wbr', 'col', 'area', 'base', 'embed', 'param', 'track']);
// Inhalt komplett verwerfen
const WEG_MIT_INHALT = new Set(['script', 'style', 'iframe', 'object', 'embed', 'template', 'noscript', 'textarea',
  'select', 'option', 'svg', 'math', 'title', 'head', 'frame', 'frameset', 'applet', 'button', 'form', 'canvas', 'video', 'audio']);
// Tag-Umbenennung auf erlaubte Tags
const ERLAUBT = {
  p: 'p', br: 'br', b: 'b', strong: 'b', em: 'em', i: 'em', a: 'a',
  ul: 'ul', ol: 'ol', li: 'li', h1: 'h2', h2: 'h2', h3: 'h3', h4: 'h4', h5: 'h4', h6: 'h4',
};
const BLOCK = new Set(['p', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'blockquote', 'pre', 'table', 'hr']);
const BLOCK_AUSGABE = new Set(['p', 'ul', 'ol', 'h2', 'h3', 'h4']);

const BENANNT = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', shy: '­',
  auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß',
  eacute: 'é', egrave: 'è', aacute: 'á', agrave: 'à', oacute: 'ó', ccedil: 'ç',
  ndash: '–', mdash: '—', hellip: '…', bdquo: '„', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’',
  sbquo: '‚', laquo: '«', raquo: '»', middot: '·', bull: '•', euro: '€', copy: '©', reg: '®',
  trade: '™', deg: '°', para: '¶', sect: '§', times: '×', rarr: '→', larr: '←', frac12: '½',
  zwnj: '‌', zwj: '‍', thinsp: ' ', ensp: ' ', emsp: ' ',
};

export function entitaetenDekodieren(s) {
  return txt(s).replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);/g, (ganz, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      if (!Number.isFinite(n) || n <= 0 || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) return '';
      return String.fromCodePoint(n);
    }
    return Object.prototype.hasOwnProperty.call(BENANNT, e) ? BENANNT[e] : ganz;
  });
}

function attributeLesen(s) {
  const attrs = {};
  const re = /([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m = re.exec(s))) {
    const name = m[1].toLowerCase();
    const wert = m[2] ?? m[3] ?? m[4] ?? '';
    if (!(name in attrs)) attrs[name] = entitaetenDekodieren(wert);
  }
  return attrs;
}

/** HTML in einen einfachen Baum zerlegen (tolerant). */
export function parse(html) {
  const wurzel = { tag: '#root', attrs: {}, kinder: [] };
  const stapel = [wurzel];
  const oben = () => stapel[stapel.length - 1];
  const s = txt(html);
  let i = 0;
  let wegTiefe = null; // in einem verworfenen Element (script o. ä.): Name

  const schliesse = (name) => {
    for (let k = stapel.length - 1; k > 0; k--) {
      if (stapel[k].tag === name) { stapel.length = k; return true; }
    }
    return false;
  };

  while (i < s.length) {
    if (wegTiefe) {
      const ende = s.toLowerCase().indexOf('</' + wegTiefe, i);
      if (ende < 0) { i = s.length; break; }
      const zu = s.indexOf('>', ende);
      i = zu < 0 ? s.length : zu + 1;
      wegTiefe = null;
      continue;
    }
    const lt = s.indexOf('<', i);
    if (lt < 0) { oben().kinder.push({ text: entitaetenDekodieren(s.slice(i)) }); break; }
    if (lt > i) oben().kinder.push({ text: entitaetenDekodieren(s.slice(i, lt)) });
    if (s.startsWith('<!--', lt)) {
      const ende = s.indexOf('-->', lt + 4);
      i = ende < 0 ? s.length : ende + 3;
      continue;
    }
    const m = /^<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/.exec(s.slice(lt));
    if (!m) {
      if (s[lt + 1] === '!' || s[lt + 1] === '?') {
        const zu = s.indexOf('>', lt);
        i = zu < 0 ? s.length : zu + 1;
        continue;
      }
      oben().kinder.push({ text: '<' });
      i = lt + 1;
      continue;
    }
    i = lt + m[0].length;
    const name = m[2].toLowerCase();
    if (m[1]) { // schließendes Tag
      schliesse(name);
      continue;
    }
    if (WEG_MIT_INHALT.has(name)) {
      if (!VOID.has(name) && !/\/\s*$/.test(m[3])) wegTiefe = name;
      continue;
    }
    // implizites Schließen wie im Browser
    if (BLOCK.has(name)) {
      for (let k = stapel.length - 1; k > 0; k--) {
        if (stapel[k].tag === 'p') { stapel.length = k; break; }
        if (['li', 'ul', 'ol', 'div', 'blockquote'].includes(stapel[k].tag)) break;
      }
    }
    if (name === 'li') {
      for (let k = stapel.length - 1; k > 0; k--) {
        if (stapel[k].tag === 'li') { stapel.length = k; break; }
        if (stapel[k].tag === 'ul' || stapel[k].tag === 'ol') break;
      }
    }
    const knoten = { tag: name, attrs: attributeLesen(m[3]), kinder: [] };
    oben().kinder.push(knoten);
    if (!VOID.has(name) && !/\/\s*$/.test(m[3])) stapel.push(knoten);
  }
  return wurzel;
}

/** Baum säubern: nur erlaubte Tags, nur href an Links. */
function saeubern(knoten, ctx) {
  const aus = [];
  for (const k of knoten.kinder) {
    if ('text' in k) {
      const t = k.text.replace(/[ \t\r\n\f]+/g, ' ');
      if (t) aus.push({ text: t });
      continue;
    }
    const neu = ERLAUBT[k.tag];
    const kinder = saeubern(k, ctx);
    if (!neu) {
      // unbekanntes Tag: weg, Inhalt bleibt (div/blockquote als Absatz)
      if (k.tag === 'div' || k.tag === 'blockquote') aus.push({ tag: 'p', attrs: {}, kinder });
      else aus.push(...kinder);
      continue;
    }
    if (neu === 'a') {
      const ziel = sicheresZiel(k.attrs.href);
      if (!ziel) { aus.push(...kinder); continue; }
      aus.push({ tag: 'a', attrs: { href: ziel }, kinder });
      continue;
    }
    aus.push({ tag: neu, attrs: {}, kinder });
  }
  return aus;
}

function istLeerInhalt(kinder) {
  return kinder.every((k) => ('text' in k ? k.text.replace(/ /g, ' ').trim() === '' : k.tag === 'br'));
}

/** Aufräumen: leere Absätze weg, <li><p>x</p></li> -> <li>x</li>, Inline-Läufe auf oberster Ebene in <p>. */
function aufraeumen(kinder, ebene) {
  const aus = [];
  for (const k of kinder) {
    if ('text' in k) { aus.push(k); continue; }
    k.kinder = aufraeumen(k.kinder, k.tag);
    if (['p', 'h2', 'h3', 'h4', 'li'].includes(k.tag) && istLeerInhalt(k.kinder)) continue;
    if ((k.tag === 'ul' || k.tag === 'ol') && !k.kinder.some((x) => x.tag === 'li')) continue;
    if (['b', 'em', 'a'].includes(k.tag) && k.kinder.length === 0) continue;
    aus.push(k);
  }
  if (ebene === 'li') {
    const ps = aus.filter((x) => x.tag === 'p');
    if (ps.length >= 1 && aus.every((x) => x.tag === 'p' || ('text' in x && x.text.trim() === ''))) {
      const neu = [];
      ps.forEach((p, n) => { if (n) neu.push({ tag: 'br', attrs: {}, kinder: [] }); neu.push(...p.kinder); });
      return trimmen(neu);
    }
  }
  if (ebene === 'ul' || ebene === 'ol') {
    return aus.filter((x) => x.tag === 'li');
  }
  if (ebene === '#root') {
    // Inline-Inhalt auf oberster Ebene in Absätze packen
    const neu = [];
    let lauf = [];
    const leeren = () => {
      if (lauf.length && !istLeerInhalt(lauf)) neu.push({ tag: 'p', attrs: {}, kinder: trimmen(lauf) });
      lauf = [];
    };
    for (const k of aus) {
      if (!('text' in k) && BLOCK_AUSGABE.has(k.tag)) { leeren(); neu.push(k); }
      else if (!('text' in k) && k.tag === 'li') { leeren(); neu.push({ tag: 'ul', attrs: {}, kinder: [k] }); }
      else lauf.push(k);
    }
    leeren();
    return neu;
  }
  if (['p', 'h2', 'h3', 'h4'].includes(ebene)) return trimmen(aus);
  return aus;
}

function trimmen(kinder) {
  const k = kinder.slice();
  while (k.length && 'text' in k[0] && k[0].text.trim() === '' ) k.shift();
  while (k.length && 'text' in k[k.length - 1] && k[k.length - 1].text.trim() === '') k.pop();
  // führende/folgende Br im Absatz weg
  while (k.length && k[0].tag === 'br') k.shift();
  while (k.length && k[k.length - 1].tag === 'br') k.pop();
  if (k.length && 'text' in k[0]) k[0] = { text: k[0].text.replace(/^ +/, '') };
  if (k.length && 'text' in k[k.length - 1]) k[k.length - 1] = { text: k[k.length - 1].text.replace(/ +$/, '') };
  return k;
}

function ausgeben(kinder, ctx, pKlasse) {
  let s = '';
  for (const k of kinder) {
    if ('text' in k) { s += esc(k.text); continue; }
    if (k.tag === 'br') { s += '<br>'; continue; }
    if (k.tag === 'a') {
      const href = k.attrs.href;
      let a = `<a class="textlink" href="${escAttr(href)}"`;
      if (istExtern(href, ctx.basisUrl)) a += ' target="_blank" rel="noopener"';
      s += a + '>' + ausgeben(k.kinder, ctx) + '</a>';
      continue;
    }
    if (k.tag === 'p' && pKlasse) {
      s += `<p class="${escAttr(pKlasse)}">` + ausgeben(k.kinder, ctx) + '</p>';
      continue;
    }
    const innen = ausgeben(k.kinder, ctx);
    if (k.tag === 'ul' || k.tag === 'ol') s += `<${k.tag}>\n` + innen + `</${k.tag}>\n`;
    else if (k.tag === 'li') s += `  <li>${innen}</li>\n`;
    else if (BLOCK_AUSGABE.has(k.tag)) s += `<${k.tag}>${innen}</${k.tag}>\n`;
    else s += `<${k.tag}>${innen}</${k.tag}>`;
  }
  return s;
}

function baum(html, ctx) {
  const roh = parse(html);
  const sauber = { tag: '#root', kinder: saeubern(roh, ctx) };
  return aufraeumen(sauber.kinder, '#root');
}

/**
 * Mehrabsätziger Fließtext -> HTML-Blöcke (<p>, <ul>, <h2> …).
 * opts.pKlasse: Klasse für jeden Absatz auf oberster Ebene.
 */
export function fliesstext(html, ctx = {}, opts = {}) {
  if (!txt(html).trim()) return '';
  return ausgeben(baum(html, ctx), ctx, opts.pKlasse).trim();
}

/**
 * Einzeiliger Fließtext (Hinweis, Listenpunkt, Wert/Zusatz): ein einzelnes <p> wird ausgepackt,
 * mehrere Absätze werden mit <br> verbunden. Ergebnis ist Inline-HTML.
 */
export function zeile(html, ctx = {}) {
  if (!txt(html).trim()) return '';
  const k = baum(html, ctx);
  const teile = [];
  for (const b of k) {
    if (b.tag === 'ul' || b.tag === 'ol') {
      for (const li of b.kinder) teile.push(ausgeben(li.kinder, ctx));
    } else {
      teile.push(ausgeben(b.kinder, ctx));
    }
  }
  return teile.filter(Boolean).join('<br>');
}

/** Sichtbarer Text eines Fließtexts (für Suchtexte, Prüfungen). */
export function nurText(html) {
  const k = parse(html);
  const rek = (n) => n.kinder.map((x) => ('text' in x ? x.text : (x.tag === 'br' ? ' ' : rek(x)))).join('');
  return rek(k).replace(/\s+/g, ' ').trim();
}
