import { getRequestURL } from 'h3'
import { badRequest, requireAuthUser } from '../../utils/auth'
import { assertTelegramFeatureEnabled } from '../../utils/household'
import {
  ensureTelegramWebhookRegistered,
  fetchTelegramBotMeta,
  generateUserTelegramLinkToken,
  getAppBaseUrl,
  getTelegramBotToken,
} from '../../utils/telegram'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  await assertTelegramFeatureEnabled(userId)

  if (!getTelegramBotToken()) {
    badRequest('Configure primeiro a variável TELEGRAM_BOT_TOKEN no servidor.')
  }

  const botMeta = await fetchTelegramBotMeta()
  if (!botMeta?.username) {
    badRequest(
      'Não foi possível identificar o username do Bot no Telegram. Verifique o TELEGRAM_BOT_TOKEN.',
    )
  }

  const reqUrl = getRequestURL(event)
  const publicBase = getAppBaseUrl(reqUrl.origin)
  if (publicBase.startsWith('https://')) {
    await ensureTelegramWebhookRegistered(publicBase).catch(() => undefined)
  }

  const { token, expiresAt } = await generateUserTelegramLinkToken(userId)

  return {
    deepLink: `https://t.me/${botMeta.username}?start=${token}`,
    botUsername: botMeta.username,
    botName: botMeta.firstName,
    token,
    startCommand: `/start ${token}`,
    expiresAt,
  }
})
