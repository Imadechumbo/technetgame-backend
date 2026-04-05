import crypto from 'crypto';

const RAWG_API_KEY = String(process.env.RAWG_API_KEY || '').trim();
const RAWG_API_BASE = String(process.env.RAWG_API_BASE || 'https://api.rawg.io/api').trim();

const SERPAPI_ACCESS_KEY = String(
  process.env.SERPAPI_ACCESS_KEY || process.env.SerpAPI_ACCESS_KEY || ''
).trim();
const UNSPLASH_ACCESS_KEY = String(process.env.UNSPLASH_ACCESS_KEY || '').trim();
const PEXELS_API_KEY = String(process.env.PEXELS_API_KEY || '').trim();
const PIXABAY_API_KEY = String(process.env.PIXABAY_API_KEY || '').trim();

const SITE_URL = String(process.env.SITE_URL || '').trim().replace(/\/$/, '');

const REQUEST_TIMEOUT_MS = Number(
  process.env.MEDIA_REQUEST_TIMEOUT_MS ||
    process.env.REQUEST_TIMEOUT_MS ||
    12000
);

const MEDIA_CACHE_TTL_MS = Number(
  process.env.MEDIA_CACHE_TTL_MS ||
    process.env.IMAGE_CACHE_TTL_MS ||
    7 * 24 * 60 * 60 * 1000
);

const memoryCache = new Map();

const FALLBACK_GAME_IMAGE = '/assets/img/fallback-game-cover.svg';
const FALLBACK_HARDWARE_IMAGE = '/assets/img/fallback-game-cover.svg';
const FALLBACK_AVATAR = '/assets/img/default-avatar.svg';

function normalizeKey(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function toCacheKey(prefix, value) {
  return `${prefix}:${normalizeKey(value)}`;
}

function getFromMemoryCache(key) {
  const entry = memoryCache.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }

  return entry.value;
}

function setInMemoryCache(key, value, ttl = MEDIA_CACHE_TTL_MS) {
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttl
  });
}

function withSiteUrl(value = '') {
  const clean = String(value || '').trim();
  if (!clean) return '';

  if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;
  if (!clean.startsWith('/')) return clean;
  if (!SITE_URL) return clean;

  return `${SITE_URL}${clean}`;
}

function sanitizeImageUrl(url = '') {
  const value = String(url || '').trim();
  if (!value) return '';

  if (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('/')) {
    return value;
  }

  return '';
}

function pickFirstValidUrl(candidates = []) {
  for (const candidate of candidates) {
    const url = sanitizeImageUrl(candidate);
    if (url) return url;
  }
  return '';
}

function hashString(value = '') {
  return crypto.createHash('md5').update(String(value || '')).digest('hex');
}

async function fetchJson(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': process.env.USER_AGENT || 'TechNetGame/1.0',
        ...(options.headers || {})
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function buildHardwareQueries(query = '') {
  const q = String(query || '').trim();
  const normalized = normalizeKey(q);

  return [
    q,
    `${q} hardware`,
    `${q} pc component`,
    `${q} gaming setup`,
    `${q} tech product`,
    `${normalized} hardware`
  ].filter(Boolean);
}

function buildGameQueries(title = '') {
  const q = String(title || '').trim();
  const normalized = normalizeKey(q);

  return [
    q,
    `${q} game`,
    `${q} official art`,
    `${q} cover art`,
    `${q} gameplay`,
    `${normalized} game`
  ].filter(Boolean);
}

async function searchRawgGameImage(title = '') {
  if (!RAWG_API_KEY || !title) return '';

  try {
    const url =
      `${RAWG_API_BASE}/games?key=${encodeURIComponent(RAWG_API_KEY)}` +
      `&search=${encodeURIComponent(title)}&page_size=5`;

    const data = await fetchJson(url);
    const results = Array.isArray(data?.results) ? data.results : [];
    if (!results.length) return '';

    const best = results[0];

    return pickFirstValidUrl([
      best?.background_image,
      best?.background_image_additional,
      Array.isArray(best?.short_screenshots) ? best.short_screenshots[0]?.image : '',
      Array.isArray(best?.short_screenshots) ? best.short_screenshots[1]?.image : ''
    ]);
  } catch (error) {
    console.error('[media][rawg] erro:', error.message);
    return '';
  }
}

async function searchSerpApiImage(query = '') {
  if (!SERPAPI_ACCESS_KEY || !query) return '';

  try {
    const url =
      `https://serpapi.com/search.json?engine=google_images&q=${encodeURIComponent(query)}` +
      `&api_key=${encodeURIComponent(SERPAPI_ACCESS_KEY)}&ijn=0`;

    const data = await fetchJson(url);
    const images = Array.isArray(data?.images_results) ? data.images_results : [];

    for (const item of images) {
      const image = pickFirstValidUrl([item?.original, item?.thumbnail, item?.image]);
      if (image) return image;
    }

    return '';
  } catch (error) {
    console.error('[media][serpapi] erro:', error.message);
    return '';
  }
}

async function searchUnsplashImage(query = '') {
  if (!UNSPLASH_ACCESS_KEY || !query) return '';

  try {
    const url =
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}` +
      `&per_page=5&orientation=landscape`;

    const data = await fetchJson(url, {
      headers: {
        Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
        'Accept-Version': 'v1'
      }
    });

    const results = Array.isArray(data?.results) ? data.results : [];

    for (const item of results) {
      const image = pickFirstValidUrl([
        item?.urls?.regular,
        item?.urls?.small,
        item?.urls?.full
      ]);
      if (image) return image;
    }

    return '';
  } catch (error) {
    console.error('[media][unsplash] erro:', error.message);
    return '';
  }
}

async function searchPexelsImage(query = '') {
  if (!PEXELS_API_KEY || !query) return '';

  try {
    const url =
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}` +
      `&per_page=5&orientation=landscape`;

    const data = await fetchJson(url, {
      headers: {
        Authorization: PEXELS_API_KEY
      }
    });

    const photos = Array.isArray(data?.photos) ? data.photos : [];
    for (const item of photos) {
      const image = pickFirstValidUrl([
        item?.src?.large2x,
        item?.src?.large,
        item?.src?.medium
      ]);
      if (image) return image;
    }

    return '';
  } catch (error) {
    console.error('[media][pexels] erro:', error.message);
    return '';
  }
}

async function searchPixabayImage(query = '') {
  if (!PIXABAY_API_KEY || !query) return '';

  try {
    const url =
      `https://pixabay.com/api/?key=${encodeURIComponent(PIXABAY_API_KEY)}` +
      `&q=${encodeURIComponent(query)}&image_type=photo&per_page=5&safesearch=true`;

    const data = await fetchJson(url);
    const hits = Array.isArray(data?.hits) ? data.hits : [];

    for (const item of hits) {
      const image = pickFirstValidUrl([
        item?.largeImageURL,
        item?.webformatURL,
        item?.previewURL
      ]);
      if (image) return image;
    }

    return '';
  } catch (error) {
    console.error('[media][pixabay] erro:', error.message);
    return '';
  }
}

async function searchWikimediaImage(query = '') {
  if (!query) return '';

  try {
    const url =
      `https://commons.wikimedia.org/w/api.php?origin=*` +
      `&action=query&generator=search&gsrsearch=${encodeURIComponent(query)}` +
      `&gsrlimit=3&prop=imageinfo&iiprop=url&format=json`;

    const data = await fetchJson(url);
    const pages = data?.query?.pages ? Object.values(data.query.pages) : [];

    for (const page of pages) {
      const image = pickFirstValidUrl([page?.imageinfo?.[0]?.url]);
      if (image) return image;
    }

    return '';
  } catch (error) {
    console.error('[media][wikimedia] erro:', error.message);
    return '';
  }
}

function getAvatarFallback(nameOrUrl = '') {
  const key = normalizeKey(nameOrUrl);
  if (!key) return withSiteUrl(FALLBACK_AVATAR);
  const hash = hashString(key);
  return `https://www.gravatar.com/avatar/${hash}?d=identicon&s=256`;
}

export async function getGameImage(title = '') {
  const cacheKey = toCacheKey('game', title);
  const cached = getFromMemoryCache(cacheKey);
  if (cached) return cached;

  const queries = buildGameQueries(title);

  for (const query of queries) {
    const providers = [
      () => searchRawgGameImage(query),
      () => searchSerpApiImage(`${query} official game art`),
      () => searchPexelsImage(`${query} gaming`),
      () => searchPixabayImage(`${query} gaming`),
      () => searchWikimediaImage(query),
      () => searchUnsplashImage(`${query} gaming`)
    ];

    for (const provider of providers) {
      const image = await provider();
      if (image) {
        const finalUrl = withSiteUrl(image);
        setInMemoryCache(cacheKey, finalUrl);
        return finalUrl;
      }
    }
  }

  const fallback = withSiteUrl(FALLBACK_GAME_IMAGE);
  setInMemoryCache(cacheKey, fallback, 60 * 60 * 1000);
  return fallback;
}

export async function getHardwareImage(query = '') {
  const cacheKey = toCacheKey('hardware', query);
  const cached = getFromMemoryCache(cacheKey);
  if (cached) return cached;

  const queries = buildHardwareQueries(query);

  for (const currentQuery of queries) {
    const providers = [
      () => searchPexelsImage(currentQuery),
      () => searchPixabayImage(currentQuery),
      () => searchWikimediaImage(currentQuery),
      () => searchSerpApiImage(currentQuery),
      () => searchUnsplashImage(currentQuery)
    ];

    for (const provider of providers) {
      const image = await provider();
      if (image) {
        const finalUrl = withSiteUrl(image);
        setInMemoryCache(cacheKey, finalUrl);
        return finalUrl;
      }
    }
  }

  const fallback = withSiteUrl(FALLBACK_HARDWARE_IMAGE);
  setInMemoryCache(cacheKey, fallback, 60 * 60 * 1000);
  return fallback;
}

export async function getCreatorAvatar(nameOrChannelUrl = '') {
  const cacheKey = toCacheKey('avatar', nameOrChannelUrl);
  const cached = getFromMemoryCache(cacheKey);
  if (cached) return cached;

  const avatarUrl = getAvatarFallback(nameOrChannelUrl);
  setInMemoryCache(cacheKey, avatarUrl, 30 * 24 * 60 * 60 * 1000);
  return avatarUrl;
}

export async function debugMediaProviders(query = '') {
  return {
    query,
    rawg: await searchRawgGameImage(query),
    serpapi: await searchSerpApiImage(query),
    unsplash: await searchUnsplashImage(query),
    pexels: await searchPexelsImage(query),
    pixabay: await searchPixabayImage(query),
    wikimedia: await searchWikimediaImage(query)
  };
}

export function clearMediaMemoryCache() {
  memoryCache.clear();
  return { ok: true };
}
