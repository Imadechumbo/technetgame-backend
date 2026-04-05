import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CACHE_DIR = path.resolve(__dirname, '../../data/cache');
const CACHE_DIR = path.resolve(process.env.CACHE_DIR || DEFAULT_CACHE_DIR);
const CACHE_FILE = path.join(CACHE_DIR, 'news-cache.json');
const IMAGE_CACHE_FILE = path.join(CACHE_DIR, 'image-cache.json');
const TRANSLATION_CACHE_FILE = path.join(CACHE_DIR, 'translation-cache.json');

async function ensureCacheDir() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

async function readJson(file, fallback) {
  try {
    const raw = await fs.readFile(file, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(file, payload) {
  await ensureCacheDir();
  await fs.writeFile(file, JSON.stringify(payload, null, 2), 'utf-8');
  return payload;
}

export function getCachePaths() {
  return {
    cacheDir: CACHE_DIR,
    newsCacheFile: CACHE_FILE,
    imageCacheFile: IMAGE_CACHE_FILE,
    translationCacheFile: TRANSLATION_CACHE_FILE
  };
}

export async function readCache() {
  return readJson(CACHE_FILE, { generatedAt: null, items: [], meta: { status: 'missing' } });
}

export async function writeCache(payload) {
  return writeJson(CACHE_FILE, payload);
}

export async function readImageCache() {
  return readJson(IMAGE_CACHE_FILE, { generatedAt: null, items: {} });
}

export async function writeImageCache(payload) {
  return writeJson(IMAGE_CACHE_FILE, payload);
}

export async function readTranslationCache() {
  return readJson(TRANSLATION_CACHE_FILE, { generatedAt: null, items: {}, meta: {} });
}

export async function writeTranslationCache(payload) {
  return writeJson(TRANSLATION_CACHE_FILE, payload);
}
