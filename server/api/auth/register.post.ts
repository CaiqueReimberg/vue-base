import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { readBody } from 'h3'
import { db } from '../../database'
import { users } from '../../database/schema'
import { badRequest, conflict, signJwt } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: string; name?: string; password?: string }>(event)
  const email = body?.email?.trim().toLowerCase()
  const name = body?.name?.trim() || null
  const password = body?.password

  if (!email || !password) {
    badRequest('Informe e-mail e senha')
  }

  if (password.length < 6) {
    badRequest('A senha deve ter no mínimo 6 caracteres')
  }

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (existing) {
    conflict('Email já está em uso')
  }

  const hashedPassword = await bcrypt.hash(password, 10)
  const now = new Date().toISOString()
  const id = randomUUID()

  await db.insert(users).values({
    id,
    email,
    name,
    password: hashedPassword,
    familyId: null,
    createdAt: now,
    updatedAt: now,
  })

  return {
    access_token: signJwt({ sub: id, email }),
  }
})
