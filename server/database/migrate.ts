import { randomUUID } from 'node:crypto'
import type pg from 'pg'

export const DEFAULT_CATEGORIES: Array<[string, 'expense' | 'income']> = [
  ['Alimentação', 'expense'],
  ['Restaurantes', 'expense'],
  ['Supermercado', 'expense'],
  ['Delivery', 'expense'],
  ['Moradia', 'expense'],
  ['Aluguel', 'expense'],
  ['Financiamento', 'expense'],
  ['Condomínio', 'expense'],
  ['Energia', 'expense'],
  ['Água', 'expense'],
  ['Internet', 'expense'],
  ['Transporte', 'expense'],
  ['Combustível', 'expense'],
  ['Uber/Taxi', 'expense'],
  ['Manutenção Veículo', 'expense'],
  ['Seguro Veículo', 'expense'],
  ['Estacionamento', 'expense'],
  ['Saúde', 'expense'],
  ['Plano de Saúde', 'expense'],
  ['Farmácia', 'expense'],
  ['Academia', 'expense'],
  ['Educação', 'expense'],
  ['Cursos', 'expense'],
  ['Faculdade', 'expense'],
  ['Livros', 'expense'],
  ['Lazer', 'expense'],
  ['Viagem', 'expense'],
  ['Streaming', 'expense'],
  ['Jogos', 'expense'],
  ['Eventos', 'expense'],
  ['Compras', 'expense'],
  ['Roupas', 'expense'],
  ['Eletrônicos', 'expense'],
  ['Casa', 'expense'],
  ['Assinaturas', 'expense'],
  ['Serviços', 'expense'],
  ['Pets', 'expense'],
  ['Impostos', 'expense'],
  ['Taxas', 'expense'],
  ['Dívidas', 'expense'],
  ['Cartão de Crédito', 'expense'],
  ['Presentes', 'expense'],
  ['Doações', 'expense'],
  ['Outros', 'expense'],
  ['Salário', 'income'],
  ['Freelance', 'income'],
  ['Investimentos', 'income'],
  ['Rendimentos', 'income'],
  ['Bônus', 'income'],
  ['Cashback', 'income'],
  ['Venda', 'income'],
  ['Reembolso', 'income'],
  ['Outros', 'income'],
]

interface MigrationStep {
  id: string
  description: string
  up: (schema: string) => string
}

const MIGRATIONS: MigrationStep[] = [
  {
    id: '0001_init_dualpact_schema',
    description: 'Cria schema apartado e tabelas base do DuoPact',
    up: (s) => `
      CREATE TABLE IF NOT EXISTS "${s}".families (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS "${s}".users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        name TEXT,
        family_id TEXT REFERENCES "${s}".families(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_${s}_users_family_id ON "${s}".users(family_id);

      CREATE TABLE IF NOT EXISTS "${s}".accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        balance DOUBLE PRECISION NOT NULL DEFAULT 0,
        initial_balance DOUBLE PRECISION NOT NULL DEFAULT 0,
        bank_name TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        share_with_partner BOOLEAN NOT NULL DEFAULT FALSE,
        user_id TEXT NOT NULL REFERENCES "${s}".users(id) ON DELETE CASCADE,
        family_id TEXT REFERENCES "${s}".families(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_${s}_accounts_user_id ON "${s}".accounts(user_id);

      CREATE TABLE IF NOT EXISTS "${s}".cards (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        limit_amount DOUBLE PRECISION NOT NULL,
        closing_day INTEGER NOT NULL,
        due_day INTEGER NOT NULL,
        bank_name TEXT,
        brand TEXT,
        last4 TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        share_with_partner BOOLEAN NOT NULL DEFAULT FALSE,
        user_id TEXT NOT NULL REFERENCES "${s}".users(id) ON DELETE CASCADE,
        family_id TEXT REFERENCES "${s}".families(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_${s}_cards_user_id ON "${s}".cards(user_id);

      CREATE TABLE IF NOT EXISTS "${s}".categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        user_id TEXT REFERENCES "${s}".users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS "${s}".budgets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        scope TEXT NOT NULL,
        period TEXT NOT NULL DEFAULT 'monthly',
        audience TEXT NOT NULL DEFAULT 'individual',
        limit_amount DOUBLE PRECISION NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        start_date TEXT,
        end_date TEXT,
        reference_month TEXT,
        owner_id TEXT NOT NULL REFERENCES "${s}".users(id) ON DELETE CASCADE,
        person_id TEXT REFERENCES "${s}".users(id) ON DELETE SET NULL,
        category_id TEXT REFERENCES "${s}".categories(id) ON DELETE SET NULL,
        family_id TEXT REFERENCES "${s}".families(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS "${s}".recurrings (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        type TEXT NOT NULL,
        frequency TEXT NOT NULL DEFAULT 'monthly',
        amount DOUBLE PRECISION NOT NULL,
        description TEXT,
        due_day INTEGER,
        start_date TEXT NOT NULL,
        end_date TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        is_shared BOOLEAN NOT NULL DEFAULT FALSE,
        user_id TEXT NOT NULL REFERENCES "${s}".users(id) ON DELETE CASCADE,
        account_id TEXT REFERENCES "${s}".accounts(id) ON DELETE SET NULL,
        card_id TEXT REFERENCES "${s}".cards(id) ON DELETE SET NULL,
        category_id TEXT REFERENCES "${s}".categories(id) ON DELETE SET NULL,
        family_id TEXT REFERENCES "${s}".families(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_${s}_recurrings_user_id ON "${s}".recurrings(user_id);

      CREATE TABLE IF NOT EXISTS "${s}".recurring_payments (
        id TEXT PRIMARY KEY,
        recurring_id TEXT NOT NULL REFERENCES "${s}".recurrings(id) ON DELETE CASCADE,
        reference_month TEXT NOT NULL,
        paid_at TEXT NOT NULL,
        user_id TEXT NOT NULL REFERENCES "${s}".users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        UNIQUE(recurring_id, reference_month)
      );

      CREATE INDEX IF NOT EXISTS idx_${s}_recurring_payments_month
        ON "${s}".recurring_payments(reference_month);

      CREATE TABLE IF NOT EXISTS "${s}".transactions (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        amount DOUBLE PRECISION NOT NULL,
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
        is_shared BOOLEAN NOT NULL DEFAULT FALSE,
        notes TEXT,
        user_id TEXT NOT NULL REFERENCES "${s}".users(id) ON DELETE CASCADE,
        account_id TEXT REFERENCES "${s}".accounts(id) ON DELETE CASCADE,
        card_id TEXT REFERENCES "${s}".cards(id) ON DELETE CASCADE,
        category_id TEXT REFERENCES "${s}".categories(id) ON DELETE SET NULL,
        family_id TEXT REFERENCES "${s}".families(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_${s}_transactions_user_month
        ON "${s}".transactions(user_id, reference_month);
    `,
  },
  {
    id: '0002_add_monthly_plans',
    description: 'Adiciona tabela monthly_plans para Renda Mensal, Meta Quero Guardar e Fechamento do Mês',
    up: (s) => `
      CREATE TABLE IF NOT EXISTS "${s}".monthly_plans (
        id TEXT PRIMARY KEY,
        reference_month TEXT NOT NULL,
        monthly_income DOUBLE PRECISION NOT NULL DEFAULT 0,
        savings_goal DOUBLE PRECISION NOT NULL DEFAULT 0,
        savings_paid_at TEXT,
        end_of_month_leftover DOUBLE PRECISION,
        closed_at TEXT,
        notes TEXT,
        user_id TEXT NOT NULL REFERENCES "${s}".users(id) ON DELETE CASCADE,
        family_id TEXT REFERENCES "${s}".families(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_${s}_monthly_plans_user_month
        ON "${s}".monthly_plans(user_id, reference_month);
    `,
  },
]

let migrationPromise: Promise<void> | null = null

export function runPostgresMigrations(pool: pg.Pool, schemaName: string): Promise<void> {
  if (migrationPromise) return migrationPromise

  migrationPromise = (async () => {
    const safeSchema = schemaName.replace(/[^a-zA-Z0-9_]/g, '') || 'dualpact'
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // 1. Garante que o schema isolado e a tabela de controle de migrations existam dentro dele
      await client.query(`CREATE SCHEMA IF NOT EXISTS "${safeSchema}";`)
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${safeSchema}"._migrations (
          id TEXT PRIMARY KEY,
          description TEXT NOT NULL,
          applied_at TEXT NOT NULL
        );
      `)

      const appliedRes = await client.query<{ id: string }>(
        `SELECT id FROM "${safeSchema}"._migrations`,
      )
      const appliedIds = new Set(appliedRes.rows.map((r) => r.id))

      for (const step of MIGRATIONS) {
        if (appliedIds.has(step.id)) continue
        console.log(`[DuoPact Migration] Aplicando ${step.id} (${step.description})...`)
        await client.query(step.up(safeSchema))
        await client.query(
          `INSERT INTO "${safeSchema}"._migrations (id, description, applied_at) VALUES ($1, $2, $3)`,
          [step.id, step.description, new Date().toISOString()],
        )
      }

      // 2. Seed de categorias padrão se a tabela estiver vazia
      const countRes = await client.query<{ cnt: number }>(
        `SELECT COUNT(*)::int AS cnt FROM "${safeSchema}".categories WHERE user_id IS NULL`,
      )
      if (!countRes.rows[0] || countRes.rows[0].cnt === 0) {
        const now = new Date().toISOString()
        for (const [name, type] of DEFAULT_CATEGORIES) {
          await client.query(
            `INSERT INTO "${safeSchema}".categories (id, name, type, user_id, created_at, updated_at) VALUES ($1, $2, $3, NULL, $4, $5)`,
            [randomUUID(), name, type, now, now],
          )
        }
        console.log(`[DuoPact Migration] 53 categorias padrão inseridas em "${safeSchema}".categories.`)
      }

      await client.query('COMMIT')
      console.log(`[DuoPact Migration] Schema "${safeSchema}" pronto e atualizado!`)
    } catch (err) {
      await client.query('ROLLBACK')
      migrationPromise = null
      throw err
    } finally {
      client.release()
    }
  })()

  return migrationPromise
}
