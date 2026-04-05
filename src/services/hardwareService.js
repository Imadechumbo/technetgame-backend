const SERPAPI_KEY = String(process.env.SERPAPI_KEY || '').trim();

function normalizeProduct(item = {}) {
  return {
    title: item.title || '',
    price: item.price || item.extracted_price || '',
    source: item.source || '',
    thumbnail: item.thumbnail || item.thumbnails?.[0] || '',
    link: item.product_link || item.link || item.serpapi_link || '#',
    rating: item.rating || '',
    reviews: item.reviews || item.reviews_count || ''
  };
}

export async function searchHardwareProducts(query = '', limit = 8) {
  const cleanQuery = String(query || '').trim();
  if (!cleanQuery || !SERPAPI_KEY) return [];

  try {
    const url = new URL('https://serpapi.com/search.json');
    url.searchParams.set('engine', 'google_shopping');
    url.searchParams.set('q', cleanQuery);
    url.searchParams.set('hl', 'pt-BR');
    url.searchParams.set('gl', 'br');
    url.searchParams.set('num', String(Math.max(1, Math.min(Number(limit) || 8, 10))));
    url.searchParams.set('api_key', SERPAPI_KEY);

    const response = await fetch(url, {
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const items = Array.isArray(data?.shopping_results) ? data.shopping_results : [];
    return items.map(normalizeProduct).filter((item) => item.title);
  } catch (error) {
    console.error('[hardwareService] erro SerpAPI:', error.message);
    return [];
  }
}
