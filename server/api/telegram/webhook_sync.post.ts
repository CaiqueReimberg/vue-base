import { getRequestURL } from 'h3'
import { badRequest, requireAuthUser } from '../../utils/auth'
import { assertAdminUser } from '../../utils/household'
import {
  ensureTelegramWebhookRegistered,
  getAppBaseUrl,
  getTelegramBotToken,
  getUserTelegramSessionStatus,
} from '../../utils/telegram'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  await assertAdminUser(userId)

  if (!getTelegramBotToken()) {
    badRequest('Configure o TELEGRAM_BOT_TOKEN antes de registrar o webhook.')
  }

  const reqUrl = getRequestURL(event)
  const publicBase = getAppBaseUrl(reqUrl.origin)
  const res = await ensureTelegramWebhookRegistered(publicBase)

  if (!res.ok) {
    badRequest(res.error || 'Não foi possível registrar o webhook.')
  }

  return getUserTelegramSessionStatus(userId)
})
