import { randomUUID } from 'node:crypto'
import { readBody } from 'h3'
import { db } from '../../database'
import { accounts } from '../../database/schema'
import { badRequest, requireAuthUser } from '../../utils/auth'
import { assertUserBelongsToFamily } from '../../utils/household'
import { mapAccountsWithEffectiveBalance } from '../../utils/resources'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const body = await readBody<{
    name?: string
    type?: string
    initialBalance?: number
    bankName?: string | null
    isActive?: boolean
    shareWithPartner?: boolean
    familyId?: string | null
  }>(event)

  if (!body?.name?.trim() || !body?.type) {
    badRequest('Informe nome e tipo da conta')
  }

  if (body.familyId) {
    await assertUserBelongsToFamily(userId, body.familyId)
  }

  const initial = Number(body.initialBalance ?? 0)
  const now = new Date().toISOString()
  const id = randomUUID()

  const newAccount: typeof accounts.$inferInsert = {
    id,
    name: body.name.trim(),
    type: body.type,
    balance: initial,
    initialBalance: initial,
    bankName: body.bankName ?? null,
    isActive: body.isActive ?? true,
    shareWithPartner: body.shareWithPartner ?? false,
    userId,
    familyId: body.familyId ?? null,
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(accounts).values(newAccount)
  const [mapped] = await mapAccountsWithEffectiveBalance([newAccount as typeof accounts.$inferSelect])
  return mapped
})
