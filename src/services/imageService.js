import { readImageCache, writeImageCache } from './cacheService.js';

const DEFAULT_IMAGE_POOLS = {
  sony: [
    'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1527443154391-507e9dc6c5cc?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1605901309584-818e25960a8f?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1560253023-3ec5d502959f?auto=format&fit=crop&w=1200&q=80'
  ],
  microsoft: [
    'https://images.unsplash.com/photo-1621259182978-fbf93132d53d?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1603481546238-487240415921?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?auto=format&fit=crop&w=1200&q=80'
  ],
  nintendo: [
    'https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1527443154391-507e9dc6c5cc?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1560253023-3ec5d502959f?auto=format&fit=crop&w=1200&q=80'
  ],
  valve: [
    'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1603481546238-487240415921?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1527443154391-507e9dc6c5cc?auto=format&fit=crop&w=1200&q=80'
  ],
  hardware: [
    'https://images.unsplash.com/photo-1591799265444-d66432b91588?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80&sat=-100',
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80'
  ],
  technology: [
    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1526379095098-d400fd0bf935?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80'
  ],
  security: [
    'https://images.unsplash.com/photo-1510511459019-5dda7724fd87?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1526379095098-d400fd0bf935?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1555949963-aa79dcee981c?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=1200&q=80'
  ],
  ai: [
    'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1674027392884-75142961f66d?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1531746790731-6c087fecd65a?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1526379095098-d400fd0bf935?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80'
  ]
};

const GLOBAL_FALLBACK_POOL = Array.from(new Set(Object.values(DEFAULT_IMAGE_POOLS).flat()));
const imageCache = new Map();
let diskCacheLoaded = false;
let diskCacheWritePromise = Promise.resolve();

function decodeHtml(value = '') {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function isValidImageUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(String(url).trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const value = `${parsed.hostname}${parsed.pathname}`.toLowerCase();
    if (/\.(mp4|webm|mov|avi|m3u8)(?:$|[?#])/.test(value)) return false;
    if (/(gravatar|avatar|placeholder|default|blank|no-image|noimage|us_flag_small|logo|sprite)/.test(value)) return false;
    if (/\.(svg)(?:$|[?#])/.test(value)) return false;
    return true;
  } catch {
    return false;
  }
}

function absolutizeUrl(url, baseUrl) {
  if (!url) return null;
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return null;
  }
}

function extractFromHtml(html, pageUrl) {
  if (!html) return null;

  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
    /<img[^>]+src=["']([^"']+)["']/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    const raw = decodeHtml(match?.[1] || '');
    const absolute = absolutizeUrl(raw, pageUrl);
    if (isValidImageUrl(absolute)) return absolute;
  }

  return null;
}

function getCacheTtlMs() {
  return Number(process.env.IMAGE_CACHE_TTL_MS || 24 * 60 * 60 * 1000);
}

async function ensureDiskCacheLoaded() {
  if (diskCacheLoaded) return;
  const stored = await readImageCache();
  for (const [url, entry] of Object.entries(stored?.items || {})) {
    if (entry?.image && isValidImageUrl(entry.image)) {
      imageCache.set(url, entry);
    }
  }
  diskCacheLoaded = true;
}

async function persistImageCache() {
  const items = {};
  for (const [url, entry] of imageCache.entries()) {
    items[url] = entry;
  }
  diskCacheWritePromise = diskCacheWritePromise.then(() => writeImageCache({ generatedAt: new Date().toISOString(), items }));
  return diskCacheWritePromise;
}

function normalizeImageFingerprint(url = '') {
  if (!url) return '';

  const raw = String(url).trim().toLowerCase();

  try {
    const parsed = new URL(raw);
    const normalizedPath = parsed.pathname
      .replace(/\\/g, '/')
      .replace(/[-_]?\d{2,4}x\d{2,4}(?=\.[a-z0-9]+$)/g, '')
      .replace(/[-_](thumb|thumbnail|small|medium|large|preview|og|social)(?=\.[a-z0-9]+$)/g, '');
    const filename = normalizedPath.split('/').filter(Boolean).pop() || normalizedPath;
    return `${parsed.hostname}/${filename}`;
  } catch {
    return raw
      .replace(/([?&])(w|h|fit|crop|q|auto|width|height|quality)=[^&]+/g, '')
      .replace(/[?&]$/, '')
      .replace(/[-_]?\d{2,4}x\d{2,4}(?=\.[a-z0-9]+$)/g, '')
      .trim();
  }
}

function hashSeed(seed = '') {
  let hash = 0;
  for (const char of String(seed)) {
    hash = ((hash << 5) - hash) + char.charCodeAt(0);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getFallbackPool(category) {
  return DEFAULT_IMAGE_POOLS[category] || DEFAULT_IMAGE_POOLS.technology || DEFAULT_IMAGE_POOLS.ai;
}

export function getFallbackImage(category, seed = 'default', usedFingerprints = new Set()) {
  const pool = getFallbackPool(category);
  if (!pool.length) return DEFAULT_IMAGE_POOLS.technology[0];

  const startIndex = hashSeed(`${category}-${seed}`) % pool.length;
  for (let offset = 0; offset < pool.length; offset += 1) {
    const candidate = pool[(startIndex + offset) % pool.length];
    const fingerprint = normalizeImageFingerprint(candidate);
    if (!usedFingerprints.has(fingerprint)) return candidate;
  }

  const globalStartIndex = hashSeed(`global-${category}-${seed}`) % GLOBAL_FALLBACK_POOL.length;
  for (let offset = 0; offset < GLOBAL_FALLBACK_POOL.length; offset += 1) {
    const candidate = GLOBAL_FALLBACK_POOL[(globalStartIndex + offset) % GLOBAL_FALLBACK_POOL.length];
    const fingerprint = normalizeImageFingerprint(candidate);
    if (!usedFingerprints.has(fingerprint)) return candidate;
  }

  return pool[startIndex] || GLOBAL_FALLBACK_POOL[globalStartIndex] || DEFAULT_IMAGE_POOLS.technology[0];
}

function buildImageCandidates(item = {}) {
  return Array.from(new Set([
    item.image,
    item.ogImage,
    item.enclosure,
    item.thumbnail,
    item.media,
    item.imageFallback
  ].filter(isValidImageUrl)));
}

export function ensureDistinctImage(item = {}, usedFingerprints = new Set()) {
  const candidates = buildImageCandidates(item);

  for (const candidate of candidates) {
    const fingerprint = normalizeImageFingerprint(candidate);
    if (!fingerprint || usedFingerprints.has(fingerprint)) continue;
    usedFingerprints.add(fingerprint);

    const fallback = getFallbackImage(item.category, item.imageSeed || item.id || item.slug || item.title || 'fallback', usedFingerprints);
    return { ...item, image: candidate, imageFallback: fallback };
  }

  const fallback = getFallbackImage(item.category, item.imageSeed || item.id || item.slug || item.title || 'fallback', usedFingerprints);
  usedFingerprints.add(normalizeImageFingerprint(fallback));
  return { ...item, image: fallback, imageFallback: fallback };
}

function setCachedImage(url, image) {
  const entry = {
    image,
    cachedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + getCacheTtlMs()).toISOString()
  };
  imageCache.set(url, entry);
  void persistImageCache();
  return image;
}

function getFreshCachedImage(url) {
  const entry = imageCache.get(url);
  if (!entry?.image) return null;
  const expiresAt = new Date(entry.expiresAt || 0).getTime();
  if (expiresAt && expiresAt < Date.now()) {
    imageCache.delete(url);
    return null;
  }
  return entry.image;
}

export async function resolveImageForItem(item) {
  if (isValidImageUrl(item?.image)) return item.image;
  if (!item?.url) return getFallbackImage(item?.category, item?.id || item?.slug || 'missing-url');

  await ensureDiskCacheLoaded();

  const cached = getFreshCachedImage(item.url);
  if (cached) return cached;

  let timeout;

  try {
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), Number(process.env.IMAGE_FETCH_TIMEOUT_MS || 5000));

    const response = await fetch(item.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': process.env.USER_AGENT || 'TechNetGameBot/1.0',
        Accept: 'text/html,application/xhtml+xml'
      }
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return setCachedImage(item.url, getFallbackImage(item.category, item.id || item.slug || item.title || 'fallback-response'));
    }

    const html = await response.text();
    const extracted = extractFromHtml(html, item.url) || getFallbackImage(item.category, item.id || item.slug || item.title || 'fallback-html');
    return setCachedImage(item.url, extracted);
  } catch {
    clearTimeout(timeout);
    return setCachedImage(item.url, getFallbackImage(item.category, item.id || item.slug || item.title || 'fallback-error'));
  }
}
