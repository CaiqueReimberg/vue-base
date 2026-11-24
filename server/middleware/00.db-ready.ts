import { ensureDatabaseReady } from '../database'

export default defineEventHandler(async (event) => {
  if (event.path.startsWith('/api/')) {
    await ensureDatabaseReady()
  }
})
