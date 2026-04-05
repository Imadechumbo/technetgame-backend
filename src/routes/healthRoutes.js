import { Router } from 'express';
import { getCache, getRefreshStatus } from '../services/feedService.js';
import { getCachePaths } from '../services/cacheService.js';

const router = Router();

/**
 * ✅ ROTA FINAL: /api/health
 * (porque app.js usa: app.use("/api/health", healthRoutes))
 */
router.get('/', async (req, res, next) => {
  try {
    const cache = await getCache();
    const items = Array.isArray(cache?.items) ? cache.items : [];
    const categories = cache?.snapshots?.categories || {};
    const translation = cache?.meta?.translation || {};
    const generatedAt = cache?.generatedAt || null;

    res.json({
      ok: true,
      status: 'ok',
      service: 'technetgame-api',
      environment: process.env.NODE_ENV || 'development',
      time: new Date().toISOString(),
      generatedAt,
      cacheAgeSec: generatedAt
        ? Math.max(0, Math.round((Date.now() - new Date(generatedAt).getTime()) / 1000))
        : null,
      totalItems: items.length,

      categories: Object.fromEntries(
        Object.entries(categories)
          .filter(([key]) => key !== 'latest')
          .map(([key, payload]) => [
            key,
            Array.isArray(payload?.items) ? payload.items.length : 0
          ])
      ),

      translation: {
        cacheHits: translation.cacheHits || 0,
        apiTranslations: translation.apiTranslations || 0,
        fallbackTranslations: translation.fallbackTranslations || 0,
        failedRecent: translation.failedApiCalls || 0,
        failureCooldownSkips: translation.failureCooldownSkips || 0,
        provider: translation.provider || 'unknown',
        avgTranslationScore: cache?.meta?.metrics?.avgTranslationScore || 0
      },

      refresh: getRefreshStatus(),

      cache: {
        status: cache?.meta?.status || 'unknown',
        duplicateGroups: cache?.meta?.duplicateGroups || 0,
        duplicatesRemoved: cache?.meta?.duplicatesRemoved || 0,
        paths: getCachePaths()
      }
    });

  } catch (error) {
    next(error);
  }
});

export default router;