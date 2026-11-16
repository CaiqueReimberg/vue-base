import { defineConfig } from 'drizzle-kit'

const schemaName = process.env.DB_SCHEMA || 'dualpact'

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/database/schema.pg.ts',
  out: './server/database/migrations',
  schemaFilter: [schemaName],
  dbCredentials: {
    url: process.env.DATABASE_URL || '',
  },
})
