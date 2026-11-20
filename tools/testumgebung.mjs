// Hilfen für Prüfungen in einer Wegwerf-Kopie des Repos (der echte Inhalt bleibt unberührt).

import { cpSync, mkdtempSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Kopiert alles, was zum Bauen nötig ist, in ein Temp-Verzeichnis. */
export function kopieRepo(praefix = 'esv-test-') {
  const dir = mkdtempSync(join(tmpdir(), praefix));
  for (const teil of ['build.mjs', 'lib', 'inhalt', 'styles.css', 'assets', 'medien', 'statisch']) {
    if (existsSync(join(WURZEL, teil))) cpSync(join(WURZEL, teil), join(dir, teil), { recursive: true });
  }
  return dir;
}

/** node build.mjs im Verzeichnis ausführen. */
export function baue(dir, args = []) {
  const r = spawnSync(process.execPath, ['build.mjs', ...args], { cwd: dir, encoding: 'utf8' });
  return { code: r.status, ausgabe: (r.stdout || '') + (r.stderr || '') };
}
