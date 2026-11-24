import { randomUUID } from 'node:crypto'
import { readBody } from 'h3'
import { db } from '../../database'
import { savingsGoals } from '../../database/schema'
import { badRequest, requireAuthUser } from '../../utils/auth'
import { getHouseholdVisibility } from '../../utils/household'
import { listSavingsGoals } from '../../utils/savings-goals'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const body = await readBody<{
    name?: string
    targetAmount?: number
    targetDate?: string | null
    isShared?: boolean
    accountId?: string | null
  }>(event)

  const name = body?.name?.trim()
  const targetAmount = Number(body?.targetAmount)
  if (!name) badRequest('Informe o nome da meta')
  if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
    badRequest('Informe um valor alvo maior que zero')
  }
  if (body?.targetDate && Number.isNaN(new Date(body.targetDate).getTime())) {
    badRequest('Data alvo inválida')
  }

  const visibility = await getHouseholdVisibility(userId)
  const now = new Date().toISOString()
  const id = randomUUID()

  await db.insert(savingsGoals).values({
    id,
    name,
    targetAmount,
    targetDate: body?.targetDate || null,
    isShared: body?.isShared ?? true,
    accountId: body?.accountId || null,
    archivedAt: null,
    userId,
    familyId: visibility.familyId,
    createdAt: now,
    updatedAt: now,
  })

  const all = await listSavingsGoals(userId)
  return all.find((g) => g.id === id)
})
