import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { createError, readBody } from 'h3'
import { db } from '../../database'
import { users } from '../../database/schema'
import { badRequest, signJwt } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: string; password?: string }>(event)
  const email = body?.email?.trim().toLowerCase()
  const password = body?.password

  if (!email || !password) {
    badRequest('Informe e-mail e senha')
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Credenciais inválidas',
      data: { message: 'Credenciais inválidas' },
    })
  }

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Credenciais inválidas',
      data: { message: 'Credenciais inválidas' },
    })
  }

  return {
    access_token: signJwt({ sub: user.id, email: user.email }),
  }
})
