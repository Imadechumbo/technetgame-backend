import crypto from 'crypto';

const demoUsers = new Map();
const sessions = new Map();
const sessionIndexByToken = new Map();
const attachmentStore = new Map();

const GROQ_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.groq.com/openai/v1';
const GROQ_API_KEY = process.env.OPENAI_API_KEY || '';
const GROQ_MODEL = process.env.OPENAI_MODEL || process.env.DEFAULT_CHAT_MODEL || 'llama-3.3-70b-versatile';

const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free';

const SITE_URL = process.env.SITE_URL || 'https://technetgame.com.br';
const SITE_NAME = process.env.SITE_NAME || 'TechNetGame';

const DEFAULT_MODELS = [
  { name: GROQ_MODEL, provider: 'groq' },
  { name: OPENROUTER_MODEL, provider: 'openrouter' },
  { name: 'technet-auto', provider: 'auto' }
];

function nowIso() {
  return new Date().toISOString();
}

function newId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

export function listModels() {
  return DEFAULT_MODELS.map((m) => ({ ...m, label: m.name }));
}

export function createDemoAccess() {
  const token = `demo_${crypto.randomUUID().replace(/-/g, '')}`;
  const user = {
    id: newId('user'),
    email: `demo_${Date.now()}@technetgame.local`,
    plan: process.env.FORCE_PRO_FOR_ALL_TEST_USERS === 'true' ? 'pro' : 'open',
    createdAt: nowIso(),
    usedToday: 0,
    limit: 30,
  };

  demoUsers.set(token, user);
  sessionIndexByToken.set(token, new Set());
  return { token, user };
}

export function requireUserFromToken(rawToken) {
  const token = String(rawToken || '').trim();
  if (!token || !demoUsers.has(token)) {
    const error = new Error('Token inválido ou expirado');
    error.status = 401;
    throw error;
  }
  return { token, user: demoUsers.get(token) };
}

export function getUsageForToken(token) {
  const { user } = requireUserFromToken(token);
  return {
    user: { id: user.id, email: user.email, plan: user.plan },
    usage: { usedToday: user.usedToday, limit: user.limit, effectivePlan: user.plan },
  };
}

export function incrementUsage(token) {
  requireUserFromToken(token).user.usedToday += 1;
}

export function listSessionsForToken(token) {
  requireUserFromToken(token);
  const ids = [...(sessionIndexByToken.get(token) || new Set())];
  return ids
    .map((id) => sessions.get(id))
    .filter(Boolean)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map((session) => ({
      id: session.id,
      title: session.title,
      updatedAt: session.updatedAt,
      createdAt: session.createdAt,
      messageCount: session.messages.length,
    }));
}

export function getSessionById(token, id) {
  requireUserFromToken(token);
  const session = sessions.get(id);
  if (!session || session.token !== token) {
    const error = new Error('Sessão não encontrada');
    error.status = 404;
    throw error;
  }
  return session;
}

export function deleteSessionById(token, id) {
  const session = getSessionById(token, id);
  sessions.delete(id);
  sessionIndexByToken.get(token)?.delete(id);
  return { ok: true, id: session.id };
}

function guessAttachmentCategory(file) {
  const mime = String(file.mimetype || '').toLowerCase();
  if (mime.includes('pdf')) return 'pdf';
  if (mime.includes('word') || mime.includes('document')) return 'doc';
  if (mime.includes('image')) return 'imagem';
  if (mime.includes('zip')) return 'zip';
  if (mime.includes('json') || mime.includes('javascript') || mime.includes('text')) return 'texto';
  return 'arquivo';
}

export function createAttachmentRecords(files = []) {
  return files.map((file) => {
    const id = newId('upload');
    const record = {
      id,
      fieldName: file.fieldname,
      originalName: file.originalname,
      name: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      category: guessAttachmentCategory(file),
      uploadedAt: nowIso(),
      textPreview: file.buffer ? file.buffer.toString('utf8', 0, Math.min(file.buffer.length, 2000)) : '',
    };
    attachmentStore.set(id, record);
    return record;
  });
}

function deriveTitle(message) {
  return String(message || 'Nova conversa').trim().slice(0, 60) || 'Nova conversa';
}

function chooseAgentSystem(message = '') {
  const text = String(message).toLowerCase();
  if (/código|code|bug|erro|patch|api|backend|frontend|javascript|node|deploy/.test(text)) return 'coder';
  if (/pesquisa|rss|fonte|fontes|buscar|news|notícia|osint|investigar/.test(text)) return 'research';
  if (/plano|estratégia|roadmap|arquitetura|checklist|passos|organizar/.test(text)) return 'planner';
  return 'default';
}

function buildSystemPrompt(agentSystem, attachments = []) {
  const base = 'Você é o TechNet AI, um assistente em português do Brasil, útil, objetivo e profissional.';
  const byAgent = {
    planner: 'Atue como estrategista e organizador. Entregue planos claros, por etapas e com prioridade.',
    coder: 'Atue como engenheiro de software sênior. Foque em correções práticas, patches e diagnóstico técnico.',
    research: 'Atue como analista de pesquisa e OSINT. Resuma fontes, contexto e próximos passos.',
    default: 'Atue como assistente geral da TechNet, com respostas úteis, diretas e orientadas à ação.',
  };
  const attachmentHint = attachments.length
    ? `Considere também estes anexos: ${attachments.map((a) => `${a.originalName || a.name} (${a.category || 'arquivo'})`).join(', ')}.`
    : '';
  return [base, byAgent[agentSystem] || byAgent.default, attachmentHint].filter(Boolean).join(' ');
}

function isRetryableProviderError(status, message = '') {
  const msg = String(message || '').toLowerCase();
  return (
    status === 408 ||
    status === 409 ||
    status === 425 ||
    status === 429 ||
    status >= 500 ||
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('capacity') ||
    msg.includes('overloaded') ||
    msg.includes('temporarily unavailable') ||
    msg.includes('timed out') ||
    msg.includes('billing') ||
    msg.includes('credit')
  );
}

async function readJsonSafe(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function callOpenAICompatible({
  apiKey,
  baseUrl,
  model,
  systemPrompt,
  message,
  attachments,
  providerName,
  extraHeaders = {},
}) {
  if (!apiKey) {
    const error = new Error(`${providerName}: missing API key`);
    error.status = 401;
    throw error;
  }

  const attachmentText = attachments.length
    ? `\n\nResumo dos anexos:\n${attachments
        .map((a) => `- ${a.originalName || a.name}: ${a.textPreview || 'sem prévia'}`)
        .join('\n')}`
    : '';

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      temperature: 0.5,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `${message}${attachmentText}` },
      ],
      stream: false,
    }),
  });

  const data = await readJsonSafe(response);
  if (!response.ok) {
    const error = new Error(data?.error?.message || data?.message || data?.raw || `Falha no provedor ${providerName}`);
    error.status = response.status;
    error.provider = providerName;
    error.payload = data;
    throw error;
  }

  const content = data?.choices?.[0]?.message?.content?.trim() || data?.choices?.[0]?.text?.trim() || null;
  if (!content) {
    const error = new Error(`${providerName}: empty response`);
    error.status = 502;
    error.provider = providerName;
    error.payload = data;
    throw error;
  }

  return { answer: content, provider: providerName, model, raw: data };
}

async function generateWithFallback({ selectedModel, systemPrompt, message, attachments }) {
  const wantsOpenRouter = /^openrouter:/i.test(selectedModel);
  const cleanModel = String(selectedModel || '').replace(/^openrouter:/i, '').trim();
  const groqModel = !wantsOpenRouter ? (cleanModel || GROQ_MODEL) : GROQ_MODEL;
  const openrouterModel = wantsOpenRouter ? (cleanModel || OPENROUTER_MODEL) : OPENROUTER_MODEL;
  const errors = [];

  try {
    return await callOpenAICompatible({
      apiKey: GROQ_API_KEY,
      baseUrl: GROQ_BASE_URL,
      model: groqModel,
      systemPrompt,
      message,
      attachments,
      providerName: 'groq',
    });
  } catch (error) {
    errors.push({ provider: 'groq', status: error.status || 500, message: error.message });
    if (!isRetryableProviderError(error.status || 500, error.message)) throw error;
  }

  try {
    return await callOpenAICompatible({
      apiKey: OPENROUTER_API_KEY,
      baseUrl: OPENROUTER_BASE_URL,
      model: openrouterModel,
      systemPrompt,
      message,
      attachments,
      providerName: 'openrouter',
      extraHeaders: {
        'HTTP-Referer': SITE_URL,
        'X-Title': SITE_NAME,
      },
    });
  } catch (error) {
    errors.push({ provider: 'openrouter', status: error.status || 500, message: error.message });
    const finalError = new Error('Todos os providers falharam');
    finalError.status = 503;
    finalError.providers = errors;
    throw finalError;
  }
}

function fallbackAnswer({ message, agentSystem, attachments, providerErrors = [] }) {
  const intro = {
    planner: 'Montei um plano objetivo para você seguir agora.',
    coder: 'Preparei um diagnóstico técnico direto ao ponto.',
    research: 'Organizei uma análise rápida do contexto pedido.',
    default: 'Separei uma resposta clara e prática para o seu pedido.',
  }[agentSystem] || 'Preparei uma resposta útil para o seu pedido.';

  const bullets = [
    `Pedido recebido: ${message}`,
    'Se quiser mais precisão, anexe arquivos ou peça um checklist operacional.',
    'O modo de fallback local entrou em ação porque os provedores de IA externos ficaram indisponíveis.',
  ];

  if (attachments.length) {
    bullets.push(`Anexos detectados: ${attachments.map((a) => a.originalName || a.name).join(', ')}.`);
  }

  if (providerErrors.length) {
    bullets.push(`Falhas dos providers: ${providerErrors.map((item) => `${item.provider} (${item.status}): ${item.message}`).join(' | ')}`);
  }

  return `${intro}\n\n- ${bullets.join('\n- ')}`;
}

function createSession(token, seedMessage = '') {
  const id = newId('session');
  const session = {
    id,
    token,
    title: deriveTitle(seedMessage),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    messages: [],
  };
  sessions.set(id, session);
  if (!sessionIndexByToken.has(token)) sessionIndexByToken.set(token, new Set());
  sessionIndexByToken.get(token).add(id);
  return session;
}

export async function generateAssistantAnswer({ token, message, sessionId, model, attachments = [] }) {
  incrementUsage(token);

  const agentSystem = chooseAgentSystem(message);
  const session = sessionId ? getSessionById(token, sessionId) : createSession(token, message);
  const attachmentRecords = attachments.map((item) => attachmentStore.get(item.id) || item).filter(Boolean);

  session.messages.push({
    id: newId('msg'),
    role: 'user',
    content: message,
    createdAt: nowIso(),
    attachments: attachmentRecords,
  });
  session.updatedAt = nowIso();

  const selectedModel = model || GROQ_MODEL;
  const systemPrompt = buildSystemPrompt(agentSystem, attachmentRecords);
  let answer = null;
  let usedProvider = 'local-fallback';
  let usedModel = selectedModel;

  try {
    const completion = await generateWithFallback({
      selectedModel,
      systemPrompt,
      message,
      attachments: attachmentRecords,
    });
    answer = completion.answer;
    usedProvider = completion.provider;
    usedModel = completion.model;
  } catch (error) {
    answer = fallbackAnswer({
      message,
      agentSystem,
      attachments: attachmentRecords,
      providerErrors: error.providers || [{ provider: 'unknown', status: error.status || 500, message: error.message }],
    });
  }

  if (!answer) {
    answer = fallbackAnswer({ message, agentSystem, attachments: attachmentRecords });
  }

  session.messages.push({
    id: newId('msg'),
    role: 'assistant',
    content: answer,
    createdAt: nowIso(),
    agentSystem,
    model: usedModel,
    provider: usedProvider,
  });
  session.updatedAt = nowIso();

  return {
    session,
    sessionId: session.id,
    resposta: answer,
    answer,
    agentSystem,
    model: usedModel,
    provider: usedProvider,
  };
}

export function splitIntoTokenChunks(text) {
  const normalized = String(text || '');
  const chunks = [];
  for (let i = 0; i < normalized.length; i += 12) {
    chunks.push(normalized.slice(i, i + 12));
  }
  return chunks;
}

export function getOpenClawState() {
  return {
    enabled: process.env.OPENCLAW_ENABLED !== 'false',
    provider: 'groq-with-openrouter-fallback',
    defaultModel: GROQ_MODEL,
    fallbackModel: OPENROUTER_MODEL,
    publicDomain: process.env.RAILWAY_PUBLIC_DOMAIN || null,
  };
}
