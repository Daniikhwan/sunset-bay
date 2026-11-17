// Sunset Bay — the entrypoint program (Node 22, standard library only).
// It copies game/ and screenshots/ from this repository into the output
// directory and writes the dossier.json that buildDossier produces from
// them, under the bounty's caps.
//
// NOTE: the output directory itself must never be removed. In the grader
// /output is a mount point whose parent is read-only for the entry's
// user, so removing it throws (EACCES/EBUSY on rmdir) and the run fails
// before anything is copied. Only the directory's CONTENTS are cleared,
// best effort: an entry that cannot be removed is left in place and
// never fails the run.
import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

mkdirSync(outDir, { recursive: true });
for (const entry of readdirSync(outDir)) {
  try {
    rmSync(join(outDir, entry), { recursive: true, force: true });
  } catch {
    // leave it; the copy below overwrites what it can
  }
}
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`Sunset Bay dossier written to ${join(outDir, 'dossier.json')}`);
