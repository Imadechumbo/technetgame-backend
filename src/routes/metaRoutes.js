import { Router } from 'express';
import { CATEGORY_LABELS, SOURCE_CATALOG } from '../config/sources.js';

const router = Router();

router.get('/meta/categories', (req, res) => {
  const items = Object.entries(CATEGORY_LABELS).map(([slug, label]) => ({ slug, label }));
  res.json({ items });
});

router.get('/meta/sources', (req, res) => {
  res.json({
    items: SOURCE_CATALOG.map(source => ({
      slug: source.slug,
      name: source.name,
      category: source.category,
      url: source.url,
      siteUrl: source.siteUrl,
      tags: source.tags,
      language: source.language
    }))
  });
});

export default router;
