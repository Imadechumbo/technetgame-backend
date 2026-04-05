const PT_MARKERS = [' para ', ' com ', ' uma ', ' seu ', ' sua ', ' e ', ' em ', ' do ', ' da ', ' de ', ' que ', ' como ', ' mais ', ' jogos ', ' tecnologia ', ' segurança ', ' seguranca ', ' lançamento ', ' anuncia ', ' confirma ', ' chega ', ' ganha ', ' traz '];
const EN_MARKERS = [' the ', ' and ', ' with ', ' for ', ' update ', ' launches ', ' launch ', ' reveals ', ' game ', ' games ', ' official ', ' available '];
const ES_MARKERS = [' para ', ' con ', ' una ', ' el ', ' la ', ' de ', ' y ', ' lanzamiento ', ' llega ', ' nuevo ', ' juegos '];

function clean(text = '') {
  return ` ${String(text || '').toLowerCase().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()} `;
}

export function hasJapanese(text = '') {
  return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(String(text || ''));
}

export function hasCyrillic(text = '') {
  return /[\u0400-\u04FF]/.test(String(text || ''));
}

export function detectLanguage(text = '', fallback = 'unknown') {
  const value = clean(text);
  if (!value.trim()) return fallback;
  if (hasJapanese(value)) return 'ja';
  if (hasCyrillic(value)) return 'ru';

  const ptScore = PT_MARKERS.reduce((acc, marker) => acc + (value.includes(marker) ? 1 : 0), /[ãõçáéíóúâêô]/i.test(value) ? 2 : 0);
  const enScore = EN_MARKERS.reduce((acc, marker) => acc + (value.includes(marker) ? 1 : 0), 0);
  const esScore = ES_MARKERS.reduce((acc, marker) => acc + (value.includes(marker) ? 1 : 0), /[ñ¿¡]/i.test(value) ? 2 : 0);

  if (ptScore >= enScore && ptScore >= esScore && ptScore >= 1) return 'pt';
  if (enScore > ptScore && enScore >= esScore && enScore >= 1) return 'en';
  if (esScore > ptScore && esScore > enScore && esScore >= 1) return 'es';

  if (/^[\x00-\x7F\s\d\W]+$/.test(value)) return 'en';
  return fallback;
}

export function shouldDiscardLanguage(lang = '', text = '') {
  const normalized = String(lang || '').toLowerCase();
  if (normalized.startsWith('ja') || normalized === 'jp' || hasJapanese(text)) return true;
  if (normalized.startsWith('ru') || hasCyrillic(text)) return true;
  return false;
}

export function shouldTranslateLanguage(lang = '') {
  const normalized = String(lang || '').toLowerCase();
  return normalized.startsWith('en') || normalized.startsWith('es');
}

export function isPortugueseLike(text = '') {
  return detectLanguage(text, 'unknown') === 'pt';
}
