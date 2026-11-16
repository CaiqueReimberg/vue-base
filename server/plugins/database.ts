import { ensureDatabaseReady } from '../database'

export default defineNitroPlugin(async () => {
  try {
    await ensureDatabaseReady()
  } catch (err) {
    console.error('[DuoPact] Falha ao executar migrations no startup:', err)
  }
})
