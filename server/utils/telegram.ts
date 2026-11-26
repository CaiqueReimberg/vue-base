import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { and, desc, eq, inArray, isNotNull, or } from 'drizzle-orm'
import { db } from '../database'
import { telegramNotificationLogs, transactions, users } from '../database/schema'
import { formatReferenceMonth, parseReferenceMonth, roundMoney } from './billing'
import { getAgenda } from './dashboard'
import {
  getHouseholdVisibility,
  getPublicUsersMap,
  getSystemFeatureFlagsMap,
  getUserOrThrow,
} from './household'

export interface TelegramBotMetadata {
  id: number
  username: string
  firstName: string
}

export interface TelegramDueReminderItem {
  id: string
  name: string
  categoryLabel: string
  amount: number
  dueDate: string // YYYY-MM-DD
  dueDay: number
  dueMonth: number
  daysUntilDue: number // < 0 atrasado, 0 hoje, > 0 próximos dias
  isShared: boolean
  isOwn: boolean
  ownerName: string | null
}

export interface UserDueDigest {
  referenceDate: string // YYYY-MM-DD (America/Sao_Paulo)
  overdue: TelegramDueReminderItem[]
  dueToday: TelegramDueReminderItem[]
  upcoming: TelegramDueReminderItem[]
  coupleItems: TelegramDueReminderItem[]
  totalOwnCount: number
  totalOwnAmount: number
  totalAllCount: number
}

let cachedBotMeta: { token: string; meta: TelegramBotMetadata; expiresAt: number } | null = null

export function getTelegramBotToken(): string {
  const runtime = useRuntimeConfig()
  return (process.env.TELEGRAM_BOT_TOKEN || runtime.telegramBotToken || '').trim()
}

export function getConfiguredBotUsername(): string {
  const runtime = useRuntimeConfig()
  return (process.env.TELEGRAM_BOT_USERNAME || runtime.telegramBotUsername || '')
    .trim()
    .replace(/^@+/, '')
}

export function getCronSecret(): string {
  const runtime = useRuntimeConfig()
  return (process.env.CRON_SECRET || runtime.cronSecret || '').trim()
}

export function getAppBaseUrl(requestOrigin?: string): string {
  const runtime = useRuntimeConfig()
  const envUrl = (process.env.APP_BASE_URL || runtime.appBaseUrl || '').trim().replace(/\/+$/, '')
  if (envUrl) return envUrl
  if (requestOrigin) return requestOrigin.replace(/\/+$/, '')
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return ''
}

export function getTelegramWebhookSecret(): string {
  const runtime = useRuntimeConfig()
  const explicit = (process.env.TELEGRAM_WEBHOOK_SECRET || runtime.telegramWebhookSecret || '').trim()
  if (explicit) return explicit.slice(0, 128)

  const token = getTelegramBotToken()
  const jwt = process.env.JWT_SECRET || runtime.jwtSecret || 'dualpact'
  return createHmac('sha256', jwt).update(`telegram-webhook:${token}`).digest('hex').slice(0, 48)
}

export function verifyTelegramWebhookSecret(headerSecret: string | undefined | null): boolean {
  if (!headerSecret) return false
  const expected = getTelegramWebhookSecret()
  if (!expected || headerSecret.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(headerSecret), Buffer.from(expected))
  } catch {
    return false
  }
}

export function verifyCronAuthorization(authHeader: string | undefined | null): boolean {
  const secret = getCronSecret()
  if (!secret) {
    // Em ambiente local sem CRON_SECRET configurado, permite teste local
    return process.env.NODE_ENV !== 'production' && !process.env.VERCEL
  }
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false
  const provided = authHeader.slice('Bearer '.length).trim()
  if (provided.length !== secret.length) return false
  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(secret))
  } catch {
    return false
  }
}

async function telegramApiRequest<T>(
  method: string,
  payload?: Record<string, unknown>,
): Promise<T> {
  const token = getTelegramBotToken()
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN não configurado no servidor.')
  }

  const url = `https://api.telegram.org/bot${token}/${method}`
  const response = await fetch(url, {
    method: payload ? 'POST' : 'GET',
    headers: payload ? { 'Content-Type': 'application/json' } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
    signal: AbortSignal.timeout(10_000),
  })

  const data = (await response.json().catch(() => null)) as {
    ok?: boolean
    result?: T
    description?: string
    error_code?: number
  } | null

  if (!response.ok || !data?.ok) {
    const descMsg = data?.description || `HTTP ${response.status}`
    const err = new Error(`Telegram API (${method}): ${descMsg}`) as Error & { code?: number }
    err.code = data?.error_code ?? response.status
    throw err
  }

  return data.result as T
}

export async function fetchTelegramBotMeta(): Promise<TelegramBotMetadata | null> {
  const token = getTelegramBotToken()
  if (!token) return null

  const now = Date.now()
  if (cachedBotMeta && cachedBotMeta.token === token && cachedBotMeta.expiresAt > now) {
    return cachedBotMeta.meta
  }

  try {
    const me = await telegramApiRequest<{
      id: number
      username?: string
      first_name?: string
    }>('getMe')

    const meta: TelegramBotMetadata = {
      id: me.id,
      username: me.username || getConfiguredBotUsername(),
      firstName: me.first_name || 'DuoPact Bot',
    }
    cachedBotMeta = {
      token,
      meta,
      expiresAt: now + 10 * 60 * 1000,
    }
    return meta
  } catch (err) {
    console.error('[DuoPact Telegram] Erro ao consultar getMe:', err instanceof Error ? err.message : err)
    const fallbackUsername = getConfiguredBotUsername()
    if (fallbackUsername) {
      return { id: 0, username: fallbackUsername, firstName: 'DuoPact Bot' }
    }
    return null
  }
}

export async function getTelegramWebhookStatus(): Promise<{
  active: boolean
  url: string | null
  pendingUpdateCount: number
  lastErrorMessage: string | null
}> {
  const token = getTelegramBotToken()
  if (!token) {
    return { active: false, url: null, pendingUpdateCount: 0, lastErrorMessage: null }
  }

  try {
    const info = await telegramApiRequest<{
      url?: string
      pending_update_count?: number
      last_error_message?: string
    }>('getWebhookInfo')

    const url = info.url ? info.url.trim() : ''
    return {
      active: Boolean(url),
      url: url || null,
      pendingUpdateCount: Number(info.pending_update_count || 0),
      lastErrorMessage: info.last_error_message || null,
    }
  } catch {
    return { active: false, url: null, pendingUpdateCount: 0, lastErrorMessage: null }
  }
}

export async function ensureTelegramWebhookRegistered(publicBaseUrl: string): Promise<{
  ok: boolean
  webhookUrl: string | null
  error?: string
}> {
  const cleanBase = publicBaseUrl.trim().replace(/\/+$/, '')
  if (
    !cleanBase.startsWith('https://') ||
    cleanBase.includes('localhost') ||
    cleanBase.includes('127.0.0.1')
  ) {
    return { ok: false, webhookUrl: null, error: 'Webhook exige URL HTTPS pública.' }
  }

  const targetUrl = `${cleanBase}/api/telegram/webhook`
  try {
    const current = await getTelegramWebhookStatus()
    if (current.url === targetUrl) {
      return { ok: true, webhookUrl: targetUrl }
    }

    await telegramApiRequest<boolean>('setWebhook', {
      url: targetUrl,
      secret_token: getTelegramWebhookSecret(),
      allowed_updates: ['message'],
    })

    return { ok: true, webhookUrl: targetUrl }
  } catch (err) {
    return {
      ok: false,
      webhookUrl: null,
      error: err instanceof Error ? err.message : 'Falha ao registrar webhook no Telegram.',
    }
  }
}

export async function sendTelegramHtmlMessage(chatId: string, htmlText: string): Promise<void> {
  await telegramApiRequest('sendMessage', {
    chat_id: chatId,
    text: htmlText,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  })
}

export function escapeTelegramHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function formatMoneyBrl(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0))
}

export function getBrazilTodayParts(now = new Date()): {
  dateStr: string // YYYY-MM-DD
  year: number
  month: number // 1..12
  day: number // 1..31
  referenceMonth: string // YYYY-MM
} {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const dateStr = formatter.format(now)
  const [yStr, mStr, dStr] = dateStr.split('-')
  const year = Number(yStr)
  const month = Number(mStr)
  const day = Number(dStr)
  const referenceMonth = `${yStr}-${mStr}`
  return { dateStr, year, month, day, referenceMonth }
}

function clampDayInMonth(year: number, month1to12: number, rawDay: number): number {
  const lastDay = new Date(Date.UTC(year, month1to12, 0)).getUTCDate()
  return Math.min(Math.max(Math.floor(rawDay), 1), lastDay)
}

function diffDaysUtc(fromYmd: string, toYmd: string): number {
  const [fy, fm, fd] = fromYmd.split('-').map(Number)
  const [ty, tm, td] = toYmd.split('-').map(Number)
  const fromMs = Date.UTC(fy, fm - 1, fd)
  const toMs = Date.UTC(ty, tm - 1, td)
  return Math.round((toMs - fromMs) / 86_400_000)
}

function shiftMonthYm(ym: string, delta: number): string {
  const { year, monthIndex } = parseReferenceMonth(ym)
  return formatReferenceMonth(new Date(Date.UTC(year, monthIndex + delta, 1)))
}

async function collectPendingMonthItems(
  userId: string,
  ym: string,
  todayStr: string,
): Promise<TelegramDueReminderItem[]> {
  const [y, m] = ym.split('-').map(Number)
  const visibility = await getHouseholdVisibility(userId)
  const hasPartner = visibility.partnerIds.length > 0

  const [agenda, standaloneRows, usersMap] = await Promise.all([
    getAgenda(userId, ym),
    db
      .select()
      .from(transactions)
      .where(
        and(
          inArray(transactions.userId, visibility.memberIds),
          eq(transactions.type, 'expense'),
          isNotNull(transactions.dueDate),
          hasPartner
            ? or(
                eq(transactions.userId, userId),
                and(
                  inArray(transactions.userId, visibility.partnerIds),
                  eq(transactions.isShared, true),
                ),
              )!
            : eq(transactions.userId, userId),
        ),
      ),
    getPublicUsersMap(visibility.memberIds),
  ])

  const items: TelegramDueReminderItem[] = []

  for (const ev of agenda.events) {
    if (ev.paid || ev.day == null || !ev.value || ev.value <= 0) continue
    if (ev.type === 'invoice_close') continue

    const effectiveDay = clampDayInMonth(y, m, ev.day)
    const dueDate = `${ym}-${String(effectiveDay).padStart(2, '0')}`
    const daysUntilDue = diffDaysUtc(todayStr, dueDate)
    const ownerId = ev.ownerId || userId
    const isOwn = ownerId === userId
    const ownerPub = usersMap.get(ownerId)
    const ownerName = ownerPub?.name || ownerPub?.email?.split('@')[0] || null

    const categoryLabel =
      ev.type === 'invoice_due'
        ? 'Cartão'
        : ev.type === 'debt_due'
          ? 'Parcela'
          : 'Conta fixa'

    items.push({
      id: `${ev.type}:${ev.referenceId}:${ym}`,
      name: ev.name,
      categoryLabel,
      amount: roundMoney(ev.value),
      dueDate,
      dueDay: effectiveDay,
      dueMonth: m,
      daysUntilDue,
      isShared: Boolean(ev.isShared),
      isOwn,
      ownerName,
    })
  }

  for (const tx of standaloneRows) {
    if (tx.cardId || tx.kind === 'debt' || tx.kind === 'invoice_payment') continue
    if (tx.status === 'paid' || tx.status === 'cleared' || Boolean(tx.paidAt)) continue
    if (!tx.dueDate) continue

    const dueSlice = String(tx.dueDate).slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueSlice)) continue
    if (dueSlice.slice(0, 7) !== ym) continue

    const [, dm, dd] = dueSlice.split('-').map(Number)
    const daysUntilDue = diffDaysUtc(todayStr, dueSlice)
    const isOwn = tx.userId === userId
    const ownerPub = usersMap.get(tx.userId)
    const ownerName = ownerPub?.name || ownerPub?.email?.split('@')[0] || null

    items.push({
      id: `tx:${tx.id}:${ym}`,
      name: tx.description,
      categoryLabel: 'Avulsa',
      amount: roundMoney(Number(tx.amount)),
      dueDate: dueSlice,
      dueDay: dd,
      dueMonth: dm,
      daysUntilDue,
      isShared: Boolean(tx.isShared),
      isOwn,
      ownerName,
    })
  }

  items.sort((a, b) => a.daysUntilDue - b.daysUntilDue || b.amount - a.amount)
  return items
}

export async function buildUserDueDigest(
  userId: string,
  options?: {
    daysBefore?: number
    notifyOverdue?: boolean
    includeCouple?: boolean
    now?: Date
  },
): Promise<UserDueDigest> {
  const user = await getUserOrThrow(userId)
  const daysBefore = Math.min(
    Math.max(options?.daysBefore ?? Number(user.telegramDaysBefore ?? 3), 0),
    15,
  )
  const notifyOverdue = options?.notifyOverdue ?? Boolean(user.telegramNotifyOverdue)
  const includeCouple = options?.includeCouple ?? Boolean(user.telegramIncludeCouple)

  const { dateStr, year, month, day, referenceMonth } = getBrazilTodayParts(options?.now)
  const lastDayOfCurrentMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const crossesNextMonth = day + daysBefore > lastDayOfCurrentMonth

  const monthsToQuery = crossesNextMonth
    ? [referenceMonth, shiftMonthYm(referenceMonth, 1)]
    : [referenceMonth]

  const allCollected = (
    await Promise.all(monthsToQuery.map((ym) => collectPendingMonthItems(userId, ym, dateStr)))
  ).flat()

  const overdue: TelegramDueReminderItem[] = []
  const dueToday: TelegramDueReminderItem[] = []
  const upcoming: TelegramDueReminderItem[] = []
  const coupleItems: TelegramDueReminderItem[] = []

  for (const item of allCollected) {
    if (item.isOwn) {
      if (item.daysUntilDue < 0) {
        if (notifyOverdue && item.dueDate.slice(0, 7) === referenceMonth) {
          overdue.push(item)
        }
      } else if (item.daysUntilDue === 0) {
        dueToday.push(item)
      } else if (item.daysUntilDue <= daysBefore) {
        upcoming.push(item)
      }
    } else if (item.isShared && includeCouple) {
      const inRange =
        (item.daysUntilDue >= 0 && item.daysUntilDue <= daysBefore) ||
        (notifyOverdue && item.daysUntilDue < 0 && item.dueDate.slice(0, 7) === referenceMonth)
      if (inRange) {
        coupleItems.push(item)
      }
    }
  }

  const totalOwnCount = overdue.length + dueToday.length + upcoming.length
  const totalOwnAmount = roundMoney(
    [...overdue, ...dueToday, ...upcoming].reduce((s, i) => s + i.amount, 0),
  )

  return {
    referenceDate: dateStr,
    overdue,
    dueToday,
    upcoming,
    coupleItems,
    totalOwnCount,
    totalOwnAmount,
    totalAllCount: totalOwnCount + coupleItems.length,
  }
}

function formatDueBadge(item: TelegramDueReminderItem): string {
  const dayMonth = `${String(item.dueDay).padStart(2, '0')}/${String(item.dueMonth).padStart(2, '0')}`
  if (item.daysUntilDue < 0) {
    const d = Math.abs(item.daysUntilDue)
    return `venceu em ${dayMonth} (${d} ${d === 1 ? 'dia' : 'dias'})`
  }
  if (item.daysUntilDue === 0) {
    return `vence hoje (${dayMonth})`
  }
  if (item.daysUntilDue === 1) {
    return `amanhã (${dayMonth})`
  }
  return `em ${item.daysUntilDue} dias (${dayMonth})`
}

export function formatDigestTelegramHtml(
  userName: string | null,
  digest: UserDueDigest,
  options?: { isTest?: boolean; daysBefore?: number; appUrl?: string },
): string {
  const firstName = userName ? escapeTelegramHtml(userName.split(' ')[0]) : 'por aí'
  const lines: string[] = []

  if (options?.isTest) {
    lines.push(`🔔 <b>Teste de aviso do DuoPact</b>`)
  } else {
    lines.push(`💚 <b>Resumo de vencimentos · DuoPact</b>`)
  }

  if (digest.totalAllCount === 0) {
    const windowLabel =
      (options?.daysBefore ?? 3) === 0
        ? 'para hoje'
        : `para os próximos ${options?.daysBefore ?? 3} dias`
    lines.push('')
    lines.push(`Olá, <b>${firstName}</b>! Tudo em dia por aqui ✅`)
    lines.push(`Você não possui contas pendentes ${windowLabel}.`)
    if (options?.appUrl) {
      lines.push('')
      lines.push(`🔗 <a href="${escapeTelegramHtml(options.appUrl)}">Abrir DuoPact</a>`)
    }
    return lines.join('\n')
  }

  lines.push(`Olá, <b>${firstName}</b>! Confira o que pede atenção:`)

  if (digest.dueToday.length > 0) {
    lines.push('')
    lines.push(`⏰ <b>Vencendo hoje (${digest.dueToday.length})</b>`)
    for (const item of digest.dueToday) {
      const sharedTag = item.isShared ? ' · Casal' : ''
      lines.push(
        `• <b>${escapeTelegramHtml(item.name)}</b>: ${formatMoneyBrl(item.amount)} <i>(${item.categoryLabel}${sharedTag})</i>`,
      )
    }
  }

  if (digest.overdue.length > 0) {
    lines.push('')
    lines.push(`⚠️ <b>Em atraso no mês (${digest.overdue.length})</b>`)
    for (const item of digest.overdue) {
      lines.push(
        `• <b>${escapeTelegramHtml(item.name)}</b>: ${formatMoneyBrl(item.amount)} · <i>${formatDueBadge(item)}</i>`,
      )
    }
  }

  if (digest.upcoming.length > 0) {
    lines.push('')
    lines.push(`📅 <b>Próximos dias (${digest.upcoming.length})</b>`)
    for (const item of digest.upcoming) {
      lines.push(
        `• <b>${escapeTelegramHtml(item.name)}</b>: ${formatMoneyBrl(item.amount)} · <i>${formatDueBadge(item)}</i>`,
      )
    }
  }

  if (digest.totalOwnCount > 0) {
    lines.push('')
    lines.push(`💰 <b>Total das suas pendências no aviso:</b> ${formatMoneyBrl(digest.totalOwnAmount)}`)
  }

  if (digest.coupleItems.length > 0) {
    lines.push('')
    lines.push(`👥 <b>Visão do casal (adicionadas pelo par)</b>`)
    for (const item of digest.coupleItems) {
      const ownerPart = item.ownerName ? `de ${escapeTelegramHtml(item.ownerName)} · ` : ''
      lines.push(
        `• ${escapeTelegramHtml(item.name)}: ${formatMoneyBrl(item.amount)} · <i>${ownerPart}${formatDueBadge(item)}</i>`,
      )
    }
  }

  if (options?.appUrl) {
    lines.push('')
    lines.push(`🔗 <a href="${escapeTelegramHtml(options.appUrl)}">Abrir DuoPact para dar baixa</a>`)
  }

  return lines.join('\n')
}

export function buildDigestShortSummary(digest: UserDueDigest): string {
  const parts: string[] = []
  if (digest.dueToday.length > 0) parts.push(`${digest.dueToday.length} hoje`)
  if (digest.overdue.length > 0) parts.push(`${digest.overdue.length} em atraso`)
  if (digest.upcoming.length > 0) parts.push(`${digest.upcoming.length} nos próximos dias`)
  if (digest.coupleItems.length > 0) parts.push(`${digest.coupleItems.length} do casal`)
  return parts.length > 0 ? parts.join(', ') : 'Nenhuma conta pendente na janela'
}

export async function recordTelegramLog(params: {
  userId: string
  kind: 'cron' | 'test' | 'welcome'
  referenceDate: string
  itemsCount: number
  status: 'sent' | 'skipped' | 'failed'
  summary?: string | null
  errorMessage?: string | null
}) {
  await db.insert(telegramNotificationLogs).values({
    id: randomUUID(),
    userId: params.userId,
    kind: params.kind,
    referenceDate: params.referenceDate,
    itemsCount: params.itemsCount,
    status: params.status,
    summary: params.summary ?? null,
    errorMessage: params.errorMessage ?? null,
    createdAt: new Date().toISOString(),
  })
}

export async function generateUserTelegramLinkToken(userId: string): Promise<{
  token: string
  expiresAt: string
}> {
  const token = randomBytes(12).toString('hex')
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
  const now = new Date().toISOString()

  await db
    .update(users)
    .set({
      telegramLinkToken: token,
      telegramLinkTokenExpiresAt: expiresAt,
      updatedAt: now,
    })
    .where(eq(users.id, userId))

  return { token, expiresAt }
}

export async function completeTelegramLinkByToken(params: {
  token: string
  chatId: string
  username?: string | null
  firstName?: string | null
}): Promise<{
  linked: boolean
  userName: string | null
  reason?: string
}> {
  const cleanToken = params.token.trim()
  if (!cleanToken) {
    return { linked: false, userName: null, reason: 'invalid_token' }
  }

  const [matched] = await db
    .select()
    .from(users)
    .where(eq(users.telegramLinkToken, cleanToken))
    .limit(1)

  if (!matched) {
    return { linked: false, userName: null, reason: 'not_found' }
  }

  if (
    matched.telegramLinkTokenExpiresAt &&
    new Date(matched.telegramLinkTokenExpiresAt).getTime() < Date.now()
  ) {
    return { linked: false, userName: null, reason: 'expired' }
  }

  const displayHandle = params.username
    ? `@${params.username.replace(/^@+/, '')}`
    : params.firstName?.trim() || 'Telegram conectado'

  const now = new Date().toISOString()
  const { dateStr } = getBrazilTodayParts()

  await db
    .update(users)
    .set({
      telegramChatId: String(params.chatId),
      telegramUsername: displayHandle,
      telegramLinkedAt: now,
      telegramLinkToken: null,
      telegramLinkTokenExpiresAt: null,
      telegramNotifyEnabled: true,
      updatedAt: now,
    })
    .where(eq(users.id, matched.id))

  await recordTelegramLog({
    userId: matched.id,
    kind: 'welcome',
    referenceDate: dateStr,
    itemsCount: 0,
    status: 'sent',
    summary: `Conta vinculada a ${displayHandle}`,
  })

  return {
    linked: true,
    userName: matched.name || matched.email.split('@')[0],
  }
}

export interface IncomingTelegramMessage {
  chat?: { id?: number | string; type?: string }
  from?: { username?: string; first_name?: string }
  text?: string
}

export async function processIncomingTelegramMessage(
  msg: IncomingTelegramMessage,
  appBaseUrl?: string,
): Promise<boolean> {
  const chatId = msg.chat?.id != null ? String(msg.chat.id) : ''
  const rawText = (msg.text || '').trim()
  if (!chatId || !rawText) return false

  // 1. Comando /start <token>
  if (rawText.startsWith('/start')) {
    const parts = rawText.split(/\s+/)
    const startParam = parts[1]?.trim() || ''

    if (!startParam) {
      await sendTelegramHtmlMessage(
        chatId,
        [
          `💚 <b>Olá! Eu sou o bot de avisos do DuoPact.</b>`,
          ``,
          `Para conectar sua conta, abra o DuoPact, entre em <b>Avisos no Telegram</b> no menu lateral e clique em <b>Conectar Telegram</b>.`,
        ].join('\n'),
      )
      return true
    }

    const result = await completeTelegramLinkByToken({
      token: startParam,
      chatId,
      username: msg.from?.username ?? null,
      firstName: msg.from?.first_name ?? null,
    })

    if (result.linked) {
      const greeting = result.userName ? `, <b>${escapeTelegramHtml(result.userName)}</b>` : ''
      await sendTelegramHtmlMessage(
        chatId,
        [
          `✅ <b>Telegram conectado ao DuoPact!</b>`,
          ``,
          `Tudo certo${greeting}! A partir de agora você receberá seus lembretes de vencimento por aqui.`,
          ``,
          `<b>Comandos rápidos a qualquer momento:</b>`,
          `• /hoje · ver suas pendências de vencimento agora`,
          `• /parar · pausar avisos diários automáticos`,
          `• /ativar · reativar avisos diários automáticos`,
        ].join('\n'),
      )
      return true
    }

    await sendTelegramHtmlMessage(
      chatId,
      [
        `⚠️ <b>Código de vínculo inválido ou expirado.</b>`,
        ``,
        `Volte na tela <b>Avisos no Telegram</b> dentro do DuoPact e clique novamente em <b>Conectar Telegram</b> para gerar um novo link.`,
      ].join('\n'),
    )
    return true
  }

  // Demais comandos para quem já está conectado
  const [linkedUser] = await db
    .select()
    .from(users)
    .where(eq(users.telegramChatId, chatId))
    .limit(1)

  if (!linkedUser) {
    await sendTelegramHtmlMessage(
      chatId,
      `Para usar este comando, conecte sua conta primeiro na sessão <b>Avisos no Telegram</b> dentro do DuoPact.`,
    )
    return true
  }

  const command = rawText.split(/\s+/)[0].toLowerCase().split('@')[0]

  if (command === '/parar') {
    await db
      .update(users)
      .set({ telegramNotifyEnabled: false, updatedAt: new Date().toISOString() })
      .where(eq(users.id, linkedUser.id))
    await sendTelegramHtmlMessage(
      chatId,
      `⏸️ <b>Avisos diários pausados.</b>\nQuando quiser voltar a receber, envie /ativar ou ative novamente no DuoPact.`,
    )
    return true
  }

  if (command === '/ativar') {
    await db
      .update(users)
      .set({ telegramNotifyEnabled: true, updatedAt: new Date().toISOString() })
      .where(eq(users.id, linkedUser.id))
    await sendTelegramHtmlMessage(
      chatId,
      `🔔 <b>Avisos diários reativados!</b>\nVocê voltará a receber seus lembretes normalmente pela manhã.`,
    )
    return true
  }

  if (command === '/hoje' || command === '/resumo' || command === '/vencimentos') {
    const flags = await getSystemFeatureFlagsMap()
    if (flags.telegram === false || (!linkedUser.telegramEnabled && !linkedUser.isAdmin)) {
      await sendTelegramHtmlMessage(
        chatId,
        `🔒 O módulo de avisos no Telegram está desativado para sua conta no momento.`,
      )
      return true
    }

    const digest = await buildUserDueDigest(linkedUser.id)
    const html = formatDigestTelegramHtml(linkedUser.name, digest, {
      daysBefore: linkedUser.telegramDaysBefore,
      appUrl: appBaseUrl || getAppBaseUrl(),
    })
    await sendTelegramHtmlMessage(chatId, html)
    return true
  }

  return false
}

/**
 * Usado em ambiente sem webhook público (ex.: localhost) quando o usuário clica
 * em "Verificar vínculo" após enviar /start no app do Telegram.
 */
export async function pollPendingLinkFromTelegramUpdates(
  expectedToken: string,
  appBaseUrl?: string,
): Promise<boolean> {
  const token = getTelegramBotToken()
  if (!token || !expectedToken) return false

  const webhook = await getTelegramWebhookStatus()
  if (webhook.active) {
    // Com webhook ativo, o próprio webhook já processa o /start em tempo real
    return false
  }

  try {
    const updates = await telegramApiRequest<
      Array<{
        update_id: number
        message?: IncomingTelegramMessage
      }>
    >('getUpdates', {
      limit: 30,
      timeout: 0,
      allowed_updates: ['message'],
    })

    let matched = false
    let maxUpdateId = 0

    for (const upd of updates) {
      if (upd.update_id > maxUpdateId) maxUpdateId = upd.update_id
      const text = (upd.message?.text || '').trim()
      if (text === `/start ${expectedToken}`) {
        await processIncomingTelegramMessage(upd.message!, appBaseUrl)
        matched = true
      }
    }

    if (matched && maxUpdateId > 0) {
      // Confirma offset no Telegram para não reprocessar as mesmas mensagens depois
      await telegramApiRequest('getUpdates', { offset: maxUpdateId + 1, limit: 1, timeout: 0 }).catch(
        () => undefined,
      )
    }

    return matched
  } catch (err) {
    console.warn(
      '[DuoPact Telegram] Não foi possível consultar getUpdates:',
      err instanceof Error ? err.message : err,
    )
    return false
  }
}

function maskChatId(chatId: string | null | undefined): string | null {
  if (!chatId) return null
  const clean = String(chatId)
  if (clean.length <= 4) return clean
  return `•••${clean.slice(-4)}`
}

export async function getUserTelegramSessionStatus(userId: string) {
  const user = await getUserOrThrow(userId)
  const botToken = getTelegramBotToken()
  const botMeta = botToken ? await fetchTelegramBotMeta() : null
  const webhook = botToken ? await getTelegramWebhookStatus() : null

  const hasValidPendingToken = Boolean(
    user.telegramLinkToken &&
      (!user.telegramLinkTokenExpiresAt ||
        new Date(user.telegramLinkTokenExpiresAt).getTime() > Date.now()),
  )

  const pendingToken = hasValidPendingToken ? user.telegramLinkToken : null
  const pendingLinkUrl =
    pendingToken && botMeta?.username
      ? `https://t.me/${botMeta.username}?start=${pendingToken}`
      : null

  const [digest, recentLogs] = await Promise.all([
    buildUserDueDigest(userId),
    db
      .select()
      .from(telegramNotificationLogs)
      .where(eq(telegramNotificationLogs.userId, userId))
      .orderBy(desc(telegramNotificationLogs.createdAt))
      .limit(10),
  ])

  return {
    botConfigured: Boolean(botToken),
    botUsername: botMeta?.username || null,
    botName: botMeta?.firstName || null,
    cronSecretConfigured: Boolean(getCronSecret()),
    webhook: webhook
      ? {
          active: webhook.active,
          url: webhook.url,
          lastErrorMessage: webhook.lastErrorMessage,
        }
      : null,
    connection: {
      connected: Boolean(user.telegramChatId),
      chatIdMasked: maskChatId(user.telegramChatId),
      username: user.telegramUsername ?? null,
      linkedAt: user.telegramLinkedAt ?? null,
      pendingToken,
      pendingLinkUrl,
      pendingExpiresAt: hasValidPendingToken ? user.telegramLinkTokenExpiresAt ?? null : null,
    },
    preferences: {
      notifyEnabled: Boolean(user.telegramNotifyEnabled),
      daysBefore: Number(user.telegramDaysBefore ?? 3),
      notifyOverdue: Boolean(user.telegramNotifyOverdue),
      includeCouple: Boolean(user.telegramIncludeCouple),
      lastSentDate: user.telegramLastSentDate ?? null,
    },
    preview: digest,
    logs: recentLogs.map((l) => ({
      id: l.id,
      kind: l.kind,
      referenceDate: l.referenceDate,
      itemsCount: Number(l.itemsCount || 0),
      status: l.status,
      summary: l.summary ?? null,
      errorMessage: l.errorMessage ?? null,
      createdAt: l.createdAt,
    })),
  }
}

export async function runDailyTelegramCronReminders(options?: {
  force?: boolean
  appBaseUrl?: string
}) {
  const flags = await getSystemFeatureFlagsMap()
  const { dateStr } = getBrazilTodayParts()

  if (flags.telegram === false) {
    return {
      ok: true,
      date: dateStr,
      skippedReason: 'module_disabled',
      checked: 0,
      sent: 0,
      skippedNoItems: 0,
      skippedAlreadySent: 0,
      failed: 0,
    }
  }

  const botToken = getTelegramBotToken()
  if (!botToken) {
    return {
      ok: false,
      date: dateStr,
      skippedReason: 'missing_bot_token',
      checked: 0,
      sent: 0,
      skippedNoItems: 0,
      skippedAlreadySent: 0,
      failed: 0,
    }
  }

  const connectedUsers = await db
    .select()
    .from(users)
    .where(and(isNotNull(users.telegramChatId), eq(users.telegramNotifyEnabled, true)))

  const eligibleUsers = connectedUsers.filter(
    (u) =>
      Boolean(u.telegramChatId) &&
      (Boolean(u.isPremium) || Boolean(u.isAdmin)) &&
      (Boolean(u.telegramEnabled) || Boolean(u.isAdmin)),
  )

  let sent = 0
  let skippedNoItems = 0
  let skippedAlreadySent = 0
  let failed = 0
  const baseUrl = options?.appBaseUrl || getAppBaseUrl()

  for (const user of eligibleUsers) {
    if (!options?.force && user.telegramLastSentDate === dateStr) {
      skippedAlreadySent++
      continue
    }

    try {
      const digest = await buildUserDueDigest(user.id)
      if (digest.totalAllCount === 0) {
        skippedNoItems++
        continue
      }

      const html = formatDigestTelegramHtml(user.name, digest, {
        daysBefore: user.telegramDaysBefore,
        appUrl: baseUrl,
      })

      await sendTelegramHtmlMessage(String(user.telegramChatId), html)

      await db
        .update(users)
        .set({
          telegramLastSentDate: dateStr,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(users.id, user.id))

      await recordTelegramLog({
        userId: user.id,
        kind: 'cron',
        referenceDate: dateStr,
        itemsCount: digest.totalAllCount,
        status: 'sent',
        summary: buildDigestShortSummary(digest),
      })

      sent++
    } catch (err) {
      failed++
      const errMsg = err instanceof Error ? err.message : 'Erro desconhecido ao enviar mensagem'
      console.error(`[DuoPact Telegram Cron] Falha para user ${user.id}:`, errMsg)
      await recordTelegramLog({
        userId: user.id,
        kind: 'cron',
        referenceDate: dateStr,
        itemsCount: 0,
        status: 'failed',
        errorMessage: errMsg.slice(0, 240),
      }).catch(() => undefined)
    }
  }

  return {
    ok: true,
    date: dateStr,
    checked: eligibleUsers.length,
    sent,
    skippedNoItems,
    skippedAlreadySent,
    failed,
  }
}
