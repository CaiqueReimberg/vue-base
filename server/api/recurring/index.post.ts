import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { readBody } from 'h3'
import { db } from '../../database'
import { recurrings } from '../../database/schema'
import { badRequest, requireAuthUser } from '../../utils/auth'
import { resolveRecurringCardKey } from '../../utils/card-invoice-key'
import {
  assertUserBelongsToFamily,
  getHouseholdVisibility,
  getUserOrThrow,
} from '../../utils/household'
import { hydrateRecurrings, setRecurringMonthAmount } from '../../utils/recurring'
import {
  findOneLinkableAccount,
  findOneLinkableCard,
  findOneVisibleCategory,
} from '../../utils/resources'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const user = await getUserOrThrow(userId)

  const body = await readBody<{
    name?: string
    kind?: string
    transactionType?: string
    frequency?: string
    amount?: number
    description?: string | null
    dueDay?: number | null
    startDate?: string
    referenceMonth?: string
    isCardInvoice?: boolean
    endDate?: string | null
    isActive?: boolean
    isShared?: boolean
    accountId?: string
    cardId?: string
    categoryId?: string
    familyId?: string
  }>(event)

  if (!body?.name?.trim() || !body.kind || !body.transactionType || !body.startDate) {
    badRequest('Informe nome, tipo e data inicial da recorrência')
  }

  if (body.accountId && body.cardId) {
    badRequest('Informe apenas accountId ou cardId, não ambos')
  }

  if (body.accountId) await findOneLinkableAccount(userId, body.accountId)
  if (body.cardId) await findOneLinkableCard(userId, body.cardId)
  if (body.categoryId) await findOneVisibleCategory(userId, body.categoryId)
  if (body.familyId) await assertUserBelongsToFamily(userId, body.familyId)

  const rawName = body.name.trim()
  const finalName =
    body.isCardInvoice && !/^(fatura|cart[aã]o)\b/i.test(rawName)
      ? `Fatura ${rawName}`
      : rawName

  const now = new Date().toISOString()
  const normalizedStart = new Date(body.startDate).toISOString().slice(0, 10)
  const targetMonth =
    body.referenceMonth && /^\d{4}-\d{2}$/.test(body.referenceMonth)
      ? body.referenceMonth
      : normalizedStart.slice(0, 7)

  // Idempotência: se for uma fatura de cartão (ex: Fatura Nubank / Nubank), garante apenas 1 por cartão para este userId
  if (body.transactionType === 'expense') {
    const targetCardKey = resolveRecurringCardKey(
      finalName,
      user.name,
      Boolean(body.isCardInvoice),
    )

    if (targetCardKey) {
      const userRecurrings = await db
        .select()
        .from(recurrings)
        .where(
          and(
            eq(recurrings.userId, userId),
            eq(recurrings.isActive, true),
            eq(recurrings.transactionType, 'expense'),
          ),
        )

      const matched = userRecurrings.find(
        (r) => resolveRecurringCardKey(r.name, user.name) === targetCardKey,
      )

      if (matched) {
        const nextUpdates: Partial<typeof recurrings.$inferInsert> = {
          updatedAt: now,
        }
        if (body.dueDay != null) {
          nextUpdates.dueDay = Number(body.dueDay)
        }
        if (typeof body.isShared === 'boolean') {
          nextUpdates.isShared = body.isShared
        }
        const targetMonthStart = `${targetMonth}-01`
        if (matched.startDate > targetMonthStart) {
          nextUpdates.startDate = targetMonthStart
        }
        // Se antes estava salvo com nome genérico (ex: "Fatura Nubank") e agora a pessoa deu um nome mais detalhado, atualiza
        if (finalName.length > matched.name.length) {
          nextUpdates.name = finalName
        }

        await db.update(recurrings).set(nextUpdates).where(eq(recurrings.id, matched.id))

        const numAmount = Number(body.amount ?? 0)
        if (numAmount > 0) {
          await setRecurringMonthAmount(userId, matched.id, targetMonth, numAmount)
        }

        const [savedExisting] = await db
          .select()
          .from(recurrings)
          .where(eq(recurrings.id, matched.id))
          .limit(1)
        const [hydratedExisting] = await hydrateRecurrings([savedExisting], true)
        return { ...hydratedExisting, deduplicated: true }
      }
    }
  }

  const visibility = await getHouseholdVisibility(userId)
  const id = randomUUID()
  const row: typeof recurrings.$inferInsert = {
    id,
    name: finalName,
    kind: body.kind,
    transactionType: body.transactionType,
    frequency: body.frequency ?? 'monthly',
    amount: Number(body.amount ?? 0),
    description: body.description ?? null,
    dueDay: body.dueDay != null ? Number(body.dueDay) : null,
    startDate: normalizedStart,
    endDate: body.endDate ? new Date(body.endDate).toISOString().slice(0, 10) : null,
    isActive: body.isActive ?? true,
    isShared: body.isShared ?? false,
    userId,
    accountId: body.accountId ?? null,
    cardId: body.cardId ?? null,
    categoryId: body.categoryId ?? null,
    familyId: body.familyId ?? visibility.familyId ?? null,
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(recurrings).values(row)
  const [saved] = await db.select().from(recurrings).where(eq(recurrings.id, id)).limit(1)
  const [hydrated] = await hydrateRecurrings([saved], true)
  return hydrated
})
