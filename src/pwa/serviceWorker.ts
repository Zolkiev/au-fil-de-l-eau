/*
 * Service worker d’Au fil de l’eau : il garde tout le jeu en cache (code,
 * niveaux, poissons, sons, icônes) pour qu'il se lance sans connexion.
 *
 * - La liste des fichiers est écrite au build par le plugin
 *   `scripts/pwaPlugin.ts`, avec une empreinte par fichier.
 * - Une nouvelle version s'installe en arrière-plan : seuls les fichiers
 *   dont l'empreinte a changé sont retéléchargés. Elle attend ensuite que le
 *   joueur choisisse « Mettre à jour » (ou que le jeu soit fermé), pour ne
 *   jamais changer le jeu en pleine partie.
 *
 * Compilé à part (tsconfig.sw.json) : il ne tourne pas dans la page.
 */

declare const self: ServiceWorkerGlobalScope;

/** Fichiers du jeu : chemin relatif (depuis sw.js) → empreinte du contenu. */
interface Precache {
  readonly version: string;
  readonly files: Readonly<Record<string, string>>;
}

// Remplacé au build par la vraie liste (voir scripts/pwaPlugin.ts)
const PRECACHE = JSON.parse('__PRECACHE_MANIFEST__') as Precache;
const CACHE_PREFIX = 'petite-peche-';
const CACHE_NAME = `${CACHE_PREFIX}${PRECACHE.version}`;
/** Entrée du cache qui garde les empreintes de la version, pour la suivante. */
const REVISIONS_KEY = '__revisions__';
/**
 * Le cache est rangé par adresse seulement. Sans `ignoreVary`, une réponse
 * « Vary: Origin » ne servirait pas aux <script>/<link crossorigin>, qui
 * envoient un en-tête Origin : le jeu ne démarrerait pas hors ligne.
 */
const MATCH: CacheQueryOptions = { ignoreVary: true };

self.addEventListener('install', (event) => event.waitUntil(precache()));
self.addEventListener('activate', (event) => event.waitUntil(removeOldCaches().then(() => self.clients.claim())));
self.addEventListener('fetch', (event) => {
  if (isOwnGet(event.request)) event.respondWith(respond(event.request));
});
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') void self.skipWaiting();
});

// --- Installation ------------------------------------------------------------

/** Met tous les fichiers en cache, en reprenant ceux qui n'ont pas changé depuis la version précédente. */
async function precache(): Promise<void> {
  const cache = await caches.open(CACHE_NAME);
  const previous = await previousVersion();
  await Promise.all(Object.entries(PRECACHE.files).map(([file, revision]) => cacheFile(cache, file, revision, previous)));
  await cache.put(REVISIONS_KEY, new Response(JSON.stringify(PRECACHE.files), { headers: { 'Content-Type': 'application/json' } }));
}

async function cacheFile(cache: Cache, file: string, revision: string, previous: PreviousVersion | null): Promise<void> {
  const url = urlOf(file);
  const kept = previous?.revisions[file] === revision ? await previous.cache.match(url, MATCH) : undefined;
  if (kept) return cache.put(url, kept);
  const response = await fetch(new Request(url, { cache: 'reload' }));
  if (!response.ok) throw new Error(`${file} : ${response.status}`);
  return cache.put(url, response);
}

interface PreviousVersion {
  readonly cache: Cache;
  readonly revisions: Readonly<Record<string, string>>;
}

/** Cache de la version installée avant celle-ci (le plus récent des autres), s'il y en a un. */
async function previousVersion(): Promise<PreviousVersion | null> {
  const names = (await caches.keys()).filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME);
  for (const name of names.reverse()) {
    const cache = await caches.open(name);
    const revisions = await cache.match(REVISIONS_KEY);
    if (revisions) return { cache, revisions: (await revisions.json()) as Record<string, string> };
  }
  return null;
}

async function removeOldCaches(): Promise<void> {
  const names = await caches.keys();
  await Promise.all(names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map((name) => caches.delete(name)));
}

// --- Requêtes ----------------------------------------------------------------

function isOwnGet(request: Request): boolean {
  return request.method === 'GET' && new URL(request.url).origin === self.location.origin;
}

/**
 * Le cache d'abord (le jeu se lance aussi vite hors ligne qu'en ligne), puis
 * le réseau pour le reste. Hors ligne, un fichier inconnu (un son pas encore
 * fourni…) répond comme un fichier absent : le jeu prend son remplaçant.
 */
async function respond(request: Request): Promise<Response> {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(isGameStart(request) ? urlOf('index.html') : request, MATCH);
  if (cached) return cached;
  try {
    return await fetch(request);
  } catch {
    return new Response(null, { status: 404, statusText: 'Hors ligne' });
  }
}

/** Ouverture du jeu : la page d'accueil, avec ou sans « index.html » ni paramètres. */
function isGameStart(request: Request): boolean {
  if (request.mode !== 'navigate') return false;
  const { pathname } = new URL(request.url);
  const scope = new URL(self.registration.scope).pathname;
  return pathname === scope || pathname === `${scope}index.html`;
}

function urlOf(file: string): string {
  return new URL(file, self.registration.scope).href;
}
