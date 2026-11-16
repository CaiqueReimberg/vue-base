import { and, eq } from 'drizzle-orm'
import { getRouterParam, readBody } from 'h3'
import { db } from '../../database'
import { accounts } from '../../database/schema'
import { notFound, requireAuthUser } from '../../utils/auth'
import { assertUserBelongsToFamily } from '../../utils/household'
import { mapAccountsWithEffectiveBalance, netFlowsByAccountIds } from '../../utils/resources'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody<{
    name?: string
    type?: string
    balance?: number
    initialBalance?: number
    bankName?: string | null
    isActive?: boolean
    shareWithPartner?: boolean
    familyId?: string | null
  }>(event)

  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
    .limit(1)

  if (!account) {
    notFound(`Conta com ID ${id} não encontrada`)
  }

  const updates: Partial<typeof accounts.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  }

  if (body.name !== undefined) updates.name = body.name.trim()
  if (body.type !== undefined) updates.type = body.type
  if (body.bankName !== undefined) updates.bankName = body.bankName
  if (body.isActive !== undefined) updates.isActive = body.isActive
  if (body.shareWithPartner !== undefined) updates.shareWithPartner = body.shareWithPartner

  if (body.balance !== undefined) {
    const netMap = await netFlowsByAccountIds([id])
    const net = netMap.get(id) ?? 0
    updates.initialBalance = Number(body.balance) - net
    updates.balance = Number(body.balance)
  } else if (body.initialBalance !== undefined) {
    const netMap = await netFlowsByAccountIds([id])
    const net = netMap.get(id) ?? 0
    updates.initialBalance = Number(body.initialBalance)
    updates.balance = Number(body.initialBalance) + net
  }

  if (body.familyId !== undefined) {
    if (body.familyId) {
      await assertUserBelongsToFamily(userId, body.familyId)
      updates.familyId = body.familyId
    } else {
      updates.familyId = null
    }
  }

  await db.update(accounts).set(updates).where(eq(accounts.id, id))
  const [updated] = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1)
  const [mapped] = await mapAccountsWithEffectiveBalance([updated])
  return mapped
})
