import * as pgTables from './schema.pg'
import * as sqliteTables from './schema.sqlite'

const isPostgres = Boolean(process.env.DATABASE_URL)

const active = (isPostgres ? pgTables : sqliteTables) as typeof sqliteTables

export const dualpactSchema = pgTables.dualpactSchema
export const DB_SCHEMA_NAME = pgTables.DB_SCHEMA_NAME

export const families = active.families
export const users = active.users
export const accounts = active.accounts
export const cards = active.cards
export const categories = active.categories
export const budgets = active.budgets
export const recurrings = active.recurrings
export const recurringPayments = active.recurringPayments
export const recurringMonthOverrides = active.recurringMonthOverrides
export const debtPayments = active.debtPayments
export const transactions = active.transactions
export const monthlyPlans = active.monthlyPlans
export const savingsGoals = active.savingsGoals
export const savingsContributions = active.savingsContributions
export const invoiceAnalyses = active.invoiceAnalyses
export const cardMonthlyInvoices = active.cardMonthlyInvoices
export const incomeEntries = active.incomeEntries
export const featureFlags = active.featureFlags
export const telegramNotificationLogs = active.telegramNotificationLogs
