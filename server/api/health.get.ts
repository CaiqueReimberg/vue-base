import { db } from '../database'
import { categories, DB_SCHEMA_NAME } from '../database/schema'

export default defineEventHandler(async () => {
  await db.select({ id: categories.id }).from(categories).limit(1)
  return {
    status: 'ok',
    database: 'up',
    engine: process.env.DATABASE_URL ? 'postgresql' : 'sqlite',
    schema: process.env.DATABASE_URL ? DB_SCHEMA_NAME : 'local',
  }
})
