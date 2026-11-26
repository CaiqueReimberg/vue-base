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
import { cardsApi } from '@/api/cards.api'
import {
  invoicesApi,
  type ParsedInvoiceItem,
  type SavedInvoiceAnalysis,
} from '@/api/invoices.api'
import type { Card as CreditCardItem } from '@/types/card'
import { isMyResource } from '@/utils/owner'
import {
  INVOICE_CATEGORIES,
  parseInvoiceText,
  SAMPLE_INVOICE_TEXT,
} from '@/utils/invoice-parser'
import { useDashboardStore } from '@/stores/dashboard/dashboard.store'
import { useToastStore } from '@/stores/toast/toast.store'
import {
  currentReferenceMonth,
  formatCurrency,
  formatPeriodLabel,
  shiftReferenceMonth,
} from '@/utils/month'
import {
  Calendar,
  Car,
  Check,
  ChevronLeft,
  ChevronRight,
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
const dashboardStore = useDashboardStore()
const router = useRouter()

const CARD_PRESETS = ['Nubank', 'Itaú', 'Inter', 'C6 Bank', 'XP', 'Santander', 'Bradesco']

const loading = ref(true)
const savedInvoices = ref<SavedInvoiceAnalysis[]>([])
const selectedMonth = ref(dashboardStore.referenceMonth || currentReferenceMonth())
const selectedInvoiceId = ref<string | null>(null)
const selectedPeriodLabel = computed(() => formatPeriodLabel(selectedMonth.value))

// Estado do Importador / Destrinchador (no Drawer ou tela inicial)
const importDrawerOpen = ref(false)
const myCards = ref<CreditCardItem[]>([])
const selectedCardId = ref<string>('new')
const cardName = ref('Nubank')
const referenceMonth = ref(currentReferenceMonth())
const dueDay = ref<number>(10)
const rawInvoiceText = ref('')
const previewItems = ref<ParsedInvoiceItem[]>([])
const isShared = ref(false)
const syncToMonthlyBill = ref(true)
const saving = ref(false)
const analyzingAi = ref(false)
const reanalyzingId = ref<string | null>(null)
const savingItemKey = ref<string | null>(null)
const savedItemKey = ref<string | null>(null)
let savedItemTimer: ReturnType<typeof setTimeout> | null = null

// Filtro de categoria na visualização detalhada
const activeCategoryFilter = ref<string | null>(null)

// Exclusão
const removeOpen = ref(false)
const invoiceToRemove = ref<SavedInvoiceAnalysis | null>(null)

interface DisplayInvoiceItem extends ParsedInvoiceItem {
  _sourceInvoiceId?: string
  _sourceCardName?: string
}

// Meses que possuem faturas salvas (ordenados do mais recente ao mais antigo)
const availableMonths = computed(() => {
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
  return Array.from(map.values()).sort((a, b) => b.month.localeCompare(a.month))
})

// Faturas apenas do mês selecionado no topo
const monthInvoices = computed(() =>
  savedInvoices.value.filter((i) => i.referenceMonth === selectedMonth.value),
)

const monthTotalAmount = computed(() =>
  monthInvoices.value.reduce((sum, i) => sum + Number(i.totalAmount || 0), 0),
)

function syncSelectionForMonth(ym: string) {
  selectedMonth.value = ym
  activeCategoryFilter.value = null
  const inMonth = savedInvoices.value.filter((i) => i.referenceMonth === ym)
  if (inMonth.length >= 2) {
    selectedInvoiceId.value = `all:${ym}`
  } else if (inMonth.length === 1) {
    selectedInvoiceId.value = inMonth[0].id
  } else {
    selectedInvoiceId.value = null
  }
}

function changeSelectedMonth(delta: number) {
  syncSelectionForMonth(shiftReferenceMonth(selectedMonth.value, delta))
}

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
    return monthInvoices.value.find((i) => i.id === selectedInvoiceId.value) ?? null
  }
  return monthInvoices.value[0] ?? null
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
    if (list.length > 0) {
      const hasInSelected = list.some((i) => i.referenceMonth === selectedMonth.value)
      const targetYm = hasInSelected ? selectedMonth.value : list[0].referenceMonth
      syncSelectionForMonth(targetYm)
    } else {
      selectedInvoiceId.value = null
    }
  } catch {
    toastStore.error('Não foi possível carregar as faturas salvas.')
  } finally {
    loading.value = false
  }
}

async function loadUserCards() {
  try {
    const all = await cardsApi.list(referenceMonth.value)
    myCards.value = all.filter((c) => isMyResource(c.owner ?? null, authStore.currentUserId))
    if (myCards.value.length > 0 && selectedCardId.value === 'new') {
      selectCardForAnalysis(myCards.value[0].id)
    }
  } catch {
    // silencioso
  }
}

function selectCardForAnalysis(id: string) {
  selectedCardId.value = id
  if (id === 'new') {
    cardName.value = ''
    dueDay.value = 10
    isShared.value = false
    return
  }
  const card = myCards.value.find((c) => c.id === id)
  if (!card) return
  cardName.value = card.name
  dueDay.value = card.dueDay
  isShared.value = Boolean(card.shareWithPartner)
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
  await Promise.all([fetchInvoices(), loadUserCards()])
})

function openImportDrawer() {
  referenceMonth.value = selectedMonth.value
  rawInvoiceText.value = ''
  previewItems.value = []
  importDrawerOpen.value = true
  loadUserCards()
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

function itemRowKey(item: DisplayInvoiceItem): string {
  return `${item._sourceInvoiceId || activeInvoice.value?.id || 'inv'}:${item.id}`
}

async function handleItemCategoryChange(changedItem?: DisplayInvoiceItem) {
  const targetInvId = changedItem?._sourceInvoiceId || activeInvoice.value?.id
  if (!targetInvId) return
  const inv = savedInvoices.value.find((i) => i.id === targetInvId)
  if (!inv) return

  const key = changedItem ? itemRowKey(changedItem) : null
  savingItemKey.value = key
  savedItemKey.value = null

  try {
    const cleanItems: ParsedInvoiceItem[] = inv.items.map((it) => ({
      id: it.id,
      date: it.date,
      description: it.description,
      merchant: it.merchant,
      amount: it.amount,
      category: it.category,
      installment: it.installment ?? null,
    }))
    await invoicesApi.updateItems(inv.id, cleanItems)
    if (key) {
      savedItemKey.value = key
      if (savedItemTimer) clearTimeout(savedItemTimer)
      savedItemTimer = setTimeout(() => {
        if (savedItemKey.value === key) savedItemKey.value = null
      }, 2000)
    }
  } catch {
    toastStore.error('Não foi possível salvar a alteração de categoria.')
  } finally {
    if (savingItemKey.value === key) {
      savingItemKey.value = null
    }
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
  if (selectedCardId.value === 'new' && !cardName.value.trim()) {
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
      ...(selectedCardId.value !== 'new' ? { cardId: selectedCardId.value } : {}),
      cardName: cardName.value.trim(),
      referenceMonth: referenceMonth.value,
      items: previewItems.value,
      isShared: isShared.value,
      syncToMonthlyBill: syncToMonthlyBill.value,
      dueDay: dueDay.value,
    })
    savedInvoices.value = [
      created,
      ...savedInvoices.value.filter((i) => i.id !== created.id),
    ]
    selectedMonth.value = created.referenceMonth
    selectedInvoiceId.value = created.id
    activeCategoryFilter.value = null
    importDrawerOpen.value = false

    if (created.syncedBillStatus === 'already_paid') {
      toastStore.success(
        `Fatura destrinchada! "${created.syncedBillName ?? created.cardName}" já consta como paga neste mês.`,
      )
    } else if (created.syncedBillStatus === 'updated') {
      toastStore.success(
        `Fatura destrinchada e valor atualizado em "${created.syncedBillName ?? created.cardName}" (${formatCurrency(created.totalAmount)})!`,
      )
    } else if (created.syncedBillStatus === 'created') {
      toastStore.success(
        `Fatura destrinchada e total (${formatCurrency(created.totalAmount)}) lançado nas Contas do Mês!`,
      )
    } else {
      toastStore.success('Fatura destrinchada e salva com sucesso!')
    }
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
    if (selectedInvoiceId.value === inv.id || selectedInvoiceId.value === `all:${inv.referenceMonth}`) {
      syncSelectionForMonth(selectedMonth.value)
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

    <!-- Cabeçalho com Seletor de Mês igual às demais páginas -->
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <div class="inline-flex items-center rounded-xl border border-border bg-card p-1 shadow-2xs">
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8 rounded-lg"
            title="Mês anterior"
            @click="changeSelectedMonth(-1)"
          >
            <ChevronLeft class="h-4 w-4" />
          </Button>

          <label class="relative flex cursor-pointer items-center gap-1.5 px-3 text-sm font-semibold text-foreground min-w-[115px] justify-center hover:text-primary transition-colors" title="Clique para escolher o mês">
            <Calendar class="h-3.5 w-3.5 text-primary shrink-0" />
            <span>{{ selectedPeriodLabel }}</span>
            <input
              :value="selectedMonth"
              type="month"
              class="absolute inset-0 cursor-pointer opacity-0"
              @change="syncSelectionForMonth(($event.target as HTMLInputElement).value || selectedMonth)"
            />
          </label>

          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8 rounded-lg"
            title="Próximo mês"
            @click="changeSelectedMonth(1)"
          >
            <ChevronRight class="h-4 w-4" />
          </Button>
        </div>

        <div class="hidden sm:block">
          <h1 class="text-base font-bold tracking-tight text-foreground leading-tight">
            Análise de Faturas
          </h1>
          <p class="text-xs text-muted-foreground">
            Escolha o mês e o cartão para ver com o que você mais gastou
          </p>
        </div>
      </div>

      <Button size="sm" class="h-9 gap-1.5 px-3.5" @click="openImportDrawer">
        <Plus class="h-4 w-4" />
        <span>Destrinchar nova fatura</span>
      </Button>
    </header>

    <!-- Atalhos de Meses com Faturas Salvas (quando há mais de 1 mês ou está fora de um mês salvo) -->
    <div
      v-if="availableMonths.length > 1 || (availableMonths.length === 1 && availableMonths[0].month !== selectedMonth)"
      class="flex flex-wrap items-center gap-1.5"
    >
      <span class="mr-1 text-[11px] font-medium text-muted-foreground">Meses salvos:</span>
      <button
        v-for="m in availableMonths"
        :key="m.month"
        type="button"
        class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors"
        :class="
          selectedMonth === m.month
            ? 'border-primary bg-primary/10 text-primary font-semibold'
            : 'border-border bg-card text-muted-foreground hover:text-foreground'
        "
        @click="syncSelectionForMonth(m.month)"
      >
        <span>{{ formatPeriodLabel(m.month) }}</span>
        <span class="text-[10px] opacity-80">({{ m.count }})</span>
      </button>
    </div>

    <!-- Seletor de Cartões dentro do Mês Selecionado -->
    <div v-if="monthInvoices.length > 0" class="flex flex-wrap items-center gap-2">
      <!-- Botão de Visão Somada quando há 2+ cartões no mês selecionado -->
      <button
        v-if="monthInvoices.length >= 2"
        type="button"
        class="inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-medium transition-all"
        :class="
          selectedInvoiceId === `all:${selectedMonth}`
            ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold shadow-2xs'
            : 'border-emerald-500/30 bg-emerald-500/5 text-foreground hover:bg-emerald-500/10'
        "
        @click="
          selectedInvoiceId = `all:${selectedMonth}`;
          activeCategoryFilter = null
        "
      >
        <Layers class="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
        <span>Todos os cartões ({{ monthInvoices.length }})</span>
        <Badge variant="success" class="text-[10px] px-1.5 py-0 tabular-nums">
          {{ formatCurrency(monthTotalAmount) }}
        </Badge>
      </button>

      <!-- Botões Individuais de Cada Cartão do Mês -->
      <button
        v-for="inv in monthInvoices"
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
        <span>{{ inv.cardName }}</span>
        <Badge variant="secondary" class="text-[10px] px-1.5 py-0 tabular-nums">
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
              :key="itemRowKey(item)"
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

              <div class="flex items-center justify-between gap-2.5 sm:justify-end">
                <div class="inline-flex items-center gap-1.5">
                  <Check
                    v-if="savedItemKey === itemRowKey(item)"
                    class="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                    title="Categoria salva"
                  />
                  <select
                    v-model="item.category"
                    class="h-7 rounded-md border border-input bg-background px-2 text-xs text-muted-foreground transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
                    :class="
                      savedItemKey === itemRowKey(item)
                        ? 'border-emerald-500/50 text-emerald-700 dark:text-emerald-300'
                        : ''
                    "
                    :disabled="savingItemKey === itemRowKey(item)"
                    title="Alterar categoria deste item"
                    @change="handleItemCategoryChange(item)"
                  >
                    <option v-for="cat in INVOICE_CATEGORIES" :key="cat" :value="cat">
                      {{ cat }}
                    </option>
                  </select>
                </div>

                <span class="w-24 text-right text-sm font-semibold tabular-nums text-foreground">
                  {{ formatCurrency(item.amount) }}
                </span>
              </div>
            </li>
          </ul>
        </CardContent>
      </Card>
    </template>

    <!-- Empty State quando não há fatura destrinchada no mês selecionado -->
    <Card v-else class="border-dashed">
      <CardContent class="flex flex-col items-center justify-center py-14 text-center">
        <div class="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <FileSpreadsheet class="h-6 w-6" />
        </div>
        <h3 class="text-base font-semibold text-foreground">
          {{
            savedInvoices.length > 0
              ? `Nenhuma fatura destrinchada em ${selectedPeriodLabel}`
              : 'Descubra para onde está indo o dinheiro do cartão'
          }}
        </h3>
        <p class="mt-1 max-w-md text-xs text-muted-foreground">
          Envie o arquivo OFX ou CSV da fatura (Nubank, Inter, Itaú, C6, Bradesco...) ou copie e cole as linhas da fatura para ver o ranking por categoria e estabelecimento.
        </p>
        <div class="mt-5 flex flex-wrap items-center justify-center gap-2.5">
          <Button class="gap-1.5" @click="openImportDrawer">
            <Upload class="h-4 w-4" />
            <span>Destrinchar fatura de {{ selectedPeriodLabel }}</span>
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
        <!-- Escolha do cartão cadastrado ou novo cartão -->
        <div class="space-y-2">
          <div class="flex items-center justify-between gap-2">
            <label class="text-xs font-medium text-foreground">
              Selecione o cartão da fatura
            </label>
            <RouterLink
              to="/cards"
              class="text-[11px] font-medium text-primary hover:underline"
              @click="importDrawerOpen = false"
            >
              Gerenciar cartões
            </RouterLink>
          </div>

          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="card in myCards"
              :key="card.id"
              type="button"
              class="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all"
              :class="
                selectedCardId === card.id
                  ? 'border-primary bg-primary/10 text-primary font-semibold'
                  : 'border-border bg-background text-foreground hover:border-primary/40'
              "
              @click="selectCardForAnalysis(card.id)"
            >
              <CreditCard class="h-3.5 w-3.5 shrink-0" />
              <span>{{ card.name }}</span>
              <span class="text-[10px] text-muted-foreground">dia {{ card.dueDay }}</span>
            </button>

            <button
              type="button"
              class="inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all"
              :class="
                selectedCardId === 'new'
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold'
                  : 'border-dashed border-border bg-muted/30 text-muted-foreground hover:text-foreground'
              "
              @click="selectCardForAnalysis('new')"
            >
              <Plus class="h-3.5 w-3.5" />
              <span>Novo cartão</span>
            </button>
          </div>

          <div v-if="selectedCardId === 'new'" class="flex flex-wrap gap-1.5 pt-1">
            <button
              v-for="preset in CARD_PRESETS"
              :key="preset"
              type="button"
              class="rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors"
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

        <div class="grid gap-3" :class="selectedCardId === 'new' ? 'grid-cols-3' : 'grid-cols-2'">
          <div v-if="selectedCardId === 'new'" class="space-y-1.5">
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
