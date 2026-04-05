import { detectLanguage, hasJapanese, isPortugueseLike } from './languageService.js';

export const SOURCE_QUALITY_WEIGHTS = {
  'playstation-blog': 96,
  'xbox-wire': 95,
  'xbox-wire-ptbr': 97,
  'steam-news': 92,
  'steam-blog': 88,
  'nvidia-newsroom': 91,
  'amd-news': 88,
  'intel-newsroom': 88,
  'google-blog': 90,
  'apple-newsroom': 92,
  'cisa-news': 90,
  'enisa-news': 84,
  'nintendo-news': 40
};

const BRAND_PREFIXES = [
  ['playstation', 'PlayStation'],
  ['sony', 'Sony'],
  ['xbox', 'Xbox'],
  ['microsoft', 'Microsoft'],
  ['nintendo', 'Nintendo'],
  ['steam', 'Steam'],
  ['valve', 'Valve'],
  ['nvidia', 'NVIDIA'],
  ['amd', 'AMD'],
  ['intel', 'Intel'],
  ['google', 'Google'],
  ['apple', 'Apple'],
  ['cisa', 'CISA'],
  ['enisa', 'ENISA']
];

const NOISY_TITLE_PATTERNS = [
  /^a publica[cç][aã]o\s+/i,
  /^the post\s+/i,
  /^official\s+/i,
  /^read more\s*[:-]\s*/i,
  /^veja\s+o\s+resumo\s*/i,
  /^breaking\s*[:-]\s*/i,
  /^live\s*[:-]\s*/i
];

const SUMMARY_NOISE_PATTERNS = [
  /the post appeared first on[^.?!]*/gi,
  /read more at[^.?!]*/gi,
  /continue reading[^.?!]*/gi,
  /originally published on[^.?!]*/gi,
  /this article originally appeared on[^.?!]*/gi,
  /click here to read more[^.?!]*/gi,
  /saiba mais em[^.?!]*/gi,
  /veja mais em[^.?!]*/gi,
  /all rights reserved[^.?!]*/gi,
  /subscribe to our newsletter[^.?!]*/gi,
  /sign up for our newsletter[^.?!]*/gi,
  /watch the trailer[^.?!]*/gi,
  /listen to the episode[^.?!]*/gi
];

const WEAK_SUMMARY_PATTERNS = [
  /^leia a cobertura completa/i,
  /^confira a cobertura completa/i,
  /^saiba mais/i,
  /^read more/i,
  /^the post/i,
  /^veja o resumo/i,
  /^acompanhe os detalhes/i
];

const ENGLISH_STRONG_MARKERS = [' the ', ' and ', ' with ', ' for ', ' have ', ' has ', ' this ', ' that ', ' more ', ' announced ', ' announces ', ' partnership ', ' experience ', ' available ', ' launch ', ' update '];

const CATEGORY_SUMMARY_MAP = {
  technology: 'tecnologia e produtos digitais',
  games: 'games e lançamentos',
  hardware: 'hardware e infraestrutura',
  ai: 'inteligência artificial',
  security: 'segurança digital',
  microsoft: 'ecossistema Xbox e Microsoft',
  sony: 'ecossistema PlayStation',
  nintendo: 'ecossistema Nintendo',
  valve: 'jogos para PC e Steam'
};

const G1_REWRITE_RULES = [
  [/\bavailable for xbox insiders\b/i, 'Xbox testa novos recursos para a interface'],
  [/\bcoming to xbox game pass\b/i, 'Xbox Game Pass recebe nova leva de jogos'],
  [/\bfree play days\b/i, 'Xbox libera novos jogos grátis por tempo limitado'],
  [/\bnew playstation portal software update\b/i, 'PlayStation Portal recebe atualização com novos recursos'],
  [/\bmeasuring progress toward agi\b/i, 'Google propõe nova forma de medir avanço rumo à AGI'],
  [/\bintroducing vibe design with stitch\b/i, 'Google lança Stitch para criação de interfaces com IA'],
  [/\bhow google is using ai to improve health for everyone\b/i, 'Google amplia uso de IA em saúde e monitoramento pessoal'],
  [/\bdouble fine.*kiln.*arrives april 23\b/i, 'Double Fine confirma Kiln para 23 de abril e mostra gameplay'],
  [/\bpragmata hands-on report\b/i, 'Pragmata aposta em ação e hacking em nova prévia'],
  [/\bstarfield is coming to playstation 5\b/i, 'Starfield chega ao PlayStation 5 com grande atualização gratuita'],
  [/\brtx 5090\b.*\bperformance\b/i, 'Nova RTX 5090 chega com salto gigante de desempenho'],
  [/\bsteam\b.*\brecord\b/i, 'Steam bate recorde histórico de jogadores simultâneos']
];

const TITLE_ACTION_PATTERNS = [
  [/\bannounces?\b/i, 'anuncia'],
  [/\breveals?\b/i, 'revela'],
  [/\bunveils?\b/i, 'mostra'],
  [/\blaunch(?:es|ed)?\b/i, 'lança'],
  [/\bcoming to\b/i, 'chega ao'],
  [/\bgets?\b/i, 'ganha'],
  [/\badds?\b/i, 'adiciona'],
  [/\bdetails?\b/i, 'detalha'],
  [/\bimproves?\b/i, 'melhora'],
  [/\bexpands?\b/i, 'expande'],
  [/\bdebuts?\b/i, 'estreia']
];

const HIGH_IMPACT_HINTS = [
  [/\brecord\b/i, 'bate recorde histórico'],
  [/\bperformance\b/i, 'com salto de desempenho'],
  [/\bnew features\b/i, 'com novos recursos'],
  [/\bupdate\b/i, 'em atualização importante'],
  [/\bgame pass\b/i, 'e movimenta o catálogo do Game Pass']
];

const INVALID_HEADLINE_PATTERNS = [
  /\bto celebra\b/i,
  /\b(kicks off|coming soon|available now|hands on|beta client|client beta|patch notes?)\b/i,
  /\bon apple tv\b/i,
  /\b(march|april|may|june|july|august|september|october|november|december)\b/i,
  /\.\.\./,
  /:\s.*:\s/,
  /^\w+\s?:\s.+$/,
  /\bthe new\b/i,
  /\ball new\b/i,
  /\bpartners integrate\b/i,
  /\badora ser um jogo de vídeo\b/i,
  /\bserviço de entrega totalmente confiável\b/i
];

const MONTH_TRANSLATIONS = [
  [/\bMarch\b/gi, 'março'],
  [/\bApril\b/gi, 'abril'],
  [/\bMay\b/gi, 'maio'],
  [/\bJune\b/gi, 'junho'],
  [/\bJuly\b/gi, 'julho'],
  [/\bAugust\b/gi, 'agosto'],
  [/\bSeptember\b/gi, 'setembro'],
  [/\bOctober\b/gi, 'outubro'],
  [/\bNovember\b/gi, 'novembro'],
  [/\bDecember\b/gi, 'dezembro']
];

function normalize(value = '') {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanupSentencePunctuation(value = '') {
  return String(value || '')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([.!?]){2,}/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function cleanTitle(title = '') {
  let output = String(title || '').replace(/\s+/g, ' ').trim();
  for (const pattern of NOISY_TITLE_PATTERNS) output = output.replace(pattern, '');
  output = output.replace(/\s*\|\s*.+$/g, '');
  output = output.replace(/^"|"$/g, '');
  output = output.replace(/\(\s*plus a direct look.*$/i, '').trim();
  output = output.replace(/\s{2,}/g, ' ').trim();
  return output;
}

function ensureBrandPrefix(title = '', item = {}) {
  const lower = normalize(title);
  if (BRAND_PREFIXES.some(([, label]) => lower.startsWith(normalize(label)))) return title;
  const sourceHint = normalize(`${item.sourceSlug || ''} ${item.category || ''} ${(item.tags || []).join(' ')}`);
  const brand = BRAND_PREFIXES.find(([needle]) => sourceHint.includes(needle))?.[1];
  if (!brand) return title;
  if (['CISA', 'ENISA', 'NVIDIA', 'AMD', 'Intel', 'Google', 'Apple'].includes(brand)) return `${brand}: ${title}`;
  return `${brand} ${title}`;
}

function applyTitleActionRewrites(title = '') {
  let output = title;
  for (const [pattern, replacement] of TITLE_ACTION_PATTERNS) output = output.replace(pattern, replacement);
  return output;
}

function inferTitleImpact(text = '') {
  for (const [pattern, suffix] of HIGH_IMPACT_HINTS) {
    if (pattern.test(text)) return suffix;
  }
  return '';
}

function translateKnownEnglishFragments(title = '') {
  let output = String(title || '');
  for (const [pattern, replacement] of MONTH_TRANSLATIONS) output = output.replace(pattern, replacement);
  return output
    .replace(/\bFive\b/gi, 'Cinco')
    .replace(/\bnew\b/gi, 'novo')
    .replace(/\bseason\b/gi, 'temporada')
    .replace(/\bupdate\b/gi, 'atualização')
    .replace(/\bclient\b/gi, 'cliente')
    .replace(/\bbeta\b/gi, 'beta')
    .replace(/\blaunches?\b/gi, 'lança')
    .replace(/\bkicks off\b/gi, 'abre')
    .replace(/\bavailable now\b/gi, 'já disponível')
    .replace(/\bcoming to\b/gi, 'chega ao')
    .replace(/\bcoming soon\b/gi, 'chega em breve')
    .replace(/\bhands on report\b/gi, 'ganha prévia detalhada')
    .replace(/\bhands on\b/gi, 'ganha prévia')
    .replace(/\bpatch notes?\b/gi, 'notas da atualização')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function isInvalidHeadline(title = '') {
  const value = String(title || '').trim();
  if (!value) return true;
  if (value.length < 22) return true;
  if (containsEnglishStrong(value) && !isPortugueseLike(value)) return true;
  return INVALID_HEADLINE_PATTERNS.some((pattern) => pattern.test(value));
}

function buildSafeHeadlineByBrand(item = {}) {
  const source = `${item.title || ''} ${item.summary || ''} ${item.sourceSlug || ''} ${item.category || ''}`.toLowerCase();

  if (/steam|valve/.test(source)) {
    if (/deck/.test(source)) return 'Steam Deck recebe atualização e amplia recursos para jogadores';
    if (/sale|promo|festival|event/.test(source)) return 'Steam destaca nova agenda de promoções e eventos para PC';
    return 'Steam traz novidade e movimenta a comunidade de PC';
  }
  if (/xbox|microsoft/.test(source)) {
    if (/game pass/.test(source)) return 'Xbox Game Pass recebe novidades e amplia catálogo para assinantes';
    if (/free play days/.test(source)) return 'Xbox libera novos jogos grátis por tempo limitado';
    return 'Xbox anuncia novidade e amplia agenda para jogadores';
  }
  if (/playstation|sony|ps5|ps vr2/.test(source)) {
    if (/plus/.test(source)) return 'PlayStation Plus recebe nova leva de jogos e reforça catálogo do mês';
    if (/portal/.test(source)) return 'PlayStation Portal ganha atualização com novos recursos';
    return 'PlayStation destaca novidade e movimenta fãs do PS5';
  }
  if (/nvidia|geforce|rtx/.test(source)) {
    if (/rtx 5090/.test(source)) return 'Nova RTX 5090 chega com salto gigante de desempenho';
    if (/geforce now/.test(source)) return 'GeForce NOW amplia catálogo e reforça aposta em jogos na nuvem';
    return 'NVIDIA apresenta novidade e reforça foco em desempenho';
  }
  if (/apple|iphone|ipad|macbook|mac|apple tv|arcade/.test(source)) {
    if (/iphone 17e/.test(source)) return 'Apple apresenta o iPhone 17e com foco em valor e mais armazenamento';
    if (/macbook air/.test(source)) return 'Apple lança novo MacBook Air e reforça foco em desempenho e IA';
    return 'Apple anuncia novidade e amplia aposta em seu ecossistema';
  }
  if (/google|android|pixel|gemini/.test(source)) {
    if (/pixel/.test(source)) return 'Google libera novidades para linha Pixel com foco em IA e personalização';
    return 'Google revela novidade com foco em IA e experiência do usuário';
  }
  if (/nintendo|switch/.test(source)) return 'Nintendo destaca novidade e reforça calendário do Switch';
  if (/cisa|enisa|security|cyber/.test(source)) return 'Órgão de segurança publica alerta e reforça atenção para falha crítica';
  if (/ai|artificial intelligence|ia/.test(source)) return 'Nova solução de IA ganha destaque e acelera disputa no setor';
  return '';
}

function finalizeHeadline(title = '', item = {}) {
  let output = cleanTitle(title || '');
  output = translateKnownEnglishFragments(output)
    .replace(/\s*[:|-]\s*/g, ': ')
    .replace(/\b(official|blog|newsroom)\b/gi, '')
    .replace(/\bto celebrate\b/gi, 'celebra')
    .replace(/\bof thinking different\b/gi, 'de sua trajetória de inovação')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (isInvalidHeadline(output)) {
    const safe = buildSafeHeadlineByBrand(item);
    if (safe) output = safe;
  }

  output = ensureBrandPrefix(output, item)
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (output.length > 98) output = `${output.slice(0, 95).trim()}...`;
  return output;
}

export function cleanEditorialText(text = '') {
  let output = String(text || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/\([^)]*(newsletter|podcast|read more|saiba mais)[^)]*\)/gi, ' ');

  for (const pattern of SUMMARY_NOISE_PATTERNS) output = output.replace(pattern, ' ');

  output = output
    .replace(/\s+[-–—]\s+/g, ' — ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const sentences = output
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => cleanupSentencePunctuation(sentence))
    .filter(Boolean)
    .filter((sentence) => !/^(read more|saiba mais|continue reading|the post)/i.test(sentence));

  return cleanupSentencePunctuation(sentences.join(' '));
}

export function tokenizeSemantic(value = '') {
  return normalize(value)
    .split(' ')
    .filter((token) => token.length > 2 && !['the', 'and', 'for', 'with', 'uma', 'para', 'com', 'que', 'dos', 'das', 'noticias', 'noticia', 'news', 'official', 'oficial', 'update', 'atualizacao', 'lancamento', 'release'].includes(token));
}

export function semanticSimilarity(a = '', b = '') {
  const tokensA = new Set(tokenizeSemantic(a));
  const tokensB = new Set(tokenizeSemantic(b));
  if (!tokensA.size || !tokensB.size) return 0;
  let intersection = 0;
  for (const token of tokensA) if (tokensB.has(token)) intersection += 1;
  const coverage = intersection / Math.max(tokensA.size, tokensB.size);
  const exactStarts = normalize(a).slice(0, 42) === normalize(b).slice(0, 42) ? 0.12 : 0;
  return Math.min(1, coverage + exactStarts);
}

export function getSourceQualityScore(item = {}) {
  return SOURCE_QUALITY_WEIGHTS[item.sourceSlug] || 70;
}

export function containsEnglishStrong(text = '') {
  const normalized = ` ${normalize(text)} `;
  if (!normalized.trim()) return false;
  let score = 0;
  for (const marker of ENGLISH_STRONG_MARKERS) {
    if (normalized.includes(marker)) score += 1;
  }
  if (/\b(health|digital|experience|people|europe|partnership|available|launch|update|official)\b/i.test(text)) score += 1;
  return score >= 2;
}

export function scoreTranslationQuality(item = {}) {
  const title = String(item.title || '');
  const summary = String(item.summary || '');
  const combined = `${title} ${summary}`;
  let score = 100;

  if (!title || title.length < 16) score -= 20;
  if (hasJapanese(combined)) score -= 80;
  if (!isPortugueseLike(title)) score -= 32;
  if (/\b(the|and|with|for|launches|hands on|available now|official)\b/i.test(title)) score -= 18;
  if (/\b(uma tradução|leia a cobertura completa em)\b/i.test(summary)) score -= 8;
  if (containsEnglishStrong(summary)) score -= 24;
  if ((item.translationProvider || '').includes('heuristic')) score -= 8;
  if ((item.translationProvider || '') === 'none' && detectLanguage(combined, 'unknown') !== 'pt') score -= 28;
  if (/^[a-z0-9\s\-:'",.&()]+$/i.test(title) && !/[çáéíóúãõâêô]/i.test(title)) score -= 10;
  if (/\b(jogo de video|dicas especializadas|primeiro olhar|evento direto)\b/i.test(title)) score -= 10;
  if (isInvalidHeadline(title)) score -= 20;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function scoreNewsQuality(item = {}) {
  const title = cleanTitle(item.title || '');
  const summary = cleanEditorialText(item.summary || '');
  let score = 100;

  if (title.length < 28) score -= 12;
  if (title.length > 110) score -= 8;
  if (summary.length < 120) score -= 18;
  if (summary.length > 320) score -= 6;
  if (WEAK_SUMMARY_PATTERNS.some((pattern) => pattern.test(summary))) score -= 26;
  if (containsEnglishStrong(`${title} ${summary}`)) score -= 14;
  if (!isPortugueseLike(title)) score -= 12;
  if (/\b(clique|assine|newsletter|podcast|epis[oó]dio)\b/i.test(summary)) score -= 12;
  if (/\b(the post appeared first|read more|continue reading)\b/i.test(summary)) score -= 35;
  if (/[:|-]$/.test(title)) score -= 8;
  if (isInvalidHeadline(title)) score -= 28;
  if (/[A-Z][a-z]+\s+to\s+celebra/i.test(title)) score -= 25;
  if (/\b(march|april|may|june|july|august|september|october|november|december)\b/i.test(title)) score -= 18;
  if (/:\s.*:\s/.test(title)) score -= 15;
  if (/\.\.\./.test(title)) score -= 12;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function isWeakContent(item = {}) {
  const title = cleanTitle(item.title || '');
  const summary = cleanEditorialText(item.summary || '');
  const combined = `${title} ${summary}`.trim();
  if (!title || title.length < 18) return true;
  if (!summary || summary.length < 80) return true;
  if (WEAK_SUMMARY_PATTERNS.some((pattern) => pattern.test(summary))) return true;
  if (containsEnglishStrong(combined) && !isPortugueseLike(summary)) return true;
  if (/^(sem título|untitled)$/i.test(title)) return true;
  if (/^(leia|saiba|confira)\b/i.test(summary) && summary.length < 120) return true;
  if (isInvalidHeadline(title)) return true;
  return false;
}

export function rewriteHeadlineG1(item = {}) {
  let title = cleanTitle(item.title || '');
  const originalNormalized = normalize(title);

  for (const [pattern, replacement] of G1_REWRITE_RULES) {
    if (pattern.test(originalNormalized)) {
      title = replacement;
      break;
    }
  }

  title = applyTitleActionRewrites(title)
    .replace(/\bhands on report\b/i, 'ganha prévia detalhada')
    .replace(/\bhands on\b/i, 'ganha prévia')
    .replace(/\bnew pc & ps5 features detailed\b/i, 'detalha novidades no PC e PS5')
    .replace(/\blaunches march\b/i, 'chega em março')
    .replace(/\blaunches april\b/i, 'chega em abril')
    .replace(/\bavailable now\b/i, 'já está disponível')
    .replace(/\bupdate released\b/i, 'recebe atualização')
    .replace(/\bcoming to\b/i, 'chega a')
    .replace(/\bnew features\b/i, 'novos recursos')
    .replace(/\bworld baseball classic\b/i, 'World Baseball Classic')
    .replace(/\bhigh quality mode\b/i, 'modo de alta qualidade')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const impact = inferTitleImpact(`${item.title || ''} ${item.summary || ''}`);
  if (impact && !normalize(title).includes(normalize(impact)) && !isInvalidHeadline(title)) {
    if (/\b(NVIDIA|AMD|Intel|Steam|Google|Apple|Xbox|PlayStation|Nintendo|Sony|Microsoft|Valve|RTX|GeForce NOW|Game Pass)\b/i.test(title)) {
      title = `${title} ${impact}`;
    }
  }

  return finalizeHeadline(title, item);
}

export function rewriteSummaryToPTBR(item = {}) {
  const source = String(item.source || 'Fonte oficial').trim();
  const category = String(item.category || '').trim().toLowerCase();
  let title = cleanTitle(item.title || '');
  title = title.replace(/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9& ._-]+:\s*/u, '').trim();
  title = title.replace(/^[A-Z][a-z]+\s+/u, (match) => match.length > 14 ? '' : match);
  const lowerTitle = title ? title.charAt(0).toLowerCase() + title.slice(1) : 'novos detalhes';
  const theme = CATEGORY_SUMMARY_MAP[category] || 'tecnologia';
  const impact = inferTitleImpact(`${item.title || ''} ${item.summary || ''}`);

  let summary = `${source} destaca ${lowerTitle} em atualização com foco em ${theme}.`;
  if (impact) summary = `${summary.slice(0, -1)} ${impact}.`;
  return cleanupSentencePunctuation(summary);
}

export function buildEditorialVersion(item = {}) {
  const cleanedSummary = cleanEditorialText(item.summary || '');
  const title = rewriteHeadlineG1({ ...item, summary: cleanedSummary || item.summary || '' });
  const summary = isWeakContent({ ...item, title, summary: cleanedSummary })
    ? rewriteSummaryToPTBR({ ...item, title, summary: cleanedSummary })
    : cleanedSummary;
  const qualityScore = scoreNewsQuality({ ...item, title, summary });
  const weakContent = qualityScore < 60 || isWeakContent({ ...item, title, summary });

  return {
    ...item,
    title,
    summary,
    qualityScore,
    weakContent
  };
}
