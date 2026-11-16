import { and, desc, eq } from 'drizzle-orm'
import { getQuery, getRouterParam } from 'h3'
import { db } from '../../../database'
import { transactions } from '../../../database/schema'
import { requireAuthUser } from '../../../utils/auth'
import {
  buildCyclesAroundReference,
  referenceMonthMidUtc,
  transactionInBillingCycle,
} from '../../../utils/billing'
import { getPublicUsersMap } from '../../../utils/household'
import { findOneLinkableCard } from '../../../utils/resources'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const cardId = getRouterParam(event, 'id')!
  const query = getQuery(event)

  const pastCycles = Number(query.pastCycles ?? query.cycles ?? 0)
  const futureCycles = Number(query.futureCycles ?? 0)
  const referenceMonth =
    typeof query.referenceMonth === 'string' && query.referenceMonth.trim()
      ? query.referenceMonth.trim()
      : undefined

  const card = await findOneLinkableCard(userId, cardId)
  const usersMap = await getPublicUsersMap([card.userId])
  const owner = usersMap.get(card.userId) ?? null
  const ownerUserId = card.userId

  const reference = referenceMonth ? referenceMonthMidUtc(referenceMonth) : new Date()
  const boundsList = buildCyclesAroundReference(
    card.closingDay,
    card.dueDay,
    pastCycles,
    futureCycles,
    reference
  )

  const conditions = [
    eq(transactions.cardId, cardId),
    eq(transactions.userId, ownerUserId),
    eq(transactions.type, 'expense'),
  ]
  if (userId !== ownerUserId) {
    conditions.push(eq(transactions.isShared, true))
  }

  const txRows = await db
    .select()
    .from(transactions)
    .where(and(...conditions))
    .orderBy(desc(transactions.occurredAt))

  const invoices = boundsList.map((b) => {
    const inCycle = txRows.filter((t) =>
      transactionInBillingCycle(t.occurredAt, b.periodStart, b.periodEnd)
    )
    const total = inCycle.reduce((sum, t) => sum + Number(t.amount), 0)
    return {
      periodStart: b.periodStart.toISOString(),
      periodEnd: b.periodEnd.toISOString(),
      dueDate: b.dueDate.toISOString(),
      total,
      transactionCount: inCycle.length,
      transactions: inCycle.map((t) => ({
        id: t.id,
        description: t.description,
        amount: Number(t.amount),
        occurredAt: new Date(t.occurredAt).toISOString(),
        installmentNumber: t.installmentNumber ?? null,
        installmentTotal: t.installmentTotal ?? null,
      })),
    }
  })

  return {
    card: {
      id: card.id,
      name: card.name,
      closingDay: card.closingDay,
      dueDay: card.dueDay,
      limitAmount: Number(card.limitAmount),
      owner,
    },
    invoices,
  }
})
