import { randomUUID } from 'node:crypto'
import { and, asc, eq, inArray, or } from 'drizzle-orm'
import { db } from '../database'
import { cardMonthlyInvoices, cards, invoiceAnalyses } from '../database/schema'
import { badRequest, notFound } from './auth'
import { resolveReferenceMonth, roundMoney } from './billing'
import { resolveInvoiceCardKey } from './card-invoice-key'
import {
  assertPersonInSameHousehold,
  getHouseholdVisibility,
  getPublicUsersMap,
  getUserOrThrow,
} from './household'

export function cleanCardDisplayName(rawName: string, ownerName?: string | null): string {
  let clean = (rawName || '')
    .trim()
    .replace(/^(fatura(\s+do|\s+de)?|cart[aã]o(\s+de\s+cr[eé]dito)?)\s+/i, '')
    .trim()

  if (ownerName?.trim()) {
    const firstName = ownerName.trim().split(/\s+/)[0]
    if (firstName && firstName.length >= 2) {
      const escaped = firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      clean = clean.replace(new RegExp(`\\s*[-·/()]\\s*${escaped}\\s*$`, 'i'), '').trim()
    }
  }

  return clean || rawName.trim()
}

export function defaultClosingDayFromDueDay(dueDay: number): number {
  const safeDue = Math.min(Math.max(Math.round(dueDay) || 10, 1), 28)
  const closing = safeDue - 7
  return closing >= 1 ? closing : closing + 28
}

export async function findOrCreateUserCard(
  userId: string,
  payload: {
    name: string
    dueDay?: number
    closingDay?: number
    limitAmount?: number
    shareWithPartner?: boolean
    bankName?: string | null
    brand?: string | null
    last4?: string | null
  },
) {
  const user = await getUserOrThrow(userId)
  const visibility = await getHouseholdVisibility(userId)

  const cleanName = cleanCardDisplayName(payload.name, user.name)
  if (!cleanName) {
    badRequest('Informe o nome do cartão.')
  }

  const targetKey = resolveInvoiceCardKey(cleanName, user.name)
  const existingUserCards = await db
    .select()
    .from(cards)
    .where(and(eq(cards.userId, userId), eq(cards.isActive, true)))

  const matched = existingUserCards.find(
    (c) => resolveInvoiceCardKey(c.name, user.name) === targetKey,
  )

  const now = new Date().toISOString()

  if (matched) {
    const updates: Partial<typeof cards.$inferInsert> = { updatedAt: now }
    if (payload.dueDay !== undefined && Number.isFinite(Number(payload.dueDay))) {
      updates.dueDay = Math.min(Math.max(Math.round(Number(payload.dueDay)), 1), 31)
      if (payload.closingDay === undefined) {
        updates.closingDay = defaultClosingDayFromDueDay(updates.dueDay)
      }
    }
    if (payload.closingDay !== undefined && Number.isFinite(Number(payload.closingDay))) {
      updates.closingDay = Math.min(Math.max(Math.round(Number(payload.closingDay)), 1), 31)
    }
    if (payload.limitAmount !== undefined && Number.isFinite(Number(payload.limitAmount))) {
      updates.limitAmount = Math.max(Number(payload.limitAmount), 0)
    }
    if (payload.shareWithPartner !== undefined) {
      updates.shareWithPartner = Boolean(payload.shareWithPartner)
    }

    await db.update(cards).set(updates).where(eq(cards.id, matched.id))
    const [updated] = await db.select().from(cards).where(eq(cards.id, matched.id)).limit(1)
    const usersMap = await getPublicUsersMap([userId])
    return {
      ...updated,
      owner: usersMap.get(userId) ?? null,
      deduplicated: true,
    }
  }

  const safeDueDay =
    payload.dueDay !== undefined && Number.isFinite(Number(payload.dueDay))
      ? Math.min(Math.max(Math.round(Number(payload.dueDay)), 1), 31)
      : 10
  const safeClosingDay =
    payload.closingDay !== undefined && Number.isFinite(Number(payload.closingDay))
      ? Math.min(Math.max(Math.round(Number(payload.closingDay)), 1), 31)
      : defaultClosingDayFromDueDay(safeDueDay)
  const safeLimit =
    payload.limitAmount !== undefined && Number.isFinite(Number(payload.limitAmount))
      ? Math.max(Number(payload.limitAmount), 0)
      : 0

  const id = randomUUID()
  const newCard: typeof cards.$inferInsert = {
    id,
    name: cleanName,
    limitAmount: safeLimit,
    closingDay: safeClosingDay,
    dueDay: safeDueDay,
    bankName: payload.bankName ?? null,
    brand: payload.brand ?? null,
    last4: payload.last4 ?? null,
    isActive: true,
    shareWithPartner: Boolean(payload.shareWithPartner),
    userId,
    familyId: visibility.familyId,
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(cards).values(newCard)
  const usersMap = await getPublicUsersMap([userId])
  return {
    ...newCard,
    owner: usersMap.get(userId) ?? null,
    deduplicated: false,
  }
}

export async function findAccessibleCardForInvoice(actorUserId: string, cardId: string) {
  const visibility = await getHouseholdVisibility(actorUserId)
  const [card] = await db
    .select()
    .from(cards)
    .where(and(eq(cards.id, cardId), inArray(cards.userId, visibility.memberIds)))
    .limit(1)

  if (!card) {
    notFound('Cartão não encontrado.')
  }

  if (card.userId === actorUserId || card.shareWithPartner) {
    return card
  }

  const sharedInv = await db
    .select({ id: cardMonthlyInvoices.id })
    .from(cardMonthlyInvoices)
    .where(and(eq(cardMonthlyInvoices.cardId, cardId), eq(cardMonthlyInvoices.isShared, true)))
    .limit(1)

  if (sharedInv.length === 0) {
    notFound('Cartão não encontrado.')
  }

  return card
}

export async function upsertCardMonthlyInvoice(
  actorUserId: string,
  cardId: string,
  payload: {
    referenceMonth: string
    amount: number
    dueDay?: number
    isShared?: boolean
  },
) {
  const referenceMonth = resolveReferenceMonth(payload.referenceMonth)
  const numericAmount = Number(payload.amount)
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    badRequest('Informe um valor de fatura maior que zero.')
  }

  const card = await findAccessibleCardForInvoice(actorUserId, cardId)
  const visibility = await getHouseholdVisibility(card.userId)
  const now = new Date().toISOString()

  const [existing] = await db
    .select()
    .from(cardMonthlyInvoices)
    .where(
      and(
        eq(cardMonthlyInvoices.cardId, card.id),
        eq(cardMonthlyInvoices.referenceMonth, referenceMonth),
      ),
    )
    .limit(1)

  const nextDueDay =
    payload.dueDay !== undefined && Number.isFinite(Number(payload.dueDay))
      ? Math.min(Math.max(Math.round(Number(payload.dueDay)), 1), 31)
      : existing?.dueDay ?? card.dueDay

  const nextShared =
    payload.isShared !== undefined
      ? Boolean(payload.isShared)
      : existing
        ? Boolean(existing.isShared)
        : Boolean(card.shareWithPartner)

  if (payload.isShared === true && !card.shareWithPartner && card.userId === actorUserId) {
    await db
      .update(cards)
      .set({ shareWithPartner: true, updatedAt: now })
      .where(eq(cards.id, card.id))
  }

  if (existing) {
    await db
      .update(cardMonthlyInvoices)
      .set({
        amount: roundMoney(numericAmount),
        dueDay: nextDueDay,
        isShared: nextShared,
        familyId: card.familyId ?? visibility.familyId,
        updatedAt: now,
      })
      .where(eq(cardMonthlyInvoices.id, existing.id))

    const [updated] = await db
      .select()
      .from(cardMonthlyInvoices)
      .where(eq(cardMonthlyInvoices.id, existing.id))
      .limit(1)

    return {
      invoice: updated,
      card,
      status: existing.paidAt ? ('already_paid' as const) : ('updated' as const),
    }
  }

  const id = randomUUID()
  await db.insert(cardMonthlyInvoices).values({
    id,
    cardId: card.id,
    referenceMonth,
    amount: roundMoney(numericAmount),
    dueDay: nextDueDay,
    isShared: nextShared,
    paidAt: null,
    paidByUserId: null,
    userId: card.userId,
    familyId: card.familyId ?? visibility.familyId,
    createdAt: now,
    updatedAt: now,
  })

  const [created] = await db
    .select()
    .from(cardMonthlyInvoices)
    .where(eq(cardMonthlyInvoices.id, id))
    .limit(1)

  return {
    invoice: created,
    card,
    status: 'created' as const,
  }
}

export async function payCardMonthlyInvoice(
  actorUserId: string,
  cardId: string,
  payload: {
    referenceMonth: string
    amount?: number
    paidByUserId?: string
  },
) {
  const referenceMonth = resolveReferenceMonth(payload.referenceMonth)
  const card = await findAccessibleCardForInvoice(actorUserId, cardId)

  const payerId = payload.paidByUserId?.trim() || actorUserId
  if (payerId !== actorUserId) {
    await assertPersonInSameHousehold(actorUserId, payerId)
  }

  const [existing] = await db
    .select()
    .from(cardMonthlyInvoices)
    .where(
      and(
        eq(cardMonthlyInvoices.cardId, card.id),
        eq(cardMonthlyInvoices.referenceMonth, referenceMonth),
      ),
    )
    .limit(1)

  const now = new Date().toISOString()

  if (!existing) {
    if (payload.amount === undefined || Number(payload.amount) <= 0) {
      badRequest('Informe o valor da fatura para registrar o pagamento.')
    }
    const visibility = await getHouseholdVisibility(card.userId)
    const id = randomUUID()
    await db.insert(cardMonthlyInvoices).values({
      id,
      cardId: card.id,
      referenceMonth,
      amount: roundMoney(Number(payload.amount)),
      dueDay: card.dueDay,
      isShared: Boolean(card.shareWithPartner),
      paidAt: now,
      paidByUserId: payerId,
      userId: card.userId,
      familyId: card.familyId ?? visibility.familyId,
      createdAt: now,
      updatedAt: now,
    })
  } else {
    const updates: Partial<typeof cardMonthlyInvoices.$inferInsert> = {
      paidAt: existing.paidAt ?? now,
      paidByUserId: payerId,
      updatedAt: now,
    }
    if (payload.amount !== undefined && Number.isFinite(Number(payload.amount)) && Number(payload.amount) > 0) {
      updates.amount = roundMoney(Number(payload.amount))
    }
    await db
      .update(cardMonthlyInvoices)
      .set(updates)
      .where(eq(cardMonthlyInvoices.id, existing.id))
  }

  const usersMap = await getPublicUsersMap([payerId])
  return {
    cardId: card.id,
    referenceMonth,
    paid: true,
    paidAt: now,
    paidBy: usersMap.get(payerId) ?? null,
  }
}

export async function unpayCardMonthlyInvoice(
  actorUserId: string,
  cardId: string,
  referenceMonth: string,
) {
  const ym = resolveReferenceMonth(referenceMonth)
  const card = await findAccessibleCardForInvoice(actorUserId, cardId)

  await db
    .update(cardMonthlyInvoices)
    .set({
      paidAt: null,
      paidByUserId: null,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(cardMonthlyInvoices.cardId, card.id),
        eq(cardMonthlyInvoices.referenceMonth, ym),
      ),
    )

  return { unpaid: true }
}

export async function deleteCardMonthlyInvoice(
  actorUserId: string,
  cardId: string,
  referenceMonth: string,
) {
  const ym = resolveReferenceMonth(referenceMonth)
  const [card] = await db
    .select()
    .from(cards)
    .where(and(eq(cards.id, cardId), eq(cards.userId, actorUserId)))
    .limit(1)

  if (!card) {
    notFound('Você só pode excluir faturas dos seus próprios cartões.')
  }

  await db
    .delete(cardMonthlyInvoices)
    .where(
      and(
        eq(cardMonthlyInvoices.cardId, card.id),
        eq(cardMonthlyInvoices.referenceMonth, ym),
      ),
    )

  return { deleted: true }
}

export async function listCardsWithMonthInvoices(userId: string, month?: string) {
  const referenceMonth = resolveReferenceMonth(month)
  const visibility = await getHouseholdVisibility(userId)

  const cardRows = await db
    .select()
    .from(cards)
    .where(
      and(
        inArray(cards.userId, visibility.memberIds),
        eq(cards.isActive, true),
        visibility.partnerIds.length > 0
          ? or(eq(cards.userId, userId), eq(cards.shareWithPartner, true))!
          : eq(cards.userId, userId),
      ),
    )
    .orderBy(asc(cards.dueDay), asc(cards.name))

  const cardIds = cardRows.map((c) => c.id)

  const [invRows, analysisRows] =
    cardIds.length === 0
      ? [[], []]
      : await Promise.all([
          db
            .select()
            .from(cardMonthlyInvoices)
            .where(
              and(
                inArray(cardMonthlyInvoices.cardId, cardIds),
                eq(cardMonthlyInvoices.referenceMonth, referenceMonth),
              ),
            ),
          db
            .select({
              id: invoiceAnalyses.id,
              cardId: invoiceAnalyses.cardId,
              cardName: invoiceAnalyses.cardName,
              userId: invoiceAnalyses.userId,
              totalAmount: invoiceAnalyses.totalAmount,
              itemsCount: invoiceAnalyses.itemsCount,
            })
            .from(invoiceAnalyses)
            .where(
              and(
                inArray(invoiceAnalyses.userId, visibility.memberIds),
                eq(invoiceAnalyses.referenceMonth, referenceMonth),
              ),
            ),
        ])

  const allUserIds = [
    ...cardRows.map((c) => c.userId),
    ...invRows.map((i) => i.paidByUserId).filter(Boolean) as string[],
  ]
  const usersMap = await getPublicUsersMap(allUserIds)

  const invByCard = new Map(invRows.map((i) => [i.cardId, i]))
  const analysisByCard = new Map<string, (typeof analysisRows)[number]>()
  for (const a of analysisRows) {
    if (a.cardId) {
      analysisByCard.set(a.cardId, a)
    }
  }
  for (const c of cardRows) {
    if (analysisByCard.has(c.id)) continue
    const ownerName = usersMap.get(c.userId)?.name
    const cardKey = resolveInvoiceCardKey(c.name, ownerName)
    const fallbackMatch = analysisRows.find(
      (a) =>
        a.userId === c.userId &&
        resolveInvoiceCardKey(a.cardName, ownerName) === cardKey,
    )
    if (fallbackMatch) {
      analysisByCard.set(c.id, fallbackMatch)
    }
  }

  return cardRows
    .sort((a, b) => {
      const aMine = a.userId === userId ? 0 : 1
      const bMine = b.userId === userId ? 0 : 1
      return aMine - bMine || a.dueDay - b.dueDay || a.name.localeCompare(b.name)
    })
    .map((c) => {
      const inv = invByCard.get(c.id)
      const analysis = analysisByCard.get(c.id)
      const payerId = inv?.paidByUserId || (inv?.paidAt ? inv.userId : null)
      return {
        ...c,
        limitAmount: Number(c.limitAmount || 0),
        owner: usersMap.get(c.userId) ?? null,
        monthInvoice: inv
          ? {
              id: inv.id,
              referenceMonth: inv.referenceMonth,
              amount: roundMoney(Number(inv.amount)),
              dueDay: inv.dueDay ?? c.dueDay,
              isShared: Boolean(inv.isShared),
              paid: Boolean(inv.paidAt),
              paidAt: inv.paidAt ?? null,
              paidByUserId: payerId,
              paidBy: payerId ? usersMap.get(payerId) ?? null : null,
            }
          : null,
        analysisId: analysis?.id ?? null,
        analysisItemsCount: analysis?.itemsCount ?? 0,
        analysisTotalAmount: analysis ? roundMoney(Number(analysis.totalAmount || 0)) : null,
      }
    })
}
