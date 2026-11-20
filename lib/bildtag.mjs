// <img>-Ausgabe mit Breite/Höhe und optionaler .webp-Quelle.

import { escAttr } from './html.mjs';

export function groesse(b) {
  return b && b.breite && b.hoehe ? ` width="${b.breite}" height="${b.hoehe}"` : '';
}

export function bildTag(bild, alt, klasse) {
  const img = `<img${klasse ? ` class="${klasse}"` : ''} src="${escAttr(bild.url)}" alt="${escAttr(alt)}"${groesse(bild)} loading="lazy">`;
  if (bild.webpUrl) return `<picture><source srcset="${escAttr(bild.webpUrl)}" type="image/webp">${img}</picture>`;
  return img;
}
