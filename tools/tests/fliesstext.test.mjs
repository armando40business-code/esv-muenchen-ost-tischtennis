// Fließtext aus Pages CMS: leere Editorfelder und Leerraum am Rand von Fett/Kursiv/Link (Befunde aus cms-probe).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fliesstext, zeile, istLeererFliesstext } from '../../lib/fliesstext.mjs';

const LEERE = ['', '<p></p>', '<p><br></p>', '<p><br/></p>', '<p> </p>', ' <p>\n</p> ', '<p>&nbsp;</p>', '<p></p><p></p>',
  '<p><br></p><p> &nbsp; </p>', '<P></P>', null, undefined];

test('leere Editorfelder ("<p></p>" & Co.) gelten als leer und erzeugen kein HTML', () => {
  for (const x of LEERE) {
    assert.equal(istLeererFliesstext(x), true, JSON.stringify(x));
    assert.equal(fliesstext(x), '', `fliesstext(${JSON.stringify(x)})`);
    assert.equal(zeile(x), '', `zeile(${JSON.stringify(x)})`);
  }
  for (const x of ['<p>a</p>', 'a', '<p><b>x</b></p>', '<ul><li>x</li></ul>']) assert.equal(istLeererFliesstext(x), false, x);
});

test('Leerraum am Rand von Fett/Kursiv/Link wird nach außen gezogen', () => {
  assert.equal(zeile('<p>eine nahegelegene <strong>Wirtschaft </strong>oder in</p>'), 'eine nahegelegene <b>Wirtschaft</b> oder in');
  assert.equal(zeile('<p>vor<strong> fett</strong> nach</p>'), 'vor <b>fett</b> nach');
  assert.equal(zeile('<p>a <em> kursiv </em> b</p>'), 'a <em>kursiv</em> b');
  assert.equal(zeile('<p>Mehr <a href="training.html">dazu </a>hier</p>'), 'Mehr <a class="textlink" href="training.html">dazu</a> hier');
  assert.equal(zeile('<p>x<strong><em>innen </em></strong>y</p>'), 'x<b><em>innen</em></b> y');
  assert.equal(zeile('<p>a<strong> </strong>b</p>'), 'a b', 'Fett nur aus Leerzeichen');
  assert.equal(fliesstext('<p><strong>Fett am Ende </strong></p>'), '<p><b>Fett am Ende</b></p>');
  assert.equal(fliesstext('<p><strong>Ohne Rand</strong> bleibt.</p>'), '<p><b>Ohne Rand</b> bleibt.</p>');
});
