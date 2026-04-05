import crypto from 'node:crypto';
import { readTranslationCache, writeTranslationCache } from './cacheService.js';
import { detectLanguage, isPortugueseLike, shouldDiscardLanguage, shouldTranslateLanguage, hasJapanese } from './languageService.js';
import { buildEditorialVersion, cleanEditorialText, scoreTranslationQuality, containsEnglishStrong, rewriteSummaryToPTBR } from './editorialService.js';

const SOURCE_NAME_MAP = {
  'Steam News': 'Notícias da Steam',
  'Steam News Collection': 'Coleção de notícias da Steam',
  'PlayStation Blog': 'Blog do PlayStation',
  'Xbox Wire': 'Xbox Wire',
  'Xbox Wire PT-BR': 'Xbox Wire PT-BR',
  'Nintendo News': 'Nintendo News',
  'NVIDIA Newsroom': 'NVIDIA Newsroom',
  'AMD News': 'AMD Notícias',
  'Intel Newsroom': 'Intel Newsroom',
  'Google Blog': 'Blog do Google',
  'Apple Newsroom': 'Apple Newsroom',
  'CISA News': 'Alertas da CISA',
  'ENISA News': 'Notícias da ENISA'
};

const TITLE_REPLACEMENTS = [
  [/^A Brief Overview of\s+/i, 'Uma visão geral de '],
  [/^An Introduction to\s+/i, 'Uma introdução a '],
  [/^Introduction to\s+/i, 'Introdução a '],
  [/^Designing\s+/i, 'Criando '],
  [/\bannounces?\b/gi, 'anuncia'],
  [/\bintroduces?\b/gi, 'apresenta'],
  [/\blaunche?s?\b/gi, 'lança'],
  [/\breveals?\b/gi, 'revela'],
  [/\bdetails?\b/gi, 'detalha'],
  [/\bexpands?\b/gi, 'amplia'],
  [/\bcelebrates?\b/gi, 'celebra'],
  [/\bconfirms?\b/gi, 'confirma'],
  [/\bhighlights?\b/gi, 'destaca'],
  [/\bshowcases?\b/gi, 'apresenta'],
  [/\bpreviews?\b/gi, 'antecipa'],
  [/\brecap\b/gi, 'resumo'],
  [/\bguide\b/gi, 'guia'],
  [/\bguides\b/gi, 'guias'],
  [/\btips and tricks\b/gi, 'dicas e truques'],
  [/\bexpert tips\b/gi, 'dicas especializadas'],
  [/\bfor\b/gi, 'para'],
  [/\bwith\b/gi, 'com'],
  [/\band\b/gi, 'e'],
  [/\bnew games\b/gi, 'novos jogos'],
  [/\bnew features\b/gi, 'novos recursos'],
  [/\bnew update\b/gi, 'nova atualização'],
  [/\bupdate\b/gi, 'atualização'],
  [/\bupdates\b/gi, 'atualizações'],
  [/\bevent\b/gi, 'evento'],
  [/\bseason\b/gi, 'temporada'],
  [/\bseasons\b/gi, 'temporadas'],
  [/\bcoming to\b/gi, 'chega a'],
  [/\bcoming\b/gi, 'chegando'],
  [/\bavailable now\b/gi, 'já disponível'],
  [/\bavailable\b/gi, 'disponível'],
  [/\bfirst look\b/gi, 'primeiro olhar'],
  [/\bdeep dive\b/gi, 'análise aprofundada'],
  [/\blaunch date\b/gi, 'data de lançamento'],
  [/\brelease date\b/gi, 'data de lançamento'],
  [/\btrailer\b/gi, 'trailer'],
  [/\bpre-order\b/gi, 'pré-venda'],
  [/\bcloud gaming\b/gi, 'jogos em nuvem'],
  [/\bsecurity\b/gi, 'segurança'],
  [/\bcybersecurity\b/gi, 'cibersegurança'],
  [/\bdata center\b/gi, 'data center'],
  [/\bhardware\b/gi, 'hardware'],
  [/\bsoftware\b/gi, 'software'],
  [/\bgames\b/gi, 'jogos'],
  [/\bgame\b/gi, 'jogo'],
  [/\bplayers\b/gi, 'jogadores'],
  [/\bplayer\b/gi, 'jogador'],
  [/\boverview\b/gi, 'visão geral'],
  [/\bintroduction\b/gi, 'introdução']
];

const SUMMARY_REPLACEMENTS = [
  [/\bpublished originally on\b/gi, 'publicado originalmente no'],
  [/\bread the full story at\b/gi, 'leia a matéria completa em'],
  [/\bread more at\b/gi, 'leia mais em'],
  [/\blearn more\b/gi, 'saiba mais'],
  [/\bthis article\b/gi, 'este artigo'],
  [/\bthis update\b/gi, 'esta atualização'],
  [/\bthis post\b/gi, 'esta publicação'],
  [/\bthe article\b/gi, 'o artigo'],
  [/\bthe post\b/gi, 'a publicação'],
  [/\bthe update\b/gi, 'a atualização'],
  [/\bofficial blog\b/gi, 'blog oficial'],
  [/\bofficial site\b/gi, 'site oficial'],
  [/\bfull details\b/gi, 'detalhes completos'],
  [/\bpatch notes\b/gi, 'notas do patch'],
  [/\bavailable now\b/gi, 'já disponível'],
  [/\bcoming soon\b/gi, 'em breve'],
  [/\bcoming to\b/gi, 'chega a'],
  [/\bnext week\b/gi, 'na próxima semana'],
  [/\btoday\b/gi, 'hoje'],
  [/\btomorrow\b/gi, 'amanhã'],
  [/\bnew features\b/gi, 'novos recursos'],
  [/\bnew feature\b/gi, 'novo recurso'],
  [/\bnew games\b/gi, 'novos jogos'],
  [/\bnew game\b/gi, 'novo jogo'],
  [/\bsecurity advisory\b/gi, 'aviso de segurança'],
  [/\bsecurity advisories\b/gi, 'avisos de segurança'],
  [/\bvulnerability\b/gi, 'vulnerabilidade'],
  [/\bvulnerabilities\b/gi, 'vulnerabilidades'],
  [/\bcommunity\b/gi, 'comunidade'],
  [/\bdevelopers\b/gi, 'desenvolvedores'],
  [/\bdeveloper\b/gi, 'desenvolvedor'],
  [/\bplayers\b/gi, 'jogadores'],
  [/\bplayer\b/gi, 'jogador'],
  [/\bevent\b/gi, 'evento'],
  [/\bupdate\b/gi, 'atualização'],
  [/\bupdates\b/gi, 'atualizações'],
  [/\bgames\b/gi, 'jogos'],
  [/\bgame\b/gi, 'jogo'],
  [/\bwith\b/gi, 'com'],
  [/\band\b/gi, 'e'],
  [/\bfor\b/gi, 'para'],
  [/\bappeared first on\b/gi, 'apareceu primeiro em'],
  [/\bcontains multiple vulnerabilities\b/gi, 'contém múltiplas vulnerabilidades'],
  [/\bcould allow an attacker to\b/gi, 'pode permitir que um invasor'],
  [/\bthe following versions are affected\b/gi, 'as seguintes versões foram afetadas'],
  [/\btechnical details\b/gi, 'detalhes técnicos'],
  [/\bview csaf summary\b/gi, 'veja o resumo CSAF'],
  [/\bview\b/gi, 'veja'],
  [/\bsummary\b/gi, 'resumo']
];

const TRANSLATION_ENABLED = String(process.env.TRANSLATION_ENABLED || 'true').toLowerCase() === 'true';
const TRANSLATION_PROVIDER = String(process.env.TRANSLATION_PROVIDER || 'libretranslate').toLowerCase();
const TRANSLATION_API_URL = String(process.env.TRANSLATION_API_URL || 'http://127.0.0.1:5000').trim();
const TRANSLATION_API_KEY = String(process.env.TRANSLATION_API_KEY || '').trim();
const TRANSLATION_TARGET = String(process.env.TRANSLATION_TARGET || 'pt').trim();
const TRANSLATION_SOURCE_MODE = String(process.env.TRANSLATION_SOURCE_MODE || 'auto').trim();
const TRANSLATION_CACHE_TTL_DAYS = Number(process.env.TRANSLATION_CACHE_TTL_DAYS || 45);
const TRANSLATION_REQUEST_TIMEOUT_MS = Number(process.env.TRANSLATION_REQUEST_TIMEOUT_MS || 12000);
const TRANSLATION_MAX_TEXT_LENGTH = Number(process.env.TRANSLATION_MAX_TEXT_LENGTH || 260);
const TRANSLATION_FAILURE_COOLDOWN_MS = Number(process.env.TRANSLATION_FAILURE_COOLDOWN_MS || 5 * 60 * 1000);

function decodeHtmlEntities(text = '') {
  return String(text)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#038;/g, '&');
}

function cleanupSpacing(text = '') {
  return String(text)
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function sanitizeText(text = '') {
  return cleanupSpacing(
    decodeHtmlEntities(String(text || ''))
      .replace(/<[^>]+>/g, ' ')
      .replace(/https?:\/\/\S+/gi, ' ')
      .replace(/\|\s*[A-Za-z0-9 .:_-]+$/g, ' ')
      .replace(/\s+/g, ' ')
  );
}

function normalizeTextBase(text = '') {
  return sanitizeText(text).toLowerCase();
}

function isTemplateSummary(text = '') {
  const value = sanitizeText(text);
  return /^the post\b/i.test(value) || /\bappeared first on\b/i.test(value);
}

function translateTemplateSummary(text = '') {
  return cleanupSpacing(
    sanitizeText(text)
      .replace(/^the post\s+/i, 'A publicação ')
      .replace(/\bappeared first on\b/gi, 'apareceu primeiro em')
      .replace(/\bread more at\b/gi, 'leia mais em')
  );
}

function applyReplacements(text = '', replacements = []) {
  let output = String(text || '');
  for (const [pattern, replacement] of replacements) {
    output = output.replace(pattern, replacement);
  }
  return cleanupSpacing(output);
}

function createCacheKey(text = '', target = TRANSLATION_TARGET) {
  return crypto.createHash('sha1').update(`${target}:${normalizeTextBase(text)}`).digest('hex');
}

function isCacheEntryFresh(entry) {
  if (!entry?.createdAt) return false;
  const createdAt = new Date(entry.createdAt).getTime();
  if (Number.isNaN(createdAt)) return false;
  const ttlMs = TRANSLATION_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
  return (Date.now() - createdAt) <= ttlMs;
}

function looksPortuguese(text = '') {
  const value = String(text || '').toLowerCase();
  if (!value) return false;
  const ptMarkers = [' para ', ' com ', ' uma ', ' seu ', ' sua ', ' e ', ' em ', ' do ', ' da ', ' de ', ' que ', ' como ', ' mais ', ' jogos ', ' tecnologia ', ' segurança ', ' seguranca '];
  return /[ãõçáéíóú]/i.test(value) || ptMarkers.some((marker) => value.includes(marker));
}

function shouldTranslate(language = '', text = '') {
  if (!TRANSLATION_ENABLED) return false;
  const value = sanitizeText(text);
  if (!value) return false;
  if (looksPortuguese(value) || isPortugueseLike(value)) return false;
  const detectedLanguage = detectLanguage(value, String(language || '').slice(0, 2) || 'unknown');
  if (shouldDiscardLanguage(detectedLanguage, value)) return false;
  if (!shouldTranslateLanguage(detectedLanguage)) return false;
  return /[a-záéíóúñç]{3,}/i.test(value);
}

function truncateText(text = '') {
  return sanitizeText(text).slice(0, TRANSLATION_MAX_TEXT_LENGTH);
}

function heuristicTranslateText(text = '', field = 'summary') {
  const replacements = field === 'title' ? TITLE_REPLACEMENTS : SUMMARY_REPLACEMENTS;
  return applyReplacements(text, replacements);
}

function normalizeTranslatedText(text = '', fallback = '') {
  const cleaned = cleanupSpacing(text);
  return cleaned || fallback;
}

function validateTranslatedText(text = '', fallback = '') {
  const cleaned = normalizeTranslatedText(text, fallback);
  if (!cleaned || cleaned.length < 14) return null;
  if (hasJapanese(cleaned)) return null;
  const language = detectLanguage(cleaned, 'unknown');
  if (shouldDiscardLanguage(language, cleaned)) return null;
  return cleaned;
}


function sanitizeSummaryToPortuguese(summary = '', item = {}) {
  const cleaned = cleanEditorialText(normalizeTranslatedText(summary, ''));
  if (!cleaned) return rewriteSummaryToPTBR(item);
  const detected = detectLanguage(cleaned, 'unknown');
  if (hasJapanese(cleaned) || shouldDiscardLanguage(detected, cleaned)) {
    return rewriteSummaryToPTBR(item);
  }
  if (containsEnglishStrong(cleaned) || detected === 'en') {
    return rewriteSummaryToPTBR(item);
  }
  return cleaned;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = TRANSLATION_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeLibreTranslateUrl(url = '') {
  const trimmed = String(url || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return /\/translate$/i.test(trimmed) ? trimmed : `${trimmed}/translate`;
}

async function translateWithLibreTranslate(text = '', sourceLanguage = 'en') {
  const url = normalizeLibreTranslateUrl(TRANSLATION_API_URL);
  if (!url) throw new Error('translation-api-url-missing');

  const body = {
    q: text,
    source: TRANSLATION_SOURCE_MODE === 'auto' ? 'auto' : (sourceLanguage || 'en').slice(0, 2),
    target: TRANSLATION_TARGET.slice(0, 2),
    format: 'text'
  };

  if (TRANSLATION_API_KEY) {
    body.api_key = TRANSLATION_API_KEY;
  }

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`translation-http-${response.status}`);
  }

  const payload = await response.json();
  const translatedText = payload?.translatedText || payload?.data?.translatedText || '';
  return normalizeTranslatedText(translatedText, text);
}

async function translateWithProvider(text = '', sourceLanguage = 'en') {
  if (TRANSLATION_PROVIDER === 'libretranslate') {
    return translateWithLibreTranslate(text, sourceLanguage);
  }

  throw new Error(`unsupported-translation-provider:${TRANSLATION_PROVIDER}`);
}

export function translateSourceName(name = '') {
  return SOURCE_NAME_MAP[name] || name;
}

export async function createTranslationSession() {
  const cache = await readTranslationCache();
  const items = { ...(cache?.items || {}) };
  let dirty = false;
  const stats = {
    cacheHits: 0,
    apiTranslations: 0,
    fallbackTranslations: 0,
    failedApiCalls: 0,
    failureCooldownSkips: 0,
    provider: TRANSLATION_API_URL ? TRANSLATION_PROVIDER : 'heuristic'
  };

  async function translateText(text = '', field = 'summary', language = 'en') {
    const originalText = truncateText(text);
    if (!shouldTranslate(language, originalText)) {
      return { text: originalText || text, provider: 'original' };
    }

    if (field === 'summary' && isTemplateSummary(originalText)) {
      const fallback = normalizeTranslatedText(translateTemplateSummary(originalText), originalText);
      stats.fallbackTranslations += 1;
      return { text: fallback, provider: 'heuristic' };
    }

    const cacheKey = createCacheKey(`${field}:${originalText}`);
    const cached = items[cacheKey];
    if (cached && isCacheEntryFresh(cached) && cached.translatedText) {
      if (cached.failedAt && cached.retryAfterMs) {
        const failedAtMs = new Date(cached.failedAt).getTime();
        if (Number.isFinite(failedAtMs) && (Date.now() - failedAtMs) < cached.retryAfterMs) {
          stats.failureCooldownSkips += 1;
          return { text: cached.translatedText, provider: cached.provider || 'cooldown' };
        }
      }
      stats.cacheHits += 1;
      return { text: cached.translatedText, provider: cached.provider || 'cache' };
    }

    const heuristic = normalizeTranslatedText(heuristicTranslateText(originalText, field), originalText);

    if (!TRANSLATION_API_URL) {
      items[cacheKey] = {
        sourceText: originalText,
        translatedText: heuristic,
        provider: 'heuristic',
        createdAt: new Date().toISOString()
      };
      dirty = true;
      stats.fallbackTranslations += 1;
      return { text: heuristic, provider: 'heuristic' };
    }

    try {
      const translatedText = await translateWithProvider(originalText, language);
      const normalized = validateTranslatedText(translatedText, originalText);
      const finalText = (!normalized || (!looksPortuguese(normalized) && looksPortuguese(heuristic))) ? heuristic : normalized;

      items[cacheKey] = {
        sourceText: originalText,
        translatedText: finalText,
        provider: finalText === heuristic ? `${TRANSLATION_PROVIDER}+heuristic` : TRANSLATION_PROVIDER,
        createdAt: new Date().toISOString()
      };
      dirty = true;
      stats.apiTranslations += 1;
      return { text: finalText, provider: items[cacheKey].provider };
    } catch {
      stats.failedApiCalls += 1;
      items[cacheKey] = {
        sourceText: originalText,
        translatedText: heuristic,
        provider: 'heuristic',
        createdAt: new Date().toISOString(),
        failedAt: new Date().toISOString(),
        retryAfterMs: TRANSLATION_FAILURE_COOLDOWN_MS
      };
      dirty = true;
      stats.fallbackTranslations += 1;
      return { text: heuristic, provider: 'heuristic' };
    }
  }

  async function translateItemToPtBr(item = {}) {
    const translatedSource = translateSourceName(item.source);
    const sourceLanguage = detectLanguage(`${item.title || ''} ${item.summary || ''}`, item.language || 'unknown');

    if (shouldDiscardLanguage(sourceLanguage, `${item.title || ''} ${item.summary || ''}`)) {
      return null;
    }

    const titleNeedsTranslation = shouldTranslate(sourceLanguage, item.title);
    const summaryNeedsTranslation = shouldTranslate(sourceLanguage, item.summary);

    const titleResult = titleNeedsTranslation
      ? await translateText(item.title, 'title', sourceLanguage || 'en')
      : { text: item.title, provider: 'original' };

    const summaryResult = summaryNeedsTranslation
      ? await translateText(item.summary, 'summary', sourceLanguage || 'en')
      : { text: item.summary, provider: 'original' };

    const translatedTitle = normalizeTranslatedText(titleResult.text || item.title, item.title);
    const translatedSummary = sanitizeSummaryToPortuguese(summaryResult.text || item.summary, {
      ...item,
      title: translatedTitle,
      source: translatedSource
    });

    const translatedItem = {
      ...item,
      title: translatedTitle,
      summary: translatedSummary,
      source: translatedSource,
      language: 'pt-br',
      originalLanguage: sourceLanguage,
      locale: 'pt-BR',
      translationProvider: titleResult.provider === 'original' && summaryResult.provider === 'original'
        ? 'none'
        : titleResult.provider === summaryResult.provider
          ? titleResult.provider
          : `${titleResult.provider}+${summaryResult.provider}`
    };

    const editorialVersion = buildEditorialVersion(translatedItem);
    translatedItem.title = editorialVersion.title;
    translatedItem.summary = editorialVersion.summary;
    translatedItem.qualityScore = editorialVersion.qualityScore;
    translatedItem.weakContent = editorialVersion.weakContent;
    translatedItem.translationScore = scoreTranslationQuality(translatedItem);
    if (translatedItem.translationScore < 45 || translatedItem.weakContent) return null;
    return translatedItem;
  }

  async function persist() {
    if (!dirty) return cache;
    return writeTranslationCache({
      generatedAt: new Date().toISOString(),
      items,
      meta: stats
    });
  }

  return {
    translateItemToPtBr,
    persist,
    stats
  };
}
