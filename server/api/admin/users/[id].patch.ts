import { eq } from 'drizzle-orm'
import { getRouterParam, readBody } from 'h3'
import { db } from '../../../database'
import { users } from '../../../database/schema'
import { badRequest, notFound, requireAuthUser } from '../../../utils/auth'
import { assertAdminUser } from '../../../utils/household'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  await assertAdminUser(userId)

  const targetId = getRouterParam(event, 'id')
  if (!targetId) {
    badRequest('ID do usuário obrigatório')
  }

  const body = await readBody<{
    invoiceAnalysisEnabled?: boolean
    isAdmin?: boolean
  }>(event)

  const [targetUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, targetId))
    .limit(1)

  if (!targetUser) {
    notFound('Usuário não encontrado')
  }

  // Impede que o próprio admin remova o seu próprio acesso de admin por engano
  if (targetId === userId && body?.isAdmin === false) {
    badRequest('Você não pode remover a permissão de administrador da sua própria conta.')
  }

  const nextInvoiceAnalysis =
    typeof body?.invoiceAnalysisEnabled === 'boolean'
      ? body.invoiceAnalysisEnabled
      : Boolean(targetUser.invoiceAnalysisEnabled)

  const nextIsAdmin =
    typeof body?.isAdmin === 'boolean' ? body.isAdmin : Boolean(targetUser.isAdmin)

  const now = new Date().toISOString()

  await db
    .update(users)
    .set({
      invoiceAnalysisEnabled: nextInvoiceAnalysis,
      isAdmin: nextIsAdmin,
      updatedAt: now,
    })
    .where(eq(users.id, targetId))

  return {
    id: targetUser.id,
    email: targetUser.email,
    name: targetUser.name ?? null,
    hasPartner: Boolean(targetUser.familyId),
    invoiceAnalysisEnabled: nextInvoiceAnalysis,
    isAdmin: nextIsAdmin,
    createdAt: targetUser.createdAt,
    updatedAt: now,
  }
})
