import 'dotenv/config';
import { refreshAllFeeds } from '../services/feedService.js';

const payload = await refreshAllFeeds();
console.log(JSON.stringify({ generatedAt: payload.generatedAt, totalItems: payload.meta.totalItems }, null, 2));
