import { readBody } from 'h3'
import { badRequest, requireAuthUser } from '../../../utils/auth'
import { createTransactionByType } from '../../../utils/transactions'

function splitTotalCents(total: number, parts: number): number[] {
  const base = Math.floor(total / parts)
  const rem = total % parts
  const out: number[] = []
  for (let i = 0; i < parts; i++) {
    out.push(base + (i < rem ? 1 : 0))
  }
  return out
}

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const dto = await readBody<{
    installmentTotal: number
    amount: number
    description: string
    occurredAt: string
    accountId?: string
    cardId?: string
    categoryId?: string
    familyId?: string
    isShared?: boolean
  }>(event)

  if (!dto.accountId && !dto.cardId) {
    badRequest('Informe accountId ou cardId na transação')
  }
  if (dto.accountId && dto.cardId) {
    badRequest('Informe apenas accountId ou cardId, não ambos')
  }

  const installmentTotal = Math.max(Number(dto.installmentTotal || 1), 1)
  const totalCents = Math.round(Number(dto.amount) * 100)
  const parcelCents = splitTotalCents(totalCents, installmentTotal)
  const baseDesc = dto.description.trim()
  const results = []
  const baseDate = new Date(dto.occurredAt)

  for (let i = 0; i < installmentTotal; i++) {
    const parcelDate = new Date(baseDate)
    parcelDate.setUTCMonth(parcelDate.getUTCMonth() + i)
    const parcelAmount = parcelCents[i] / 100
    const created = await createTransactionByType(
      userId,
      {
        accountId: dto.accountId,
        cardId: dto.cardId,
        categoryId: dto.categoryId,
        familyId: dto.familyId,
        amount: parcelAmount,
        description: `${baseDesc} (${i + 1}/${installmentTotal})`,
        occurredAt: parcelDate.toISOString(),
        installmentNumber: i + 1,
        installmentTotal,
        isShared: dto.isShared,
      },
      'expense'
    )
    results.push(created)
  }

  return results
})
