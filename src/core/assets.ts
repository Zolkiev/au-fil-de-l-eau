import { DRACO_GLTF_CONFIG, DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { warn } from './log';

let gltfLoader: GLTFLoader | null = null;

/** URL publique d'un fichier du dossier `assets/`. */
export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}

/**
 * Loader GLTF partagé, capable de lire les .glb compressés en Draco.
 * Les décodeurs sont fournis par three.js et embarqués par Vite au build.
 */
function getLoader(): GLTFLoader {
  if (gltfLoader) return gltfLoader;
  const draco = new DRACOLoader().setDecoderPath(DRACO_GLTF_CONFIG);
  gltfLoader = new GLTFLoader().setDRACOLoader(draco);
  return gltfLoader;
}

/**
 * Charge un .glb du dossier `assets/`.
 * Ne lève jamais d'erreur : retourne null (avec un warning clair) si le
 * fichier est absent ou illisible, pour que l'appelant utilise un placeholder.
 */
export async function loadGLB(path: string, label: string): Promise<GLTF | null> {
  try {
    return await getLoader().loadAsync(assetUrl(path));
  } catch (error) {
    warn('assets', `${label} : « assets/${path} » introuvable ou illisible → placeholder utilisé.`, error);
    return null;
  }
}
