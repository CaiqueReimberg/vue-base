import { getHeader, getQuery, getRequestURL } from 'h3'
import {
  getAppBaseUrl,
  runDailyTelegramCronReminders,
  verifyCronAuthorization,
} from '../../utils/telegram'

export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, 'authorization')
  if (!verifyCronAuthorization(authHeader)) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Execução de cron não autorizada.',
      data: { message: 'Execução de cron não autorizada.' },
    })
  }

  const query = getQuery(event)
  const force = query.force === '1' || query.force === 'true'
  const reqUrl = getRequestURL(event)

  return runDailyTelegramCronReminders({
    force,
    appBaseUrl: getAppBaseUrl(reqUrl.origin),
  })
})
