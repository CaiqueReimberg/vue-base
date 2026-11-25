const KNOWN_CARD_ISSUERS: Array<{
  canonical: string
  patterns: RegExp[]
  /** Se true, mesmo sem a palavra "Fatura"/"Cartão" no título da recorrência já identifica cartão */
  standaloneBankBrand?: boolean
}> = [
  {
    canonical: 'nubank',
    patterns: [/\bnubank\b/, /\broxinho\b/, /\bnu\s*pagamentos\b/],
    standaloneBankBrand: true,
  },
  {
    canonical: 'c6',
    patterns: [/\bc6\s*bank\b/, /\bc6bank\b/, /\bc6\b/],
    standaloneBankBrand: true,
  },
  {
    canonical: 'itau',
    patterns: [/\bitau\b/, /\bpersonnalite\b/, /\buniclass\b/],
    standaloneBankBrand: true,
  },
  {
    canonical: 'inter',
    patterns: [/\bbanco\s*inter\b/, /\binter\b/],
    standaloneBankBrand: false,
  },
  {
    canonical: 'santander',
    patterns: [/\bsantander\b/, /\bsfera\b/],
    standaloneBankBrand: true,
  },
  {
    canonical: 'bradesco',
    patterns: [/\bbradesco\b/],
    standaloneBankBrand: true,
  },
  {
    canonical: 'xp',
    patterns: [/\bxp\b/],
    standaloneBankBrand: true,
  },
  {
    canonical: 'btg',
    patterns: [/\bbtg\b/],
    standaloneBankBrand: true,
  },
  {
    canonical: 'bb',
    patterns: [/\bbanco\s*do\s*brasil\b/, /\bourocard\b/, /\bbb\b/],
    standaloneBankBrand: false,
  },
  {
    canonical: 'caixa',
    patterns: [/\bcaixa\b/],
    standaloneBankBrand: false,
  },
  {
    canonical: 'picpay',
    patterns: [/\bpicpay\b/],
    standaloneBankBrand: true,
  },
  {
    canonical: 'mercadopago',
    patterns: [/\bmercado\s*pago\b/, /\bmercadopago\b/],
    standaloneBankBrand: true,
  },
  {
    canonical: 'porto',
    patterns: [/\bporto\s*seguro\b/, /\bporto\s*bank\b/, /\bportobank\b/],
    standaloneBankBrand: false,
  },
  {
    canonical: 'will',
    patterns: [/\bwill\s*bank\b/, /\bwillbank\b/],
    standaloneBankBrand: true,
  },
  {
    canonical: 'neon',
    patterns: [/\bneon\b/],
    standaloneBankBrand: true,
  },
  {
    canonical: 'pan',
    patterns: [/\bbanco\s*pan\b/, /\bpan\b/],
    standaloneBankBrand: false,
  },
  {
    canonical: 'digio',
    patterns: [/\bdigio\b/],
    standaloneBankBrand: true,
  },
  {
    canonical: 'sicredi',
    patterns: [/\bsicredi\b/],
    standaloneBankBrand: true,
  },
  {
    canonical: 'sicoob',
    patterns: [/\bsicoob\b/],
    standaloneBankBrand: true,
  },
  {
    canonical: 'safra',
    patterns: [/\bsafra\b/],
    standaloneBankBrand: true,
  },
  {
    canonical: 'original',
    patterns: [/\boriginal\b/],
    standaloneBankBrand: false,
  },
  {
    canonical: 'amazon',
    patterns: [/\bamazon\b/],
    standaloneBankBrand: false,
  },
  {
    canonical: 'samsung',
    patterns: [/\bsamsung\b/],
    standaloneBankBrand: false,
  },
  {
    canonical: 'azul',
    patterns: [/\bazul\b/],
    standaloneBankBrand: false,
  },
  {
    canonical: 'latam',
    patterns: [/\blatam\b/],
    standaloneBankBrand: false,
  },
]

const GENERIC_INVOICE_STOPWORDS = new Set([
  'fatura',
  'faturas',
  'cartao',
  'cartoes',
  'credito',
  'banco',
  'bank',
  'card',
  'de',
  'do',
  'da',
  'dos',
  'das',
  'meu',
  'minha',
])

export function normalizePlainText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractOwnerTokens(ownerName?: string | null): Set<string> {
  if (!ownerName) return new Set()
  const norm = normalizePlainText(ownerName)
  return new Set(norm.split(' ').filter((t) => t.length >= 2))
}

/**
 * Gera a chave canônica de um cartão/fatura para garantir idempotência (1 fatura por cartão por pessoa).
 * Ex: "Fatura Nubank - Matheus", "Fatura do Nubank", "Nubank" -> "card:nubank"
 */
export function resolveInvoiceCardKey(cardName: string, ownerName?: string | null): string {
  const norm = normalizePlainText(cardName)
  if (!norm) return 'card:unknown'

  for (const issuer of KNOWN_CARD_ISSUERS) {
    if (issuer.patterns.some((re) => re.test(norm))) {
      return `card:${issuer.canonical}`
    }
  }

  const ownerTokens = extractOwnerTokens(ownerName)
  const tokens = norm
    .split(' ')
    .filter((t) => t && !GENERIC_INVOICE_STOPWORDS.has(t) && !ownerTokens.has(t))

  const cleaned = tokens.join(' ').trim()
  return `card:${cleaned || norm}`
}

/**
 * Avalia se uma conta recorrente representa uma fatura de cartão e retorna sua chave canônica,
 * ou `null` caso seja uma conta comum (ex: Luz, Aluguel, Internet, Seguro).
 */
export function resolveRecurringCardKey(
  recurringName: string,
  ownerName?: string | null,
  forceCardInvoice = false,
): string | null {
  if (forceCardInvoice) {
    return resolveInvoiceCardKey(recurringName, ownerName)
  }

  const norm = normalizePlainText(recurringName)
  if (!norm) return null

  const hasInvoiceKeyword = /\b(fatura|faturas|cartao|cartoes)\b/.test(norm)

  // Evita confundir empréstimo, financiamento, seguro ou assinatura com fatura de cartão
  if (
    !hasInvoiceKeyword &&
    /\b(emprestimo|financiamento|seguro|consorcio|assinatura|prime|plano)\b/.test(norm)
  ) {
    return null
  }

  if (hasInvoiceKeyword) {
    return resolveInvoiceCardKey(recurringName, ownerName)
  }

  for (const issuer of KNOWN_CARD_ISSUERS) {
    if (issuer.standaloneBankBrand && issuer.patterns.some((re) => re.test(norm))) {
      return `card:${issuer.canonical}`
    }
  }

  return null
}
