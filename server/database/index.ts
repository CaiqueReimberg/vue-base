import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3'
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { DEFAULT_CATEGORIES, LAST_MIGRATION_ID, runPostgresMigrations } from './migrate'
import { createPoolConfig } from './pool-config'
import * as pgSchema from './schema.pg'
import * as sqliteSchema from './schema.sqlite'

function createSqliteDb() {
  const dbPath = resolve(process.cwd(), '.data', 'dualpact.sqlite')
  mkdirSync(dirname(dbPath), { recursive: true })

  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS families (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      name TEXT,
      family_id TEXT REFERENCES families(id) ON DELETE SET NULL,
      is_premium INTEGER NOT NULL DEFAULT 0,
      invoice_analysis_enabled INTEGER NOT NULL DEFAULT 0,
      is_admin INTEGER NOT NULL DEFAULT 0,
      solo_mode INTEGER NOT NULL DEFAULT 0,
      onboarding_completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      balance REAL NOT NULL DEFAULT 0,
      initial_balance REAL NOT NULL DEFAULT 0,
      bank_name TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      share_with_partner INTEGER NOT NULL DEFAULT 0,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      family_id TEXT REFERENCES families(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      limit_amount REAL NOT NULL,
      closing_day INTEGER NOT NULL,
      due_day INTEGER NOT NULL,
      bank_name TEXT,
      brand TEXT,
      last4 TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      share_with_partner INTEGER NOT NULL DEFAULT 0,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      family_id TEXT REFERENCES families(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      scope TEXT NOT NULL,
      period TEXT NOT NULL DEFAULT 'monthly',
      audience TEXT NOT NULL DEFAULT 'individual',
      limit_amount REAL NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      start_date TEXT,
      end_date TEXT,
      reference_month TEXT,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      person_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      family_id TEXT REFERENCES families(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recurrings (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      type TEXT NOT NULL,
      frequency TEXT NOT NULL DEFAULT 'monthly',
      amount REAL NOT NULL,
      description TEXT,
      due_day INTEGER,
      start_date TEXT NOT NULL,
      end_date TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      is_shared INTEGER NOT NULL DEFAULT 0,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
      card_id TEXT REFERENCES cards(id) ON DELETE SET NULL,
      category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      family_id TEXT REFERENCES families(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recurring_payments (
      id TEXT PRIMARY KEY,
      recurring_id TEXT NOT NULL REFERENCES recurrings(id) ON DELETE CASCADE,
      reference_month TEXT NOT NULL,
      paid_at TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      UNIQUE(recurring_id, reference_month)
    );

    CREATE TABLE IF NOT EXISTS recurring_month_overrides (
      id TEXT PRIMARY KEY,
      recurring_id TEXT NOT NULL REFERENCES recurrings(id) ON DELETE CASCADE,
      reference_month TEXT NOT NULL,
      amount REAL NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(recurring_id, reference_month)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      due_date TEXT,
      paid_at TEXT,
      reference_month TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      kind TEXT,
      debt_category TEXT,
      installment_number INTEGER,
      installment_total INTEGER,
      is_shared INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      account_id TEXT REFERENCES accounts(id) ON DELETE CASCADE,
      card_id TEXT REFERENCES cards(id) ON DELETE CASCADE,
      category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      family_id TEXT REFERENCES families(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS monthly_plans (
      id TEXT PRIMARY KEY,
      reference_month TEXT NOT NULL,
      monthly_income REAL NOT NULL DEFAULT 0,
      savings_goal REAL NOT NULL DEFAULT 0,
      savings_paid_at TEXT,
      end_of_month_leftover REAL,
      closed_at TEXT,
      notes TEXT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      family_id TEXT REFERENCES families(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS savings_goals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      target_amount REAL NOT NULL,
      target_date TEXT,
      is_shared INTEGER NOT NULL DEFAULT 1,
      archived_at TEXT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      family_id TEXT REFERENCES families(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS savings_contributions (
      id TEXT PRIMARY KEY,
      goal_id TEXT NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      contributed_at TEXT NOT NULL,
      note TEXT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invoice_analyses (
      id TEXT PRIMARY KEY,
      card_name TEXT NOT NULL,
      reference_month TEXT NOT NULL,
      total_amount REAL NOT NULL DEFAULT 0,
      items_count INTEGER NOT NULL DEFAULT 0,
      items_json TEXT NOT NULL,
      is_shared INTEGER NOT NULL DEFAULT 1,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      family_id TEXT REFERENCES families(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS income_entries (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      source TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'freelance',
      amount REAL NOT NULL,
      reference_month TEXT NOT NULL,
      received_at TEXT NOT NULL,
      is_recurring INTEGER NOT NULL DEFAULT 0,
      end_month TEXT,
      notes TEXT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      family_id TEXT REFERENCES families(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS card_monthly_invoices (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      reference_month TEXT NOT NULL,
      amount REAL NOT NULL,
      due_day INTEGER,
      is_shared INTEGER NOT NULL DEFAULT 0,
      paid_at TEXT,
      paid_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      family_id TEXT REFERENCES families(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(card_id, reference_month)
    );

    CREATE TABLE IF NOT EXISTS telegram_notification_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      reference_date TEXT NOT NULL,
      items_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      summary TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL
    );
  `)

  const userCols = (sqlite.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>).map(
    (c) => c.name,
  )
  if (!userCols.includes('is_premium')) {
    sqlite.exec('ALTER TABLE users ADD COLUMN is_premium INTEGER NOT NULL DEFAULT 0;')
  }
  if (!userCols.includes('invoice_analysis_enabled')) {
    sqlite.exec('ALTER TABLE users ADD COLUMN invoice_analysis_enabled INTEGER NOT NULL DEFAULT 0;')
  }
  if (!userCols.includes('telegram_enabled')) {
    sqlite.exec('ALTER TABLE users ADD COLUMN telegram_enabled INTEGER NOT NULL DEFAULT 0;')
  }
  if (!userCols.includes('is_admin')) {
    sqlite.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;')
  }
  if (!userCols.includes('solo_mode')) {
    sqlite.exec('ALTER TABLE users ADD COLUMN solo_mode INTEGER NOT NULL DEFAULT 0;')
  }
  if (!userCols.includes('onboarding_completed_at')) {
    sqlite.exec('ALTER TABLE users ADD COLUMN onboarding_completed_at TEXT;')
  }
  if (!userCols.includes('telegram_chat_id')) {
    sqlite.exec('ALTER TABLE users ADD COLUMN telegram_chat_id TEXT;')
  }
  if (!userCols.includes('telegram_username')) {
    sqlite.exec('ALTER TABLE users ADD COLUMN telegram_username TEXT;')
  }
  if (!userCols.includes('telegram_linked_at')) {
    sqlite.exec('ALTER TABLE users ADD COLUMN telegram_linked_at TEXT;')
  }
  if (!userCols.includes('telegram_link_token')) {
    sqlite.exec('ALTER TABLE users ADD COLUMN telegram_link_token TEXT;')
  }
  if (!userCols.includes('telegram_link_token_expires_at')) {
    sqlite.exec('ALTER TABLE users ADD COLUMN telegram_link_token_expires_at TEXT;')
  }
  if (!userCols.includes('telegram_notify_enabled')) {
    sqlite.exec('ALTER TABLE users ADD COLUMN telegram_notify_enabled INTEGER NOT NULL DEFAULT 1;')
  }
  if (!userCols.includes('telegram_days_before')) {
    sqlite.exec('ALTER TABLE users ADD COLUMN telegram_days_before INTEGER NOT NULL DEFAULT 3;')
  }
  if (!userCols.includes('telegram_notify_overdue')) {
    sqlite.exec('ALTER TABLE users ADD COLUMN telegram_notify_overdue INTEGER NOT NULL DEFAULT 1;')
  }
  if (!userCols.includes('telegram_include_couple')) {
    sqlite.exec('ALTER TABLE users ADD COLUMN telegram_include_couple INTEGER NOT NULL DEFAULT 1;')
  }
  if (!userCols.includes('telegram_last_sent_date')) {
    sqlite.exec('ALTER TABLE users ADD COLUMN telegram_last_sent_date TEXT;')
  }

  const famCols = (sqlite.prepare('PRAGMA table_info(families)').all() as Array<{ name: string }>).map(
    (c) => c.name,
  )
  if (!famCols.includes('share_overview')) {
    sqlite.exec('ALTER TABLE families ADD COLUMN share_overview INTEGER NOT NULL DEFAULT 0;')
  }

  const txCols = (sqlite.prepare('PRAGMA table_info(transactions)').all() as Array<{ name: string }>).map(
    (c) => c.name,
  )
  if (!txCols.includes('paid_by_user_id')) {
    sqlite.exec('ALTER TABLE transactions ADD COLUMN paid_by_user_id TEXT;')
  }

  const invCols = (sqlite.prepare('PRAGMA table_info(invoice_analyses)').all() as Array<{ name: string }>).map(
    (c) => c.name,
  )
  if (!invCols.includes('card_id')) {
    sqlite.exec('ALTER TABLE invoice_analyses ADD COLUMN card_id TEXT;')
  }

  const countRow = sqlite
    .prepare('SELECT COUNT(*) as cnt FROM categories WHERE user_id IS NULL')
    .get() as { cnt: number }
  if (!countRow || countRow.cnt === 0) {
    const now = new Date().toISOString()
    const insertStmt = sqlite.prepare(
      'INSERT INTO categories (id, name, type, user_id, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?)',
    )
    const insertMany = sqlite.transaction((items: Array<[string, 'expense' | 'income']>) => {
      for (const [name, type] of items) {
        insertStmt.run(randomUUID(), name, type, now, now)
      }
    })
    insertMany(DEFAULT_CATEGORIES)
  }

  return drizzleSqlite(sqlite, { schema: sqliteSchema })
}

interface GlobalPgCache {
  pool?: pg.Pool
  readyForMigrationId?: string
  inFlightReady?: Promise<void> | null
}

const globalForPg = globalThis as unknown as {
  __dualpactPgCache?: GlobalPgCache
}

const pgCache: GlobalPgCache = globalForPg.__dualpactPgCache ?? {}
globalForPg.__dualpactPgCache = pgCache

let dbInstance: ReturnType<typeof createSqliteDb>
let pgPool: pg.Pool | null = null

if (process.env.DATABASE_URL) {
  if (!pgCache.pool) {
    const createdPool = new pg.Pool(createPoolConfig(process.env.DATABASE_URL))

    // Sem esse handler, um socket morto em cliente ocioso derruba o processo/requisição
    createdPool.on('error', (err) => {
      console.error('[DuoPact] Erro em conexão ociosa do pool (será descartada):', err.message)
    })

    pgCache.pool = createdPool
  }

  pgPool = pgCache.pool
  dbInstance = drizzlePg(pgPool, { schema: pgSchema }) as unknown as ReturnType<typeof createSqliteDb>
} else {
  dbInstance = createSqliteDb()
}

export function ensureDatabaseReady(): Promise<void> {
  if (!pgPool) return Promise.resolve()

  if (pgCache.readyForMigrationId === LAST_MIGRATION_ID) {
    return Promise.resolve()
  }

  if (pgCache.inFlightReady) {
    return pgCache.inFlightReady
  }

  const poolRef = pgPool
  pgCache.inFlightReady = (async () => {
    const maxAttempts = 4
    let lastError: unknown
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await runPostgresMigrations(poolRef, pgSchema.DB_SCHEMA_NAME)
        pgCache.readyForMigrationId = LAST_MIGRATION_ID
        return
      } catch (err) {
        lastError = err
        console.error(
          `[DuoPact] Falha ao preparar banco (tentativa ${attempt}/${maxAttempts}):`,
          err instanceof Error ? err.message : err,
        )
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 600 * attempt))
        }
      }
    }
    throw lastError
  })().finally(() => {
    pgCache.inFlightReady = null
  })

  return pgCache.inFlightReady
}

export const db = dbInstance
