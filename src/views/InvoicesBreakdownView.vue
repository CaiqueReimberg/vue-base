<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import ConfirmModal from '@/components/ConfirmModal.vue'
import { useAuthStore } from '@/stores/auth/auth.store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Sheet } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import {
  invoicesApi,
  type ParsedInvoiceItem,
  type SavedInvoiceAnalysis,
} from '@/api/invoices.api'
import {
  INVOICE_CATEGORIES,
  parseInvoiceText,
  SAMPLE_INVOICE_TEXT,
} from '@/utils/invoice-parser'
import { useToastStore } from '@/stores/toast/toast.store'
import { currentReferenceMonth, formatCurrency, formatPeriodLabel } from '@/utils/month'
import {
  Car,
  Check,
  CreditCard,
  FileSpreadsheet,
  Flame,
  HeartPulse,
  Home,
  Layers,
  PieChart,
  Plane,
  Plus,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Store,
  Trash2,
  Tv,
  Upload,
  Users,
  Utensils,
} from 'lucide-vue-next'

const toastStore = useToastStore()
const authStore = useAuthStore()
const router = useRouter()

const CARD_PRESETS = ['Nubank', 'Itaú', 'Inter', 'C6 Bank', 'XP', 'Santander', 'Bradesco']

const loading = ref(true)
const savedInvoices = ref<SavedInvoiceAnalysis[]>([])
const selectedInvoiceId = ref<string | null>(null)

// Estado do Importador / Destrinchador (no Drawer ou tela inicial)
const importDrawerOpen = ref(false)
const cardName = ref('Nubank')
const referenceMonth = ref(currentReferenceMonth())
const dueDay = ref<number>(10)
const rawInvoiceText = ref('')
const previewItems = ref<ParsedInvoiceItem[]>([])
const isShared = ref(true)
const syncToMonthlyBill = ref(true)
const saving = ref(false)
const analyzingAi = ref(false)
const reanalyzingId = ref<string | null>(null)

// Filtro de categoria na visualização detalhada
const activeCategoryFilter = ref<string | null>(null)

// Exclusão
const removeOpen = ref(false)
const invoiceToRemove = ref<SavedInvoiceAnalysis | null>(null)

interface DisplayInvoiceItem extends ParsedInvoiceItem {
  _sourceInvoiceId?: string
  _sourceCardName?: string
}

// Meses que possuem 2 ou mais faturas salvas (habilita botão "Todos os cartões do mês")
const multiCardMonths = computed(() => {
  const map = new Map<string, { month: string; count: number; total: number }>()
  for (const inv of savedInvoices.value) {
    const prev = map.get(inv.referenceMonth) ?? {
      month: inv.referenceMonth,
      count: 0,
      total: 0,
    }
    prev.count += 1
    prev.total += Number(inv.totalAmount || 0)
    map.set(inv.referenceMonth, prev)
  }
  return Array.from(map.values()).filter((m) => m.count >= 2)
})

const isCombinedView = computed(
  () => Boolean(selectedInvoiceId.value && selectedInvoiceId.value.startsWith('all:')),
)

const combinedMonth = computed(() =>
  isCombinedView.value && selectedInvoiceId.value ? selectedInvoiceId.value.slice(4) : null,
)

const combinedInvoices = computed(() => {
  if (!combinedMonth.value) return []
  return savedInvoices.value.filter((i) => i.referenceMonth === combinedMonth.value)
})

// Fatura individual ativa exibida na tela (quando não está na visão somada)
const activeInvoice = computed<SavedInvoiceAnalysis | null>(() => {
  if (isCombinedView.value) return null
  if (selectedInvoiceId.value) {
    return savedInvoices.value.find((i) => i.id === selectedInvoiceId.value) ?? null
  }
  return savedInvoices.value[0] ?? null
})

const hasActiveSelection = computed(
  () => Boolean(activeInvoice.value) || combinedInvoices.value.length > 0,
)

const activeTitleLabel = computed(() => {
  if (isCombinedView.value && combinedMonth.value) {
    return `Todos os cartões (${combinedInvoices.value.length})`
  }
  return activeInvoice.value?.cardName ?? ''
})

const activePeriodText = computed(() => {
  if (isCombinedView.value && combinedMonth.value) {
    return formatPeriodLabel(combinedMonth.value)
  }
  return activeInvoice.value ? formatPeriodLabel(activeInvoice.value.referenceMonth) : ''
})

const activeItems = computed<DisplayInvoiceItem[]>(() => {
  if (isCombinedView.value) {
    const merged: DisplayInvoiceItem[] = []
    for (const inv of combinedInvoices.value) {
      for (const item of inv.items) {
        const tagged = item as DisplayInvoiceItem
        tagged._sourceInvoiceId = inv.id
        tagged._sourceCardName = inv.cardName
        merged.push(tagged)
      }
    }
    return merged.sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
  }
  return (activeInvoice.value?.items ?? []) as DisplayInvoiceItem[]
})

const activeTotal = computed(() =>
  activeItems.value.reduce((sum, i) => sum + Number(i.amount || 0), 0),
)

// 1. Ranking por Categoria ("Com o que mais gastei")
const categoryBreakdown = computed(() => {
  const total = activeTotal.value || 1
  const map = new Map<
    string,
    { category: string; amount: number; count: number; share: number }
  >()

  for (const item of activeItems.value) {
    const cat = item.category || 'Outros'
    const prev = map.get(cat) ?? { category: cat, amount: 0, count: 0, share: 0 }
    prev.amount += Number(item.amount || 0)
    prev.count += 1
    map.set(cat, prev)
  }

  return Array.from(map.values())
    .map((entry) => ({
      ...entry,
      share: Math.round((entry.amount / total) * 100),
    }))
    .sort((a, b) => b.amount - a.amount)
})

// 2. Top Estabelecimentos Agrupados ("Onde mais comprei / Maiores vilões")
const merchantBreakdown = computed(() => {
  const total = activeTotal.value || 1
  const map = new Map<
    string,
    { merchant: string; category: string; amount: number; count: number; share: number }
  >()

  for (const item of activeItems.value) {
    const key = (item.merchant || item.description).trim()
    const prev = map.get(key) ?? {
      merchant: key,
      category: item.category,
      amount: 0,
      count: 0,
      share: 0,
    }
    prev.amount += Number(item.amount || 0)
    prev.count += 1
    map.set(key, prev)
  }

  return Array.from(map.values())
    .map((entry) => ({
      ...entry,
      share: Math.round((entry.amount / total) * 100),
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8)
})

// 3. Compras Parceladas na Fatura
const installmentItems = computed(() =>
  activeItems.value.filter((i) => Boolean(i.installment)),
)

const filteredActiveItems = computed(() => {
  if (!activeCategoryFilter.value) return activeItems.value
  return activeItems.value.filter((i) => i.category === activeCategoryFilter.value)
})

const topCategory = computed(() => categoryBreakdown.value[0] ?? null)
const topMerchant = computed(() => merchantBreakdown.value[0] ?? null)

function getCategoryIcon(cat: string) {
  if (cat.includes('Delivery') || cat.includes('Restaurante')) return Utensils
  if (cat.includes('Supermercado')) return ShoppingCart
  if (cat.includes('Transporte')) return Car
  if (cat.includes('Compras')) return ShoppingBag
  if (cat.includes('Assinaturas')) return Tv
  if (cat.includes('Saúde')) return HeartPulse
  if (cat.includes('Casa')) return Home
  if (cat.includes('Lazer')) return Plane
  return Layers
}

async function fetchInvoices() {
  loading.value = true
  try {
    const list = await invoicesApi.list()
    savedInvoices.value = list
    if (list.length > 0 && !selectedInvoiceId.value) {
      selectedInvoiceId.value = list[0].id
    }
  } catch {
    toastStore.error('Não foi possível carregar as faturas salvas.')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  if (!authStore.profileLoaded) {
    await authStore.fetchProfile()
  }
  if (!authStore.invoiceAnalysisEnabled) {
    toastStore.error('A Análise de Faturas não está habilitada para sua conta.')
    router.replace('/')
    return
  }
  fetchInvoices()
})

function openImportDrawer() {
  rawInvoiceText.value = ''
  previewItems.value = []
  importDrawerOpen.value = true
}

function handleTextChange() {
  previewItems.value = parseInvoiceText(rawInvoiceText.value)
}

function loadSampleInvoice() {
  rawInvoiceText.value = SAMPLE_INVOICE_TEXT
  previewItems.value = parseInvoiceText(SAMPLE_INVOICE_TEXT)
}

async function decodeFileText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const utf8Text = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
  // Alguns bancos brasileiros exportam OFX/CSV em Windows-1252 ou ISO-8859-1
  if (utf8Text.includes('\uFFFD') || /CHARSET\s*:\s*1252/i.test(utf8Text)) {
    return new TextDecoder('windows-1252').decode(buffer)
  }
  return utf8Text
}

async function runAiContextAnalysis() {
  if (previewItems.value.length === 0 || analyzingAi.value) return
  analyzingAi.value = true
  try {
    const res = await invoicesApi.analyzeContext(previewItems.value)
    if (res.items && res.items.length > 0) {
      previewItems.value = res.items
      toastStore.success('Contexto de gastos classificado com Gemini!')
    }
  } catch (err) {
    toastStore.error(
      err instanceof Error ? err.message : 'Não foi possível classificar com o Gemini agora.',
    )
  } finally {
    analyzingAi.value = false
  }
}

async function handleReanalyzeSavedInvoice(inv: SavedInvoiceAnalysis) {
  if (reanalyzingId.value) return
  reanalyzingId.value = inv.id
  try {
    const updated = await invoicesApi.reanalyze(inv.id)
    savedInvoices.value = savedInvoices.value.map((item) =>
      item.id === updated.id ? updated : item,
    )
    toastStore.success('Fatura reclassificada por contexto de gastos com Gemini!')
  } catch (err) {
    toastStore.error(
      err instanceof Error ? err.message : 'Erro ao reclassificar fatura com o Gemini.',
    )
  } finally {
    reanalyzingId.value = null
  }
}

async function handleItemCategoryChange(changedItem?: DisplayInvoiceItem) {
  const targetInvId = changedItem?._sourceInvoiceId || activeInvoice.value?.id
  if (!targetInvId) return
  const inv = savedInvoices.value.find((i) => i.id === targetInvId)
  if (!inv) return
  try {
    await invoicesApi.updateItems(inv.id, inv.items)
  } catch {
    toastStore.error('Não foi possível salvar a alteração de categoria.')
  }
}

async function handleFileUpload(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const text = await decodeFileText(file)
    const parsed = parseInvoiceText(text)
    previewItems.value = parsed

    const isOfx = file.name.toLowerCase().endsWith('.ofx') || /<STMTTRN>/i.test(text)
    if (isOfx && parsed.length > 0) {
      rawInvoiceText.value = parsed
        .map((item) => {
          const datePart = item.date ? `${item.date} ` : ''
          const amtPart = item.amount.toFixed(2).replace('.', ',')
          return `${datePart}${item.description} R$ ${amtPart}`
        })
        .join('\n')
    } else {
      rawInvoiceText.value = text
    }

    if (previewItems.value.length === 0) {
      toastStore.error('Não encontramos lançamentos válidos nesse arquivo.')
    } else {
      await runAiContextAnalysis()
    }
  } catch {
    toastStore.error('Erro ao ler o arquivo da fatura.')
  } finally {
    input.value = ''
  }
}

const previewTotal = computed(() =>
  previewItems.value.reduce((sum, i) => sum + Number(i.amount || 0), 0),
)

async function handleSaveInvoice() {
  if (!cardName.value.trim()) {
    toastStore.error('Informe o nome do cartão.')
    return
  }
  if (previewItems.value.length === 0) {
    toastStore.error('Cole o texto da fatura ou envie um arquivo OFX ou CSV com pelo menos 1 item.')
    return
  }

  saving.value = true
  try {
    const created = await invoicesApi.create({
      cardName: cardName.value.trim(),
      referenceMonth: referenceMonth.value,
      items: previewItems.value,
      isShared: isShared.value,
      syncToMonthlyBill: syncToMonthlyBill.value,
      dueDay: dueDay.value,
    })
    savedInvoices.value = [created, ...savedInvoices.value]
    selectedInvoiceId.value = created.id
    activeCategoryFilter.value = null
    importDrawerOpen.value = false
    toastStore.success(
      syncToMonthlyBill.value
        ? `Fatura destrinchada e total (${formatCurrency(created.totalAmount)}) lançado nas Contas do Mês!`
        : 'Fatura destrinchada e salva com sucesso!',
    )
  } catch {
    toastStore.error('Erro ao salvar a fatura.')
  } finally {
    saving.value = false
  }
}

function openRemove(inv: SavedInvoiceAnalysis) {
  invoiceToRemove.value = inv
  removeOpen.value = true
}

async function confirmRemove() {
  const inv = invoiceToRemove.value
  if (!inv) return
  removeOpen.value = false
  try {
    await invoicesApi.delete(inv.id)
    savedInvoices.value = savedInvoices.value.filter((i) => i.id !== inv.id)
    if (selectedInvoiceId.value === inv.id) {
      selectedInvoiceId.value = savedInvoices.value[0]?.id ?? null
    }
    toastStore.success('Análise de fatura removida.')
  } catch {
    toastStore.error('Não foi possível remover.')
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-6">
    <ConfirmModal
      :open="removeOpen"
      title="Excluir análise de fatura"
      :message="
        invoiceToRemove
          ? `Deseja excluir a análise da fatura &quot;${invoiceToRemove.cardName}&quot; (${formatPeriodLabel(invoiceToRemove.referenceMonth)})?`
          : ''
      "
      confirm-label="Excluir"
      :danger="true"
      @close="removeOpen = false"
      @confirm="confirmRemove"
    />

    <!-- Cabeçalho -->
    <header class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h1 class="text-xl font-bold tracking-tight text-foreground">
          Análise de Faturas do Cartão
        </h1>
        <p class="mt-0.5 text-xs text-muted-foreground">
          Envie o arquivo OFX ou CSV do banco ou cole os lançamentos da fatura para ver exatamente com o que você mais gastou.
        </p>
      </div>

      <Button class="gap-1.5" @click="openImportDrawer">
        <Plus class="h-4 w-4" />
        <span>Destrinchar nova fatura</span>
      </Button>
    </header>

    <!-- Seletor de Faturas Salvas + Visão Somada por Mês -->
    <div v-if="savedInvoices.length > 0" class="flex flex-wrap items-center gap-2">
      <!-- Botões de Visão Somada ("Todos os cartões do mês") quando há 2+ faturas no mesmo mês -->
      <button
        v-for="mc in multiCardMonths"
        :key="`all-${mc.month}`"
        type="button"
        class="inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-medium transition-all"
        :class="
          selectedInvoiceId === `all:${mc.month}`
            ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold shadow-2xs'
            : 'border-emerald-500/30 bg-emerald-500/5 text-foreground hover:bg-emerald-500/10'
        "
        @click="
          selectedInvoiceId = `all:${mc.month}`;
          activeCategoryFilter = null
        "
      >
        <Layers class="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
        <span>Todos de {{ formatPeriodLabel(mc.month) }} ({{ mc.count }})</span>
        <Badge variant="success" class="text-[10px] px-1.5 py-0">
          {{ formatCurrency(mc.total) }}
        </Badge>
      </button>

      <!-- Botões Individuais de Cada Cartão -->
      <button
        v-for="inv in savedInvoices"
        :key="inv.id"
        type="button"
        class="inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-medium transition-all"
        :class="
          activeInvoice?.id === inv.id
            ? 'border-primary bg-primary/10 text-primary font-semibold shadow-2xs'
            : 'border-border bg-card text-muted-foreground hover:text-foreground'
        "
        @click="
          selectedInvoiceId = inv.id;
          activeCategoryFilter = null
        "
      >
        <CreditCard class="h-3.5 w-3.5" />
        <span>{{ inv.cardName }} · {{ formatPeriodLabel(inv.referenceMonth) }}</span>
        <Badge variant="secondary" class="text-[10px] px-1.5 py-0">
          {{ formatCurrency(inv.totalAmount) }}
        </Badge>
      </button>
    </div>

    <!-- Skeleton durante carregamento -->
    <div v-if="loading" class="space-y-4">
      <div class="grid grid-cols-3 gap-2.5 sm:gap-4">
        <Card v-for="n in 3" :key="n">
          <CardContent class="p-3 sm:p-5 space-y-1.5">
            <Skeleton class="h-3 w-16 sm:w-28" />
            <Skeleton class="h-5 sm:h-7 w-20 sm:w-36" />
            <Skeleton class="h-2.5 w-14 sm:w-24" />
          </CardContent>
        </Card>
      </div>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card v-for="n in 2" :key="n">
          <CardContent class="p-4 sm:p-5 space-y-3">
            <Skeleton class="h-3.5 w-36 sm:w-48" />
            <div v-for="k in 3" :key="k" class="space-y-1.5">
              <Skeleton class="h-3.5 w-full" />
              <Skeleton class="h-1.5 w-full rounded-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>

    <!-- CONTEÚDO DA FATURA DESTRINCHADA (INDIVIDUAL OU SOMADA DO MÊS) -->
    <template v-else-if="hasActiveSelection">
      <!-- 1. Três Cards de Resumo (Total, Categoria #1, Vilão #1) -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent class="p-5">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-muted-foreground">
                Total ({{ activeTitleLabel }})
              </span>
              <Layers v-if="isCombinedView" class="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <CreditCard v-else class="h-4 w-4 text-primary" />
            </div>
            <div class="mt-2 text-2xl font-bold tracking-tight tabular-nums text-foreground">
              {{ formatCurrency(activeTotal) }}
            </div>
            <div class="mt-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>{{ activeItems.length }} compras em {{ activePeriodText }}</span>
              <div v-if="activeInvoice" class="flex items-center gap-2">
                <button
                  type="button"
                  class="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                  :disabled="reanalyzingId === activeInvoice.id"
                  title="Avaliar o contexto de gastos com Gemini"
                  @click="handleReanalyzeSavedInvoice(activeInvoice)"
                >
                  <Sparkles class="h-3 w-3" />
                  <span>
                    {{ reanalyzingId === activeInvoice.id ? 'Avaliando com Gemini...' : 'Avaliar contexto com IA' }}
                  </span>
                </button>
                <button
                  type="button"
                  class="text-muted-foreground hover:text-destructive transition-colors"
                  title="Excluir esta análise"
                  @click="openRemove(activeInvoice)"
                >
                  <Trash2 class="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card v-if="topCategory" class="border-amber-500/25 bg-amber-500/5">
          <CardContent class="p-5">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                Maior gasto por categoria
              </span>
              <Flame class="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div class="mt-2 text-lg font-bold text-foreground truncate">
              {{ topCategory.category }}
            </div>
            <p class="mt-1 text-xs text-muted-foreground">
              <strong class="text-foreground">{{ formatCurrency(topCategory.amount) }}</strong>
              ({{ topCategory.share }}% da fatura em {{ topCategory.count }} compras)
            </p>
          </CardContent>
        </Card>

        <Card v-if="topMerchant">
          <CardContent class="p-5">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-muted-foreground">
                Principal contexto de gasto
              </span>
              <Store class="h-4 w-4 text-primary" />
            </div>
            <div class="mt-2 text-lg font-bold text-foreground truncate">
              {{ topMerchant.merchant }}
            </div>
            <p class="mt-1 text-xs text-muted-foreground">
              <strong class="text-foreground">{{ formatCurrency(topMerchant.amount) }}</strong>
              somados em <strong>{{ topMerchant.count }}x</strong> compras ({{ topMerchant.share }}%)
            </p>
          </CardContent>
        </Card>
      </div>

      <!-- 2. Duas Colunas: Ranking por Categoria vs Top Estabelecimentos -->
      <section class="grid grid-cols-1 gap-6 md:grid-cols-2">
        <!-- Coluna 1: Com o que você mais gastou (Categorias) -->
        <Card>
          <CardHeader class="border-b border-border py-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <PieChart class="h-4 w-4 text-primary" />
                <CardTitle class="text-sm font-semibold">
                  Com o que você mais gastou
                </CardTitle>
              </div>
              <button
                v-if="activeCategoryFilter"
                type="button"
                class="text-xs font-medium text-primary hover:underline"
                @click="activeCategoryFilter = null"
              >
                Ver todas
              </button>
            </div>
            <CardDescription class="text-xs">
              Clique em uma categoria para filtrar os itens abaixo.
            </CardDescription>
          </CardHeader>

          <CardContent class="p-5 space-y-4">
            <button
              v-for="cat in categoryBreakdown"
              :key="cat.category"
              type="button"
              class="w-full text-left rounded-xl p-2.5 -mx-2.5 transition-colors hover:bg-muted/50"
              :class="activeCategoryFilter === cat.category ? 'bg-primary/10 ring-1 ring-primary/30' : ''"
              @click="
                activeCategoryFilter =
                  activeCategoryFilter === cat.category ? null : cat.category
              "
            >
              <div class="flex items-center justify-between gap-2 text-xs mb-1.5">
                <div class="flex items-center gap-2 min-w-0">
                  <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <component :is="getCategoryIcon(cat.category)" class="h-3.5 w-3.5" />
                  </div>
                  <span class="font-semibold text-foreground truncate">{{ cat.category }}</span>
                  <Badge variant="secondary" class="text-[10px] px-1.5 py-0 font-normal">
                    {{ cat.count }}x
                  </Badge>
                </div>

                <div class="shrink-0 text-right tabular-nums">
                  <strong class="text-sm font-bold text-foreground">
                    {{ formatCurrency(cat.amount) }}
                  </strong>
                  <span class="ml-1.5 text-[11px] text-muted-foreground">
                    ({{ cat.share }}%)
                  </span>
                </div>
              </div>

              <Progress
                :model-value="cat.share"
                class="h-2"
                indicator-class="bg-primary"
              />
            </button>
          </CardContent>
        </Card>

        <!-- Coluna 2: Contexto Especifico dos Gastos (Agrupado pelo Gemini) -->
        <Card>
          <CardHeader class="border-b border-border py-4">
            <div class="flex items-center gap-2">
              <Store class="h-4 w-4 text-primary" />
              <CardTitle class="text-sm font-semibold">
                Maiores gastos por contexto
              </CardTitle>
            </div>
            <CardDescription class="text-xs">
              Agrupamento automático do tipo de gasto (delivery, corridas, farmácia, mercado, etc.).
            </CardDescription>
          </CardHeader>

          <CardContent class="p-0">
            <ul class="divide-y divide-border" role="list">
              <li
                v-for="(m, idx) in merchantBreakdown"
                :key="m.merchant"
                class="flex items-center justify-between gap-3 px-5 py-3.5"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <span
                    class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground"
                  >
                    {{ idx + 1 }}º
                  </span>
                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <p class="truncate text-sm font-semibold text-foreground">
                        {{ m.merchant }}
                      </p>
                      <Badge v-if="m.count > 1" variant="warning" class="text-[10px] px-1.5 py-0">
                        {{ m.count }} compras
                      </Badge>
                    </div>
                    <p class="text-[11px] text-muted-foreground">
                      {{ m.category }}
                    </p>
                  </div>
                </div>

                <div class="text-right shrink-0 tabular-nums">
                  <div class="text-sm font-bold text-foreground">
                    {{ formatCurrency(m.amount) }}
                  </div>
                  <div class="text-[11px] text-muted-foreground">
                    {{ m.share }}% da fatura
                  </div>
                </div>
              </li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <!-- 3. Lista Detalhada de Todos os Itens da Fatura -->
      <Card>
        <CardHeader class="flex flex-row items-center justify-between border-b border-border py-3.5 px-5">
          <div class="flex items-center gap-2">
            <CardTitle class="text-sm font-semibold">
              Lançamentos da Fatura
              <span v-if="activeCategoryFilter" class="text-primary">
                · {{ activeCategoryFilter }}
              </span>
            </CardTitle>
            <Badge variant="secondary">{{ filteredActiveItems.length }}</Badge>
          </div>

          <span v-if="installmentItems.length > 0" class="text-xs text-muted-foreground">
            {{ installmentItems.length }} compra(s) parcelada(s) nesta fatura
          </span>
        </CardHeader>

        <CardContent class="p-0">
          <ul class="divide-y divide-border" role="list">
            <li
              v-for="item in filteredActiveItems"
              :key="item.id"
              class="flex flex-col justify-between gap-3 px-5 py-3 hover:bg-muted/30 sm:flex-row sm:items-center"
            >
              <div class="flex items-center gap-3 min-w-0">
                <span class="w-20 shrink-0 whitespace-nowrap text-xs font-medium tabular-nums text-muted-foreground">
                  {{ item.date }}
                </span>
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-sm font-medium text-foreground truncate">
                      {{ item.merchant || item.description }}
                    </span>
                    <Badge
                      v-if="isCombinedView && item._sourceCardName"
                      variant="secondary"
                      class="text-[10px] px-1.5 py-0 font-normal"
                    >
                      {{ item._sourceCardName }}
                    </Badge>
                    <Badge v-if="item.installment" variant="outline" class="text-[10px] px-1.5 py-0">
                      Parcela {{ item.installment }}
                    </Badge>
                  </div>
                  <p
                    v-if="item.merchant && item.merchant !== item.description"
                    class="text-[11px] text-muted-foreground truncate"
                  >
                    {{ item.description }}
                  </p>
                </div>
              </div>

              <div class="flex items-center justify-between gap-3 sm:justify-end">
                <select
                  v-model="item.category"
                  class="h-7 rounded-md border border-input bg-background px-2 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  title="Alterar categoria deste item"
                  @change="handleItemCategoryChange(item)"
                >
                  <option v-for="cat in INVOICE_CATEGORIES" :key="cat" :value="cat">
                    {{ cat }}
                  </option>
                </select>

                <span class="w-24 text-right text-sm font-semibold tabular-nums text-foreground">
                  {{ formatCurrency(item.amount) }}
                </span>
              </div>
            </li>
          </ul>
        </CardContent>
      </Card>
    </template>

    <!-- Empty State quando ainda não há nenhuma fatura destrinchada -->
    <Card v-else class="border-dashed">
      <CardContent class="flex flex-col items-center justify-center py-14 text-center">
        <div class="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <FileSpreadsheet class="h-6 w-6" />
        </div>
        <h3 class="text-base font-semibold text-foreground">
          Descubra para onde está indo o dinheiro do cartão
        </h3>
        <p class="mt-1 max-w-md text-xs text-muted-foreground">
          Envie o arquivo OFX ou CSV da fatura (Nubank, Inter, Itaú, C6, Bradesco...) ou simplesmente copie e cole as linhas da fatura para ver o ranking por categoria e estabelecimento.
        </p>
        <div class="mt-5 flex flex-wrap items-center justify-center gap-2.5">
          <Button class="gap-1.5" @click="openImportDrawer">
            <Upload class="h-4 w-4" />
            <span>Destrinchar minha primeira fatura</span>
          </Button>
        </div>
      </CardContent>
    </Card>

    <!-- ============================================================ -->
    <!-- BOTTOM DRAWER: IMPORTAR / COLAR E DESTRINCHAR FATURA -->
    <!-- ============================================================ -->
    <Sheet
      v-model:open="importDrawerOpen"
      title="Destrinchar fatura de cartão"
      description="Envie o arquivo OFX ou CSV exportado do banco ou cole as linhas de compras da sua fatura."
    >
      <form class="space-y-5" @submit.prevent="handleSaveInvoice">
        <!-- Escolha rápida do cartão -->
        <div class="space-y-2">
          <label class="text-xs font-medium text-foreground">
            Qual é o cartão?
          </label>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="preset in CARD_PRESETS"
              :key="preset"
              type="button"
              class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
              :class="
                cardName === preset
                  ? 'border-primary bg-primary/10 text-primary font-semibold'
                  : 'border-border bg-muted/40 text-muted-foreground hover:text-foreground'
              "
              @click="cardName = preset"
            >
              {{ preset }}
            </button>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-foreground">Nome do cartão</label>
            <input
              v-model="cardName"
              type="text"
              placeholder="Ex: Nubank"
              required
              class="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div class="space-y-1.5">
            <label class="text-xs font-medium text-foreground">Mês da fatura</label>
            <input
              v-model="referenceMonth"
              type="month"
              required
              class="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div class="space-y-1.5">
            <label class="text-xs font-medium text-foreground">Dia vencimento</label>
            <input
              v-model.number="dueDay"
              type="number"
              min="1"
              max="31"
              placeholder="10"
              class="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <!-- Upload OFX, CSV ou Exemplo -->
        <div class="space-y-2">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <label class="text-xs font-medium text-foreground">
              Arquivo OFX, CSV ou Texto da Fatura
            </label>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                @click="loadSampleInvoice"
              >
                <Sparkles class="h-3 w-3" />
                <span>Preencher com exemplo</span>
              </button>

              <label
                class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-secondary px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
              >
                <Upload class="h-3 w-3" />
                <span>Importar OFX ou CSV</span>
                <input
                  type="file"
                  accept=".ofx,.csv,.txt"
                  class="hidden"
                  @change="handleFileUpload"
                />
              </label>
            </div>
          </div>

          <textarea
            v-model="rawInvoiceText"
            rows="6"
            placeholder="Importe o arquivo .OFX ou .CSV acima, ou cole aqui o texto copiado do PDF ou App da fatura...&#10;Exemplo:&#10;05/11 IFOOD *RESTAURANTE R$ 68,90&#10;06/11 UBER *TRIP 32,40&#10;08/11 SUPERMERCADO ASSAI 542,30"
            class="w-full rounded-xl border border-input bg-background p-3 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            @input="handleTextChange"
          />
        </div>

        <!-- Preview instantâneo do que foi detectado -->
        <div
          v-if="previewItems.length > 0"
          class="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 space-y-2"
        >
          <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span class="font-semibold text-emerald-700 dark:text-emerald-300">
              {{
                analyzingAi
                  ? `Avaliando o contexto de ${previewItems.length} compras com o Gemini...`
                  : `${previewItems.length} compras identificadas!`
              }}
            </span>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded-md border border-emerald-600/30 bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:text-emerald-200 hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                :disabled="analyzingAi"
                @click="runAiContextAnalysis"
              >
                <Sparkles class="h-3 w-3" />
                <span>{{ analyzingAi ? 'Analisando...' : 'Avaliar contexto com Gemini' }}</span>
              </button>
              <strong class="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                Total: {{ formatCurrency(previewTotal) }}
              </strong>
            </div>
          </div>
          <p class="text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
            O Gemini agrupa cada lançamento pelo contexto de gasto (delivery, supermercado, corridas, farmácia, assinaturas, compras online).
          </p>
        </div>

        <!-- Opções: Sincronizar com Contas a Pagar do Mês & Compartilhar com o Par -->
        <div class="space-y-2">
          <button
            type="button"
            class="flex h-10 w-full items-center justify-between rounded-lg border px-3 py-2 text-xs transition-colors"
            :class="
              syncToMonthlyBill
                ? 'border-primary/40 bg-primary/10 text-foreground font-medium'
                : 'border-input bg-background text-muted-foreground'
            "
            @click="syncToMonthlyBill = !syncToMonthlyBill"
          >
            <span class="flex items-center gap-2">
              <CreditCard class="h-4 w-4" :class="syncToMonthlyBill ? 'text-primary' : 'text-muted-foreground'" />
              Já lançar o valor total ({{ formatCurrency(previewTotal) }}) em "Falta Pagar" no mês
            </span>
            <span
              class="flex h-5 w-5 items-center justify-center rounded-full"
              :class="syncToMonthlyBill ? 'bg-primary text-primary-foreground' : 'border border-muted-foreground/30'"
            >
              <Check v-if="syncToMonthlyBill" class="h-3 w-3" />
            </span>
          </button>

          <button
            type="button"
            class="flex h-10 w-full items-center justify-between rounded-lg border px-3 py-2 text-xs transition-colors"
            :class="
              isShared
                ? 'border-primary/40 bg-primary/10 text-foreground font-medium'
                : 'border-input bg-background text-muted-foreground'
            "
            @click="isShared = !isShared"
          >
            <span class="flex items-center gap-2">
              <Users class="h-4 w-4" :class="isShared ? 'text-primary' : 'text-muted-foreground'" />
              Compartilhar análise com meu par (Casal)
            </span>
            <span
              class="flex h-5 w-5 items-center justify-center rounded-full"
              :class="isShared ? 'bg-primary text-primary-foreground' : 'border border-muted-foreground/30'"
            >
              <Check v-if="isShared" class="h-3 w-3" />
            </span>
          </button>
        </div>

        <div class="flex items-center justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" @click="importDrawerOpen = false">
            Cancelar
          </Button>
          <Button type="submit" :disabled="saving || previewItems.length === 0">
            {{ saving ? 'Salvando...' : 'Ver Fatura Destrinchada' }}
          </Button>
        </div>
      </form>
    </Sheet>
  </div>
</template>

<style scoped>
/* Styled with Tailwind CSS */
</style>
