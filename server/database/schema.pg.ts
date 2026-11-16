import { pgSchema, text, doublePrecision, integer, boolean } from 'drizzle-orm/pg-core'

export const DB_SCHEMA_NAME = process.env.DB_SCHEMA || 'dualpact'

export const dualpactSchema = pgSchema(DB_SCHEMA_NAME)

export const families = dualpactSchema.table('families', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const users = dualpactSchema.table('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  name: text('name'),
  familyId: text('family_id').references(() => families.id, { onDelete: 'set null' }),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const accounts = dualpactSchema.table('accounts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'checking' | 'savings' | 'investment'
  balance: doublePrecision('balance').notNull().default(0),
  initialBalance: doublePrecision('initial_balance').notNull().default(0),
  bankName: text('bank_name'),
  isActive: boolean('is_active').notNull().default(true),
  shareWithPartner: boolean('share_with_partner').notNull().default(false),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  familyId: text('family_id').references(() => families.id, { onDelete: 'set null' }),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const cards = dualpactSchema.table('cards', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  limitAmount: doublePrecision('limit_amount').notNull(),
  closingDay: integer('closing_day').notNull(),
  dueDay: integer('due_day').notNull(),
  bankName: text('bank_name'),
  brand: text('brand'),
  last4: text('last4'),
  isActive: boolean('is_active').notNull().default(true),
  shareWithPartner: boolean('share_with_partner').notNull().default(false),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  familyId: text('family_id').references(() => families.id, { onDelete: 'set null' }),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const categories = dualpactSchema.table('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'expense' | 'income'
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const budgets = dualpactSchema.table('budgets', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  scope: text('scope').notNull(), // 'total' | 'category' | 'person'
  period: text('period').notNull().default('monthly'),
  audience: text('audience').notNull().default('individual'),
  limitAmount: doublePrecision('limit_amount').notNull(),
  isActive: boolean('is_active').notNull().default(true),
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

export const recurrings = dualpactSchema.table('recurrings', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind').notNull(), // 'fixed_bill' | 'subscription'
  transactionType: text('type').notNull(), // 'expense' | 'income'
  frequency: text('frequency').notNull().default('monthly'),
  amount: doublePrecision('amount').notNull(),
  description: text('description'),
  dueDay: integer('due_day'),
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
  isActive: boolean('is_active').notNull().default(true),
  isShared: boolean('is_shared').notNull().default(false),
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

export const recurringPayments = dualpactSchema.table('recurring_payments', {
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

export const transactions = dualpactSchema.table('transactions', {
  id: text('id').primaryKey(),
  type: text('type').notNull(), // 'expense' | 'income'
  amount: doublePrecision('amount').notNull(),
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
  isShared: boolean('is_shared').notNull().default(false),
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

export const monthlyPlans = dualpactSchema.table('monthly_plans', {
  id: text('id').primaryKey(),
  referenceMonth: text('reference_month').notNull(), // 'YYYY-MM'
  monthlyIncome: doublePrecision('monthly_income').notNull().default(0),
  savingsGoal: doublePrecision('savings_goal').notNull().default(0),
  savingsPaidAt: text('savings_paid_at'),
  endOfMonthLeftover: doublePrecision('end_of_month_leftover'),
  closedAt: text('closed_at'),
  notes: text('notes'),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  familyId: text('family_id').references(() => families.id, { onDelete: 'set null' }),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})
