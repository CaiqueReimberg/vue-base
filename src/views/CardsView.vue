<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ConfirmModal from '@/components/ConfirmModal.vue'
import { Card as UiCard, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet } from '@/components/ui/sheet'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Skeleton } from '@/components/ui/skeleton'
import { cardsApi } from '@/api/cards.api'
import { useAuthStore } from '@/stores/auth/auth.store'
import { useDashboardStore } from '@/stores/dashboard/dashboard.store'
import { useToastStore } from '@/stores/toast/toast.store'
import type { Card as CreditCardItem } from '@/types/card'
import { isMyResource, ownerBadgeLabel, payerBadgeLabel, personShortName } from '@/utils/owner'
import {
  currentReferenceMonth,
  formatCurrency,
  formatPeriodLabel,
  shiftReferenceMonth,
} from '@/utils/month'
import {
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileSpreadsheet,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  Undo2,
  Users,
} from 'lucide-vue-next'

const authStore = useAuthStore()
const dashboardStore = useDashboardStore()
const toastStore = useToastStore()

const CARD_PRESETS = ['Nubank', 'Itaú', 'Inter', 'C6 Bank', 'XP', 'Santander', 'Bradesco']

const referenceMonth = ref(dashboardStore.referenceMonth || currentReferenceMonth())
const periodLabel = computed(() => formatPeriodLabel(referenceMonth.value))

const hasPartner = computed(() => Boolean(authStore.profile?.partner))
const myShortName = computed(() => personShortName(authStore.profile) || 'Você')
const partnerShortName = computed(() => personShortName(authStore.profile?.partner) || 'Par')

const loading = ref(false)
const allCards = ref<CreditCardItem[]>([])
const scopeFilter = ref<'individual' | 'shared'>('individual')

function isMyCard(card: CreditCardItem): boolean {
  return isMyResource(card.owner ?? null, authStore.currentUserId)
}

function isExternalPaidByMe(card: CreditCardItem): boolean {
  return (
    !isMyCard(card) &&
    Boolean(
      authStore.currentUserId &&
        card.monthInvoice?.paidByUserId === authStore.currentUserId,
    )
  )
}

const filteredCards = computed(() => {
  if (scopeFilter.value === 'shared') {
    return allCards.value.filter(
      (c) => Boolean(c.shareWithPartner || c.monthInvoice?.isShared),
    )
  }
  return allCards.value.filter((c) => isMyCard(c) || isExternalPaidByMe(c))
})

const totalLaunchedInMonth = computed(() =>
  filteredCards.value.reduce((sum, c) => sum + Number(c.monthInvoice?.amount || 0), 0),
)

const totalPendingInMonth = computed(() =>
  filteredCards.value
    .filter((c) => c.monthInvoice && !c.monthInvoice.paid)
    .reduce((sum, c) => sum + Number(c.monthInvoice?.amount || 0), 0),
)

const totalPaidInMonth = computed(() =>
  filteredCards.value
    .filter((c) => c.monthInvoice?.paid)
    .reduce((sum, c) => sum + Number(c.monthInvoice?.amount || 0), 0),
)

// Drawer 1: Cadastrar ou Editar Cartão
const cardDrawerOpen = ref(false)
const editingCard = ref<CreditCardItem | null>(null)
const formCardName = ref('')
const formCardDueDay = ref<number | ''>(10)
const formCardLimit = ref<number | ''>('')
const formCardShared = ref(false)
const savingCard = ref(false)

// Drawer 2: Lançar / Ajustar / Pagar Fatura do Mês daquele Cartão
const invoiceDrawerOpen = ref(false)
const invoiceDrawerMode = ref<'launch' | 'pay'>('launch')
const targetCard = ref<CreditCardItem | null>(null)
const invoiceAmountInput = ref<number | ''>('')
const invoiceDueDayInput = ref<number | ''>(10)
const invoiceSharedInput = ref(false)
const invoicePayerUserId = ref('')
const savingInvoice = ref(false)

// Confirmação de Exclusão de Cartão
const cardToDelete = ref<CreditCardItem | null>(null)

async function fetchCards() {
  loading.value = true
  try {
    allCards.value = await cardsApi.list(referenceMonth.value)
  } catch (e) {
    toastStore.error(e instanceof Error ? e.message : 'Erro ao carregar cartões.')
  } finally {
    loading.value = false
  }
}

async function changeMonth(delta: number) {
  referenceMonth.value = shiftReferenceMonth(referenceMonth.value, delta)
  await fetchCards()
}

function openCreateCard() {
  editingCard.value = null
  formCardName.value = ''
  formCardDueDay.value = 10
  formCardLimit.value = ''
  formCardShared.value = false
  cardDrawerOpen.value = true
}

function openEditCard(card: CreditCardItem) {
  editingCard.value = card
  formCardName.value = card.name
  formCardDueDay.value = card.dueDay
  formCardLimit.value = card.limitAmount > 0 ? card.limitAmount : ''
  formCardShared.value = Boolean(card.shareWithPartner)
  cardDrawerOpen.value = true
}

async function handleSaveCard() {
  const name = formCardName.value.trim()
  if (!name) {
    toastStore.error('Informe o nome do cartão.')
    return
  }
  savingCard.value = true
  try {
    const dueDay = Math.min(Math.max(Number(formCardDueDay.value) || 10, 1), 31)
    const limitAmount = Number(formCardLimit.value) || 0

    if (editingCard.value) {
      await cardsApi.update(editingCard.value.id, {
        name,
        dueDay,
        limitAmount,
        shareWithPartner: formCardShared.value,
      })
      toastStore.success('Cartão atualizado!')
    } else {
      const created = await cardsApi.create({
        name,
        dueDay,
        limitAmount,
        shareWithPartner: formCardShared.value,
      })
      toastStore.success(
        created.deduplicated
          ? `Cartão ${created.name} já existia e foi atualizado!`
          : `Cartão ${created.name} cadastrado!`,
      )
    }

    cardDrawerOpen.value = false
    await fetchCards()
    if (dashboardStore.referenceMonth === referenceMonth.value) {
      dashboardStore.fetchSummary(referenceMonth.value)
    }
  } catch (e) {
    toastStore.error(e instanceof Error ? e.message : 'Erro ao salvar cartão.')
  } finally {
    savingCard.value = false
  }
}

function openInvoiceDrawer(card: CreditCardItem, mode: 'launch' | 'pay') {
  targetCard.value = card
  invoiceDrawerMode.value = mode
  invoiceAmountInput.value = card.monthInvoice
    ? card.monthInvoice.amount
    : card.analysisTotalAmount && card.analysisTotalAmount > 0
      ? card.analysisTotalAmount
      : ''
  invoiceDueDayInput.value = card.monthInvoice?.dueDay ?? card.dueDay
  invoiceSharedInput.value = Boolean(card.monthInvoice?.isShared ?? card.shareWithPartner)
  invoicePayerUserId.value = authStore.currentUserId || ''
  invoiceDrawerOpen.value = true
}

async function handleSaveMonthlyInvoice(alsoPay = false) {
  const card = targetCard.value
  if (!card) return
  const amount = Number(invoiceAmountInput.value)
  if (!Number.isFinite(amount) || amount <= 0) {
    toastStore.error('Informe o valor da fatura neste mês.')
    return
  }

  savingInvoice.value = true
  try {
    const shouldPay = invoiceDrawerMode.value === 'pay' || alsoPay
    if (shouldPay) {
      await cardsApi.upsertMonthlyInvoice(card.id, {
        referenceMonth: referenceMonth.value,
        amount,
        dueDay: Number(invoiceDueDayInput.value) || card.dueDay,
        isShared: invoiceSharedInput.value,
      })
      await cardsApi.payMonthlyInvoice(card.id, {
        referenceMonth: referenceMonth.value,
        amount,
        paidByUserId: invoicePayerUserId.value || undefined,
      })
      toastStore.success(`Fatura ${card.name} marcada como paga em ${periodLabel.value}!`)
    } else {
      const res = await cardsApi.upsertMonthlyInvoice(card.id, {
        referenceMonth: referenceMonth.value,
        amount,
        dueDay: Number(invoiceDueDayInput.value) || card.dueDay,
        isShared: invoiceSharedInput.value,
      })
      toastStore.success(
        res.status === 'created'
          ? `Fatura ${card.name} lançada em ${periodLabel.value}!`
          : `Valor da fatura ${card.name} atualizado em ${periodLabel.value}!`,
      )
    }

    invoiceDrawerOpen.value = false
    await fetchCards()
    if (dashboardStore.referenceMonth === referenceMonth.value) {
      dashboardStore.fetchSummary(referenceMonth.value)
    }
  } catch (e) {
    toastStore.error(e instanceof Error ? e.message : 'Erro ao salvar fatura do mês.')
  } finally {
    savingInvoice.value = false
  }
}

async function handleUnpayInvoice(card: CreditCardItem) {
  try {
    await cardsApi.unpayMonthlyInvoice(card.id, referenceMonth.value)
    toastStore.success(`Fatura ${card.name} voltou para pendente.`)
    await fetchCards()
    if (dashboardStore.referenceMonth === referenceMonth.value) {
      dashboardStore.fetchSummary(referenceMonth.value)
    }
  } catch (e) {
    toastStore.error(e instanceof Error ? e.message : 'Erro ao desmarcar pagamento.')
  }
}

async function handleClearMonthInvoice(card: CreditCardItem) {
  try {
    await cardsApi.deleteMonthlyInvoice(card.id, referenceMonth.value)
    toastStore.success(`Fatura de ${periodLabel.value} removida deste cartão.`)
    invoiceDrawerOpen.value = false
    await fetchCards()
    if (dashboardStore.referenceMonth === referenceMonth.value) {
      dashboardStore.fetchSummary(referenceMonth.value)
    }
  } catch (e) {
    toastStore.error(e instanceof Error ? e.message : 'Erro ao remover fatura do mês.')
  }
}

async function confirmDeleteCard() {
  const card = cardToDelete.value
  if (!card) return
  cardToDelete.value = null
  try {
    await cardsApi.delete(card.id)
    toastStore.success(`Cartão ${card.name} removido.`)
    await fetchCards()
    if (dashboardStore.referenceMonth === referenceMonth.value) {
      dashboardStore.fetchSummary(referenceMonth.value)
    }
  } catch (e) {
    toastStore.error(e instanceof Error ? e.message : 'Erro ao remover cartão.')
  }
}

onMounted(() => {
  fetchCards()
})
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <!-- Cabeçalho com seletor de mês e Novo cartão -->
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <div class="inline-flex items-center rounded-xl border border-border bg-card p-1 shadow-2xs">
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8 rounded-lg"
            title="Mês anterior"
            @click="changeMonth(-1)"
          >
            <ChevronLeft class="h-4 w-4" />
          </Button>

          <div class="flex items-center gap-1.5 px-3 text-sm font-semibold text-foreground min-w-[110px] justify-center">
            <Calendar class="h-3.5 w-3.5 text-primary" />
            <span>{{ periodLabel }}</span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8 rounded-lg"
            title="Próximo mês"
            @click="changeMonth(1)"
          >
            <ChevronRight class="h-4 w-4" />
          </Button>
        </div>

        <div class="hidden sm:block">
          <h1 class="text-base font-bold text-foreground leading-tight">Cartões & Faturas</h1>
          <p class="text-xs text-muted-foreground">
            Cadastre seus cartões uma vez e lance o valor da fatura de cada mês sem duplicidade
          </p>
        </div>
      </div>

      <Button size="sm" class="h-9 gap-1.5 px-3.5" @click="openCreateCard">
        <Plus class="h-4 w-4" />
        <span>Novo cartão</span>
      </Button>
    </header>

    <!-- Resumo das Faturas no Mês -->
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
      <UiCard>
        <CardContent class="p-4">
          <span class="text-xs font-medium text-muted-foreground">
            Total em faturas ({{ periodLabel }})
          </span>
          <div class="mt-1.5 text-2xl font-bold tracking-tight tabular-nums text-foreground">
            {{ formatCurrency(totalLaunchedInMonth) }}
          </div>
          <span class="mt-1 block text-[11px] text-muted-foreground">
            {{ filteredCards.length }} {{ filteredCards.length === 1 ? 'cartão listado' : 'cartões listados' }}
          </span>
        </CardContent>
      </UiCard>

      <UiCard>
        <CardContent class="p-4">
          <span class="text-xs font-medium text-muted-foreground">
            Falta pagar em {{ periodLabel }}
          </span>
          <div class="mt-1.5 text-2xl font-bold tracking-tight tabular-nums text-amber-600 dark:text-amber-400">
            {{ formatCurrency(totalPendingInMonth) }}
          </div>
          <span class="mt-1 block text-[11px] text-muted-foreground">
            Faturas abertas neste mês
          </span>
        </CardContent>
      </UiCard>

      <UiCard>
        <CardContent class="p-4">
          <span class="text-xs font-medium text-muted-foreground">
            Já quitado em {{ periodLabel }}
          </span>
          <div class="mt-1.5 text-2xl font-bold tracking-tight tabular-nums text-emerald-600 dark:text-emerald-400">
            {{ formatCurrency(totalPaidInMonth) }}
          </div>
          <span class="mt-1 block text-[11px] text-muted-foreground">
            Faturas pagas neste mês
          </span>
        </CardContent>
      </UiCard>
    </div>

    <!-- Filtro Individual vs Casal -->
    <div class="flex items-center justify-between gap-3">
      <div class="inline-flex items-center rounded-xl border border-border bg-card p-1">
        <button
          type="button"
          class="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
          :class="
            scopeFilter === 'individual'
              ? 'bg-secondary text-foreground font-semibold shadow-2xs'
              : 'text-muted-foreground hover:text-foreground'
          "
          @click="scopeFilter = 'individual'"
        >
          Individual
        </button>

        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
          :class="
            scopeFilter === 'shared'
              ? 'bg-secondary text-foreground font-semibold shadow-2xs'
              : 'text-muted-foreground hover:text-foreground'
          "
          @click="scopeFilter = 'shared'"
        >
          <Users class="h-3.5 w-3.5 text-primary" />
          <span>Casal</span>
        </button>
      </div>
    </div>

    <!-- Lista de Cartões -->
    <div v-if="loading && allCards.length === 0" class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <UiCard v-for="n in 2" :key="n">
        <CardContent class="p-5 space-y-3">
          <Skeleton class="h-5 w-36" />
          <Skeleton class="h-7 w-28" />
          <Skeleton class="h-8 w-full" />
        </CardContent>
      </UiCard>
    </div>

    <UiCard v-else-if="filteredCards.length === 0">
      <CardContent class="flex flex-col items-center justify-center py-14 px-4 text-center">
        <div class="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CreditCard class="h-5 w-5" />
        </div>
        <p class="text-sm font-semibold text-foreground">
          Nenhum cartão neste filtro
        </p>
        <p class="mt-1 max-w-md text-xs text-muted-foreground">
          Cadastre seus cartões (ex: Nubank, C6 Bank, Itaú) para lançar ou importar a fatura de cada mês sem risco de duplicar lançamentos.
        </p>
        <Button size="sm" class="mt-4 gap-1.5" @click="openCreateCard">
          <Plus class="h-4 w-4" />
          <span>Cadastrar primeiro cartão</span>
        </Button>
      </CardContent>
    </UiCard>

    <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <UiCard
        v-for="card in filteredCards"
        :key="card.id"
        class="flex flex-col justify-between transition-colors hover:border-primary/30"
      >
        <CardHeader class="flex flex-row items-start justify-between gap-2 pb-3">
          <div class="space-y-1 min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <CreditCard class="h-4 w-4 text-primary shrink-0" />
              <CardTitle class="text-base font-bold truncate">{{ card.name }}</CardTitle>

              <Badge
                v-if="card.shareWithPartner || card.monthInvoice?.isShared"
                variant="outline"
                class="gap-1 text-[10px] px-1.5 py-0 font-normal"
              >
                <Users class="h-2.5 w-2.5 text-primary" />
                Casal
              </Badge>

              <Badge
                v-if="ownerBadgeLabel(card.owner, authStore.currentUserId)"
                variant="secondary"
                class="text-[10px] px-1.5 py-0 font-normal"
              >
                De {{ ownerBadgeLabel(card.owner, authStore.currentUserId) }}
              </Badge>
            </div>

            <p class="text-xs text-muted-foreground">
              Vencimento todo dia {{ card.monthInvoice?.dueDay ?? card.dueDay }}
              <template v-if="card.limitAmount > 0">
                · Limite {{ formatCurrency(card.limitAmount) }}
              </template>
            </p>
          </div>

          <div v-if="isMyCard(card)" class="flex items-center gap-1 shrink-0">
            <button
              type="button"
              class="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Editar cartão"
              @click="openEditCard(card)"
            >
              <Pencil class="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              class="rounded-md p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors"
              title="Excluir cartão"
              @click="cardToDelete = card"
            >
              <Trash2 class="h-3.5 w-3.5" />
            </button>
          </div>
        </CardHeader>

        <CardContent class="space-y-4 pt-0">
          <!-- Bloco da Fatura deste Mês -->
          <div class="rounded-xl border border-border bg-muted/30 p-3.5 flex items-center justify-between gap-3">
            <div>
              <span class="text-[11px] font-medium text-muted-foreground block">
                Fatura de {{ periodLabel }}
              </span>
              <div
                v-if="card.monthInvoice"
                class="mt-0.5 text-xl font-bold tracking-tight tabular-nums text-foreground"
              >
                {{ formatCurrency(card.monthInvoice.amount) }}
              </div>
              <div
                v-else-if="card.analysisTotalAmount"
                class="mt-0.5 space-y-0.5"
              >
                <span class="block text-sm font-semibold tabular-nums text-primary">
                  Analisada: {{ formatCurrency(card.analysisTotalAmount) }}
                </span>
                <span class="block text-[11px] text-muted-foreground">
                  Clique em Lançar fatura para confirmar no mês
                </span>
              </div>
              <div v-else class="mt-0.5 text-sm font-medium text-muted-foreground">
                Não lançada neste mês
              </div>
            </div>

            <div class="flex flex-col items-end gap-1">
              <Badge
                v-if="card.monthInvoice?.paid"
                variant="success"
                class="gap-1 text-[11px]"
              >
                <CheckCircle2 class="h-3 w-3" />
                <span>Paga</span>
              </Badge>
              <Badge
                v-else-if="card.monthInvoice"
                variant="warning"
                class="text-[11px]"
              >
                Pendente
              </Badge>

              <span
                v-if="card.monthInvoice?.paid && payerBadgeLabel(card.monthInvoice.paidBy)"
                class="text-[10px] font-medium text-emerald-700 dark:text-emerald-300"
              >
                {{ payerBadgeLabel(card.monthInvoice.paidBy) }}
              </span>
            </div>
          </div>

          <!-- Ações do Mês -->
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex flex-wrap items-center gap-2">
              <Button
                v-if="isMyCard(card)"
                variant="outline"
                size="xs"
                class="gap-1.5"
                @click="openInvoiceDrawer(card, 'launch')"
              >
                <Receipt class="h-3.5 w-3.5" />
                <span>{{ card.monthInvoice ? 'Ajustar valor' : 'Lançar fatura' }}</span>
              </Button>

              <RouterLink v-if="card.analysisId" to="/invoices">
                <Button variant="ghost" size="xs" class="gap-1 text-primary">
                  <FileSpreadsheet class="h-3.5 w-3.5" />
                  <span>Ver análise ({{ card.analysisItemsCount }})</span>
                </Button>
              </RouterLink>
            </div>

            <div class="flex items-center gap-1.5">
              <Button
                v-if="card.monthInvoice && !card.monthInvoice.paid"
                size="xs"
                class="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                @click="openInvoiceDrawer(card, 'pay')"
              >
                <Check class="h-3.5 w-3.5" />
                <span>Pagar</span>
              </Button>

              <Button
                v-else-if="card.monthInvoice?.paid"
                variant="ghost"
                size="xs"
                class="gap-1 text-muted-foreground hover:text-foreground"
                @click="handleUnpayInvoice(card)"
              >
                <Undo2 class="h-3.5 w-3.5" />
                <span>Desfazer</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </UiCard>
    </div>

    <!-- Drawer 1: Cadastrar / Editar Cartão -->
    <Sheet
      v-model:open="cardDrawerOpen"
      :title="editingCard ? `Editar ${editingCard.name}` : 'Novo cartão de crédito'"
      description="Cadastre o cartão uma única vez para lançar ou importar a fatura de cada mês."
    >
      <form class="space-y-4" @submit.prevent="handleSaveCard">
        <div v-if="!editingCard" class="space-y-1.5">
          <span class="text-xs font-medium text-muted-foreground">Atalhos rápidos:</span>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="preset in CARD_PRESETS"
              :key="preset"
              type="button"
              class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
              :class="
                formCardName === preset
                  ? 'border-primary bg-primary/10 text-primary font-semibold'
                  : 'border-border bg-muted/40 text-muted-foreground hover:text-foreground'
              "
              @click="formCardName = preset"
            >
              {{ preset }}
            </button>
          </div>
        </div>

        <div class="space-y-1.5">
          <label class="text-xs font-medium text-foreground">Nome do cartão</label>
          <input
            v-model="formCardName"
            type="text"
            required
            placeholder="Ex: Nubank, C6 Bank, Bradesco..."
            class="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-foreground">Dia de vencimento</label>
            <input
              v-model.number="formCardDueDay"
              type="number"
              min="1"
              max="31"
              required
              placeholder="10"
              class="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div class="space-y-1.5">
            <label class="text-xs font-medium text-foreground">
              Limite <span class="font-normal text-muted-foreground">(opcional)</span>
            </label>
            <CurrencyInput
              v-model="formCardLimit"
              placeholder="0,00"
            />
          </div>
        </div>

        <button
          type="button"
          class="flex h-10 w-full items-center justify-between rounded-lg border px-3 py-2 text-xs transition-colors"
          :class="
            formCardShared
              ? 'border-primary/40 bg-primary/10 text-foreground font-medium'
              : 'border-input bg-background text-muted-foreground'
          "
          @click="formCardShared = !formCardShared"
        >
          <span class="flex items-center gap-2">
            <Users class="h-4 w-4" :class="formCardShared ? 'text-primary' : 'text-muted-foreground'" />
            Visível na aba Casal
          </span>
          <span
            class="flex h-5 w-5 items-center justify-center rounded-full"
            :class="formCardShared ? 'bg-primary text-primary-foreground' : 'border border-muted-foreground/30'"
          >
            <Check v-if="formCardShared" class="h-3 w-3" />
          </span>
        </button>

        <div class="flex items-center justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" @click="cardDrawerOpen = false">
            Cancelar
          </Button>
          <Button type="submit" :disabled="savingCard">
            {{ savingCard ? 'Salvando...' : editingCard ? 'Salvar alterações' : 'Salvar cartão' }}
          </Button>
        </div>
      </form>
    </Sheet>

    <!-- Drawer 2: Lançar / Ajustar / Pagar Fatura do Mês -->
    <Sheet
      v-model:open="invoiceDrawerOpen"
      :title="
        invoiceDrawerMode === 'pay'
          ? `Pagar Fatura ${targetCard?.name ?? ''} (${periodLabel})`
          : `Fatura ${targetCard?.name ?? ''} em ${periodLabel}`
      "
      description="Cada cartão possui apenas uma fatura por mês, evitando lançamentos duplicados."
    >
      <form class="space-y-4" @submit.prevent="handleSaveMonthlyInvoice(false)">
        <p
          v-if="!targetCard?.monthInvoice && targetCard?.analysisTotalAmount"
          class="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-800 dark:text-emerald-300 tabular-nums"
        >
          Valor sugerido automaticamente a partir da análise desta fatura ({{ formatCurrency(targetCard.analysisTotalAmount) }}).
        </p>

        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-foreground">Valor em {{ periodLabel }}</label>
            <CurrencyInput
              v-model="invoiceAmountInput"
              placeholder="1.250,00"
              required
            />
          </div>

          <div class="space-y-1.5">
            <label class="text-xs font-medium text-foreground">Dia de vencimento</label>
            <input
              v-model.number="invoiceDueDayInput"
              type="number"
              min="1"
              max="31"
              class="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div v-if="invoiceDrawerMode === 'launch'" class="space-y-2">
          <button
            type="button"
            class="flex h-10 w-full items-center justify-between rounded-lg border px-3 py-2 text-xs transition-colors"
            :class="
              invoiceSharedInput
                ? 'border-primary/40 bg-primary/10 text-foreground font-medium'
                : 'border-input bg-background text-muted-foreground'
            "
            @click="invoiceSharedInput = !invoiceSharedInput"
          >
            <span class="flex items-center gap-2">
              <Users class="h-4 w-4" :class="invoiceSharedInput ? 'text-primary' : 'text-muted-foreground'" />
              Exibir esta fatura na aba Casal
            </span>
            <span
              class="flex h-5 w-5 items-center justify-center rounded-full"
              :class="invoiceSharedInput ? 'bg-primary text-primary-foreground' : 'border border-muted-foreground/30'"
            >
              <Check v-if="invoiceSharedInput" class="h-3 w-3" />
            </span>
          </button>
        </div>

        <div
          v-if="hasPartner && invoiceDrawerMode === 'pay' && (targetCard?.shareWithPartner || targetCard?.monthInvoice?.isShared)"
          class="space-y-1.5"
        >
          <label class="text-xs font-medium text-foreground">Quem está pagando?</label>
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              class="rounded-lg border px-3 py-2 text-xs font-medium transition-colors"
              :class="
                invoicePayerUserId === authStore.currentUserId
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold'
                  : 'border-border bg-background text-muted-foreground'
              "
              @click="invoicePayerUserId = authStore.currentUserId || ''"
            >
              {{ myShortName }} (Você)
            </button>
            <button
              v-if="authStore.profile?.partner"
              type="button"
              class="rounded-lg border px-3 py-2 text-xs font-medium transition-colors"
              :class="
                invoicePayerUserId === authStore.profile.partner.id
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold'
                  : 'border-border bg-background text-muted-foreground'
              "
              @click="invoicePayerUserId = authStore.profile.partner.id"
            >
              {{ partnerShortName }}
            </button>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
          <Button
            v-if="invoiceDrawerMode === 'launch' && targetCard?.monthInvoice && isMyCard(targetCard)"
            type="button"
            variant="ghost"
            class="text-xs text-red-500 hover:text-red-600"
            @click="handleClearMonthInvoice(targetCard)"
          >
            Limpar fatura do mês
          </Button>

          <div class="ml-auto flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" @click="invoiceDrawerOpen = false">
              Cancelar
            </Button>

            <Button
              v-if="invoiceDrawerMode === 'launch' && !targetCard?.monthInvoice?.paid"
              type="button"
              variant="secondary"
              class="gap-1.5"
              :disabled="savingInvoice"
              @click="handleSaveMonthlyInvoice(true)"
            >
              <Check class="h-3.5 w-3.5" />
              <span>Salvar e pagar</span>
            </Button>

            <Button type="submit" :disabled="savingInvoice">
              {{
                savingInvoice
                  ? 'Salvando...'
                  : invoiceDrawerMode === 'pay'
                    ? 'Confirmar pagamento'
                    : 'Salvar fatura'
              }}
            </Button>
          </div>
        </div>
      </form>
    </Sheet>

    <!-- Confirmação de Exclusão de Cartão -->
    <ConfirmModal
      :open="Boolean(cardToDelete)"
      title="Excluir cartão?"
      :description="
        cardToDelete
          ? `Deseja excluir o cartão ${cardToDelete.name} e suas faturas mensais vinculadas?`
          : ''
      "
      confirm-label="Excluir cartão"
      variant="danger"
      @close="cardToDelete = null"
      @confirm="confirmDeleteCard"
    />
  </div>
</template>
