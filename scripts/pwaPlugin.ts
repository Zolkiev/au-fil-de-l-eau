import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';

/** Source du service worker, et nom du fichier produit (à la racine du build). */
const SW_SOURCE = 'src/pwa/serviceWorker.ts';
const SW_FILE = 'sw.js';
/** Chaîne que le service worker contient à la place de la liste des fichiers. */
const PLACEHOLDER = /(["'`])__PRECACHE_MANIFEST__\1/;

/**
 * PWA sans dépendance (build seulement) :
 * - compile `src/pwa/serviceWorker.ts` en `sw.js`, à la racine du build ;
 * - y écrit la liste de tous les fichiers du jeu (code, puis dossier public :
 *   niveaux, poissons, sons, icônes), chacun avec l'empreinte de son contenu.
 * Le moindre changement (code ou asset réexporté) change donc `sw.js`, et le
 * navigateur installe la nouvelle version.
 */
export function pwaPlugin(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'petite-peche-pwa',
    apply: 'build',
    enforce: 'post',
    configResolved(resolved) {
      config = resolved;
    },
    buildStart() {
      this.emitFile({ type: 'chunk', id: resolve(config.root, SW_SOURCE), fileName: SW_FILE });
    },
    generateBundle(_options, bundle) {
      const files: Record<string, string> = {};
      for (const [fileName, output] of Object.entries(bundle)) {
        if (fileName !== SW_FILE && !fileName.endsWith('.map')) files[fileName] = revision(output.type === 'chunk' ? output.code : output.source);
      }
      if (config.publicDir) {
        for (const file of listFiles(config.publicDir)) files[toUrlPath(relative(config.publicDir, file))] = revision(readFileSync(file));
      }
      const worker = bundle[SW_FILE];
      if (worker?.type !== 'chunk' || !PLACEHOLDER.test(worker.code)) {
        this.error(`${SW_FILE} : liste des fichiers introuvable (__PRECACHE_MANIFEST__).`);
      }
      const sorted = Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)));
      const manifest = { version: revision(JSON.stringify(sorted)), files: sorted };
      worker.code = worker.code.replace(PLACEHOLDER, JSON.stringify(JSON.stringify(manifest)));
    },
  };
}

/** Empreinte courte d'un contenu. */
function revision(content: string | Uint8Array): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 12);
}

/** Tous les fichiers d'un dossier, sous-dossiers compris, sans les fichiers cachés (.gitkeep, .DS_Store…). */
function listFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith('.'))
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? listFiles(path) : [path];
    });
}

function toUrlPath(path: string): string {
  return path.split(sep).map(encodeURIComponent).join('/');
}
