// Seitenrahmen: <head>, Seitenkopf (Navigation), Kopfbereich (groß/einfach), Fußzeile, Skripte.

import { esc, escAttr, txt, leer, liste, obj, linkAttr, sicheresZiel } from './html.mjs';

const MENUE_SKRIPT = `<script>
(function(){
  var b=document.getElementById('burger'), n=document.getElementById('nav');
  if(b&&n) b.addEventListener('click',function(){
    var open=n.classList.toggle('open');
    b.setAttribute('aria-expanded',open?'true':'false');
    b.setAttribute('aria-label',open?'Menü schließen':'Menü öffnen');
  });
})();
</script>`;

// Reiter + Suche für Turnierarchiv und Tabellen mit Suchfeld; beliebig viele Bereiche/Reiter je Seite.
export const SUCH_SKRIPT = `<script>
(function(){
  [].slice.call(document.querySelectorAll('[data-suche]')).forEach(function(box){
    var tabs=[].slice.call(box.querySelectorAll('.tab'));
    var q=box.querySelector('.search input');
    var panels=[].slice.call(box.querySelectorAll('[data-tafel]'));
    function show(id){
      tabs.forEach(function(t){
        var on=t.dataset.panel===id;
        t.setAttribute('aria-selected',on?'true':'false');
        document.getElementById(t.dataset.panel).hidden=!on;
      });
      filter();
    }
    tabs.forEach(function(t){ t.addEventListener('click',function(){ show(t.dataset.panel); }); });
    function filter(){
      var v=q?(q.value||'').trim().toLowerCase():'';
      panels.forEach(function(p){
        if(p.hidden) return;
        var hits=0;
        [].slice.call(p.querySelectorAll('tbody tr')).forEach(function(tr){
          var ok=!v||(tr.dataset.s||'').indexOf(v)>-1||tr.cells[0].textContent.indexOf(v)>-1;
          tr.hidden=!ok; if(ok) hits++;
        });
        var nh=p.querySelector('.no-hits'); if(nh) nh.hidden=hits>0||!v;
        var tw=p.querySelector('.table-wrap'); if(tw) tw.hidden=hits===0&&!!v;
      });
    }
    if(q) q.addEventListener('input',filter);
    if(tabs.length) show(tabs[0].dataset.panel); else filter();
  });
})();
</script>`;

/** Absolute Adresse aus Basis-URL + Pfad. */
export function absolut(basisUrl, pfad) {
  const b = txt(basisUrl).replace(/\/+$/, '');
  const p = txt(pfad);
  if (/^https?:\/\//i.test(p)) return p;
  return b + '/' + p.replace(/^\/+/, '');
}

export function kanonisch(basisUrl, name) {
  const b = txt(basisUrl).replace(/\/+$/, '');
  return name === 'index' ? b + '/' : `${b}/${name}`;
}

export function head(seite, ctx) {
  const { einst, technik, basisUrl } = ctx;
  const titel = txt(seite.daten.browsertitel) || txt(seite.daten.menue_titel) || seite.name;
  const beschr = txt(seite.daten.beschreibung);
  const z = [];
  z.push('<!DOCTYPE html>', '<html lang="de">', '<head>', '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${esc(titel)}</title>`);
  if (beschr) z.push(`<meta name="description" content="${escAttr(beschr)}">`);
  if (!leer(technik.theme_color)) z.push(`<meta name="theme-color" content="${escAttr(technik.theme_color)}">`);
  z.push(`<meta property="og:title" content="${escAttr(titel)}">`);
  if (beschr) z.push(`<meta property="og:description" content="${escAttr(beschr)}">`);
  z.push('<meta property="og:type" content="website">', '<meta property="og:locale" content="de_DE">');
  const vorschau = ctx.bild(einst.vorschaubild, 'Vorschaubild (einstellungen.json)');
  if (vorschau) z.push(`<meta property="og:image" content="${escAttr(absolut(basisUrl, vorschau.url))}">`);
  const logo = ctx.bild(obj(einst.verein).logo, null);
  if (logo) z.push(`<link rel="icon" href="${escAttr(logo.url)}">`);
  z.push('<link rel="preload" href="assets/fonts/inter-latin-700-normal.woff2" as="font" type="font/woff2" crossorigin>',
    '<link rel="preload" href="assets/fonts/inter-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>',
    '<link rel="stylesheet" href="styles.css">',
    `<link rel="canonical" href="${escAttr(kanonisch(basisUrl, seite.name))}">`);
  if (ctx.designCss) z.push(ctx.designCss);
  if (seite.name === 'index' && technik.strukturierte_daten && typeof technik.strukturierte_daten === 'object') {
    const json = JSON.stringify(technik.strukturierte_daten, null, 2).replace(/</g, '\\u003c');
    z.push('<script type="application/ld+json">', json, '</script>');
  }
  z.push('</head>');
  return z.join('\n');
}

export function seitenkopf(seite, ctx) {
  const { einst } = ctx;
  const verein = obj(einst.verein);
  const logo = ctx.bild(verein.logo, 'Logo (einstellungen.json)');
  const z = [];
  z.push('<a class="skip" href="#main">Zum Inhalt springen</a>', '', '<header class="site-head">', '  <div class="head-in">',
    '    <a class="brand" href="index.html">');
  if (logo) {
    z.push(`      <img src="${escAttr(logo.url)}" alt="${escAttr(verein.logo_alt)}"${groesse(logo)}>`);
  }
  z.push(`      <span class="brand-txt"><b>${esc(verein.name)}</b><span>${esc(verein.abteilung)}</span></span>`, '    </a>',
    '    <nav class="nav" id="nav" aria-label="Hauptnavigation">');
  for (const m of ctx.menue) {
    const attr = linkAttr(m.ziel, ctx.basisUrl);
    if (!attr || leer(m.titel)) continue;
    const aktuell = istAktuell(m.ziel, seite.name) ? ' aria-current="page"' : '';
    z.push(`      <a ${attr}${aktuell}>${esc(m.titel)}</a>`);
  }
  z.push('    </nav>');
  const kb = obj(einst.kopf_button);
  const kbAttr = linkAttr(kb.ziel, ctx.basisUrl);
  if (kbAttr && !leer(kb.text)) z.push(`    <a class="btn btn-gold btn-sm head-cta" ${kbAttr}>${esc(kb.text)}</a>`);
  z.push('    <button class="burger" id="burger" aria-label="Menü öffnen" aria-expanded="false" aria-controls="nav">',
    '      <span></span><span></span><span></span>', '    </button>', '  </div>', '</header>');
  return z.join('\n');
}

function istAktuell(ziel, name) {
  const z = txt(ziel).trim().split('#')[0].split('?')[0].replace(/^\.?\//, '');
  return z === `${name}.html` || (name === 'index' && z === '');
}

export function groesse(b) {
  return b && b.breite && b.hoehe ? ` width="${b.breite}" height="${b.hoehe}"` : '';
}

/** CSS-Wert für ein Hintergrundbild (mit image-set, wenn eine .webp daneben liegt). */
export function cssBild(b) {
  const u = (s) => `url('${s.replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29')}')`;
  if (b.webpUrl) return `image-set(${u(b.webpUrl)} type('image/webp'), ${u(b.url)} type('${b.mime}'))`;
  return u(b.url);
}

/** Großer Kopf der Startseite. */
export function grosserKopf(kopf, ctx) {
  const k = obj(kopf);
  const z = ['<section class="hero">'];
  const bild = ctx.bild(k.bild, 'Kopfbild der Startseite');
  if (bild) {
    const label = leer(k.bild_beschreibung) ? '' : ` role="img" aria-label="${escAttr(k.bild_beschreibung)}"`;
    z.push(`  <div class="hero-bg" style="background-image:${escAttr(cssBild(bild))}"${label}></div>`);
  }
  z.push('  <div class="hero-in">', '    <div class="hero-copy">');
  if (!leer(k.kicker)) z.push(`      <p class="kicker">${esc(k.kicker)}</p>`);
  if (!leer(k.ueberschrift)) z.push(`      <h1>${esc(k.ueberschrift)}</h1>`);
  const text = ctx.ft(k.text, { pKlasse: 'hero-lead' });
  if (text) z.push('      ' + text.replace(/\n/g, '\n      '));
  const knoepfe = liste(k.buttons).map((b) => knopf(b.text, b.ziel, b.stil, ctx)).filter(Boolean);
  if (knoepfe.length) {
    z.push('      <div class="hero-actions">', ...knoepfe.map((x) => '        ' + x), '      </div>');
  }
  const fakten = liste(k.fakten).map((f) => {
    const vor = txt(f.vor).trim();
    const fett = txt(f.fett).trim();
    const nach = txt(f.nach).trim();
    if (!fett) return vor || nach ? `<span>${esc([vor, nach].filter(Boolean).join(' '))}</span>` : '';
    return [vor && esc(vor), `<b>${esc(fett)}</b>`, nach && esc(nach)].filter(Boolean).join(' ');
  }).filter(Boolean);
  if (fakten.length) z.push(`      <p class="hero-facts">${fakten.join(' ')}</p>`);
  z.push('    </div>');
  const karte = obj(k.karte);
  const zeilen = liste(karte.zeilen).filter((x) => !leer(x.fett) || !leer(x.text));
  const fussLink = linkAttr(karte.fuss_link_ziel, ctx.basisUrl);
  if (!leer(karte.titel) || zeilen.length || !leer(karte.fuss_text) || (fussLink && !leer(karte.fuss_link_text))) {
    z.push('    <aside class="hero-card">');
    if (!leer(karte.titel)) z.push(`      <h2>${esc(karte.titel)}</h2>`);
    for (const x of zeilen) z.push(`      <div class="hc-item"><b>${esc(x.fett)}</b><span>${esc(x.text)}</span></div>`);
    const fussTeile = [];
    if (!leer(karte.fuss_text)) fussTeile.push(`<span>${esc(karte.fuss_text)}</span>`);
    if (fussLink && !leer(karte.fuss_link_text)) fussTeile.push(`<a class="textlink" ${fussLink}>${esc(karte.fuss_link_text)}</a>`);
    if (fussTeile.length) z.push(`      <div class="hc-foot">${fussTeile.join('')}</div>`);
    z.push('    </aside>');
  }
  z.push('  </div>', '</section>');
  return z.join('\n');
}

/** Einfacher Kopf aller anderen Seiten (Brotkrumen, Überschrift, Text, optional Hintergrundbild). */
export function einfacherKopf(seite, ctx) {
  const k = obj(seite.daten.kopf);
  const bild = ctx.bild(k.bild, `Kopfbild der Seite "${seite.name}"`);
  const startTitel = txt(ctx.startTitel) || 'Start';
  const crumbName = txt(seite.daten.menue_titel) || txt(k.ueberschrift);
  const stil = bild ? ` page-head-bild" style="--kopfbild:${escAttr(cssBild(bild))}` : '';
  const z = [`<section class="page-head${stil}">`, '  <div class="wrap">',
    `    <p class="crumb"><a href="index.html">${esc(startTitel)}</a> / ${esc(crumbName)}</p>`];
  if (!leer(k.ueberschrift)) z.push(`    <h1>${esc(k.ueberschrift)}</h1>`);
  const text = ctx.ft(k.text);
  if (text) z.push('    ' + text.replace(/\n/g, '\n    '));
  z.push('  </div>', '</section>');
  return z.join('\n');
}

/** Knopf (Link im Button-Stil). stil: gold | rahmen. */
export function knopf(text, ziel, stil, ctx, extraKlasse = '') {
  const attr = linkAttr(ziel, ctx.basisUrl);
  if (!attr || leer(text)) return '';
  const s = txt(stil) === 'rahmen' ? 'btn-ghost' : 'btn-gold';
  return `<a class="btn ${s}${extraKlasse}" ${attr}>${esc(text)}</a>`;
}

export function fusszeile(ctx) {
  const f = obj(ctx.einst.fusszeile);
  const verein = obj(ctx.einst.verein);
  const logo = ctx.bild(verein.logo, null);
  const z = ['<footer class="site-foot">', '  <div class="wrap">', '    <div class="foot-grid">', '      <div class="foot-brand">'];
  if (logo) z.push(`        <img src="${escAttr(logo.url)}" alt="${escAttr(f.logo_alt)}"${groesse(logo)}>`);
  if (!leer(f.text)) z.push(`        <p>${esc(f.text)}</p>`);
  z.push('      </div>');
  for (const sp of liste(f.spalten)) {
    const eintraege = liste(sp.links).map((l) => {
      if (leer(l.text)) return '';
      const attr = linkAttr(l.ziel, ctx.basisUrl);
      return attr ? `<li><a ${attr}>${esc(l.text)}</a></li>` : `<li>${esc(l.text)}</li>`;
    }).filter(Boolean);
    if (leer(sp.titel) && !eintraege.length) continue;
    z.push('      <div class="foot-col">');
    if (!leer(sp.titel)) z.push(`        <h5>${esc(sp.titel)}</h5>`);
    if (eintraege.length) z.push('        <ul>', ...eintraege.map((x) => '          ' + x), '        </ul>');
    z.push('      </div>');
  }
  z.push('    </div>', '    <div class="foot-bar">');
  const jahr = String(new Date().getFullYear());
  z.push(`      <span>${esc(txt(f.copyright).replace(/\{jahr\}/g, jahr))}</span>`);
  const recht = liste(f.rechtliche_links).map((l) => {
    const attr = linkAttr(l.ziel, ctx.basisUrl);
    return attr && !leer(l.text) ? `<a ${attr}>${esc(l.text)}</a>` : '';
  }).filter(Boolean);
  if (recht.length) z.push(`      <span>${recht.join(' · ')}</span>`);
  z.push('    </div>', '  </div>', '</footer>', '', MENUE_SKRIPT, '</body>', '</html>', '');
  return z.join('\n');
}

export { sicheresZiel };
