import { getRequestURL } from 'h3'
import { badRequest, requireAuthUser } from '../../utils/auth'
import { assertTelegramFeatureEnabled } from '../../utils/household'
import {
  buildDigestShortSummary,
  buildUserDueDigest,
  formatDigestTelegramHtml,
  getAppBaseUrl,
  getTelegramBotToken,
  getUserTelegramSessionStatus,
  recordTelegramLog,
  sendTelegramHtmlMessage,
} from '../../utils/telegram'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const user = await assertTelegramFeatureEnabled(userId)

  if (!getTelegramBotToken()) {
    badRequest('O TELEGRAM_BOT_TOKEN ainda não está configurado no servidor.')
  }

  if (!user.telegramChatId) {
    badRequest('Conecte primeiro o seu Telegram antes de enviar um aviso de teste.')
  }

  const reqUrl = getRequestURL(event)
  const digest = await buildUserDueDigest(userId)
  const html = formatDigestTelegramHtml(user.name, digest, {
    isTest: true,
    daysBefore: user.telegramDaysBefore,
    appUrl: getAppBaseUrl(reqUrl.origin),
  })

  try {
    await sendTelegramHtmlMessage(String(user.telegramChatId), html)
    await recordTelegramLog({
      userId,
      kind: 'test',
      referenceDate: digest.referenceDate,
      itemsCount: digest.totalAllCount,
      status: 'sent',
      summary: buildDigestShortSummary(digest),
    })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Falha ao enviar mensagem no Telegram'
    await recordTelegramLog({
      userId,
      kind: 'test',
      referenceDate: digest.referenceDate,
      itemsCount: 0,
      status: 'failed',
      errorMessage: errMsg.slice(0, 240),
    }).catch(() => undefined)

    throw createError({
      statusCode: 502,
      statusMessage: errMsg,
      data: { message: errMsg },
    })
  }

  return getUserTelegramSessionStatus(userId)
})
