/**
 * Configuração de pool Postgres pensada para Vercel/serverless + Railway.
 * Espelha a configuração que já funciona no projeto Conlir.
 */
import dns from 'node:dns'
import type { PoolConfig } from 'pg'

try {
  dns.setDefaultResultOrder('ipv4first')
} catch {
  // ambientes restritos sem suporte a setDefaultResultOrder
}

export function isServerlessRuntime(): boolean {
  return Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.NETLIFY ||
      process.env.CF_PAGES,
  )
}

export function cleanDatabaseUrl(raw: string): string {
  return raw.trim().replace(/^["']|["']$/g, '')
}

/** Remove parâmetros de SSL da URL: o SSL é configurado explicitamente no pool. */
export function stripSslParamsFromUrl(databaseUrl: string): string {
  try {
    const parsed = new URL(databaseUrl.replace(/^postgresql:/, 'postgres:'))
    parsed.searchParams.delete('sslmode')
    parsed.searchParams.delete('ssl')
    parsed.searchParams.delete('sslrootcert')
    parsed.searchParams.delete('sslcert')
    parsed.searchParams.delete('sslkey')
    parsed.searchParams.delete('channel_binding')
    return parsed.toString().replace(/^postgres:/, 'postgresql:')
  } catch {
    return databaseUrl
  }
}

export function isLocalDatabase(databaseUrl: string): boolean {
  try {
    const parsed = new URL(databaseUrl.replace(/^postgresql:/, 'postgres:'))
    return ['localhost', '127.0.0.1', 'host.docker.internal'].includes(parsed.hostname)
  } catch {
    return false
  }
}

export function resolvePoolMax(): number {
  const fromEnv = Number(process.env.PG_POOL_MAX)
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.floor(fromEnv)
  // Serverless usa 1 conexão; dev/node usa pool enxuto (3) para não saturar handshakes TLS no proxy da Railway
  return isServerlessRuntime() ? 1 : 3
}

export function createPoolConfig(rawUrl: string): PoolConfig {
  const connectionString = stripSslParamsFromUrl(cleanDatabaseUrl(rawUrl))
  const local = isLocalDatabase(connectionString)
  const serverless = isServerlessRuntime()

  return {
    connectionString,
    ssl: local && process.env.PG_SSL !== '1' ? undefined : { rejectUnauthorized: false },
    max: resolvePoolMax(),
    idleTimeoutMillis: serverless ? 5_000 : 30_000,
    connectionTimeoutMillis: 20_000,
    allowExitOnIdle: serverless,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  }
}
