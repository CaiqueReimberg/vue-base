import { and, eq, inArray } from 'drizzle-orm'
import { getRouterParam, readBody } from 'h3'
import { db } from '../../database'
import { accounts } from '../../database/schema'
import { notFound, requireAuthUser } from '../../utils/auth'
import { roundMoney } from '../../utils/billing'
import { assertUserBelongsToFamily, getHouseholdVisibility } from '../../utils/household'
import { mapAccountsWithEffectiveBalance, netFlowsByAccountIds } from '../../utils/resources'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody<{
    name?: string
    type?: string
    balance?: number
    initialBalance?: number
    delta?: number
    bankName?: string | null
    isActive?: boolean
    shareWithPartner?: boolean
    familyId?: string | null
  }>(event)

  const visibility = await getHouseholdVisibility(userId)

  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, id), inArray(accounts.userId, visibility.memberIds)))
    .limit(1)

  if (!account || (account.userId !== userId && !account.shareWithPartner)) {
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

  const netMap = await netFlowsByAccountIds([id])
  const net = netMap.get(id) ?? 0
  const currentEffectiveBalance = Number(account.initialBalance) + net

  if (body.delta !== undefined && Number.isFinite(Number(body.delta))) {
    const nextBalance = Math.max(0, roundMoney(currentEffectiveBalance + Number(body.delta)))
    updates.initialBalance = roundMoney(nextBalance - net)
    updates.balance = nextBalance
  } else if (body.balance !== undefined) {
    const nextBalance = roundMoney(Number(body.balance))
    updates.initialBalance = roundMoney(nextBalance - net)
    updates.balance = nextBalance
  } else if (body.initialBalance !== undefined) {
    const nextInit = roundMoney(Number(body.initialBalance))
    updates.initialBalance = nextInit
    updates.balance = roundMoney(nextInit + net)
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
