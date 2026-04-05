import 'dotenv/config';
import app from './app.js';
import { primeCache, startRefreshScheduler } from './jobs/refreshScheduler.js';

const port = Number(process.env.PORT || 3000);
const host = '0.0.0.0';

console.log('[server] iniciando...');
console.log('[server] HOST:', host);
console.log('[server] PORT:', process.env.PORT || '(fallback 3000)');

const server = app.listen(port, host, () => {
  console.log(`🚀 API rodando em http://${host}:${port}`);
});

setTimeout(() => {
  console.log('[server] iniciando background jobs...');

  primeCache()
    .then(() => console.log('[server] cache carregado'))
    .catch((err) => console.error('[server] erro cache:', err?.message || err));

  try {
    startRefreshScheduler();
    console.log('[server] scheduler ativo');
  } catch (err) {
    console.error('[server] erro scheduler:', err?.message || err);
  }
}, 1000);

function shutdown(signal) {
  console.log(`[server] encerrando com ${signal}`);
  server.close((error) => {
    if (error) {
      console.error('[server] erro ao encerrar:', error.message);
      process.exit(1);
    }
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandledRejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[server] uncaughtException:', error);
  process.exit(1);
});