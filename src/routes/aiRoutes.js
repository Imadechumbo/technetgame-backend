import { Router } from 'express';
import multer from 'multer';
import { createAttachmentRecords, createDemoAccess, deleteSessionById, generateAssistantAnswer, getOpenClawState, getSessionById, getUsageForToken, listModels, listSessionsForToken, requireUserFromToken, splitIntoTokenChunks } from '../services/aiService.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 10 } });
const getBearerToken = (req) => String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();

function requireAuth(req, _res, next) {
  try { req.auth = requireUserFromToken(getBearerToken(req)); next(); } catch (error) { next(error); }
}

router.get('/health', (_req, res) => res.json({ ok: true, status: 'ok', service: 'technet-ai-backend', environment: process.env.NODE_ENV || 'development', time: new Date().toISOString() }));
router.get('/models', (_req, res) => res.json({ ok: true, models: listModels() }));
router.post('/auth/demo', (_req, res) => { const { token, user } = createDemoAccess(); res.json({ ok: true, token, user, mode: 'demo-open' }); });
router.get('/auth/me', requireAuth, (req, res) => res.json({ ok: true, ...getUsageForToken(req.auth.token) }));
router.post('/uploads/attachments', requireAuth, upload.array('attachments', 10), (req, res) => { const files = Array.isArray(req.files) ? req.files : []; res.json({ ok: true, uploads: createAttachmentRecords(files) }); });
router.get('/chat/sessions', requireAuth, (req, res) => res.json({ ok: true, sessions: listSessionsForToken(req.auth.token) }));
router.get('/chat/:id', requireAuth, (req, res, next) => { try { res.json({ ok: true, ...getSessionById(req.auth.token, req.params.id) }); } catch (error) { next(error); } });
router.delete('/chat/:id', requireAuth, (req, res, next) => { try { res.json(deleteSessionById(req.auth.token, req.params.id)); } catch (error) { next(error); } });
router.post('/chat', requireAuth, async (req, res, next) => { try { res.json({ ok: true, ...(await generateAssistantAnswer({ token: req.auth.token, message: String(req.body.message || '').trim(), sessionId: req.body.sessionId, model: req.body.model, attachments: Array.isArray(req.body.attachments) ? req.body.attachments : [] })) }); } catch (error) { next(error); } });
router.post('/chat/stream', requireAuth, async (req, res, next) => {
  try {
    const data = await generateAssistantAnswer({ token: req.auth.token, message: String(req.body.message || '').trim(), sessionId: req.body.sessionId, model: req.body.model, attachments: Array.isArray(req.body.attachments) ? req.body.attachments : [] });
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    res.write(`data: ${JSON.stringify({ type: 'agent', agentSystem: data.agentSystem })}\n\n`);
    for (const tokenChunk of splitIntoTokenChunks(data.answer)) {
      res.write(`data: ${JSON.stringify({ type: 'token', token: tokenChunk })}\n\n`);
      await new Promise((resolve) => setTimeout(resolve, 18));
    }
    res.write(`data: ${JSON.stringify({ type: 'done', sessionId: data.sessionId, agentSystem: data.agentSystem })}\n\n`);
    res.end();
  } catch (error) { next(error); }
});
router.get('/system/openclaw-status', (_req, res) => res.json({ ok: true, status: 'online', ...getOpenClawState() }));
router.get('/system/openclaw-profile', (_req, res) => { const state = getOpenClawState(); res.json({ ok: true, profile: { name: 'OpenClaw Command', provider: state.provider, defaultModel: state.defaultModel, mode: 'multi-agent' } }); });
router.get('/system/openclaw-settings', (_req, res) => { const state = getOpenClawState(); res.json({ ok: true, settings: { enabled: state.enabled, provider: state.provider, defaultModel: state.defaultModel, streaming: true, uploads: true } }); });

export default router;
