import cron from 'node-cron';
import { refreshAllFeeds } from '../services/feedService.js';

let scheduledTask = null;

export async function primeCache() {
  try {
    await refreshAllFeeds();
    console.log('[feeds] cache inicial gerado');
  } catch (error) {
    console.error('[feeds] falha ao gerar cache inicial:', error.message);
  }
}

export function startRefreshScheduler() {
  const cronExpr = process.env.REFRESH_CRON || '*/30 * * * *';
  const timezone = process.env.REFRESH_TIMEZONE || 'America/Sao_Paulo';

  if (scheduledTask) {
    scheduledTask.stop();
  }

  scheduledTask = cron.schedule(cronExpr, async () => {
    try {
      await refreshAllFeeds();
      console.log('[feeds] cache atualizado com sucesso');
    } catch (error) {
      console.error('[feeds] erro no agendador:', error.message);
    }
  }, {
    timezone
  });

  console.log(`[feeds] agendador ativo em ${cronExpr} (${timezone})`);
  return scheduledTask;
}
