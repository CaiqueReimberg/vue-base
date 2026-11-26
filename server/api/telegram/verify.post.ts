import { getRequestURL } from 'h3'
import { requireAuthUser } from '../../utils/auth'
import { assertTelegramFeatureEnabled } from '../../utils/household'
import {
  getAppBaseUrl,
  getUserTelegramSessionStatus,
  pollPendingLinkFromTelegramUpdates,
} from '../../utils/telegram'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const user = await assertTelegramFeatureEnabled(userId)

  if (!user.telegramChatId && user.telegramLinkToken) {
    const reqUrl = getRequestURL(event)
    await pollPendingLinkFromTelegramUpdates(
      user.telegramLinkToken,
      getAppBaseUrl(reqUrl.origin),
    )
  }

  return getUserTelegramSessionStatus(userId)
})
