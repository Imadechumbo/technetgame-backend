import { Router } from 'express';
import { searchHardwareProducts } from '../services/hardwareService.js';

const router = Router();

router.get('/products', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 8, 10));

    if (!q) {
      return res.status(400).json({ ok: false, error: 'Parametro q obrigatorio.' });
    }

    const items = await searchHardwareProducts(q, limit);
    return res.json({ ok: true, q, total: items.length, items });
  } catch (error) {
    return next(error);
  }
});

export default router;
