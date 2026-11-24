import { ensureDatabaseReady } from '../database'

export default defineEventHandler(async (event) => {
  if (!event.path.startsWith('/api/')) return
  // Diagnóstico de saúde precisa funcionar mesmo com o banco inacessível
  if (event.path.startsWith('/api/health/')) return
  await ensureDatabaseReady()
})
