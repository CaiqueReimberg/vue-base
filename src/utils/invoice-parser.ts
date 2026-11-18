import type { ParsedInvoiceItem } from '@/api/invoices.api'

export const INVOICE_CATEGORIES = [
  'Delivery & Restaurantes',
  'Supermercado',
  'Transporte & Combustível',
  'Compras & Lojas',
  'Assinaturas & Streaming',
  'Saúde & Farmácia',
  'Casa & Pets',
  'Lazer & Viagem',
  'Serviços & Taxas',
  'Outros',
] as const

export type InvoiceCategoryName = (typeof INVOICE_CATEGORIES)[number]

const CATEGORY_RULES: Array<{ category: InvoiceCategoryName; keywords: string[] }> = [
  {
    category: 'Delivery & Restaurantes',
    keywords: [
      'ifood',
      'ifd*',
      'ifd ',
      'rappi',
      'ze delivery',
      'zé delivery',
      'aiqfome',
      'mcdonalds',
      'mc donalds',
      'arcos dourados',
      'burger king',
      'bk ',
      'outback',
      'starbucks',
      'restaurante',
      'lanchonete',
      'padaria',
      'panificadora',
      'pizzaria',
      'pizza',
      'sushi',
      'churrascaria',
      'hamburgueria',
      'burger',
      'cafe',
      'cafeteria',
      'acai',
      'açaí',
      'sorveteria',
      'bar ',
      'boteco',
      'cervejaria',
      'doceria',
      'confeitaria',
    ],
  },
  {
    category: 'Supermercado',
    keywords: [
      'supermercado',
      'mercado',
      'atacadao',
      'atacadão',
      'assai',
      'assaí',
      'carrefour',
      'pao de acucar',
      'pão de açúcar',
      'extra ',
      'hortifruti',
      'sacolao',
      'sacolão',
      'oba ',
      'sonda',
      'mambo',
      'zaffari',
      'angeloni',
      'bistek',
      'giassi',
      'condor',
      'muffato',
      'guanabara',
      'mundial',
      'prezunic',
      'zona sul',
      'epa ',
      'super nosso',
      'bh supermercados',
      'mateus super',
      'acougue',
      'açougue',
      'minimercado',
      'oxxo',
      'carrefour',
      'sam s club',
      'sams club',
    ],
  },
  {
    category: 'Transporte & Combustível',
    keywords: [
      'uber',
      '99app',
      '99*',
      '99 pop',
      '99pop',
      'indrive',
      'cabify',
      'posto ',
      'auto posto',
      'autoposto',
      'combustivel',
      'combustível',
      'shell',
      'ipiranga',
      'petrobras',
      'br mania',
      'ale ',
      'sem parar',
      'semparar',
      'veloe',
      'conectcar',
      'taggy',
      'estapar',
      'indigo',
      'estacionamento',
      'park ',
      'parking',
      'pedagio',
      'pedágio',
      'recarga bilhete',
      'top sp',
    ],
  },
  {
    category: 'Compras & Lojas',
    keywords: [
      'mercadolivre',
      'mercado livre',
      'meli ',
      'mp *',
      'amazon',
      'amzn',
      'shopee',
      'shp*',
      'shein',
      'aliexpress',
      'magalu',
      'magazine luiza',
      'casas bahia',
      'ponto frio',
      'fast shop',
      'kabum',
      'pichau',
      'terabyteshop',
      'renner',
      'riachuelo',
      'c&a',
      'cea ',
      'zara',
      'hering',
      'centauro',
      'decathlon',
      'netshoes',
      'nike',
      'adidas',
      'sephora',
      'oticario',
      'boticario',
      'natura',
      'kalunga',
      'americanas',
    ],
  },
  {
    category: 'Assinaturas & Streaming',
    keywords: [
      'netflix',
      'spotify',
      'youtube',
      'google *',
      'google one',
      'apple.com/bill',
      'itunes',
      'icloud',
      'prime video',
      'amazon prime',
      'disney',
      'hbo',
      'max.com',
      'globoplay',
      'paramount',
      'crunchyroll',
      'chatgpt',
      'openai',
      'claude',
      'anthropic',
      'cursor',
      'github',
      'microsoft',
      'xbox',
      'playstation',
      'steam',
      'nintendo',
      'canva',
      'adobe',
      'vivo',
      'claro',
      'tim ',
    ],
  },
  {
    category: 'Saúde & Farmácia',
    keywords: [
      'drogasil',
      'droga raia',
      'drogaria',
      'farmacia',
      'farmácia',
      'pague menos',
      'panvel',
      'araujo',
      'araújo',
      'venancio',
      'acheco',
      'extrafarma',
      'ultrafarma',
      'sao paulo',
      'smartfit',
      'smart fit',
      'bluefit',
      'bodytech',
      'gympass',
      'wellhub',
      'totalpass',
      'academia',
      'hospital',
      'clinica',
      'clínica',
      'laboratorio',
      'laboratório',
      'fleury',
      'delboni',
      'sabini',
      'unimed',
      'odonto',
      'dentista',
    ],
  },
  {
    category: 'Casa & Pets',
    keywords: [
      'petz',
      'cobasi',
      'petlove',
      'pet shop',
      'petshop',
      'veterinaria',
      'veterinária',
      'leroy merlin',
      'telhanorte',
      'c&c',
      'sodimac',
      'obrlar',
      'tokstok',
      'tok&stok',
      'madeiramadeira',
      'camicado',
      'lavanderia',
    ],
  },
  {
    category: 'Lazer & Viagem',
    keywords: [
      'cinemark',
      'cinepolis',
      'kinoplex',
      'uci ',
      'cinema',
      'ingresso',
      'sympla',
      'eventim',
      'ticketmaster',
      'airbnb',
      'booking',
      'decolar',
      'hoteis',
      'hotel',
      'pousada',
      'latam',
      'azul ',
      'gol ',
      'clickbus',
      'buser',
    ],
  },
]

export function detectCategory(description: string, hintCategory?: string): InvoiceCategoryName {
  const lower = `${description} ${hintCategory || ''}`.toLowerCase()
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return rule.category
    }
  }
  if (hintCategory) {
    const h = hintCategory.toLowerCase()
    if (h.includes('restaurante') || h.includes('lanchonete') || h.includes('alimenta')) return 'Delivery & Restaurantes'
    if (h.includes('mercado') || h.includes('supermercado') || h.includes('mercearia') || h.includes('padaria')) return 'Supermercado'
    if (h.includes('transporte') || h.includes('combust')) return 'Transporte & Combustível'
    if (h.includes('saúde') || h.includes('saude') || h.includes('farm')) return 'Saúde & Farmácia'
    if (h.includes('assinatura') || h.includes('streaming')) return 'Assinaturas & Streaming'
    if (h.includes('casa') || h.includes('mobili') || h.includes('escritório') || h.includes('escritorio')) return 'Casa & Pets'
    if (h.includes('vestuário') || h.includes('vestuario') || h.includes('roupa') || h.includes('departamento') || h.includes('desconto')) return 'Compras & Lojas'
    if (h.includes('lazer') || h.includes('viagem') || h.includes('turismo')) return 'Lazer & Viagem'
    if (h.includes('serviço') || h.includes('servico') || h.includes('associa') || h.includes('profissiona')) return 'Serviços & Taxas'
  }
  return 'Outros'
}

export function normalizeMerchantName(description: string): string {
  const clean = description
    .replace(/\b\d{1,2}\/\d{1,2}\b/g, '')
    .replace(/parcela\s*\d+\s*de\s*\d+/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

  const lower = clean.toLowerCase()
  if (lower.includes('ifood') || lower.startsWith('ifd*') || lower.startsWith('ifd ')) return 'iFood'
  if (lower.includes('uber')) return 'Uber'
  if (lower.startsWith('99app') || lower.startsWith('99*') || lower.includes('99 pop')) return '99'
  if (lower.includes('mercadolivre') || lower.includes('mercado livre') || lower.startsWith('mp *meli')) {
    return 'Mercado Livre'
  }
  if (lower.includes('amazon prime') || lower.includes('prime video')) return 'Amazon Prime'
  if (lower.includes('amazon') || lower.includes('amzn')) return 'Amazon'
  if (lower.includes('shopee') || lower.startsWith('shp*')) return 'Shopee'
  if (lower.includes('netflix')) return 'Netflix'
  if (lower.includes('spotify')) return 'Spotify'
  if (lower.includes('youtube') || lower.includes('google')) return 'Google / YouTube'
  if (lower.includes('apple.com') || lower.includes('icloud')) return 'Apple'
  if (lower.includes('drogasil') || lower.includes('droga raia')) return 'Drogasil / Raia'
  if (lower.includes('smartfit') || lower.includes('smart fit')) return 'Smart Fit'
  if (lower.includes('wellhub') || lower.includes('gympass')) return 'Wellhub (Gympass)'
  if (lower.includes('ze delivery') || lower.includes('zé delivery')) return 'Zé Delivery'
  if (lower.includes('rappi')) return 'Rappi'

  // Remove prefixos de maquininha tipo "PAG*", "MP *", "PG *", "EC *"
  return clean.replace(/^(pag\*|mp\s*\*|pg\s*\*|ec\s*\*|html\*|ebn\*)/i, '').trim() || description
}

export function detectInstallment(description: string): string | null {
  const match =
    description.match(/\b(\d{1,2}\/\d{1,2})\b/) ||
    description.match(/parcela\s*(\d{1,2})\s*(?:de|\/)\s*(\d{1,2})/i)
  if (!match) return null
  if (match[2]) return `${match[1]}/${match[2]}`
  return match[1]
}

function parseMoneyString(raw: string): number | null {
  const cleaned = raw.replace(/R\$/gi, '').replace(/\s/g, '').trim()
  if (!cleaned) return null
  // Ignora valores negativos (pagamentos de fatura / estornos)
  if (cleaned.startsWith('-')) return -Math.abs(parsePositiveMoney(cleaned.slice(1)))
  return parsePositiveMoney(cleaned)
}

function parsePositiveMoney(str: string): number {
  const only = str.replace(/[^\d.,]/g, '')
  if (!only) return NaN
  if (only.includes(',')) {
    // Formato BR: 1.250,50 -> 1250.50
    const normalized = only.replace(/\./g, '').replace(',', '.')
    return Number(normalized)
  }
  return Number(only)
}

function isPaymentOrCreditDescription(desc: string): boolean {
  const lower = desc.toLowerCase()
  return (
    lower.includes('pagamento recebido') ||
    lower.includes('pagamento de fatura') ||
    lower.includes('pagamento fatura') ||
    lower.includes('inclusao de pagamento') ||
    lower.includes('credito de fatura')
  )
}

function extractOfxTag(block: string, tagName: string): string {
  const re = new RegExp(`<${tagName}>([^<\\r\\n]+)`, 'i')
  const match = block.match(re)
  return match ? match[1].trim() : ''
}

function formatOfxDate(dtPosted: string): string {
  const digits = dtPosted.replace(/\D/g, '')
  if (digits.length >= 8) {
    const month = digits.slice(4, 6)
    const day = digits.slice(6, 8)
    return `${day}/${month}`
  }
  return 'No mês'
}

export function parseOfxText(rawText: string): ParsedInvoiceItem[] {
  const parts = rawText.split(/<STMTTRN>/i).slice(1)
  if (parts.length === 0) return []

  const rawEntries: Array<{
    date: string
    description: string
    rawAmount: number
    trnType: string
  }> = []

  for (const part of parts) {
    const block = part.split(/<\/STMTTRN>/i)[0] || part
    const trnType = extractOfxTag(block, 'TRNTYPE').toUpperCase()
    const dtPosted = extractOfxTag(block, 'DTPOSTED')
    const trnAmtStr = extractOfxTag(block, 'TRNAMT')
    const memo = extractOfxTag(block, 'MEMO')
    const name = extractOfxTag(block, 'NAME')

    const description = (memo.length >= name.length ? memo : name) || memo || name
    const rawAmount = parseMoneyString(trnAmtStr)

    if (!description || rawAmount == null || !Number.isFinite(rawAmount) || rawAmount === 0) {
      continue
    }
    if (isPaymentOrCreditDescription(description)) {
      continue
    }

    rawEntries.push({
      date: formatOfxDate(dtPosted),
      description,
      rawAmount,
      trnType,
    })
  }

  // Em arquivos OFX de cartão de crédito (Nubank, Itaú, Inter, Bradesco, Santander),
  // compras (DEBIT) vêm com TRNAMT negativo (-68.90) e pagamentos de fatura (CREDIT) vêm positivos.
  const negCount = rawEntries.filter((e) => e.rawAmount < 0).length
  const posCount = rawEntries.filter((e) => e.rawAmount > 0).length
  const expensesAreNegative = negCount >= posCount

  const items: ParsedInvoiceItem[] = []
  let idx = 0

  for (const entry of rawEntries) {
    if (expensesAreNegative && entry.rawAmount > 0 && entry.trnType === 'CREDIT') {
      continue
    }
    if (!expensesAreNegative && entry.rawAmount < 0) {
      continue
    }

    const amount = Math.round(Math.abs(entry.rawAmount) * 100) / 100
    if (amount <= 0) continue

    idx += 1
    items.push({
      id: `ofx-${idx}-${Math.random().toString(36).slice(2, 7)}`,
      date: entry.date,
      description: entry.description,
      merchant: normalizeMerchantName(entry.description),
      amount,
      category: detectCategory(entry.description),
      installment: detectInstallment(entry.description),
    })
  }

  return items
}

/**
 * Faz o parse de qualquer formato de fatura:
 * 0. Arquivo OFX (<OFX> / <STMTTRN>) de qualquer banco brasileiro
 * 1. CSV do Nubank (date,category,title,amount ou date,title,amount)
 * 2. CSV do Inter / Itaú / C6 / XP (separado por ; ou ,)
 * 3. Texto colado direto do PDF ou App (ex: "05/11 IFOOD *PIZZA R$ 68,90")
 */
export function parseInvoiceText(rawText: string): ParsedInvoiceItem[] {
  if (/<STMTTRN>/i.test(rawText) || /<OFX>/i.test(rawText)) {
    return parseOfxText(rawText)
  }

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  const items: ParsedInvoiceItem[] = []
  let idx = 0

  let csvDescIndex = -1
  let csvCatIndex = -1
  let csvInstIndex = -1
  let csvDateIndex = 0
  let csvAmountIndex = -1

  for (const line of lines) {
    idx += 1
    // Detecta e mapeia cabeçalho CSV (C6 Bank, Nubank, Itaú, Inter, XP, etc.)
    if (
      idx === 1 &&
      /^(date|data|vencimento|lan[cç]amento)/i.test(line.replace(/["']/g, ''))
    ) {
      const headerSep = line.includes(';') ? ';' : ','
      const headers = line
        .split(headerSep)
        .map((h) => h.replace(/^["']|["']$/g, '').trim().toLowerCase())

      csvDateIndex = headers.findIndex((h) => h.includes('data') || h === 'date')
      if (csvDateIndex < 0) csvDateIndex = 0

      csvDescIndex = headers.findIndex(
        (h) =>
          h.includes('descri') ||
          h === 'title' ||
          h.includes('estabelecimento') ||
          h.includes('lançamento') ||
          h.includes('lancamento') ||
          h.includes('histórico') ||
          h.includes('historico'),
      )

      csvCatIndex = headers.findIndex((h) => h.includes('categoria') || h === 'category')
      csvInstIndex = headers.findIndex((h) => h.includes('parcela') || h.includes('installment'))

      // Pega a última coluna de valor (ex: "Valor (em R$)" no C6 ou "amount" no Nubank)
      for (let i = headers.length - 1; i >= 0; i--) {
        if (headers[i].includes('valor') || headers[i].includes('amount')) {
          csvAmountIndex = i
          break
        }
      }
      continue
    }

    // 1. Tenta formato CSV (separado por ; ou , com pelo menos 3 colunas)
    if (line.includes(';') || (line.split(',').length >= 3 && /^\d{4}-\d{2}-\d{2}|^"?\d{2}\/\d{2}/.test(line))) {
      const sep = line.includes(';') ? ';' : ','
      const cols = line.split(sep).map((c) => c.replace(/^["']|["']$/g, '').trim())

      if (cols.length >= 3) {
        const dateCol = cols[csvDateIndex >= 0 && csvDateIndex < cols.length ? csvDateIndex : 0]
        const amountCol =
          csvAmountIndex >= 0 && csvAmountIndex < cols.length
            ? cols[csvAmountIndex]
            : cols[cols.length - 1]
        const amount = parseMoneyString(amountCol)

        if (amount != null && Number.isFinite(amount) && amount > 0) {
          let description = ''
          let hintCat: string | undefined
          let csvInst: string | null = null

          if (csvDescIndex >= 0 && csvDescIndex < cols.length) {
            description = cols[csvDescIndex]
          } else if (cols.length >= 6) {
            // Fallback para CSV estilo C6 sem cabeçalho (Data;Nome;Final;Categoria;Descrição;Parcela;...)
            description = cols[4]
            hintCat = cols[3]
            csvInst = cols[5]
          } else {
            description = cols.length >= 4 ? cols[2] : cols[1]
            hintCat = cols.length >= 4 ? cols[1] : undefined
          }

          if (csvCatIndex >= 0 && csvCatIndex < cols.length) {
            hintCat = cols[csvCatIndex]
          }
          if (csvInstIndex >= 0 && csvInstIndex < cols.length) {
            csvInst = cols[csvInstIndex]
          }

          const installment =
            (csvInst && /\d{1,2}\/\d{1,2}/.test(csvInst) ? csvInst : null) ||
            detectInstallment(description)

          if (!isPaymentOrCreditDescription(description)) {
            items.push({
              id: `item-${idx}-${Math.random().toString(36).slice(2, 7)}`,
              date: dateCol,
              description,
              merchant: normalizeMerchantName(description),
              amount: Math.round(amount * 100) / 100,
              category: detectCategory(description, hintCat),
              installment,
            })
            continue
          }
        }
      }
    }

    // 2. Formato Texto Livre / PDF / Copiar e Colar:
    // Ex: "05/11 IFOOD *RESTAURANTE R$ 58,90" ou "05 NOV UBER *TRIP 32,40" ou "IFOOD 58,90"
    const freeMatch = line.match(
      /^(?:(\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?|\d{4}-\d{2}-\d{2}|\d{1,2}\s+[A-Za-zçÇ]{3})\s+)?(.+?)\s+(?:R\$\s*)?(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+\.\d{2})\s*$/i,
    )

    if (freeMatch) {
      const dateStr = freeMatch[1] || 'No mês'
      const descStr = freeMatch[2].replace(/\s+/g, ' ').trim()
      const amount = parseMoneyString(freeMatch[3])

      if (
        amount != null &&
        Number.isFinite(amount) &&
        amount > 0 &&
        !isPaymentOrCreditDescription(descStr)
      ) {
        items.push({
          id: `item-${idx}-${Math.random().toString(36).slice(2, 7)}`,
          date: dateStr,
          description: descStr,
          merchant: normalizeMerchantName(descStr),
          amount: Math.round(amount * 100) / 100,
          category: detectCategory(descStr),
          installment: detectInstallment(descStr),
        })
      }
    }
  }

  return items
}

export const SAMPLE_INVOICE_TEXT = [
  '02/11 IFOOD *RESTAURANTE R$ 68,90',
  '03/11 UBER *UBER *TRIP R$ 28,40',
  '04/11 SUPERMERCADO ASSAI R$ 542,30',
  '05/11 NETFLIX.COM R$ 55,90',
  '06/11 IFOOD *BURGER KING R$ 54,50',
  '07/11 DROGASIL 1420 R$ 118,60',
  '08/11 MERCADOLIVRE*COMPRA 02/06 R$ 189,90',
  '09/11 UBER *UBER *TRIP R$ 34,20',
  '10/11 POSTO IPIRANGA R$ 240,00',
  '11/11 IFOOD *SUSHI HOUSE R$ 112,00',
  '12/11 AMAZON BR *COMPRAS 01/03 R$ 159,00',
  '14/11 SPOTIFY R$ 34,90',
  '15/11 SMARTFIT ACADEMIA R$ 139,90',
  '16/11 PADARIA REAL R$ 42,50',
  '18/11 SUPERMERCADO CARREFOUR R$ 389,40',
  '19/11 IFOOD *PIZZARIA R$ 94,00',
  '20/11 UBER *UBER *TRIP R$ 26,80',
  '22/11 PETZ LOJA R$ 164,00',
  '24/11 IFOOD *MERCADO R$ 78,20',
].join('\n')
