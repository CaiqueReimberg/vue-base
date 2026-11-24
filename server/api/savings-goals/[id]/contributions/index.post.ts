import { randomUUID } from 'node:crypto'
import { getRouterParam, readBody } from 'h3'
import { db } from '../../../../database'
import { savingsContributions } from '../../../../database/schema'
import { badRequest, requireAuthUser } from '../../../../utils/auth'
import {
  applyGoalAccountDelta,
  getVisibleGoalOrThrow,
  listSavingsGoals,
} from '../../../../utils/savings-goals'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const goalId = getRouterParam(event, 'id')!
  const goal = await getVisibleGoalOrThrow(userId, goalId)

  const body = await readBody<{
    amount?: number
    note?: string | null
    contributedAt?: string
    accountId?: string | null
  }>(event)
  const amount = Number(body?.amount)
  // Valor negativo representa uma retirada da meta
  if (!Number.isFinite(amount) || amount === 0) {
    badRequest('Informe um valor diferente de zero')
  }
  if (body?.contributedAt && Number.isNaN(new Date(body.contributedAt).getTime())) {
    badRequest('Data inválida')
  }

  const now = new Date().toISOString()
  await db.insert(savingsContributions).values({
    id: randomUUID(),
    goalId,
    amount,
    contributedAt: body?.contributedAt || now,
    note: body?.note?.trim() || null,
    userId,
    createdAt: now,
  })

  // Atualiza automaticamente o saldo do CDB/Conta vinculado (ou escolhido no momento do aporte)
  const targetAccountId = goal.accountId || body?.accountId || null
  if (targetAccountId) {
    await applyGoalAccountDelta(userId, targetAccountId, amount)
  }

  const all = await listSavingsGoals(userId)
  return all.find((g) => g.id === goalId)
})
