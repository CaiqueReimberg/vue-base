import { getHeader, getRequestURL, readBody } from 'h3'
import {
  getAppBaseUrl,
  type IncomingTelegramMessage,
  processIncomingTelegramMessage,
  verifyTelegramWebhookSecret,
} from '../../utils/telegram'

export default defineEventHandler(async (event) => {
  const headerSecret = getHeader(event, 'x-telegram-bot-api-secret-token')
  if (!verifyTelegramWebhookSecret(headerSecret)) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Webhook não autorizado.',
      data: { message: 'Webhook não autorizado.' },
    })
  }

  const body = await readBody<{
    update_id?: number
    message?: IncomingTelegramMessage
  }>(event).catch(() => null)

  if (body?.message) {
    const reqUrl = getRequestURL(event)
    try {
      await processIncomingTelegramMessage(body.message, getAppBaseUrl(reqUrl.origin))
    } catch (err) {
      console.error(
        '[DuoPact Telegram Webhook] Erro ao processar update:',
        err instanceof Error ? err.message : err,
      )
    }
  }

  return { ok: true }
})
