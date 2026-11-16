-- =============================================================================
-- DuoPact — Schema Exclusivo PostgreSQL (Railway)
-- Cria um schema apartado ("dualpact") sem interferir no schema "public"
-- ou em outros projetos que compartilhem o mesmo banco no Railway.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS dualpact;

-- 1. Famílias / Casais
CREATE TABLE IF NOT EXISTS dualpact.families (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 2. Usuários
CREATE TABLE IF NOT EXISTS dualpact.users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  name TEXT,
  family_id TEXT REFERENCES dualpact.families(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dualpact_users_family_id ON dualpact.users(family_id);

-- 3. Contas Bancárias
CREATE TABLE IF NOT EXISTS dualpact.accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'checking' | 'savings' | 'investment'
  balance DOUBLE PRECISION NOT NULL DEFAULT 0,
  initial_balance DOUBLE PRECISION NOT NULL DEFAULT 0,
  bank_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  share_with_partner BOOLEAN NOT NULL DEFAULT FALSE,
  user_id TEXT NOT NULL REFERENCES dualpact.users(id) ON DELETE CASCADE,
  family_id TEXT REFERENCES dualpact.families(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dualpact_accounts_user_id ON dualpact.accounts(user_id);

-- 4. Cartões de Crédito
CREATE TABLE IF NOT EXISTS dualpact.cards (
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
  user_id TEXT NOT NULL REFERENCES dualpact.users(id) ON DELETE CASCADE,
  family_id TEXT REFERENCES dualpact.families(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dualpact_cards_user_id ON dualpact.cards(user_id);

-- 5. Categorias
CREATE TABLE IF NOT EXISTS dualpact.categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'expense' | 'income'
  user_id TEXT REFERENCES dualpact.users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 6. Orçamentos
CREATE TABLE IF NOT EXISTS dualpact.budgets (
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
  owner_id TEXT NOT NULL REFERENCES dualpact.users(id) ON DELETE CASCADE,
  person_id TEXT REFERENCES dualpact.users(id) ON DELETE SET NULL,
  category_id TEXT REFERENCES dualpact.categories(id) ON DELETE SET NULL,
  family_id TEXT REFERENCES dualpact.families(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 7. Contas Fixas & Assinaturas Recorrentes
CREATE TABLE IF NOT EXISTS dualpact.recurrings (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL, -- 'fixed_bill' | 'subscription'
  type TEXT NOT NULL, -- 'expense' | 'income'
  frequency TEXT NOT NULL DEFAULT 'monthly',
  amount DOUBLE PRECISION NOT NULL,
  description TEXT,
  due_day INTEGER,
  start_date TEXT NOT NULL,
  end_date TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_shared BOOLEAN NOT NULL DEFAULT FALSE,
  user_id TEXT NOT NULL REFERENCES dualpact.users(id) ON DELETE CASCADE,
  account_id TEXT REFERENCES dualpact.accounts(id) ON DELETE SET NULL,
  card_id TEXT REFERENCES dualpact.cards(id) ON DELETE SET NULL,
  category_id TEXT REFERENCES dualpact.categories(id) ON DELETE SET NULL,
  family_id TEXT REFERENCES dualpact.families(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dualpact_recurrings_user_id ON dualpact.recurrings(user_id);

-- 8. Baixas de Pagamento das Contas Fixas por Mês
CREATE TABLE IF NOT EXISTS dualpact.recurring_payments (
  id TEXT PRIMARY KEY,
  recurring_id TEXT NOT NULL REFERENCES dualpact.recurrings(id) ON DELETE CASCADE,
  reference_month TEXT NOT NULL, -- 'YYYY-MM'
  paid_at TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES dualpact.users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  UNIQUE(recurring_id, reference_month)
);

CREATE INDEX IF NOT EXISTS idx_dualpact_recurring_payments_month
  ON dualpact.recurring_payments(reference_month);

-- 9. Transações / Financiamentos / Parcelas (Dívidas)
CREATE TABLE IF NOT EXISTS dualpact.transactions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- 'expense' | 'income'
  amount DOUBLE PRECISION NOT NULL,
  description TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  due_date TEXT,
  paid_at TEXT,
  reference_month TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'cleared' | 'paid'
  kind TEXT, -- 'debt' | 'purchase' | 'invoice_payment' | 'transfer' | 'adjustment'
  debt_category TEXT, -- 'car' | 'home' | 'personal_loan' | 'student' | 'other'
  installment_number INTEGER,
  installment_total INTEGER,
  is_shared BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  user_id TEXT NOT NULL REFERENCES dualpact.users(id) ON DELETE CASCADE,
  account_id TEXT REFERENCES dualpact.accounts(id) ON DELETE CASCADE,
  card_id TEXT REFERENCES dualpact.cards(id) ON DELETE CASCADE,
  category_id TEXT REFERENCES dualpact.categories(id) ON DELETE SET NULL,
  family_id TEXT REFERENCES dualpact.families(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dualpact_transactions_user_month
  ON dualpact.transactions(user_id, reference_month);

-- 10. Planejamento Mensal Livre (Renda do Mês + Meta Quero Guardar + Check-in de Fim de Mês)
CREATE TABLE IF NOT EXISTS dualpact.monthly_plans (
  id TEXT PRIMARY KEY,
  reference_month TEXT NOT NULL, -- 'YYYY-MM'
  monthly_income DOUBLE PRECISION NOT NULL DEFAULT 0,
  savings_goal DOUBLE PRECISION NOT NULL DEFAULT 0,
  savings_paid_at TEXT,
  end_of_month_leftover DOUBLE PRECISION,
  closed_at TEXT,
  notes TEXT,
  user_id TEXT NOT NULL REFERENCES dualpact.users(id) ON DELETE CASCADE,
  family_id TEXT REFERENCES dualpact.families(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dualpact_monthly_plans_user_month
  ON dualpact.monthly_plans(user_id, reference_month);
