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
  {
    id: '0003_add_recurring_month_overrides',
    description: 'Adiciona tabela recurring_month_overrides para valor variável por mês em contas fixas (ex: Luz, Água)',
    up: (s) => `
      CREATE TABLE IF NOT EXISTS "${s}".recurring_month_overrides (
        id TEXT PRIMARY KEY,
        recurring_id TEXT NOT NULL REFERENCES "${s}".recurrings(id) ON DELETE CASCADE,
        reference_month TEXT NOT NULL,
        amount DOUBLE PRECISION NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(recurring_id, reference_month)
      );

      CREATE INDEX IF NOT EXISTS idx_${s}_recurring_month_overrides_month
        ON "${s}".recurring_month_overrides(reference_month);
    `,
  },
  {
    id: '0004_add_invoice_analyses',
    description: 'Adiciona tabela invoice_analyses para raio-x de faturas de cartão destrinchadas',
    up: (s) => `
      CREATE TABLE IF NOT EXISTS "${s}".invoice_analyses (
        id TEXT PRIMARY KEY,
        card_name TEXT NOT NULL,
        reference_month TEXT NOT NULL,
        total_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
        items_count INTEGER NOT NULL DEFAULT 0,
        items_json TEXT NOT NULL,
        is_shared BOOLEAN NOT NULL DEFAULT TRUE,
        user_id TEXT NOT NULL REFERENCES "${s}".users(id) ON DELETE CASCADE,
        family_id TEXT REFERENCES "${s}".families(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_${s}_invoice_analyses_user_month
        ON "${s}".invoice_analyses(user_id, reference_month);
    `,
  },
  {
    id: '0005_add_user_invoice_analysis_enabled',
    description: 'Adiciona coluna invoice_analysis_enabled na tabela users para feature flag de análise de faturas',
    up: (s) => `
      ALTER TABLE "${s}".users
        ADD COLUMN IF NOT EXISTS invoice_analysis_enabled BOOLEAN NOT NULL DEFAULT FALSE;
    `,
  },
  {
    id: '0006_add_user_is_admin',
    description: 'Adiciona coluna is_admin na tabela users para controle de administradores e gestão de feature flags',
    up: (s) => `
      ALTER TABLE "${s}".users
        ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;
    `,
  },
  {
    id: '0007_add_feature_flags',
    description: 'Adiciona tabela feature_flags para controle global de módulos e funcionalidades do sistema',
    up: (s) => `
      CREATE TABLE IF NOT EXISTS "${s}".feature_flags (
        key TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        description TEXT NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        updated_at TEXT NOT NULL
      );

      INSERT INTO "${s}".feature_flags (key, label, description, enabled, updated_at)
      VALUES
        ('accounts', 'Dinheiro Guardado (CDBs)', 'Controle de contas, reservas e CDBs', TRUE, NOW()::text),
        ('invoices', 'Análise de Faturas (IA)', 'Destrinchador de faturas OFX e CSV com Gemini (também exige permissão no usuário)', TRUE, NOW()::text),
        ('monthly_control', 'Contas Fixas', 'Gestão de contas fixas e recorrentes do mês', TRUE, NOW()::text),
        ('debts', 'Dívidas & Parcelas', 'Controle de financiamentos e compras parceladas', TRUE, NOW()::text),
        ('cards', 'Cartões de Crédito', 'Cadastro manual de limites e cartões (módulo legado)', FALSE, NOW()::text),
        ('agenda', 'Agenda de Vencimentos', 'Calendário de vencimentos do mês', TRUE, NOW()::text)
      ON CONFLICT (key) DO NOTHING;
    `,
  },
  {
    id: '0008_add_debt_payments',
    description: 'Adiciona tabela debt_payments para baixa mensal independente de financiamentos e parcelamentos',
    up: (s) => `
      CREATE TABLE IF NOT EXISTS "${s}".debt_payments (
        id TEXT PRIMARY KEY,
        transaction_id TEXT NOT NULL REFERENCES "${s}".transactions(id) ON DELETE CASCADE,
        reference_month TEXT NOT NULL,
        paid_at TEXT NOT NULL,
        user_id TEXT NOT NULL REFERENCES "${s}".users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        UNIQUE(transaction_id, reference_month)
      );

      CREATE INDEX IF NOT EXISTS idx_${s}_debt_payments_month
        ON "${s}".debt_payments(reference_month);
    `,
  },
  {
    id: '0009_add_savings_goals',
    description: 'Adiciona metas de poupança e seus aportes para acompanhar progresso',
    up: (s) => `
      CREATE TABLE IF NOT EXISTS "${s}".savings_goals (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        target_amount DOUBLE PRECISION NOT NULL,
        target_date TEXT,
        is_shared BOOLEAN NOT NULL DEFAULT TRUE,
        archived_at TEXT,
        user_id TEXT NOT NULL REFERENCES "${s}".users(id) ON DELETE CASCADE,
        family_id TEXT REFERENCES "${s}".families(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS "${s}".savings_contributions (
        id TEXT PRIMARY KEY,
        goal_id TEXT NOT NULL REFERENCES "${s}".savings_goals(id) ON DELETE CASCADE,
        amount DOUBLE PRECISION NOT NULL,
        contributed_at TEXT NOT NULL,
        note TEXT,
        user_id TEXT NOT NULL REFERENCES "${s}".users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_${s}_savings_contributions_goal
        ON "${s}".savings_contributions(goal_id);
    `,
  },
  {
    id: '0010_add_goal_account_link',
    description: 'Adiciona vinculo account_id em savings_goals para conectar Metas aos CDBs e Contas',
    up: (s) => `
      ALTER TABLE "${s}".savings_goals
        ADD COLUMN IF NOT EXISTS account_id TEXT REFERENCES "${s}".accounts(id) ON DELETE SET NULL;
    `,
  },
  {
    id: '0011_add_user_is_premium',
    description: 'Adiciona coluna is_premium na tabela users para controle de acesso completo vs somente perfil',
    up: (s) => `
      ALTER TABLE "${s}".users
        ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT FALSE;

      UPDATE "${s}".users
        SET is_premium = TRUE
        WHERE is_admin = TRUE;
    `,
  },
]

let migrationPromise: Promise<void> | null = null

export function runPostgresMigrations(pool: pg.Pool, schemaName: string): Promise<void> {
  if (migrationPromise) return migrationPromise

  migrationPromise = (async () => {
    const safeSchema = schemaName.replace(/[^a-zA-Z0-9_]/g, '') || 'dualpact'

    // Caminho rápido: se todas as migrations já estão aplicadas, não abre transação
    // nem executa DDL (reduz idas ao banco em cada cold start na Vercel).
    try {
      const quick = await pool.query<{ id: string }>(
        `SELECT id FROM "${safeSchema}"._migrations`,
      )
      const done = new Set(quick.rows.map((r) => r.id))
      if (MIGRATIONS.every((m) => done.has(m.id))) {
        return
      }
    } catch (err) {
      const code = (err as { code?: string })?.code
      // 42P01 (tabela não existe) / 3F000 (schema não existe): segue para criar tudo
      if (code !== '42P01' && code !== '3F000') throw err
    }

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
      try {
        await client.query('ROLLBACK')
      } catch {
        // conexão já morreu: ignora para não mascarar o erro original
      }
      throw err
    } finally {
      client.release()
    }
  })().catch((err) => {
    // Qualquer falha (inclusive ao conectar) limpa o cache: a próxima chamada tenta de novo
    migrationPromise = null
    throw err
  })

  return migrationPromise
}
