import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core'

export const families = sqliteTable('families', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  name: text('name'),
  familyId: text('family_id').references(() => families.id, { onDelete: 'set null' }),
  isPremium: integer('is_premium', { mode: 'boolean' }).notNull().default(false),
  invoiceAnalysisEnabled: integer('invoice_analysis_enabled', { mode: 'boolean' }).notNull().default(false),
  isAdmin: integer('is_admin', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const featureFlags = sqliteTable('feature_flags', {
  key: text('key').primaryKey(),
  label: text('label').notNull(),
  description: text('description').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  updatedAt: text('updated_at').notNull(),
})

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  balance: real('balance').notNull().default(0),
  initialBalance: real('initial_balance').notNull().default(0),
  bankName: text('bank_name'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  shareWithPartner: integer('share_with_partner', { mode: 'boolean' }).notNull().default(false),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  familyId: text('family_id').references(() => families.id, { onDelete: 'set null' }),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const cards = sqliteTable('cards', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  limitAmount: real('limit_amount').notNull(),
  closingDay: integer('closing_day').notNull(),
  dueDay: integer('due_day').notNull(),
  bankName: text('bank_name'),
  brand: text('brand'),
  last4: text('last4'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  shareWithPartner: integer('share_with_partner', { mode: 'boolean' }).notNull().default(false),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  familyId: text('family_id').references(() => families.id, { onDelete: 'set null' }),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const budgets = sqliteTable('budgets', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  scope: text('scope').notNull(),
  period: text('period').notNull().default('monthly'),
  audience: text('audience').notNull().default('individual'),
  limitAmount: real('limit_amount').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  startDate: text('start_date'),
  endDate: text('end_date'),
  referenceMonth: text('reference_month'),
  ownerId: text('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  personId: text('person_id').references(() => users.id, { onDelete: 'set null' }),
  categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
  familyId: text('family_id').references(() => families.id, { onDelete: 'set null' }),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const recurrings = sqliteTable('recurrings', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind').notNull(),
  transactionType: text('type').notNull(),
  frequency: text('frequency').notNull().default('monthly'),
  amount: real('amount').notNull(),
  description: text('description'),
  dueDay: integer('due_day'),
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  isShared: integer('is_shared', { mode: 'boolean' }).notNull().default(false),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').references(() => accounts.id, { onDelete: 'set null' }),
  cardId: text('card_id').references(() => cards.id, { onDelete: 'set null' }),
  categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
  familyId: text('family_id').references(() => families.id, { onDelete: 'set null' }),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const recurringPayments = sqliteTable('recurring_payments', {
  id: text('id').primaryKey(),
  recurringId: text('recurring_id')
    .notNull()
    .references(() => recurrings.id, { onDelete: 'cascade' }),
  referenceMonth: text('reference_month').notNull(),
  paidAt: text('paid_at').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull(),
})

export const recurringMonthOverrides = sqliteTable('recurring_month_overrides', {
  id: text('id').primaryKey(),
  recurringId: text('recurring_id')
    .notNull()
    .references(() => recurrings.id, { onDelete: 'cascade' }),
  referenceMonth: text('reference_month').notNull(),
  amount: real('amount').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const debtPayments = sqliteTable('debt_payments', {
  id: text('id').primaryKey(),
  transactionId: text('transaction_id')
    .notNull()
    .references(() => transactions.id, { onDelete: 'cascade' }),
  referenceMonth: text('reference_month').notNull(),
  paidAt: text('paid_at').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull(),
})

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  amount: real('amount').notNull(),
  description: text('description').notNull(),
  occurredAt: text('occurred_at').notNull(),
  dueDate: text('due_date'),
  paidAt: text('paid_at'),
  referenceMonth: text('reference_month'),
  status: text('status').notNull().default('pending'),
  kind: text('kind'),
  debtCategory: text('debt_category'),
  installmentNumber: integer('installment_number'),
  installmentTotal: integer('installment_total'),
  isShared: integer('is_shared', { mode: 'boolean' }).notNull().default(false),
  notes: text('notes'),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').references(() => accounts.id, { onDelete: 'cascade' }),
  cardId: text('card_id').references(() => cards.id, { onDelete: 'cascade' }),
  categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
  familyId: text('family_id').references(() => families.id, { onDelete: 'set null' }),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const monthlyPlans = sqliteTable('monthly_plans', {
  id: text('id').primaryKey(),
  referenceMonth: text('reference_month').notNull(),
  monthlyIncome: real('monthly_income').notNull().default(0),
  savingsGoal: real('savings_goal').notNull().default(0),
  savingsPaidAt: text('savings_paid_at'),
  endOfMonthLeftover: real('end_of_month_leftover'),
  closedAt: text('closed_at'),
  notes: text('notes'),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  familyId: text('family_id').references(() => families.id, { onDelete: 'set null' }),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const savingsGoals = sqliteTable('savings_goals', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  targetAmount: real('target_amount').notNull(),
  targetDate: text('target_date'),
  isShared: integer('is_shared', { mode: 'boolean' }).notNull().default(true),
  archivedAt: text('archived_at'),
  accountId: text('account_id').references(() => accounts.id, { onDelete: 'set null' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  familyId: text('family_id').references(() => families.id, { onDelete: 'set null' }),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const savingsContributions = sqliteTable('savings_contributions', {
  id: text('id').primaryKey(),
  goalId: text('goal_id')
    .notNull()
    .references(() => savingsGoals.id, { onDelete: 'cascade' }),
  amount: real('amount').notNull(),
  contributedAt: text('contributed_at').notNull(),
  note: text('note'),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull(),
})

export const invoiceAnalyses = sqliteTable('invoice_analyses', {
  id: text('id').primaryKey(),
  cardName: text('card_name').notNull(),
  referenceMonth: text('reference_month').notNull(),
  totalAmount: real('total_amount').notNull().default(0),
  itemsCount: integer('items_count').notNull().default(0),
  itemsJson: text('items_json').notNull(),
  isShared: integer('is_shared', { mode: 'boolean' }).notNull().default(true),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  familyId: text('family_id').references(() => families.id, { onDelete: 'set null' }),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})
