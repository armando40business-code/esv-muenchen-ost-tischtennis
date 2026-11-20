// Maschinenlesbare Feldliste des Inhaltsmodells (Abgleich für `node build.mjs --pruefen`).
// Muss mit docs/INHALTSMODELL.md übereinstimmen.
// Arten: text | fliesstext | bild | datei | auswahl:<a|b> | janein | liste:<art> | { objekt } | [ { objekt } ]

const GEMEINSAM = { _block: 'text', hintergrund: 'auswahl:normal|abgesetzt', anker: 'text', kicker: 'text', ueberschrift: 'text' };
const INFO = [{ begriff: 'text', wert: 'fliesstext', zusatz: 'fliesstext' }];
const STIL = 'auswahl:gold|rahmen';

export const EINSTELLUNGEN = {
  verein: { name: 'text', abteilung: 'text', logo: 'bild', logo_alt: 'text' },
  kopf_button: { text: 'text', ziel: 'text' },
  menue: [{ titel: 'text', ziel: 'text' }],
  fusszeile: {
    text: 'text', logo_alt: 'text',
    spalten: [{ titel: 'text', links: [{ text: 'text', ziel: 'text' }] }],
    copyright: 'text',
    rechtliche_links: [{ text: 'text', ziel: 'text' }],
  },
  vorschaubild: 'bild',
  design: { farbschema: 'auswahl:petrol|nachtblau|tannengruen|anthrazit', akzentfarbe: 'text' },
};

export const TECHNIK = {
  basis_url: 'text', theme_color: 'text', strukturierte_daten: 'json',
  sitemap_prioritaeten: 'json', impressum_zusatz_html: 'text',
};

export const KOPF_GROSS = {
  kicker: 'text', ueberschrift: 'text', text: 'fliesstext',
  buttons: [{ text: 'text', ziel: 'text', stil: STIL }],
  fakten: [{ vor: 'text', fett: 'text', nach: 'text' }],
  bild: 'bild', bild_beschreibung: 'text',
  karte: { titel: 'text', zeilen: [{ fett: 'text', text: 'text' }], fuss_text: 'text', fuss_link_text: 'text', fuss_link_ziel: 'text' },
};

export const KOPF_EINFACH = { ueberschrift: 'text', text: 'fliesstext', bild: 'bild' };

const PRIO = 'auswahl:1.0|0.9|0.8|0.7|0.6|0.5|0.4|0.3|0.2|0.1';
export const SEITE = {
  browsertitel: 'text', beschreibung: 'text', menue_titel: 'text', sitemap_prioritaet: PRIO,
  im_menue: 'janein', kopf: 'objekt', bausteine: 'bausteine',
};

export const BAUSTEINE = {
  text_mit_kasten: {
    ...GEMEINSAM, text: 'fliesstext', punkte: 'liste:fliesstext', button_text: 'text', button_ziel: 'text', button_stil: STIL,
    kasten: { kicker: 'text', infos: INFO, liste: 'liste:text', hinweis: 'fliesstext' },
  },
  karten: {
    ...GEMEINSAM, link_rechts_text: 'text', link_rechts_ziel: 'text', spalten: 'auswahl:2|3', raster: 'auswahl:standard|turniere',
    karten: [{
      zwischentitel_davor: 'text', kicker: 'text', titel: 'text', unterzeile: 'text', fettzeile: 'text', zeile2: 'text',
      text: 'fliesstext', zeilen: [{ fett: 'text', text: 'text' }], rangliste_titel: 'text', rangliste: 'liste:text',
      bild: 'bild', bild_alt: 'text', link_text: 'text', link_ziel: 'text',
    }],
    hinweise: 'liste:fliesstext',
  },
  zahlenband: { _block: 'text', anker: 'text', zahlen: [{ zahl: 'text', text: 'text' }] },
  aufruf: { _block: 'text', anker: 'text', ueberschrift: 'text', text: 'fliesstext', button_text: 'text', button_ziel: 'text' },
  zeitleiste: { ...GEMEINSAM, eintraege: [{ jahr: 'text', titel: 'text', text: 'fliesstext' }] },
  ehrentafel: { ...GEMEINSAM, text: 'fliesstext', gruppen: [{ titel: 'text', eintraege: [{ zahl: 'text', name: 'text', zusatz: 'text' }] }] },
  turnierarchiv: {
    ...GEMEINSAM, suchfeld_text: 'text', kein_treffer_text: 'text', hinweis: 'fliesstext',
    weitere_reiter: [{ titel: 'text', excel: 'datei', eingefuegt: 'text' }],
  },
  kontakt: {
    ...GEMEINSAM, infos: INFO, formular_titel: 'text', formular_text: 'fliesstext', formular_empfaenger: 'text',
    formular_button: 'text', formular_hinweis: 'fliesstext',
  },
  zwei_spalten: {
    _block: 'text', hintergrund: 'auswahl:normal|abgesetzt', anker: 'text',
    spalten: [{ anker: 'text', kicker: 'text', ueberschrift: 'text', einleitung: 'fliesstext', text: 'fliesstext', button_text: 'text', button_ziel: 'text', button_stil: STIL }],
  },
  freitext: { ...GEMEINSAM, text: 'fliesstext', hinweis: 'fliesstext' },
  tabelle: {
    ...GEMEINSAM, text: 'fliesstext', excel: 'datei', eingefuegt: 'text', kopfzeile: 'janein', erste_spalte_fett: 'janein',
    suchfeld: 'janein', hinweis: 'fliesstext',
  },
  bilder: { ...GEMEINSAM, text: 'fliesstext', spalten: 'auswahl:1|2|3', bilder: [{ bild: 'bild', beschreibung: 'text', unterschrift: 'text' }] },
};

export const TURNIER = {
  vereinsmeisterschaft: {
    titel: 'text', zusatz: 'text', excel: 'datei',
    spaltentitel: { jahr: 'text', platz1: 'text', platz2: 'text', platz3: 'text', doppel: 'text' },
    jahrgaenge: [{ jahr: 'text', platz1: 'text', platz2: 'text', platz3: 'text', doppel: 'text' }],
  },
  facklerpokal: {
    titel: 'text', zusatz: 'text', excel: 'datei',
    spaltentitel: { jahr: 'text', sieger: 'text', zweiter: 'text' },
    jahrgaenge: [{ jahr: 'text', sieger: 'text', zweiter: 'text' }],
  },
};
