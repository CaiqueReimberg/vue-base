import { eq } from 'drizzle-orm'
import { db } from '../../database'
import { users } from '../../database/schema'
import { requireAuthUser } from '../../utils/auth'
import { assertTelegramFeatureEnabled } from '../../utils/household'
import { getUserTelegramSessionStatus } from '../../utils/telegram'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  await assertTelegramFeatureEnabled(userId)

  await db
    .update(users)
    .set({
      telegramChatId: null,
      telegramUsername: null,
      telegramLinkedAt: null,
      telegramLinkToken: null,
      telegramLinkTokenExpiresAt: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(users.id, userId))

  return getUserTelegramSessionStatus(userId)
})
