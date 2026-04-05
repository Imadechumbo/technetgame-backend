import Parser from 'rss-parser';
import { SOURCE_CATALOG, HOMEPAGE_BUCKETS, CATEGORY_LABELS } from '../config/sources.js';
import { CURATED_SEED_ITEMS } from '../config/seedNews.js';
import { normalizeFeedItem } from './normalizer.js';
import { compareByDateDesc } from '../utils/date.js';
import { slugify } from '../utils/slug.js';
import { readCache, writeCache } from './cacheService.js';
import { resolveImageForItem, ensureDistinctImage, getFallbackImage } from './imageService.js';
import { createTranslationSession } from './translationService.js';
import { detectLanguage, shouldDiscardLanguage } from './languageService.js';
import { buildEditorialVersion, getSourceQualityScore, scoreNewsQuality, scoreTranslationQuality, semanticSimilarity, tokenizeSemantic } from './editorialService.js';

const parser = new Parser({
  timeout: Number(process.env.REQUEST_TIMEOUT_MS || 12000),
  headers: {
    'User-Agent': process.env.USER_AGENT || 'TechNetGameBot/1.0'
  },
  customFields: {
    item: [
      ['media:content', 'media:content', { keepArray: true }],
      ['media:thumbnail', 'media:thumbnail', { keepArray: true }],
      ['content:encoded', 'content:encoded'],
      ['itunes:image', 'itunes:image']
    ]
  }
});

const TITLE_STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'for', 'with', 'and', 'to', 'on', 'in',
  'de', 'da', 'do', 'das', 'dos', 'para', 'com', 'uma', 'um', 'o', 'os', 'as', 'ao', 'na', 'no'
]);

const DUPLICATE_STOPWORDS = new Set([
  ...TITLE_STOPWORDS,
  'update', 'updates', 'atualizacao', 'atualizações', 'release', 'launch',
  'announces', 'announce', 'anuncia', 'introduces', 'apresenta', 'overview',
  'resumo', 'news', 'noticias', 'official', 'oficial', 'trailer', 'beta',
  'patch', 'guide', 'guia', 'preview', 'first', 'look'
]);

const AI_TERMS = ['ai', 'ia', 'agent', 'agents', 'copilot', 'gemini', 'llm', 'model', 'models', 'robotics', 'inference', 'generative', 'datacenter'];
const HIGHLIGHT_TERMS = ['launch', 'release', 'unveil', 'introduce', 'preview', 'showcase', 'direct', 'state of play', 'announces', 'announce', 'reveals', 'coming', 'debut', 'event', 'hands on'];
const STRONG_ENTITY_TERMS = ['nvidia', 'geforce', 'rtx', 'amd', 'intel', 'apple', 'google', 'gemini', 'playstation', 'sony', 'xbox', 'microsoft', 'steam', 'valve', 'nintendo', 'switch', 'vulnerability', 'segurança', 'security', 'gpu', 'cpu', 'chip'];

const DOMAIN_WEIGHTS = {
  'blog.playstation.com': 12,
  'news.xbox.com': 12,
  'store.steampowered.com': 12,
  'nvidianews.nvidia.com': 11,
  'www.amd.com': 10,
  'www.intel.com': 10,
  'blog.google': 11,
  'www.apple.com': 11,
  'www.cisa.gov': 11,
  'www.enisa.europa.eu': 10,
  'www.nintendo.com': 10,
  'www.nintendo.co.jp': 10
};

let isRefreshing = false;
let lastRefreshStartedAt = null;
let lastRefreshFinishedAt = null;
let lastRefreshError = null;

function normalizeWhitespace(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function stripAccents(value = '') {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeTextForCompare(value = '') {
  return stripAccents(normalizeWhitespace(value).toLowerCase());
}

function tokenizeTitle(value = '') {
  return normalizeTextForCompare(value)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function extractMeaningfulTokens(value = '') {
  return tokenizeTitle(value).filter((token) => !DUPLICATE_STOPWORDS.has(token) && token.length > 2);
}

function titleFingerprint(value = '') {
  return extractMeaningfulTokens(value).slice(0, 10).join('-');
}

function similarity(a = '', b = '') {
  const tokensA = new Set(extractMeaningfulTokens(a));
  const tokensB = new Set(extractMeaningfulTokens(b));
  if (!tokensA.size || !tokensB.size) return 0;
  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection += 1;
  }
  return intersection / Math.max(tokensA.size, tokensB.size, 1);
}

function extractDomain(url = '') {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function normalizeImageKey(url = '') {
  return String(url || '')
    .trim()
    .toLowerCase()
    .split('?')[0]
    .replace(/\/(avatar|default|blank|placeholder|no-image|noimage)(?=\.|\/|$)/g, '/invalid-image')
    .replace(/[-_]?\d{2,4}x\d{2,4}(?=\.[a-z0-9]+$)/g, '');
}

function sourceFamily(sourceSlug = '', category = '') {
  const value = `${sourceSlug} ${category}`;
  if (/xbox|microsoft/.test(value)) return 'microsoft';
  if (/steam|valve/.test(value)) return 'valve';
  if (/playstation|sony/.test(value)) return 'sony';
  if (/nintendo/.test(value)) return 'nintendo';
  if (/apple/.test(value)) return 'apple';
  if (/google/.test(value)) return 'google';
  if (/nvidia/.test(value)) return 'nvidia';
  if (/amd/.test(value)) return 'amd';
  if (/intel/.test(value)) return 'intel';
  if (/cisa/.test(value)) return 'cisa';
  if (/enisa/.test(value)) return 'enisa';
  return category || sourceSlug || 'generic';
}

function containsAny(text, list) {
  const haystack = normalizeTextForCompare(text);
  return list.some((term) => haystack.includes(normalizeTextForCompare(term)));
}

function isAiItem(item) {
  const text = `${item.title || ''} ${item.summary || ''} ${(item.tags || []).join(' ')}`;
  return containsAny(text, AI_TERMS);
}

function categoryMatch(item, slug) {
  switch (slug) {
    case 'games':
      return ['sony', 'microsoft', 'nintendo', 'valve'].includes(item.category);
    case 'technology':
      return ['technology'].includes(item.category);
    case 'hardware':
      return item.category === 'hardware';
    case 'ai':
      return isAiItem(item);
    case 'internet':
      return item.category === 'technology' || containsAny(`${item.title || ''} ${item.summary || ''}`, ['android', 'cloud', 'workspace', 'web', 'mobile', 'internet']);
    case 'security':
      return item.category === 'security';
    case 'valve':
      return item.category === 'valve';
    default:
      return item.category === slug;
  }
}

function getCategoryRequestLimit(slug) {
  return Number(process.env.CATEGORY_SNAPSHOT_LIMIT || 24);
}

function toHoursOld(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 9999;
  return Math.max(1, (Date.now() - date.getTime()) / (1000 * 60 * 60));
}

function scoreItem(item, duplicateGroupSize = 1) {
  const text = normalizeTextForCompare(`${item.title || ''} ${item.summary || ''} ${(item.tags || []).join(' ')}`);
  const hoursOld = toHoursOld(item.publishedAt);
  const domain = extractDomain(item.url || item.sourceUrl || '');
  const sourceWeight = DOMAIN_WEIGHTS[domain] || 6;
  const sourceQualityScore = getSourceQualityScore(item);
  const translationScore = Number.isFinite(item.translationScore) ? item.translationScore : scoreTranslationQuality(item);

  let score = 0;
  score += Math.max(0, 38 - hoursOld * 1.05);
  score += sourceWeight;
  score += Math.round(sourceQualityScore / 8);
  score += Math.min((item.summary || '').length / 32, 9);
  score += Math.max(-10, Math.round((translationScore - 70) / 4));
  if (item.pinned) score += 28;
  if (item.isOfficial) score += 10;
  if (item.image) score += 8;
  if (containsAny(text, HIGHLIGHT_TERMS)) score += 16;
  if (containsAny(text, AI_TERMS)) score += 12;
  if (containsAny(text, STRONG_ENTITY_TERMS)) score += 8;
  if (containsAny(text, ['review', 'benchmark', 'hands on', 'launch date', 'release date'])) score += 9;
  if (containsAny(text, ['podcast', 'newsletter', 'episode'])) score -= 10;
  if ((item.title || '').length < 26) score -= 4;
  if (duplicateGroupSize > 1) score -= (duplicateGroupSize - 1) * 10;
  return Math.round(Math.max(0, Math.min(100, score)));
}

function dedupeItems(items = []) {
  const groups = [];
  const kept = [];
  const metrics = {
    duplicateGroups: 0,
    duplicatesRemoved: 0
  };

  const sorted = [...items].sort(compareByDateDesc);

  for (const rawItem of sorted) {
    const item = { ...rawItem };
    const urlKey = String(item.url || '').trim().toLowerCase().replace(/\?.*$/, '');
    const family = sourceFamily(item.sourceSlug, item.category);
    const fingerprint = titleFingerprint(item.title || '');
    const imageKey = normalizeImageKey(item.image || item.imageFallback || '');
    let targetGroup = null;

    if (urlKey) {
      targetGroup = groups.find((group) => group.urls.has(urlKey));
    }

    if (!targetGroup) {
      targetGroup = groups.find((group) => {
        if (group.family === family && fingerprint && group.fingerprints.has(fingerprint)) return true;
        const basicSimilarity = similarity(item.title || '', group.mainTitle || '');
        const semanticScore = semanticSimilarity(item.title || '', group.mainTitle || '');
        const sharedEntity = tokenizeSemantic(item.title || '').some((token) => (group.semanticTokens || new Set()).has(token));
        if (group.family === family && basicSimilarity >= 0.78) return true;
        return sharedEntity && semanticScore >= 0.86;
      });
    }

    if (!targetGroup && imageKey) {
      targetGroup = groups.find((group) => group.family === family && group.images.has(imageKey));
    }

    if (!targetGroup) {
      const group = {
        family,
        mainTitle: item.title || '',
        mainId: item.id,
        urls: new Set(urlKey ? [urlKey] : []),
        fingerprints: new Set(fingerprint ? [fingerprint] : []),
        images: new Set(imageKey ? [imageKey] : []),
        semanticTokens: new Set(tokenizeSemantic(item.title || '')),
        items: [item]
      };
      groups.push(group);
      continue;
    }

    targetGroup.items.push(item);
    if (urlKey) targetGroup.urls.add(urlKey);
    if (fingerprint) targetGroup.fingerprints.add(fingerprint);
    if (imageKey) targetGroup.images.add(imageKey);
    for (const token of tokenizeSemantic(item.title || '')) targetGroup.semanticTokens.add(token);
  }

  for (const group of groups) {
    const candidates = group.items
      .map((item) => ({
        ...item,
        duplicateGroupSize: group.items.length,
        editorialScore: scoreItem(item, group.items.length)
      }))
      .sort((a, b) => {
        const diff = b.editorialScore - a.editorialScore;
        if (diff !== 0) return diff;
        return compareByDateDesc(a, b);
      });

    const canonical = {
      ...candidates[0],
      relatedItems: candidates.slice(1).map(({ id, title, url, source, publishedAt }) => ({ id, title, url, source, publishedAt })),
      isDuplicate: false
    };

    kept.push(canonical);

    if (group.items.length > 1) {
      metrics.duplicateGroups += 1;
      metrics.duplicatesRemoved += group.items.length - 1;
    }
  }

  return {
    items: kept.sort(compareByDateDesc),
    metrics
  };
}

function diversifyCollection(items = [], limit = 12, keySeed = 'collection') {
  const usedFingerprints = new Set();
  const usedDomains = new Map();
  const selected = [];

  for (const item of items) {
    const domain = extractDomain(item.url || item.sourceUrl || '') || item.sourceSlug || 'unknown';
    const allowedPerDomain = selected.length < 6 ? 2 : 3;
    if ((usedDomains.get(domain) || 0) >= allowedPerDomain) continue;

    const unique = ensureDistinctImage({
      ...item,
      imageSeed: `${keySeed}-${item.id || item.slug || item.title || selected.length}`
    }, usedFingerprints);

    selected.push(unique);
    usedDomains.set(domain, (usedDomains.get(domain) || 0) + 1);
    if (selected.length >= limit) break;
  }

  if (selected.length >= limit) return selected;

  for (const item of items) {
    if (selected.some((entry) => entry.id === item.id)) continue;
    const unique = ensureDistinctImage({
      ...item,
      imageSeed: `${keySeed}-fill-${item.id || item.slug || item.title || selected.length}`
    }, usedFingerprints);
    selected.push(unique);
    if (selected.length >= limit) break;
  }

  return selected;
}

function buildCategorySnapshot(cache, slug, limit = getCategoryRequestLimit(slug)) {
  const filtered = cache.items.filter((item) => categoryMatch(item, slug));
  const items = diversifyCollection(filtered, limit, `category-${slug}`);
  return {
    generatedAt: cache.generatedAt,
    items,
    meta: {
      category: slug,
      categoryLabel: CATEGORY_LABELS[slug] || slug,
      totalItems: items.length,
      status: cache.meta?.status || 'ok'
    }
  };
}


function buildMonthSnapshot(cache, limit = Number(process.env.MONTH_SNAPSHOT_LIMIT || 36), days = 30) {
  const now = Date.now();
  const cutoff = now - (days * 24 * 60 * 60 * 1000);
  const filtered = cache.items.filter((item) => {
    const published = new Date(item.publishedAt || item.updatedAt || item.generatedAt || 0).getTime();
    return Number.isFinite(published) && published >= cutoff;
  });

  const ranked = [...filtered].sort((a, b) => {
    const scoreDiff = (b.editorialScore || b.relevanceScore || 0) - (a.editorialScore || a.relevanceScore || 0);
    if (scoreDiff !== 0) return scoreDiff;
    return compareByDateDesc(a, b);
  });

  const items = diversifyCollection(ranked, limit, 'month');
  const hero = selectHero(items) || items[0] || null;
  const highlights = items.filter((item) => item.id !== hero?.id).slice(0, 4);

  return {
    generatedAt: cache.generatedAt,
    hero,
    highlights,
    items,
    meta: {
      category: 'mes',
      categoryLabel: 'Mês',
      windowDays: days,
      totalItems: items.length,
      status: cache.meta?.status || 'ok',
      description: 'Agregamento das melhores notícias dos últimos 30 dias em tecnologia, jogos, hardware, IA e segurança.'
    }
  };
}


function buildLatestSnapshot(cache, limit = Number(process.env.LATEST_SNAPSHOT_LIMIT || 36)) {
  const items = diversifyCollection(cache.items, limit, 'latest');
  return {
    generatedAt: cache.generatedAt,
    items,
    meta: {
      category: 'latest',
      categoryLabel: CATEGORY_LABELS.latest,
      totalItems: items.length,
      status: cache.meta?.status || 'ok'
    }
  };
}

function selectHero(items = []) {
  const candidates = [...items]
    .filter((item) => item.image && (item.title || '').length >= 30 && !item.isDuplicate)
    .sort((a, b) => (b.editorialScore || 0) - (a.editorialScore || 0));

  return candidates[0] || items[0] || null;
}

function buildHomePayload(cache) {
  const ranked = [...cache.items].sort((a, b) => {
    const diff = (b.editorialScore || 0) - (a.editorialScore || 0);
    if (diff !== 0) return diff;
    return compareByDateDesc(a, b);
  });

  const hero = selectHero(ranked);
  const remaining = ranked.filter((item) => item.id !== hero?.id);

  const highlights = diversifyCollection(remaining, 4, 'home-highlights');
  const usedIds = new Set([hero?.id, ...highlights.map((item) => item.id)].filter(Boolean));
  const latest = diversifyCollection(remaining.filter((item) => !usedIds.has(item.id)), 24, 'home-latest');

  const categoryCacheBase = {
    generatedAt: cache.generatedAt,
    items: ranked,
    meta: cache.meta
  };

  return {
    generatedAt: cache.generatedAt,
    hero,
    highlights,
    latest,
    categories: {
      games: buildCategorySnapshot(categoryCacheBase, 'games', 12).items,
      ai: buildCategorySnapshot(categoryCacheBase, 'ai', 12).items,
      hardware: buildCategorySnapshot(categoryCacheBase, 'hardware', 12).items,
      technology: buildCategorySnapshot(categoryCacheBase, 'technology', 12).items,
      security: buildCategorySnapshot(categoryCacheBase, 'security', 12).items
    },
    meta: cache.meta
  };
}

function buildFeaturedPayload(cache) {
  const groups = HOMEPAGE_BUCKETS.map((bucket) => {
    const items = bucket.mode === 'latest'
      ? diversifyCollection(cache.items, bucket.limit, `featured-${bucket.slug}`)
      : diversifyCollection(cache.items.filter((item) => categoryMatch(item, bucket.slug)), bucket.limit, `featured-${bucket.slug}`);

    return {
      slug: bucket.slug,
      title: bucket.title,
      items
    };
  });

  return {
    generatedAt: cache.generatedAt,
    groups,
    meta: cache.meta
  };
}

async function hydrateMissingImages(items = []) {
  const limit = Number(process.env.IMAGE_ENRICH_LIMIT || 10);
  let enrichedCount = 0;

  return Promise.all(
    items.map(async (item) => {
      if (item.image || enrichedCount >= limit) return item;
      enrichedCount += 1;
      const image = await resolveImageForItem(item);
      return { ...item, image };
    })
  );
}

function withSeedFallback(fetchedItems = []) {
  return [...fetchedItems, ...CURATED_SEED_ITEMS].sort(compareByDateDesc);
}

async function enrichItem(item, translationSession) {
  const rawText = `${item.title || ''} ${item.summary || ''}`;
  const detectedLanguage = detectLanguage(rawText, item.language || 'unknown');
  if (shouldDiscardLanguage(detectedLanguage, rawText)) return null;

  const translated = await translationSession.translateItemToPtBr({ ...item, language: detectedLanguage });
  if (!translated) return null;

  const editorialVersion = buildEditorialVersion(translated);
  const translationScore = Number.isFinite(translated.translationScore) ? translated.translationScore : scoreTranslationQuality({ ...translated, title: editorialVersion.title, summary: editorialVersion.summary });
  if (translationScore < 45 || editorialVersion.weakContent) return null;

  const sourceQualityScore = getSourceQualityScore(translated);
  const editorialBase = { ...translated, ...editorialVersion, translationScore, sourceQualityScore };
  const editorialScore = scoreItem(editorialBase, item.duplicateGroupSize || 1);
  const stickyDays = item.pinned || editorialScore >= 82 ? 15 : editorialScore >= 64 ? 10 : editorialScore >= 48 ? 7 : 3;
  const publishedAt = new Date(translated.publishedAt || Date.now());
  const stickyUntil = new Date(publishedAt.getTime() + stickyDays * 24 * 60 * 60 * 1000).toISOString();
  const priority = item.pinned || editorialScore >= 82 ? 'hero' : editorialScore >= 64 ? 'highlight' : editorialScore >= 48 ? 'watch' : 'latest';

  return {
    ...translated,
    ...editorialVersion,
    categoryLabel: CATEGORY_LABELS[translated.category] || translated.category,
    image: translated.image || getFallbackImage(translated.category, translated.id || translated.slug || translated.title || 'fallback-enrich'),
    imageFallback: getFallbackImage(translated.category, translated.id || translated.slug || translated.title || 'fallback-enrich'),
    editorialScore,
    relevanceScore: editorialScore,
    translationScore,
    sourceQualityScore,
    qualityScore: Number.isFinite(editorialVersion.qualityScore) ? editorialVersion.qualityScore : scoreNewsQuality(editorialVersion),
    stickyDays,
    stickyUntil,
    priority
  };
}

async function fetchSource(source) {
  try {
    const feed = await parser.parseURL(source.url);
    const normalized = (feed.items || []).map((item) => normalizeFeedItem(item, source)).filter(Boolean);
    const items = await hydrateMissingImages(normalized);
    return { source: source.slug, status: 'ok', count: items.length, items };
  } catch (error) {
    return { source: source.slug, status: 'error', error: error.message, count: 0, items: [] };
  }
}

function buildSnapshots(baseCache) {
  const latest = buildLatestSnapshot(baseCache);
  const categories = {
    latest,
    technology: buildCategorySnapshot(baseCache, 'technology'),
    games: buildCategorySnapshot(baseCache, 'games'),
    hardware: buildCategorySnapshot(baseCache, 'hardware'),
    ai: buildCategorySnapshot(baseCache, 'ai'),
    security: buildCategorySnapshot(baseCache, 'security'),
    valve: buildCategorySnapshot(baseCache, 'valve'),
    sony: buildCategorySnapshot(baseCache, 'sony'),
    microsoft: buildCategorySnapshot(baseCache, 'microsoft'),
    nintendo: buildCategorySnapshot(baseCache, 'nintendo')
  };

  return {
    latest,
    featured: buildFeaturedPayload(baseCache),
    home: buildHomePayload(baseCache),
    categories,
    month: buildMonthSnapshot(baseCache)
  };
}

export function getRefreshStatus() {
  return {
    isRefreshing,
    lastRefreshStartedAt,
    lastRefreshFinishedAt,
    lastRefreshError
  };
}

async function buildFallbackCache() {
  const translationSession = await createTranslationSession();
  const enriched = (await Promise.all([...CURATED_SEED_ITEMS].sort(compareByDateDesc).map((item) => enrichItem(item, translationSession)))).filter(Boolean);
  await translationSession.persist();

  const deduped = dedupeItems(enriched);

  const baseCache = {
    generatedAt: new Date().toISOString(),
    items: diversifyCollection(deduped.items.sort((a, b) => (b.editorialScore || 0) - (a.editorialScore || 0)), deduped.items.length || CURATED_SEED_ITEMS.length, 'base-fallback'),
    meta: {
      status: 'seed-fallback',
      totalItems: deduped.items.length,
      liveItems: 0,
      seedItems: CURATED_SEED_ITEMS.length,
      duplicateGroups: deduped.metrics.duplicateGroups,
      duplicatesRemoved: deduped.metrics.duplicatesRemoved,
      translation: translationSession.stats,
      sources: []
    }
  };

  return {
    ...baseCache,
    snapshots: buildSnapshots(baseCache)
  };
}

export async function refreshAllFeeds(options = {}) {
  if (isRefreshing && !options.force) {
    const cache = await getCache();
    return {
      ...cache,
      meta: {
        ...(cache.meta || {}),
        refreshSkipped: true,
        reason: 'refresh-already-running'
      }
    };
  }

  isRefreshing = true;
  lastRefreshStartedAt = new Date().toISOString();
  lastRefreshError = null;

  try {
    const responses = await Promise.all(SOURCE_CATALOG.map(fetchSource));
    const fetchedItems = responses.flatMap((entry) => entry.items).sort(compareByDateDesc);
    const translationSession = await createTranslationSession();
    const enrichedItems = (await Promise.all(withSeedFallback(fetchedItems).map((item) => enrichItem(item, translationSession)))).filter(Boolean);
    await translationSession.persist();

    const deduped = dedupeItems(enrichedItems);
    const orderedItems = deduped.items.sort((a, b) => {
      const diff = (b.editorialScore || 0) - (a.editorialScore || 0);
      if (diff !== 0) return diff;
      return compareByDateDesc(a, b);
    });

    const baseCache = {
      generatedAt: new Date().toISOString(),
      items: diversifyCollection(orderedItems, orderedItems.length, 'base-live'),
      meta: {
        status: fetchedItems.length ? 'ok' : 'seed-fallback',
        totalItems: deduped.items.length,
        liveItems: fetchedItems.length,
        seedItems: CURATED_SEED_ITEMS.length,
        duplicateGroups: deduped.metrics.duplicateGroups,
        duplicatesRemoved: deduped.metrics.duplicatesRemoved,
        refreshStartedAt: lastRefreshStartedAt,
        refreshFinishedAt: new Date().toISOString(),
        translation: translationSession.stats,
        metrics: {
          heroCandidates: orderedItems.filter((item) => item.priority === 'hero').length,
          aiItems: orderedItems.filter((item) => isAiItem(item)).length,
          itemsWithImages: orderedItems.filter((item) => item.image).length,
          avgTranslationScore: orderedItems.length ? Math.round(orderedItems.reduce((acc, item) => acc + (item.translationScore || 0), 0) / orderedItems.length) : 0,
          highQualitySources: orderedItems.filter((item) => (item.sourceQualityScore || 0) >= 90).length
        },
        sources: responses.map(({ source, status, count, error }) => ({
          source,
          status,
          count,
          error: error || null
        }))
      }
    };

    const payload = {
      ...baseCache,
      snapshots: buildSnapshots(baseCache)
    };

    await writeCache(payload);
    lastRefreshFinishedAt = payload.meta.refreshFinishedAt;
    return payload;
  } catch (error) {
    lastRefreshError = error.message;
    throw error;
  } finally {
    isRefreshing = false;
  }
}

export async function getCache() {
  const cache = await readCache();
  if (Array.isArray(cache?.items) && cache.items.length) {
    if (!cache.snapshots?.home || !cache.snapshots?.latest) {
      return {
        ...cache,
        snapshots: buildSnapshots(cache)
      };
    }
    return cache;
  }

  return buildFallbackCache();
}

export async function getLatest(limit = 12) {
  const cache = await getCache();
  const source = cache.snapshots?.latest || buildLatestSnapshot(cache);
  return {
    generatedAt: source.generatedAt,
    items: source.items.slice(0, limit),
    meta: {
      ...source.meta,
      requestedLimit: limit
    }
  };
}

export async function getByCategory(category, limit = 12) {
  const cache = await getCache();
  const source = cache.snapshots?.categories?.[category] || buildCategorySnapshot(cache, category);
  return {
    generatedAt: source.generatedAt,
    items: source.items.slice(0, limit),
    meta: {
      ...source.meta,
      requestedLimit: limit
    }
  };
}

export async function getBySource(sourceSlug, limit = 12) {
  const cache = await getCache();
  const filtered = cache.items.filter((item) => item.sourceSlug === sourceSlug);
  const items = diversifyCollection(filtered, limit, `source-${sourceSlug}`);
  return {
    generatedAt: cache.generatedAt,
    items,
    meta: {
      sourceSlug,
      totalItems: items.length,
      status: cache.meta?.status || 'ok'
    }
  };
}

export async function getFeatured() {
  const cache = await getCache();
  return cache.snapshots?.featured || buildFeaturedPayload(cache);
}

export async function getHomePayload() {
  const cache = await getCache();
  return cache.snapshots?.home || buildHomePayload(cache);
}

export async function getMonthRoundup(limit = 24, days = 30) {
  const cache = await getCache();
  const snapshot = cache.snapshots?.month || buildMonthSnapshot(cache, Math.max(limit, 24), days);
  return {
    generatedAt: snapshot.generatedAt,
    hero: snapshot.hero,
    highlights: snapshot.highlights?.slice(0, 4) || [],
    items: (snapshot.items || []).slice(0, limit),
    meta: {
      ...(snapshot.meta || {}),
      requestedLimit: limit
    }
  };
}
