import { eq } from 'drizzle-orm'
import { getRouterParam, readBody } from 'h3'
import { db } from '../../database'
import { savingsGoals } from '../../database/schema'
import { badRequest, requireAuthUser } from '../../utils/auth'
import { getOwnedGoalOrThrow, listSavingsGoals } from '../../utils/savings-goals'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const id = getRouterParam(event, 'id')!
  await getOwnedGoalOrThrow(userId, id)

  const body = await readBody<{
    name?: string
    targetAmount?: number
    targetDate?: string | null
    isShared?: boolean
    archived?: boolean
    accountId?: string | null
  }>(event)

  const patch: Partial<typeof savingsGoals.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  }
  if (body?.name !== undefined) {
    if (!body.name.trim()) badRequest('Informe o nome da meta')
    patch.name = body.name.trim()
  }
  if (body?.targetAmount !== undefined) {
    const v = Number(body.targetAmount)
    if (!Number.isFinite(v) || v <= 0) badRequest('Informe um valor alvo maior que zero')
    patch.targetAmount = v
  }
  if (body?.targetDate !== undefined) {
    if (body.targetDate && Number.isNaN(new Date(body.targetDate).getTime())) {
      badRequest('Data alvo inválida')
    }
    patch.targetDate = body.targetDate || null
  }
  if (typeof body?.isShared === 'boolean') patch.isShared = body.isShared
  if (body?.accountId !== undefined) {
    patch.accountId = body.accountId || null
  }
  if (typeof body?.archived === 'boolean') {
    patch.archivedAt = body.archived ? new Date().toISOString() : null
  }

  await db.update(savingsGoals).set(patch).where(eq(savingsGoals.id, id))
  const all = await listSavingsGoals(userId)
  return all.find((g) => g.id === id)
})
