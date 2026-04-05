import { slugify } from '../utils/slug.js';
import { toIsoDate } from '../utils/date.js';

function stripHtml(value = '') {
  return String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function extractImageFromHtml(html = '') {
  const match = String(html).match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1] || null;
}

function extractImage(item) {
  return firstNonEmpty(
    item.enclosure?.url,
    item.image?.url,
    item.image,
    item['media:content']?.$?.url,
    item['media:content']?.url,
    Array.isArray(item['media:content']) ? item['media:content']?.[0]?.$?.url : null,
    Array.isArray(item['media:content']) ? item['media:content']?.[0]?.url : null,
    item['media:thumbnail']?.$?.url,
    item['media:thumbnail']?.url,
    Array.isArray(item['media:thumbnail']) ? item['media:thumbnail']?.[0]?.$?.url : null,
    Array.isArray(item['media:thumbnail']) ? item['media:thumbnail']?.[0]?.url : null,
    item['itunes:image']?.$?.href,
    extractImageFromHtml(item.content),
    extractImageFromHtml(item['content:encoded']),
    extractImageFromHtml(item.summary),
    extractImageFromHtml(item.description)
  );
}

export function normalizeFeedItem(item, source) {
  const title = stripHtml(item.title || 'Sem título');
  const summary = stripHtml(
    item.contentSnippet ||
    item.content ||
    item.summary ||
    item.description ||
    item['content:encoded'] ||
    ''
  ).slice(0, 280);

  const url = item.link || item.guid || source.siteUrl;
  const publishedAt = toIsoDate(item.isoDate || item.pubDate || item.date);
  const idBase = `${source.slug}-${title}-${publishedAt}`;

  return {
    id: slugify(idBase),
    title,
    slug: slugify(title),
    url,
    summary: summary || `Leia a cobertura completa em ${source.name}.`,
    source: source.name,
    sourceSlug: source.slug,
    sourceUrl: source.siteUrl,
    category: source.category,
    tags: source.tags || [],
    language: source.language || 'en',
    publishedAt,
    image: extractImage(item),
    isOfficial: Boolean(source.tags?.includes('official'))
  };
}
