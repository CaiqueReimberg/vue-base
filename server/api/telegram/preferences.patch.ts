import { eq } from 'drizzle-orm'
import { readBody } from 'h3'
import { db } from '../../database'
import { users } from '../../database/schema'
import { badRequest, requireAuthUser } from '../../utils/auth'
import { assertTelegramFeatureEnabled } from '../../utils/household'
import { getUserTelegramSessionStatus } from '../../utils/telegram'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const user = await assertTelegramFeatureEnabled(userId)

  const body = await readBody<{
    notifyEnabled?: boolean
    daysBefore?: number
    notifyOverdue?: boolean
    includeCouple?: boolean
  }>(event)

  if (!body || typeof body !== 'object') {
    badRequest('Informe as preferências de notificação.')
  }

  const nextNotifyEnabled =
    typeof body.notifyEnabled === 'boolean'
      ? body.notifyEnabled
      : Boolean(user.telegramNotifyEnabled)

  let nextDaysBefore = Number(user.telegramDaysBefore ?? 3)
  if (body.daysBefore !== undefined) {
    const parsed = Math.floor(Number(body.daysBefore))
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 15) {
      badRequest('A antecedência deve ser entre 0 e 15 dias.')
    }
    nextDaysBefore = parsed
  }

  const nextNotifyOverdue =
    typeof body.notifyOverdue === 'boolean'
      ? body.notifyOverdue
      : Boolean(user.telegramNotifyOverdue)

  const nextIncludeCouple =
    typeof body.includeCouple === 'boolean'
      ? body.includeCouple
      : Boolean(user.telegramIncludeCouple)

  await db
    .update(users)
    .set({
      telegramNotifyEnabled: nextNotifyEnabled,
      telegramDaysBefore: nextDaysBefore,
      telegramNotifyOverdue: nextNotifyOverdue,
      telegramIncludeCouple: nextIncludeCouple,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(users.id, userId))

  return getUserTelegramSessionStatus(userId)
})
