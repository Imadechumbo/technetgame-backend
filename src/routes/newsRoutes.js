import { Router } from 'express';
import { getByCategory, getBySource, getFeatured, getHomePayload, getLatest, getMonthRoundup, refreshAllFeeds, getRefreshStatus } from '../services/feedService.js';
import { searchGameNews } from '../services/gameNewsService.js';

const router = Router();

function safeLimit(value, fallback = 12) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 120);
}

function getBearerToken(value = '') {
  return String(value).replace(/^Bearer\s+/i, '').trim();
}

function requireRefreshAuth(req, res, next) {
  const expectedToken = String(process.env.REFRESH_TOKEN || '').trim();
  const allowLocalWithoutToken = process.env.ALLOW_LOCAL_REFRESH_WITHOUT_TOKEN === 'true';
  const remoteAddress = req.ip || req.socket?.remoteAddress || '';
  const isLocal = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remoteAddress);

  if (!expectedToken && allowLocalWithoutToken && isLocal) {
    return next();
  }

  const candidate = getBearerToken(req.headers.authorization) || String(req.headers['x-refresh-token'] || '').trim();
  if (!expectedToken || candidate !== expectedToken) {
    return res.status(401).json({ ok: false, error: 'Unauthorized refresh request' });
  }

  return next();
}

router.get('/latest', async (req, res) => {
  const limit = safeLimit(req.query.limit, 12);
  const data = await getLatest(limit);
  res.set('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=120');
  res.json(data);
});

router.get('/featured', async (req, res) => {
  const data = await getFeatured();
  res.set('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=120');
  res.json(data);
});

router.get('/home', async (req, res) => {
  const data = await getHomePayload();
  res.set('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=60');
  res.json(data);
});


router.get('/month', async (req, res) => {
  const limit = safeLimit(req.query.limit, 24);
  const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 90);
  const data = await getMonthRoundup(limit, days);
  res.set('Cache-Control', 'public, max-age=900, s-maxage=900, stale-while-revalidate=300');
  res.json(data);
});

router.get('/status', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ ok: true, refresh: getRefreshStatus() });
});


router.get('/game-search', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const limit = safeLimit(req.query.limit, 3);
    if (!q) return res.status(400).json({ ok: false, error: 'Missing q' });
    const data = await searchGameNews(q, limit);
    res.set('Cache-Control', 'public, max-age=600, s-maxage=600, stale-while-revalidate=300');
    return res.json(data);
  } catch (error) {
    return next(error);
  }
});


router.get('/category/:slug', async (req, res) => {
  const limit = safeLimit(req.query.limit, 12);
  const data = await getByCategory(req.params.slug, limit);
  res.set('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=120');
  res.json(data);
});

router.get('/source/:slug', async (req, res) => {
  const limit = safeLimit(req.query.limit, 12);
  const data = await getBySource(req.params.slug, limit);
  res.set('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=120');
  res.json(data);
});

router.post('/refresh', requireRefreshAuth, async (req, res) => {
  const data = await refreshAllFeeds({ force: true });
  res.json({ ok: true, generatedAt: data.generatedAt, totalItems: data.meta.totalItems, sources: data.meta.sources, meta: data.meta });
});

router.post('/internal/refresh-news', requireRefreshAuth, async (req, res) => {
  const data = await refreshAllFeeds({ force: true });
  res.json({ ok: true, generatedAt: data.generatedAt, totalItems: data.meta.totalItems });
});

export default router;
