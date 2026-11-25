import { randomUUID } from 'node:crypto'
import { and, eq, inArray } from 'drizzle-orm'
import { getRouterParam, readBody } from 'h3'
import { db } from '../../database'
import { debtPayments, transactions } from '../../database/schema'
import { badRequest, notFound, requireAuthUser } from '../../utils/auth'
import {
  assertPersonInSameHousehold,
  assertUserBelongsToFamily,
  getHouseholdVisibility,
} from '../../utils/household'
import {
  findOneLinkableAccount,
  findOneLinkableCard,
  findOneVisibleCategory,
} from '../../utils/resources'
import { getDebtStartMonth, hydrateTransactions } from '../../utils/transactions'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody<{
    accountId?: string | null
    cardId?: string | null
    categoryId?: string | null
    familyId?: string | null
    type?: string
    kind?: string | null
    debtCategory?: string | null
    amount?: number
    description?: string
    occurredAt?: string
    dueDate?: string | null
    paidAt?: string | null
    paidByUserId?: string | null
    referenceMonth?: string | null
    paymentMonth?: string | null
    status?: string
    installmentNumber?: number | null
    installmentTotal?: number | null
    isShared?: boolean
    notes?: string | null
  }>(event)

  const visibility = await getHouseholdVisibility(userId)
  const [tx] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), inArray(transactions.userId, visibility.memberIds)))
    .limit(1)

  if (!tx || (tx.userId !== userId && !tx.isShared)) {
    notFound('Transação não encontrada')
  }

  const payerId = body.paidByUserId?.trim() || userId
  if (payerId !== userId) {
    await assertPersonInSameHousehold(userId, payerId)
  }

  const hasAccountInPayload = body.accountId !== undefined
  const hasCardInPayload = body.cardId !== undefined
  const hasCategoryInPayload = body.categoryId !== undefined

  if (hasAccountInPayload && hasCardInPayload && body.accountId && body.cardId) {
    badRequest('Informe apenas accountId ou cardId, não ambos')
  }

  const nextType = body.type ?? tx.type
  let nextKind = body.kind !== undefined ? body.kind : tx.kind

  let nextAccountId = tx.accountId
  let nextCardId = tx.cardId
  let nextCategoryId = tx.categoryId

  if (body.kind === 'debt') {
    nextAccountId = null
    nextCardId = null
    nextCategoryId = null
  } else {
    if (hasAccountInPayload) {
      nextAccountId = body.accountId || null
      nextCardId = null
    }
    if (hasCardInPayload) {
      nextCardId = body.cardId || null
      nextAccountId = null
    }
    if (hasCategoryInPayload) {
      nextCategoryId = body.categoryId || null
    }
  }

  if (tx.kind === 'debt' && body.kind !== 'debt' && (nextAccountId || nextCardId)) {
    nextKind = 'purchase'
  }

  const isDebt = nextKind === 'debt'

  if (isDebt && nextType !== 'expense') {
    badRequest('Lançamentos de dívida são sempre gastos')
  }

  if (!isDebt && !nextAccountId && !nextCardId) {
    badRequest('A transação precisa de accountId ou cardId')
  }

  if (nextType === 'income' && nextCardId) {
    badRequest('Entradas não podem ser vinculadas a cartão')
  }

  if (nextType !== 'expense' && nextCardId) {
    badRequest('Somente gastos podem ser vinculados a cartão')
  }

  if (!isDebt) {
    if (nextAccountId) {
      await findOneLinkableAccount(userId, nextAccountId)
    }
    if (nextCardId) {
      await findOneLinkableCard(userId, nextCardId)
    }
  }

  if (nextCategoryId) {
    const cat = await findOneVisibleCategory(userId, nextCategoryId)
    if (cat.type !== nextType) {
      badRequest('Tipo da categoria incompatível com a transação')
    }
  }

  const updates: Partial<typeof transactions.$inferInsert> = {
    type: nextType,
    kind: nextKind,
    accountId: nextAccountId,
    cardId: nextCardId,
    categoryId: nextCategoryId,
    updatedAt: new Date().toISOString(),
  }

  if (isDebt) {
    if (body.debtCategory !== undefined) {
      updates.debtCategory = body.debtCategory
    }
  } else {
    updates.debtCategory = null
  }

  if (body.amount !== undefined) updates.amount = Number(body.amount)
  if (body.description !== undefined) updates.description = body.description.trim()
  if (body.occurredAt !== undefined) updates.occurredAt = new Date(body.occurredAt).toISOString()
  if (body.dueDate !== undefined) {
    updates.dueDate = body.dueDate ? new Date(body.dueDate).toISOString().slice(0, 10) : null
  }
  if (body.referenceMonth !== undefined) updates.referenceMonth = body.referenceMonth

  const targetPaymentMonth =
    isDebt && body.status !== undefined
      ? (body.paymentMonth && /^\d{4}-\d{2}$/.test(body.paymentMonth)
          ? body.paymentMonth
          : getDebtStartMonth(tx))
      : undefined

  if (isDebt && targetPaymentMonth && body.status !== undefined) {
    const isMarkingPaid = body.status === 'cleared' || body.status === 'paid'
    if (isMarkingPaid) {
      const paidIso = body.paidAt ? new Date(body.paidAt).toISOString() : new Date().toISOString()
      const [existingPayment] = await db
        .select()
        .from(debtPayments)
        .where(
          and(
            eq(debtPayments.transactionId, id),
            eq(debtPayments.referenceMonth, targetPaymentMonth),
          ),
        )
        .limit(1)
      if (!existingPayment) {
        await db.insert(debtPayments).values({
          id: randomUUID(),
          transactionId: id,
          referenceMonth: targetPaymentMonth,
          paidAt: paidIso,
          userId: payerId,
          createdAt: paidIso,
        })
      } else if (body.paidByUserId && existingPayment.userId !== payerId) {
        await db
          .update(debtPayments)
          .set({ userId: payerId })
          .where(eq(debtPayments.id, existingPayment.id))
      }
    } else {
      await db
        .delete(debtPayments)
        .where(
          and(
            eq(debtPayments.transactionId, id),
            eq(debtPayments.referenceMonth, targetPaymentMonth),
          ),
        )
    }
  } else {
    if (body.paidAt !== undefined) {
      updates.paidAt = body.paidAt ? new Date(body.paidAt).toISOString() : null
      updates.paidByUserId = body.paidAt ? payerId : null
    }
    if (body.status !== undefined) {
      updates.status = body.status
      if (body.status === 'cleared' || body.status === 'paid') {
        updates.paidByUserId = payerId
      } else if (body.status === 'pending') {
        updates.paidByUserId = null
      }
    }
  }

  if (body.installmentNumber !== undefined) updates.installmentNumber = body.installmentNumber
  if (body.installmentTotal !== undefined) updates.installmentTotal = body.installmentTotal
  if (body.isShared !== undefined) updates.isShared = body.isShared
  if (body.notes !== undefined) updates.notes = body.notes

  if (body.familyId !== undefined) {
    if (body.familyId) {
      await assertUserBelongsToFamily(userId, body.familyId)
      updates.familyId = body.familyId
    } else {
      updates.familyId = null
    }
  }

  await db.update(transactions).set(updates).where(eq(transactions.id, id))
  const [saved] = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1)
  const [hydrated] = await hydrateTransactions([saved], true, targetPaymentMonth)
  return hydrated
})
