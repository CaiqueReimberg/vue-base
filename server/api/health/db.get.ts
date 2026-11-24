import { lookup } from 'node:dns/promises'
import net from 'node:net'
import pg from 'pg'
import { cleanDatabaseUrl, createPoolConfig, stripSslParamsFromUrl } from '../../database/pool-config'

function maskHost(host: string): string {
  if (host.length <= 6) return '***'
  return `${host.slice(0, 3)}***${host.slice(host.indexOf('.'))}`
}

function tcpProbe(host: string, port: number, timeoutMs: number): Promise<{ ok: boolean; ms: number; error?: string }> {
  return new Promise((resolve) => {
    const started = Date.now()
    const socket = net.connect({ host, port })
    const done = (ok: boolean, error?: string) => {
      socket.destroy()
      resolve({ ok, ms: Date.now() - started, error })
    }
    socket.setTimeout(timeoutMs)
    socket.once('connect', () => done(true))
    socket.once('timeout', () => done(false, 'timeout'))
    socket.once('error', (e) => done(false, e.message))
  })
}

/**
 * Diagnóstico de conectividade com o Postgres (sem credenciais na resposta).
 * Não passa pelo middleware de migrations para funcionar mesmo com o banco fora do ar.
 */
export default defineEventHandler(async () => {
  const raw = process.env.DATABASE_URL
  if (!raw) {
    return { ok: false, reason: 'DATABASE_URL não definida neste ambiente (usando SQLite)' }
  }

  const cleaned = cleanDatabaseUrl(raw)
  let host = ''
  let port = 5432
  let dbName = ''
  try {
    const u = new URL(stripSslParamsFromUrl(cleaned).replace(/^postgresql:/, 'postgres:'))
    host = u.hostname
    port = Number(u.port) || 5432
    dbName = u.pathname.replace(/^\//, '')
  } catch {
    return { ok: false, reason: 'DATABASE_URL inválida (não foi possível interpretar)', hadQuotes: raw !== raw.trim() || /^["']/.test(raw) }
  }

  const result: Record<string, unknown> = {
    host: maskHost(host),
    port,
    database: dbName,
    schema: process.env.DB_SCHEMA || 'dualpact',
    hadQuotesOrSpaces: raw !== cleaned,
    vercelRegion: process.env.VERCEL_REGION || null,
    serverless: Boolean(process.env.VERCEL),
  }

  const t0 = Date.now()
  try {
    const dns = await lookup(host)
    result.dns = { ok: true, ms: Date.now() - t0, ip: dns.address.replace(/\.\d+$/, '.x') }
  } catch (e) {
    result.dns = { ok: false, ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e) }
    return result
  }

  result.tcp = await tcpProbe(host, port, 8000)
  if (!(result.tcp as { ok: boolean }).ok) return result

  const client = new pg.Client({ ...createPoolConfig(raw), connectionTimeoutMillis: 8000 })
  const t1 = Date.now()
  try {
    await client.connect()
    result.pgConnectMs = Date.now() - t1
    const q0 = Date.now()
    await client.query('SELECT 1')
    result.queryMs = Date.now() - q0
    result.ok = true
  } catch (e) {
    result.ok = false
    result.pgError = e instanceof Error ? e.message : String(e)
    result.pgMs = Date.now() - t1
  } finally {
    await client.end().catch(() => {})
  }

  return result
})
