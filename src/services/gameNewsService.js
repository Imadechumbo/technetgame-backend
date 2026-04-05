import { getLatest } from './feedService.js';
import { getGameImage } from './mediaService.js';

const NEWSAPI_KEY = String(process.env.NEWSAPI_KEY || '').trim();
const NEWSAPI_BASE = String(process.env.NEWSAPI_BASE || 'https://newsapi.org/v2/everything').trim();
const GAME_NEWS_CACHE_TTL_MS = Number(process.env.GAME_NEWS_CACHE_TTL_MS || 30 * 60 * 1000);
const GAME_NEWS_REQUEST_TIMEOUT_MS = Number(process.env.GAME_NEWS_REQUEST_TIMEOUT_MS || 10000);
const GAME_NEWS_PAGE_SIZE = Math.min(Math.max(Number(process.env.GAME_NEWS_PAGE_SIZE || 3), 1), 5);
const NEWSAPI_FETCH_MULTIPLIER = Math.min(Math.max(Number(process.env.GAME_NEWS_FETCH_MULTIPLIER || 4), 1), 8);
const memoryCache = new Map();

function normalizeKey(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function safeLimit(value, fallback = GAME_NEWS_PAGE_SIZE) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 5);
}

function dedupeByUrl(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const key = String(item?.url || item?.title || '').trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildSearchTerms(query = '') {
  const base = String(query || '').trim();
  if (!base) return [];
  const terms = [base, `${base} game`, `${base} trailer`, `${base} release date`];
  const normalized = normalizeKey(base);
  if (normalized.includes('grand theft auto vi')) terms.push('GTA 6');
  if (normalized.includes('resident evil requiem')) terms.push('Resident Evil');
  if (normalized.includes('final fantasy vii remake')) terms.push('Final Fantasy 7');
  if (normalized.includes('assassin s creed codename hexe')) terms.push('Assassins Creed Hexe');
  return [...new Set(terms)];
}

function articleFromNewsApi(article = {}) {
  return {
    title: article.title || 'Sem título',
    url: article.url || '',
    image: article.urlToImage || '',
    source: article.source?.name || 'NewsAPI',
    description: article.description || article.content || ''
  };
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GAME_NEWS_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': process.env.USER_AGENT || 'TechNetGameBot/1.0'
      },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchFromNewsApi(query, limit) {
  if (!NEWSAPI_KEY) return [];
  const searchTerms = buildSearchTerms(query);
  const q = searchTerms.map((term) => `"${term}"`).join(' OR ');
  const pageSize = Math.min(Math.max(limit * NEWSAPI_FETCH_MULTIPLIER, limit), 20);
  const url = `${NEWSAPI_BASE}?q=${encodeURIComponent(q)}&pageSize=${pageSize}&sortBy=publishedAt&searchIn=title,description&apiKey=${encodeURIComponent(NEWSAPI_KEY)}`;
  const payload = await fetchJson(url);
  const articles = dedupeByUrl((payload?.articles || []).map(articleFromNewsApi));
  const withImages = articles.filter((item) => item.image);
  const fallback = articles.filter((item) => !item.image);
  return [...withImages, ...fallback].slice(0, limit);
}

async function fetchFromLocalFeed(query, limit) {
  const latest = await getLatest(48);
  const terms = buildSearchTerms(query).map(normalizeKey);
  const items = Array.isArray(latest?.items) ? latest.items : [];
  const matched = items.filter((item) => {
    const haystack = normalizeKey(`${item.title || ''} ${item.summary || ''} ${item.description || ''}`);
    return terms.some((term) => haystack.includes(term));
  }).slice(0, limit);

  return matched.map((item) => ({
    title: item.title || 'Notícia relacionada',
    url: item.url || item.sourceUrl || '#',
    image: item.image || '',
    source: item.sourceName || item.sourceSlug || 'TechNetGame',
    description: item.summary || item.description || ''
  }));
}

export async function searchGameNews(query = '', limitValue = GAME_NEWS_PAGE_SIZE) {
  const queryText = String(query || '').trim();
  const limit = safeLimit(limitValue, GAME_NEWS_PAGE_SIZE);
  if (!queryText) {
    return { ok: false, query: '', cover: '/assets/img/fallback-game-cover.svg', items: [] };
  }

  const cacheKey = `${normalizeKey(queryText)}:${limit}`;
  const cached = memoryCache.get(cacheKey);
  if (cached && (Date.now() - cached.cachedAt) < GAME_NEWS_CACHE_TTL_MS) return cached.payload;

  let items = [];
  try {
    items = await fetchFromNewsApi(queryText, limit);
  } catch (error) {
    console.warn('[game-news] NewsAPI lookup failed for', queryText, error?.message || error);
  }

  if (!items.length) {
    try {
      items = await fetchFromLocalFeed(queryText, limit);
    } catch (error) {
      console.warn('[game-news] Local feed fallback failed for', queryText, error?.message || error);
    }
  }

  let cover = items.find((item) => item?.image)?.image || '/assets/img/fallback-game-cover.svg';
  try {
    const lookedUpCover = await getGameImage(queryText, '/assets/img/fallback-game-cover.svg');
    if (!cover || cover.includes('fallback-game-cover')) {
      cover = lookedUpCover;
    }
  } catch (error) {
    console.warn('[game-news] Cover lookup failed for', queryText, error?.message || error);
  }

  if (!cover) {
    cover = '/assets/img/fallback-game-cover.svg';
  }

  const payload = {
    ok: true,
    query: queryText,
    cover,
    items: dedupeByUrl(items).slice(0, limit)
  };

  memoryCache.set(cacheKey, { cachedAt: Date.now(), payload });
  return payload;
}
