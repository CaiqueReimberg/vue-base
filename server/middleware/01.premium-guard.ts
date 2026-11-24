import { requireAuthUser } from '../utils/auth'
import { assertPremiumUser } from '../utils/household'

export default defineEventHandler(async (event) => {
  if (!event.path.startsWith('/api/')) return

  const pathname = event.path.split('?')[0].replace(/\/+$/, '')

  // Rotas públicas, próprio perfil e administração (que já valida assertAdminUser)
  if (
    pathname === '/api/health' ||
    pathname.startsWith('/api/auth/') ||
    pathname === '/api/users/me' ||
    pathname.startsWith('/api/admin/')
  ) {
    return
  }

  const { userId } = requireAuthUser(event)
  await assertPremiumUser(userId)
})
