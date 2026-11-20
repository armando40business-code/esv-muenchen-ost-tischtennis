/* Bedienung der Nachbildung: Formular wählen, Schalter, Hinweise. Es wird nichts gespeichert und nichts gesendet. */
(function () {
  'use strict';
  var panels = Array.prototype.slice.call(document.querySelectorAll('.formular'));
  var links = Array.prototype.slice.call(document.querySelectorAll('#seitenleiste a[data-ziel]'));
  var auswahl = document.getElementById('auswahl');
  var toastEl = document.getElementById('toast');
  var arten = document.getElementById('arten-dialog');
  var timer = null;

  function ids() { return panels.map(function (p) { return p.id; }); }

  function zeige(id, fokus) {
    if (ids().indexOf(id) < 0) id = panels[0].id;
    var aktiv = null;
    panels.forEach(function (p) { var an = p.id === id; p.hidden = !an; if (an) aktiv = p; });
    var eltern = aktiv.getAttribute('data-eltern') || id;
    links.forEach(function (a) {
      if (a.getAttribute('data-ziel') === eltern) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
    if (auswahl) auswahl.value = eltern;
    document.title = (aktiv.getAttribute('data-titel') || '') + ' – Nachbildung der Formulare';
    if (fokus) window.scrollTo(0, 0);
  }

  function ausHash() { return decodeURIComponent((location.hash || '').replace(/^#/, '')); }

  window.addEventListener('hashchange', function () { zeige(ausHash(), true); });
  if (auswahl) {
    auswahl.addEventListener('change', function () { location.hash = '#' + auswahl.value; });
  }
  zeige(ausHash(), false);

  function toast(text) {
    if (!toastEl) return;
    toastEl.textContent = text;
    toastEl.classList.add('an');
    clearTimeout(timer);
    timer = setTimeout(function () { toastEl.classList.remove('an'); }, 4200);
  }

  var TEXTE = {
    neu: 'Nur zur Ansicht: In der echten Oberfläche erscheint hier eine neue, leere Zeile zum Ausfüllen.',
    loeschen: 'Nur zur Ansicht: In der echten Oberfläche würde dieser Eintrag gelöscht. Hier passiert nichts.',
    bild: 'Nur zur Ansicht: In der echten Oberfläche öffnet sich hier die Auswahl der vorhandenen Bilder und das Hochladen.',
    datei: 'Nur zur Ansicht: In der echten Oberfläche öffnet sich hier die Auswahl der vorhandenen Dateien und das Hochladen.',
    entfernen: 'Nur zur Ansicht: In der echten Oberfläche würde die Auswahl geleert. Hier passiert nichts.',
    werkzeug: 'Die Werkzeugleiste ist hier nur angedeutet. In der echten Oberfläche formatiert sie den markierten Text.',
    link: 'Nur zur Ansicht: Links lassen sich in der Nachbildung nicht öffnen.',
    seite: 'Nur zur Ansicht: In der echten Oberfläche würde hier eine neue Seite angelegt.'
  };

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!(t instanceof Element)) return;
    var a = t.closest('.inhalt a');
    if (a) { e.preventDefault(); toast(TEXTE.link); return; }
    var sw = t.closest('.schalter');
    if (sw) {
      var an = sw.getAttribute('aria-checked') !== 'true';
      sw.setAttribute('aria-checked', an ? 'true' : 'false');
      var z = sw.querySelector('.zustand');
      if (z) z.textContent = an ? 'Ein' : 'Aus';
      return;
    }
    var b = t.closest('[data-aktion]');
    if (!b) return;
    var aktion = b.getAttribute('data-aktion');
    if (aktion === 'arten') { if (arten && arten.showModal) arten.showModal(); return; }
    if (aktion === 'zu') { if (arten) arten.close(); return; }
    if (TEXTE[aktion]) toast(TEXTE[aktion]);
  });

  if (arten) {
    arten.addEventListener('click', function (e) { if (e.target === arten) arten.close(); });
  }
})();
