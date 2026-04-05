import { Router } from 'express';
import {
  getGameImage,
  getHardwareImage,
  getCreatorAvatar,
  debugMediaProviders,
  clearMediaMemoryCache
} from '../services/mediaService.js';

const router = Router();

router.get('/game-image', async (req, res, next) => {
  try {
    const title = String(req.query.title || '').trim();
    if (!title) {
      return res.status(400).json({ ok: false, error: 'title é obrigatório' });
    }

    const image = await getGameImage(title);
    return res.json({ ok: true, title, image });
  } catch (error) {
    return next(error);
  }
});

router.get('/hardware-image', async (req, res, next) => {
  try {
    const query = String(req.query.query || req.query.q || req.query.title || '').trim();
    if (!query) {
      return res.status(400).json({ ok: false, error: 'query é obrigatório' });
    }

    const image = await getHardwareImage(query);
    return res.json({ ok: true, query, image });
  } catch (error) {
    return next(error);
  }
});

router.get('/creator-avatar', async (req, res, next) => {
  try {
    const value = String(req.query.name || req.query.channelUrl || '').trim();
    if (!value) {
      return res.status(400).json({ ok: false, error: 'name ou channelUrl é obrigatório' });
    }

    const image = await getCreatorAvatar(value);
    return res.json({ ok: true, value, image });
  } catch (error) {
    return next(error);
  }
});

router.get('/debug', async (req, res, next) => {
  try {
    const query = String(req.query.query || req.query.q || req.query.title || '').trim();
    if (!query) {
      return res.status(400).json({ ok: false, error: 'query é obrigatório' });
    }

    const providers = await debugMediaProviders(query);
    return res.json({ ok: true, ...providers });
  } catch (error) {
    return next(error);
  }
});

router.get('/debug/providers', async (req, res, next) => {
  try {
    const query = String(req.query.query || req.query.q || req.query.title || '').trim();
    if (!query) {
      return res.status(400).json({ ok: false, error: 'query é obrigatório' });
    }

    const providers = await debugMediaProviders(query);
    return res.json({ ok: true, ...providers });
  } catch (error) {
    return next(error);
  }
});

router.post('/cache/clear', (_req, res, next) => {
  try {
    const result = clearMediaMemoryCache();
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

router.post('/debug/clear-cache', (_req, res, next) => {
  try {
    const result = clearMediaMemoryCache();
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

export default router;
