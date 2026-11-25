<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Sheet } from '@/components/ui/sheet'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Skeleton } from '@/components/ui/skeleton'
import PremiumOnboarding from '@/components/dashboard/PremiumOnboarding.vue'
import {
  useDashboardStore,
  type DashboardPaidItem,
  type DashboardPendingItem,
} from '@/stores/dashboard/dashboard.store'
import { useAccountsStore } from '@/stores/accounts/accounts.store'
import { useAuthStore } from '@/stores/auth/auth.store'
import { useThemeStore } from '@/stores/theme/theme.store'
import { useToastStore } from '@/stores/toast/toast.store'
import { recurringApi } from '@/api/recurring.api'
import { transactionsApi } from '@/api/transactions.api'
import { usersApi } from '@/api/users.api'
import { isMyResource, payerBadgeLabel, personShortName } from '@/utils/owner'
import type { DebtCategory } from '@/types/transaction'
import {
  Calendar,
  Car,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  ExternalLink,
  Eye,
  EyeOff,
  Flag,
  GraduationCap,
  Home,
  Landmark,
  Pencil,
  PiggyBank,
  Plus,
  Receipt,
  Repeat,
  Sparkles,
  Trash2,
  Undo2,
  Users,
  Wallet,
} from 'lucide-vue-next'

const dashboardStore = useDashboardStore()
const accountsStore = useAccountsStore()
const authStore = useAuthStore()
const themeStore = useThemeStore()
const toastStore = useToastStore()

const { hideValues } = storeToRefs(themeStore)
const { accounts: vaultAccounts } = storeToRefs(accountsStore)

const {
  loading,
  error,
  periodLabel,
  referenceMonth,
  pendingItems,
  paidItems,
  pendingTotalAmount,
  paidTotalAmount,
  monthPaymentProgressPercent,
  monthlyPlan,
  commitment,
  daysRemaining,
  formatCurrency,
} = storeToRefs(dashboardStore)

const hasPartner = computed(() => Boolean(authStore.profile?.partner))
const myShortName = computed(() => personShortName(authStore.profile) || 'Você')
const partnerShortName = computed(
  () => personShortName(authStore.profile?.partner) || 'Par',
)
const coupleShareOverview = computed(() =>
  Boolean(authStore.profile?.family?.shareOverview ?? commitment.value?.shareOverview),
)
const partnerOverview = computed(() => commitment.value?.partnerOverview ?? null)
const togglingCoupleOverview = ref(false)

async function toggleCoupleOverview() {
  if (!hasPartner.value || togglingCoupleOverview.value) return
  togglingCoupleOverview.value = true
  const nextVal = !coupleShareOverview.value
  try {
    const updated = await usersApi.updatePartnerSettings({ shareOverview: nextVal })
    authStore.profile = updated
    await dashboardStore.fetchSummary(referenceMonth.value)
    toastStore.success(
      nextVal
        ? 'Visão discriminada do casal habilitada!'
        : 'Visão discriminada do casal ocultada.',
    )
  } catch (e) {
    toastStore.error(e instanceof Error ? e.message : 'Erro ao atualizar preferência do casal.')
  } finally {
    togglingCoupleOverview.value = false
  }
}

// Patrimônio em CDBs separado: soma nos seus cards apenas as SUAS contas
const myVaultAccounts = computed(() =>
  vaultAccounts.value.filter((a) => isMyResource(a.owner ?? null, authStore.currentUserId)),
)
const partnerSharedVaultAccounts = computed(() =>
  vaultAccounts.value.filter((a) => !isMyResource(a.owner ?? null, authStore.currentUserId)),
)
const mySavedBalance = computed(() =>
  myVaultAccounts.value.reduce((sum, a) => sum + Number(a.balance || 0), 0),
)
const partnerSharedSavedBalance = computed(() =>
  partnerSharedVaultAccounts.value.reduce((sum, a) => sum + Number(a.balance || 0), 0),
)

// 1. Drawer: Editar Renda + Meta de Guardar
const planDrawerOpen = ref(false)
const incomeInput = ref<number | ''>('')
const savingsInput = ref<number | ''>('')
const savingPlan = ref(false)

// 2. Drawer: Check-in de fim de mês ("Quanto sobrou na conta?")
const checkinDrawerOpen = ref(false)
const leftoverInput = ref<number | ''>('')
const savingCheckin = ref(false)

// 3. Drawer: Nova Conta Fixa, Fatura de Cartão OU Financiamento/Parcela direto na Home!
const addDrawerOpen = ref(false)
const addMode = ref<'recurring' | 'card_invoice' | 'debt'>('recurring')
const billName = ref('')
const billAmount = ref<number | ''>('')
const billDueDay = ref<number | ''>(10)
const billInstallments = ref<number | ''>(36)
const billDebtCategory = ref<DebtCategory>('car')
const billShared = ref(false)
const submitting = ref(false)

const CARD_INVOICE_PRESETS = [
  'Fatura Nubank',
  'Fatura Itaú',
  'Fatura Inter',
  'Fatura C6 Bank',
  'Fatura XP',
  'Fatura Santander',
  'Fatura Bradesco',
]

const DEBT_CATEGORIES: Array<{
  value: DebtCategory
  shortLabel: string
  icon: any
}> = [
  { value: 'car', shortLabel: 'Veículo', icon: Car },
  { value: 'home', shortLabel: 'Casa / Imóvel', icon: Home },
  { value: 'personal_loan', shortLabel: 'Empréstimo', icon: Landmark },
  { value: 'student', shortLabel: 'Estudos', icon: GraduationCap },
  { value: 'other', shortLabel: 'Outro', icon: Receipt },
]

// Filtro de divisão: Todas vs Com o Par (Casal) vs Individuais
const scopeFilter = ref<'all' | 'shared' | 'individual'>('all')

const filteredPendingItems = computed(() => {
  if (scopeFilter.value === 'shared') {
    return pendingItems.value.filter((i) => i.isShared || i.kind === 'savings')
  }
  if (scopeFilter.value === 'individual') {
    return pendingItems.value.filter((i) => !i.isShared && i.kind !== 'savings')
  }
  return pendingItems.value
})

const filteredPaidItems = computed(() => {
  if (scopeFilter.value === 'shared') {
    return paidItems.value.filter((i) => i.isShared || i.kind === 'savings')
  }
  if (scopeFilter.value === 'individual') {
    return paidItems.value.filter((i) => !i.isShared && i.kind !== 'savings')
  }
  return paidItems.value
})

const filteredPendingTotal = computed(() =>
  filteredPendingItems.value.reduce((s, i) => s + i.amount, 0),
)

const filteredPaidTotal = computed(() =>
  filteredPaidItems.value.reduce((s, i) => s + i.amount, 0),
)

const sharedTotalBills = computed(() => {
  const pend = pendingItems.value
    .filter((i) => i.isShared && i.kind !== 'savings')
    .reduce((s, i) => s + i.amount, 0)
  const paid = paidItems.value
    .filter((i) => i.isShared && i.kind !== 'savings')
    .reduce((s, i) => s + i.amount, 0)
  return pend + paid
})

// Placar de quem já pagou quanto nas contas compartilhadas do mês
const sharedPaidByMe = computed(() =>
  paidItems.value
    .filter(
      (i) =>
        i.isShared &&
        i.kind !== 'savings' &&
        i.paidBy?.id === authStore.currentUserId,
    )
    .reduce((s, i) => s + i.amount, 0),
)

const sharedPaidByPartner = computed(() =>
  paidItems.value
    .filter(
      (i) =>
        i.isShared &&
        i.kind !== 'savings' &&
        i.paidBy?.id &&
        i.paidBy.id !== authStore.currentUserId,
    )
    .reduce((s, i) => s + i.amount, 0),
)

// Contas individuais desta pessoa + metade das contas marcadas como Casal (quando em casal)
const myIndividualBillsTotal = computed(() => {
  const pend = pendingItems.value
    .filter((i) => !i.isShared && i.kind !== 'savings')
    .reduce((s, i) => s + i.amount, 0)
  const paid = paidItems.value
    .filter((i) => !i.isShared && i.kind !== 'savings')
    .reduce((s, i) => s + i.amount, 0)
  return pend + paid
})

const mySharedBillsShare = computed(() =>
  hasPartner.value ? sharedTotalBills.value / 2 : sharedTotalBills.value,
)

// Cálculos do modelo Anti-Planilha (estritamente individual + sua parte nas contas compartilhadas):
const configuredIncome = computed(() => monthlyPlan.value?.monthlyIncome ?? 0)
const configuredSavings = computed(() => monthlyPlan.value?.savingsGoal ?? 0)
const isSavingsPaid = computed(() => Boolean(monthlyPlan.value?.savingsPaid))
const endOfMonthLeftover = computed(() => monthlyPlan.value?.endOfMonthLeftover ?? null)

const totalMonthBills = computed(
  () => myIndividualBillsTotal.value + mySharedBillsShare.value,
)

const totalBillsCount = computed(
  () =>
    pendingItems.value.filter((i) => i.kind !== 'savings').length +
    paidItems.value.filter((i) => i.kind !== 'savings').length,
)

const totalItemsCount = computed(
  () => pendingItems.value.length + paidItems.value.length,
)

const afterBillsAmount = computed(
  () => configuredIncome.value - totalMonthBills.value,
)

const freeToSpendAmount = computed(
  () => configuredIncome.value - totalMonthBills.value - configuredSavings.value,
)

const freePerWeekAmount = computed(() => {
  if (freeToSpendAmount.value <= 0) return 0
  return freeToSpendAmount.value / 4
})

const freePerDayRemaining = computed(() => {
  if (freeToSpendAmount.value <= 0) return 0
  const days = Math.max(daysRemaining.value || 15, 1)
  return freeToSpendAmount.value / days
})

const actualFreeSpent = computed(() => {
  if (endOfMonthLeftover.value == null) return null
  return Math.max(freeToSpendAmount.value - endOfMonthLeftover.value, 0)
})

const totalSavedInMonth = computed(() => {
  if (endOfMonthLeftover.value == null) return null
  return configuredSavings.value + endOfMonthLeftover.value
})

watch(
  monthlyPlan,
  (plan) => {
    if (plan && !planDrawerOpen.value) {
      incomeInput.value = plan.monthlyIncome > 0 ? plan.monthlyIncome : ''
      savingsInput.value = plan.savingsGoal > 0 ? plan.savingsGoal : ''
      leftoverInput.value =
        plan.endOfMonthLeftover != null ? plan.endOfMonthLeftover : ''
    }
  },
  { immediate: true },
)

const initialSummaryLoaded = ref(false)

onMounted(async () => {
  await Promise.all([
    dashboardStore.fetchSummary(),
    accountsStore.fetchAll(),
  ])
  initialSummaryLoaded.value = true
  if (dashboardStore.error) {
    toastStore.error(dashboardStore.error)
  }
})

function openPlanDrawer() {
  incomeInput.value = configuredIncome.value > 0 ? configuredIncome.value : ''
  savingsInput.value = configuredSavings.value > 0 ? configuredSavings.value : ''
  planDrawerOpen.value = true
}

async function handleSavePlan() {
  const inc = Number(incomeInput.value) || 0
  const sav = Number(savingsInput.value) || 0
  if (inc < 0 || sav < 0) {
    toastStore.error('Os valores não podem ser negativos.')
    return
  }
  savingPlan.value = true
  try {
    await dashboardStore.saveMonthlyPlan({
      monthlyIncome: inc,
      savingsGoal: sav,
    })
    planDrawerOpen.value = false
    toastStore.success('Planejamento do mês atualizado!')
  } catch {
    toastStore.error('Não foi possível salvar o planejamento.')
  } finally {
    savingPlan.value = false
  }
}

function openCheckinDrawer() {
  leftoverInput.value =
    endOfMonthLeftover.value != null ? endOfMonthLeftover.value : ''
  checkinDrawerOpen.value = true
}

async function handleSaveCheckin() {
  const val = leftoverInput.value === '' ? null : Number(leftoverInput.value)
  if (val !== null && (!Number.isFinite(val) || val < 0)) {
    toastStore.error('Informe um valor válido.')
    return
  }
  savingCheckin.value = true
  try {
    await dashboardStore.saveMonthlyPlan({
      endOfMonthLeftover: val,
    })
    checkinDrawerOpen.value = false
    toastStore.success(
      val !== null
        ? 'Fechamento do mês registrado!'
        : 'Fechamento do mês reaberto.',
    )
  } catch {
    toastStore.error('Erro ao salvar o fechamento do mês.')
  } finally {
    savingCheckin.value = false
  }
}

async function handleClearCheckin() {
  savingCheckin.value = true
  try {
    await dashboardStore.saveMonthlyPlan({
      endOfMonthLeftover: null,
    })
    checkinDrawerOpen.value = false
    toastStore.success('Fechamento removido.')
  } catch {
    toastStore.error('Erro ao limpar fechamento.')
  } finally {
    savingCheckin.value = false
  }
}

function openAddDrawer(mode: 'recurring' | 'card_invoice' | 'debt' = 'recurring') {
  addMode.value = mode
  billName.value = ''
  billAmount.value = ''
  billDueDay.value = 10
  billInstallments.value = 36
  billDebtCategory.value = 'car'
  billShared.value = false
  addDrawerOpen.value = true
}

async function submitNewBill() {
  const name = billName.value.trim()
  const amount = Number(billAmount.value)
  if (!name || !amount || amount <= 0) {
    toastStore.error('Informe o nome e o valor mensal.')
    return
  }

  submitting.value = true
  const ym = referenceMonth.value || new Date().toISOString().slice(0, 7)
  const dayStr = String(Math.min(Math.max(Number(billDueDay.value) || 10, 1), 28)).padStart(2, '0')

  try {
    let wasDeduplicated = false
    if (addMode.value === 'recurring' || addMode.value === 'card_invoice') {
      const res = (await recurringApi.create({
        name,
        kind: 'fixed_bill',
        transactionType: 'expense',
        frequency: 'monthly',
        amount,
        dueDay: billDueDay.value ? Number(billDueDay.value) : undefined,
        startDate: `${ym}-01`,
        referenceMonth: ym,
        isCardInvoice: addMode.value === 'card_invoice',
        isShared: billShared.value,
      })) as { deduplicated?: boolean; name?: string } | undefined
      wasDeduplicated = Boolean(res?.deduplicated)
    } else {
      await transactionsApi.createDebtExpense({
        description: name,
        amount,
        installmentTotal: Math.max(Number(billInstallments.value) || 1, 1),
        debtCategory: billDebtCategory.value,
        occurredAt: new Date(`${ym}-${dayStr}T12:00:00`).toISOString(),
        referenceMonth: ym,
        isShared: billShared.value,
      })
    }

    toastStore.success(
      wasDeduplicated
        ? `${name} já existia e teve o valor deste mês atualizado!`
        : `${name} adicionado ao mês!`,
    )
    addDrawerOpen.value = false
    await dashboardStore.fetchSummary(ym)
  } catch (e) {
    toastStore.error(e instanceof Error ? e.message : 'Erro ao adicionar conta')
  } finally {
    submitting.value = false
  }
}

async function handlePrevMonth() {
  await dashboardStore.changeMonth(-1)
}

async function handleNextMonth() {
  await dashboardStore.changeMonth(1)
}

async function handleCurrentMonth() {
  const now = new Date()
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  await dashboardStore.fetchSummary(ym)
}

// 4. Drawer: Ajustar valor do mês (ex: Luz que varia todo mês) ou Confirmar Pagamento
const itemDrawerOpen = ref(false)
const itemDrawerMode = ref<'pay' | 'edit'>('pay')
const selectedItem = ref<DashboardPendingItem | DashboardPaidItem | null>(null)
const selectedItemAmount = ref<number | ''>('')
const selectedVaultAccountId = ref<string>('')
const selectedPayerUserId = ref<string>('')
const savingItemAction = ref(false)

function openItemDrawer(
  item: DashboardPendingItem | DashboardPaidItem,
  mode: 'pay' | 'edit',
) {
  selectedItem.value = item
  selectedItemAmount.value = item.amount
  itemDrawerMode.value = mode
  selectedPayerUserId.value = authStore.currentUserId || ''
  if (item.kind === 'savings' && myVaultAccounts.value.length > 0 && !selectedVaultAccountId.value) {
    selectedVaultAccountId.value = myVaultAccounts.value[0].id
  }
  itemDrawerOpen.value = true
}

async function handleConfirmItemDrawer(alsoMarkPaid = false) {
  const item = selectedItem.value
  if (!item) return
  const numAmount = Number(selectedItemAmount.value)
  if (!Number.isFinite(numAmount) || numAmount <= 0) {
    toastStore.error('Informe um valor válido maior que zero.')
    return
  }

  savingItemAction.value = true
  try {
    if (itemDrawerMode.value === 'pay' || alsoMarkPaid) {
      await dashboardStore.markPendingItemAsPaid(
        item as DashboardPendingItem,
        numAmount,
        item.isShared && selectedPayerUserId.value ? selectedPayerUserId.value : undefined,
      )
      if (item.kind === 'savings' && selectedVaultAccountId.value) {
        const targetVault = myVaultAccounts.value.find((a) => a.id === selectedVaultAccountId.value)
        await accountsStore.adjustBalance(selectedVaultAccountId.value, numAmount)
        toastStore.success(
          `${formatCurrency.value(numAmount)} guardados em ${targetVault?.name ?? 'sua reserva'}!`,
        )
      } else {
        toastStore.success(`${item.title} pago (${formatCurrency.value(numAmount)})!`)
      }
    } else {
      await dashboardStore.updateItemMonthAmount(item, numAmount)
      toastStore.success(
        `Valor de ${item.title} ajustado para ${formatCurrency.value(numAmount)} neste mês!`,
      )
    }
    itemDrawerOpen.value = false
  } catch (e) {
    toastStore.error(e instanceof Error ? e.message : 'Erro ao atualizar conta')
  } finally {
    savingItemAction.value = false
  }
}

async function handleMarkPaid(item: DashboardPendingItem) {
  openItemDrawer(item, 'pay')
}

async function handleUnmarkPaid(item: DashboardPaidItem) {
  try {
    await dashboardStore.unmarkPaidItem(item)
    toastStore.success(`${item.title} voltou para pendentes.`)
  } catch (e) {
    toastStore.error(e instanceof Error ? e.message : 'Erro ao desfazer')
  }
}

async function handleRemovePending(item: DashboardPendingItem) {
  try {
    await dashboardStore.removePendingItem(item)
    toastStore.success(`${item.title} removido.`)
  } catch (e) {
    toastStore.error(e instanceof Error ? e.message : 'Erro ao remover conta')
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-6 sm:px-6 space-y-5">
    <!-- Cabeçalho Minimalista: Navegador de Mês integrado ao Título + Ação Única -->
    <header class="flex items-center justify-between gap-2">
      <div class="inline-flex items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-2xs">
        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8 rounded-lg"
          aria-label="Mês anterior"
          @click="handlePrevMonth"
        >
          <ChevronLeft class="h-4 w-4" />
        </Button>

        <button
          type="button"
          class="inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1 text-sm font-bold tracking-tight text-foreground hover:text-primary transition-colors"
          title="Voltar para o mês atual"
          @click="handleCurrentMonth"
        >
          <Calendar class="h-3.5 w-3.5 shrink-0 text-primary" />
          <span>{{ periodLabel || 'Hoje' }}</span>
        </button>

        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8 rounded-lg"
          aria-label="Próximo mês"
          @click="handleNextMonth"
        >
          <ChevronRight class="h-4 w-4" />
        </Button>
      </div>

      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          class="hidden md:inline-flex h-9 w-9"
          :title="hideValues ? 'Mostrar valores' : 'Ocultar valores (Modo Privacidade)'"
          @click="themeStore.togglePrivacy()"
        >
          <EyeOff v-if="hideValues" class="h-4 w-4 text-primary" />
          <Eye v-else class="h-4 w-4 text-muted-foreground" />
        </Button>

        <Button size="sm" class="h-9 gap-1.5 px-3.5" @click="openAddDrawer('recurring')">
          <Plus class="h-4 w-4" />
          <span>Nova conta</span>
        </Button>
      </div>
    </header>

    <!-- Tour de Boas Vindas (1º acesso Premium) + Checklist Interativo de Primeiros Passos -->
    <PremiumOnboarding
      :ready="initialSummaryLoaded"
      :configured-income="configuredIncome"
      :configured-savings="configuredSavings"
      :total-bills-count="totalBillsCount"
      @open-plan="openPlanDrawer"
      @open-add-bill="openAddDrawer('recurring')"
    />

    <!-- 1. A EQUAÇÃO DO MÊS (Sua Renda, Suas Contas, Quero Guardar e Livre) -->
    <Card class="overflow-hidden border-primary/25 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-2.5 sm:px-5 sm:py-3">
        <div class="flex items-center gap-2">
          <Sparkles class="h-4 w-4 text-primary" />
          <span class="text-xs font-semibold uppercase tracking-wider text-foreground">
            {{ hasPartner ? `Seu Orçamento (${myShortName})` : 'Orçamento Livre do Mês' }}
          </span>
        </div>

        <div class="flex items-center gap-1.5">
          <Button
            v-if="hasPartner"
            type="button"
            :variant="coupleShareOverview ? 'secondary' : 'ghost'"
            size="xs"
            class="gap-1.5 text-xs"
            :disabled="togglingCoupleOverview"
            title="Exibir ou ocultar o quadro comparativo separado do casal"
            @click="toggleCoupleOverview"
          >
            <Users class="h-3 w-3 text-primary" />
            <span>{{ coupleShareOverview ? 'Ocultar visão do casal' : 'Ver visão do casal' }}</span>
          </Button>

          <Button
            variant="ghost"
            size="xs"
            class="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            @click="openPlanDrawer"
          >
            <Pencil class="h-3 w-3" />
            <span>Definir Renda & Meta</span>
          </Button>
        </div>
      </div>

      <CardContent class="p-3.5 sm:p-5">
        <div v-if="loading && pendingItems.length === 0 && paidItems.length === 0" class="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-4">
          <div v-for="n in 4" :key="n" class="flex flex-col justify-between rounded-xl border border-border bg-background p-2.5 sm:p-4 space-y-1.5 sm:space-y-2.5">
            <Skeleton class="h-3 w-16 sm:w-24" />
            <Skeleton class="h-5 sm:h-7 w-20 sm:w-32" />
            <Skeleton class="h-2.5 w-20 sm:w-36" />
          </div>
        </div>

        <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <!-- Bloco 1: Renda do Mês -->
          <button
            type="button"
            class="group flex flex-col justify-between rounded-xl border border-border bg-background p-3 sm:p-4 text-left transition-colors hover:border-primary/40"
            @click="openPlanDrawer"
          >
            <div class="flex items-center justify-between">
              <span class="text-[11px] sm:text-xs font-medium text-muted-foreground">1. Renda no mês</span>
              <Pencil class="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div class="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-bold tracking-tight tabular-nums text-foreground">
              {{ formatCurrency(configuredIncome) }}
            </div>
            <span class="mt-1 text-[10px] sm:text-[11px] text-muted-foreground truncate">
              {{ configuredIncome > 0 ? 'Toque para ajustar' : 'Informar renda' }}
            </span>
          </button>

          <!-- Bloco 2: Contas a Pagar no Mês (suas individuais + sua metade das compartilhadas) -->
          <div class="flex flex-col justify-between rounded-xl border border-border bg-background p-3 sm:p-4">
            <div class="flex items-center justify-between gap-1">
              <span class="text-[11px] sm:text-xs font-medium text-muted-foreground truncate">2. Suas contas</span>
              <Badge variant="secondary" class="text-[10px] px-1.5 py-0 shrink-0">
                {{ totalBillsCount }}
              </Badge>
            </div>
            <div class="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-bold tracking-tight tabular-nums text-foreground">
              {{ formatCurrency(totalMonthBills) }}
            </div>
            <span
              v-if="hasPartner && sharedTotalBills > 0"
              class="mt-1 text-[10px] sm:text-[11px] text-muted-foreground truncate tabular-nums"
              :title="`Individuais: ${formatCurrency(myIndividualBillsTotal)} + 50% casal: ${formatCurrency(mySharedBillsShare)}`"
            >
              Indiv. + 50% casal ({{ formatCurrency(mySharedBillsShare) }})
            </span>
            <span v-else class="mt-1 text-[10px] sm:text-[11px] text-muted-foreground truncate tabular-nums">
              Restam {{ formatCurrency(afterBillsAmount) }}
            </span>
          </div>

          <!-- Bloco 3: Quero Guardar -->
          <button
            type="button"
            class="group flex flex-col justify-between rounded-xl border border-border bg-background p-3 sm:p-4 text-left transition-colors hover:border-primary/40"
            @click="openPlanDrawer"
          >
            <div class="flex items-center justify-between gap-1">
              <span class="text-[11px] sm:text-xs font-medium text-muted-foreground truncate">3. Quero guardar</span>
              <Badge
                v-if="configuredSavings > 0"
                :variant="isSavingsPaid ? 'success' : 'warning'"
                class="text-[10px] px-1.5 py-0 shrink-0"
              >
                {{ isSavingsPaid ? 'OK' : 'Meta' }}
              </Badge>
              <PiggyBank v-else class="h-3.5 w-3.5 text-primary shrink-0" />
            </div>
            <div class="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-bold tracking-tight tabular-nums text-primary">
              {{ formatCurrency(configuredSavings) }}
            </div>
            <span class="mt-1 text-[10px] sm:text-[11px] text-muted-foreground truncate">
              {{
                configuredSavings > 0
                  ? isSavingsPaid
                    ? 'Já separado no mês'
                    : 'Na lista Falta Pagar'
                  : 'Definir reserva'
              }}
            </span>
          </button>

          <!-- Bloco 4: LIVRE PRA GASTAR -->
          <div
            class="flex flex-col justify-between rounded-xl border p-3 sm:p-4"
            :class="
              freeToSpendAmount >= 0
                ? 'border-emerald-500/30 bg-emerald-500/10'
                : 'border-red-500/30 bg-red-500/10'
            "
          >
            <div class="flex items-center justify-between gap-1">
              <span
                class="text-[11px] sm:text-xs font-semibold uppercase tracking-wide truncate"
                :class="freeToSpendAmount >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600'"
              >
                4. Livre
              </span>
              <Wallet
                class="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0"
                :class="freeToSpendAmount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'"
              />
            </div>
            <div
              class="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-extrabold tracking-tight tabular-nums"
              :class="freeToSpendAmount >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600'"
            >
              {{ formatCurrency(freeToSpendAmount) }}
            </div>
            <span
              v-if="freeToSpendAmount > 0"
              class="mt-1 text-[10px] sm:text-[11px] font-medium text-emerald-700/80 dark:text-emerald-300/80 truncate tabular-nums"
            >
              ~ {{ formatCurrency(freePerWeekAmount) }}/sem
            </span>
            <span v-else class="mt-1 text-[10px] sm:text-[11px] text-red-600/90 truncate">
              Ajuste renda/metas
            </span>
          </div>
        </div>
      </CardContent>

      <!-- Faixa discreta de Patrimônio Guardado (separado por pessoa, sem somar tudo) -->
      <RouterLink
        v-if="myVaultAccounts.length > 0 || partnerSharedVaultAccounts.length > 0"
        to="/accounts"
        class="group flex flex-wrap items-center justify-between gap-3 border-t border-border/70 bg-emerald-500/5 px-4 py-2.5 text-xs transition-colors hover:bg-emerald-500/10 sm:px-5"
      >
        <div class="flex items-center gap-2 min-w-0">
          <PiggyBank class="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span class="font-medium text-muted-foreground group-hover:text-foreground transition-colors truncate">
            Seu patrimônio guardado ({{ myVaultAccounts.length }} {{ myVaultAccounts.length === 1 ? 'reserva' : 'reservas' }})
          </span>
        </div>

        <div class="flex flex-wrap items-center gap-3 shrink-0">
          <strong class="font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
            {{ formatCurrency(mySavedBalance) }}
          </strong>
          <span
            v-if="partnerSharedVaultAccounts.length > 0"
            class="rounded-md border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground tabular-nums"
          >
            {{ partnerShortName }}: <strong class="text-foreground">{{ formatCurrency(partnerSharedSavedBalance) }}</strong>
          </span>
          <ChevronRight class="h-3.5 w-3.5 text-muted-foreground group-hover:translate-x-0.5 group-hover:text-emerald-600 transition-all" />
        </div>
      </RouterLink>
    </Card>

    <!-- QUADRO DISCRIMINADO DO CASAL (VALORES SEPARADOS, SEM MISTURAR) -->
    <Card
      v-if="hasPartner && coupleShareOverview && partnerOverview"
      class="overflow-hidden border-primary/20 bg-card"
    >
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-primary/5 px-4 py-2.5 sm:px-5">
        <div class="flex items-center gap-2">
          <Users class="h-4 w-4 text-primary" />
          <span class="text-xs font-semibold text-foreground">
            Visão do Casal (Valores Separados por Pessoa)
          </span>
        </div>
        <span class="text-[11px] text-muted-foreground">
          Cada pessoa mantém sua renda e saldo separados
        </span>
      </div>

      <CardContent class="p-4 sm:p-5">
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          <!-- Coluna 1: Você -->
          <div class="rounded-xl border border-border bg-background p-3.5 space-y-2.5">
            <div class="flex items-center justify-between border-b border-border/60 pb-2">
              <span class="text-xs font-bold text-foreground">{{ myShortName }} (Você)</span>
              <Badge variant="outline" class="text-[10px] px-1.5 py-0">Individual</Badge>
            </div>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span class="text-[11px] text-muted-foreground block">Renda no mês</span>
                <strong class="font-semibold tabular-nums text-foreground">{{ formatCurrency(configuredIncome) }}</strong>
              </div>
              <div>
                <span class="text-[11px] text-muted-foreground block">Suas contas (+ 50% casal)</span>
                <strong class="font-semibold tabular-nums text-foreground">{{ formatCurrency(totalMonthBills) }}</strong>
              </div>
              <div>
                <span class="text-[11px] text-muted-foreground block">Quero guardar</span>
                <strong class="font-semibold tabular-nums text-primary">{{ formatCurrency(configuredSavings) }}</strong>
              </div>
              <div>
                <span class="text-[11px] text-muted-foreground block">Livre no mês</span>
                <strong
                  class="font-bold tabular-nums"
                  :class="freeToSpendAmount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600'"
                >
                  {{ formatCurrency(freeToSpendAmount) }}
                </strong>
              </div>
            </div>
            <div class="flex items-center justify-between border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
              <span>Guardado em CDBs próprios</span>
              <strong class="tabular-nums text-foreground">{{ formatCurrency(mySavedBalance) }}</strong>
            </div>
          </div>

          <!-- Coluna 2: Par -->
          <div class="rounded-xl border border-border bg-background p-3.5 space-y-2.5">
            <div class="flex items-center justify-between border-b border-border/60 pb-2">
              <span class="text-xs font-bold text-foreground">{{ partnerOverview.name }}</span>
              <Badge variant="secondary" class="text-[10px] px-1.5 py-0">Seu par</Badge>
            </div>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span class="text-[11px] text-muted-foreground block">Renda no mês</span>
                <strong class="font-semibold tabular-nums text-foreground">{{ formatCurrency(partnerOverview.monthlyIncome) }}</strong>
              </div>
              <div>
                <span class="text-[11px] text-muted-foreground block">Contas (+ 50% casal)</span>
                <strong class="font-semibold tabular-nums text-foreground">{{ formatCurrency(partnerOverview.totalBillsShare) }}</strong>
              </div>
              <div>
                <span class="text-[11px] text-muted-foreground block">Quero guardar</span>
                <strong class="font-semibold tabular-nums text-primary">{{ formatCurrency(partnerOverview.savingsGoal) }}</strong>
              </div>
              <div>
                <span class="text-[11px] text-muted-foreground block">Livre no mês</span>
                <strong
                  class="font-bold tabular-nums"
                  :class="partnerOverview.freeBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600'"
                >
                  {{ formatCurrency(partnerOverview.freeBalance) }}
                </strong>
              </div>
            </div>
            <div class="flex items-center justify-between border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
              <span>Guardado em CDBs próprios</span>
              <strong class="tabular-nums text-foreground">{{ formatCurrency(partnerOverview.savedInAccounts) }}</strong>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Banner de Resumo quando o mês já foi conferido -->
    <Card
      v-if="endOfMonthLeftover != null"
      class="border-primary/30 bg-primary/5"
    >
      <CardContent class="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <Badge variant="success">Mês conferido</Badge>
            <span class="text-sm font-semibold text-foreground">
              Sobrou {{ formatCurrency(endOfMonthLeftover) }} do saldo livre!
            </span>
          </div>
          <p class="text-xs text-muted-foreground">
            Vocês gastaram <strong>{{ formatCurrency(actualFreeSpent ?? 0) }}</strong> dos
            {{ formatCurrency(freeToSpendAmount) }} livres e guardaram no total
            <strong class="text-primary">{{ formatCurrency(totalSavedInMonth ?? 0) }}</strong>
            ({{ formatCurrency(configuredSavings) }} da meta + {{ formatCurrency(endOfMonthLeftover) }} que sobrou).
          </p>
        </div>

        <Button variant="outline" size="xs" @click="openCheckinDrawer">
          Editar fechamento
        </Button>
      </CardContent>
    </Card>

    <div
      v-if="error"
      class="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-600 dark:text-red-400"
    >
      {{ error }}
    </div>

    <!-- 2. PROGRESSO DAS CONTAS DO MÊS -->
    <Card>
      <CardContent class="p-4 space-y-3">
        <template v-if="loading && pendingItems.length === 0 && paidItems.length === 0">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 sm:gap-4">
              <Skeleton class="h-3.5 w-20 sm:w-36" />
              <Skeleton class="h-3.5 w-20 sm:w-36" />
            </div>
            <Skeleton class="h-3.5 w-16 sm:w-40" />
          </div>
          <Skeleton class="h-2 w-full rounded-full" />
        </template>

        <template v-else>
          <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div class="flex items-center gap-4">
              <span class="font-medium text-foreground">
                Falta pagar: <strong class="text-amber-600 dark:text-amber-400">{{ formatCurrency(pendingTotalAmount) }}</strong>
              </span>
              <span class="font-medium text-foreground">
                Já paguei: <strong class="text-emerald-600 dark:text-emerald-400">{{ formatCurrency(paidTotalAmount) }}</strong>
              </span>
            </div>
            <span class="text-muted-foreground">
              {{ paidItems.length }} de {{ totalItemsCount }} contas pagas ({{ monthPaymentProgressPercent }}%)
            </span>
          </div>

          <Progress
            :model-value="monthPaymentProgressPercent"
            class="h-2"
            indicator-class="bg-emerald-600 dark:bg-emerald-500"
          />
        </template>
      </CardContent>
    </Card>

    <!-- Barra de Filtro: Todas vs Com o Par (Casal) vs Individuais -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="inline-flex items-center rounded-xl border border-border bg-card p-1">
        <button
          type="button"
          class="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
          :class="
            scopeFilter === 'all'
              ? 'bg-secondary text-foreground font-semibold shadow-2xs'
              : 'text-muted-foreground hover:text-foreground'
          "
          @click="scopeFilter = 'all'"
        >
          Todas as contas
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
          <span>Com meu par (Casal)</span>
        </button>

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
          Individuais
        </button>
      </div>

      <div v-if="sharedTotalBills > 0" class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span class="inline-flex items-center gap-1.5">
          <Users class="h-3.5 w-3.5 text-primary" />
          <span>
            Contas do casal: <strong class="tabular-nums text-foreground">{{ formatCurrency(sharedTotalBills) }}</strong>
            ({{ formatCurrency(sharedTotalBills / 2) }} pra cada)
          </span>
        </span>
        <span
          v-if="hasPartner && (sharedPaidByMe > 0 || sharedPaidByPartner > 0)"
          class="rounded-lg border border-border bg-card px-2.5 py-0.5 text-[11px] tabular-nums"
        >
          Pago por {{ myShortName }}: <strong class="text-emerald-600 dark:text-emerald-400">{{ formatCurrency(sharedPaidByMe) }}</strong>
          · Pago por {{ partnerShortName }}: <strong class="text-emerald-600 dark:text-emerald-400">{{ formatCurrency(sharedPaidByPartner) }}</strong>
        </span>
      </div>
    </div>

    <!-- 3. DUAS COLUNAS: FALTA PAGAR vs JÁ PAGUEI -->
    <section class="grid grid-cols-1 gap-6 md:grid-cols-2">
      <!-- COLUNA 1: FALTA PAGAR -->
      <Card class="flex flex-col">
        <CardHeader class="flex flex-row items-center justify-between border-b border-border py-4">
          <div class="flex items-center gap-2">
            <CardTitle class="text-sm font-semibold">Falta Pagar no Mês</CardTitle>
            <Skeleton v-if="loading && pendingItems.length === 0" class="h-5 w-6 rounded-full" />
            <Badge v-else :variant="filteredPendingItems.length > 0 ? 'warning' : 'secondary'">
              {{ filteredPendingItems.length }}
            </Badge>
          </div>
          <Skeleton v-if="loading && pendingItems.length === 0" class="h-5 w-24" />
          <span v-else class="text-sm font-semibold tabular-nums text-foreground">
            {{ formatCurrency(filteredPendingTotal) }}
          </span>
        </CardHeader>

        <CardContent class="flex-1 p-0">
          <ul
            v-if="loading && pendingItems.length === 0"
            class="divide-y divide-border"
            aria-label="Carregando contas pendentes"
          >
            <li
              v-for="n in 3"
              :key="n"
              class="flex items-center justify-between gap-2 px-4 py-2.5 sm:px-5 sm:py-3.5"
            >
              <div class="flex items-center gap-2">
                <Skeleton class="h-3.5 w-24 sm:w-32" />
                <Skeleton class="h-3.5 w-12 rounded-full" />
              </div>
              <div class="flex items-center gap-2">
                <Skeleton class="h-3.5 w-16 sm:w-20" />
                <Skeleton class="h-6 w-12 sm:h-7 sm:w-16 rounded-md" />
              </div>
            </li>
          </ul>

          <div
            v-else-if="filteredPendingItems.length === 0"
            class="flex flex-col items-center justify-center py-12 px-4 text-center"
          >
            <CheckCircle2 class="h-8 w-8 text-emerald-500/80 mb-2" />
            <p class="text-sm font-medium text-foreground">Tudo pago neste mês!</p>
            <p class="text-xs text-muted-foreground mt-0.5">
              Nenhuma conta pendente neste filtro.
            </p>
          </div>

          <ul v-else class="divide-y divide-border" role="list">
            <li
              v-for="item in filteredPendingItems"
              :key="item.id"
              class="group flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-muted/40 transition-colors"
              :class="item.kind === 'savings' ? 'bg-primary/5' : ''"
            >
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <PiggyBank v-if="item.kind === 'savings'" class="h-4 w-4 shrink-0 text-primary" />
                  <p class="truncate text-sm font-medium text-foreground">
                    {{ item.title }}
                  </p>
                  <Badge
                    v-if="item.isShared"
                    variant="outline"
                    class="gap-1 text-[10px] px-1.5 py-0 font-normal"
                  >
                    <Users class="h-2.5 w-2.5 text-primary" />
                    Casal
                  </Badge>
                  <Badge
                    v-if="item.kind === 'savings'"
                    variant="secondary"
                    class="text-[11px] px-1.5 py-0 font-normal"
                  >
                    Meta do mês
                  </Badge>
                  <Badge
                    v-else-if="item.dueDay"
                    :variant="
                      item.status === 'overdue'
                        ? 'destructive'
                        : item.status === 'urgent'
                          ? 'warning'
                          : 'secondary'
                    "
                    class="text-[11px] px-1.5 py-0 font-normal"
                  >
                    {{ item.statusLabel }}
                  </Badge>
                </div>
              </div>

              <div class="flex shrink-0 items-center gap-2.5">
                <button
                  v-if="item.kind !== 'invoice'"
                  type="button"
                  class="group/price inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-sm font-semibold tabular-nums text-foreground transition-colors hover:bg-muted hover:text-primary"
                  title="Clique para ajustar o valor deste mês (ex: conta de luz variável)"
                  @click="openItemDrawer(item, 'edit')"
                >
                  <span>{{ formatCurrency(item.amount) }}</span>
                  <Pencil class="h-3 w-3 text-muted-foreground opacity-60 group-hover/price:opacity-100 group-hover/price:text-primary" />
                </button>
                <span v-else class="text-sm font-semibold tabular-nums text-foreground">
                  {{ formatCurrency(item.amount) }}
                </span>

                <Button
                  v-if="item.canMarkPaid"
                  variant="outline"
                  size="xs"
                  class="border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400"
                  :disabled="dashboardStore.isActionLoading(item.id)"
                  @click="handleMarkPaid(item)"
                >
                  <Check class="h-3.5 w-3.5" />
                  <span>{{ item.kind === 'savings' ? 'Guardar' : 'Pagar' }}</span>
                </Button>

                <RouterLink v-else-if="item.linkTo" :to="item.linkTo">
                  <Button variant="ghost" size="xs">
                    <span>Ver</span>
                    <ExternalLink class="h-3 w-3" />
                  </Button>
                </RouterLink>

                <button
                  v-if="item.kind === 'recurring' || item.kind === 'transaction'"
                  type="button"
                  class="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-red-500 transition-opacity"
                  title="Excluir conta"
                  @click="handleRemovePending(item)"
                >
                  <Trash2 class="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          </ul>
        </CardContent>
      </Card>

      <!-- COLUNA 2: JÁ PAGUEI -->
      <Card class="flex flex-col">
        <CardHeader class="flex flex-row items-center justify-between border-b border-border py-4">
          <div class="flex items-center gap-2">
            <CardTitle class="text-sm font-semibold">Já Paguei</CardTitle>
            <Skeleton v-if="loading && paidItems.length === 0" class="h-5 w-6 rounded-full" />
            <Badge v-else variant="success">
              {{ filteredPaidItems.length }}
            </Badge>
          </div>
          <Skeleton v-if="loading && paidItems.length === 0" class="h-5 w-24" />
          <span v-else class="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
            {{ formatCurrency(filteredPaidTotal) }}
          </span>
        </CardHeader>

        <CardContent class="flex-1 p-0">
          <ul
            v-if="loading && paidItems.length === 0"
            class="divide-y divide-border"
            aria-label="Carregando contas pagas"
          >
            <li
              v-for="n in 2"
              :key="n"
              class="flex items-center justify-between gap-2 px-4 py-2.5 sm:px-5 sm:py-3.5"
            >
              <div class="flex items-center gap-2">
                <Skeleton class="h-3.5 w-3.5 rounded-full" />
                <div class="space-y-1">
                  <Skeleton class="h-3.5 w-24 sm:w-28" />
                  <Skeleton class="h-2.5 w-16 sm:w-20" />
                </div>
              </div>
              <div class="flex items-center gap-2">
                <Skeleton class="h-3.5 w-16 sm:w-20" />
                <Skeleton class="h-6 w-6 rounded-md" />
              </div>
            </li>
          </ul>

          <div
            v-else-if="filteredPaidItems.length === 0"
            class="flex flex-col items-center justify-center py-12 px-4 text-center"
          >
            <p class="text-sm font-medium text-muted-foreground">
              Nenhuma conta paga ainda
            </p>
            <p class="text-xs text-muted-foreground mt-0.5">
              Clique em "Pagar" nas contas ao lado conforme for quitando no mês.
            </p>
          </div>

          <ul v-else class="divide-y divide-border" role="list">
            <li
              v-for="item in filteredPaidItems"
              :key="item.id"
              class="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-muted/40 transition-colors"
              :class="item.kind === 'savings' ? 'bg-primary/5' : ''"
            >
              <div class="flex min-w-0 items-center gap-2.5">
                <PiggyBank v-if="item.kind === 'savings'" class="h-4 w-4 shrink-0 text-primary" />
                <CheckCircle2 v-else class="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <p class="truncate text-sm font-medium text-foreground">
                      {{ item.title }}
                    </p>
                    <Badge
                      v-if="item.kind === 'savings'"
                      variant="outline"
                      class="gap-1 text-[10px] px-1.5 py-0 font-normal border-primary/30 text-primary"
                    >
                      Guardado
                    </Badge>
                    <Badge
                      v-if="item.isShared"
                      variant="outline"
                      class="gap-1 text-[10px] px-1.5 py-0 font-normal"
                    >
                      <Users class="h-2.5 w-2.5 text-primary" />
                      Casal
                    </Badge>
                    <Badge
                      v-if="item.isShared && payerBadgeLabel(item.paidBy)"
                      variant="secondary"
                      class="text-[10px] px-1.5 py-0 font-medium text-emerald-700 dark:text-emerald-300"
                    >
                      {{ payerBadgeLabel(item.paidBy) }}
                    </Badge>
                  </div>
                  <p class="text-[11px] text-muted-foreground">
                    {{ item.paidDateLabel }}
                  </p>
                </div>
              </div>

              <div class="flex shrink-0 items-center gap-2.5">
                <button
                  v-if="item.kind !== 'invoice'"
                  type="button"
                  class="group/price inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-sm font-medium tabular-nums text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="Clique para ajustar o valor pago neste mês"
                  @click="openItemDrawer(item, 'edit')"
                >
                  <span>{{ formatCurrency(item.amount) }}</span>
                  <Pencil class="h-3 w-3 opacity-0 group-hover/price:opacity-100" />
                </button>
                <span v-else class="text-sm font-medium tabular-nums text-muted-foreground">
                  {{ formatCurrency(item.amount) }}
                </span>

                <Button
                  v-if="item.canUnmarkPaid"
                  variant="ghost"
                  size="xs"
                  class="text-muted-foreground hover:text-foreground h-7 px-2"
                  title="Voltar para Falta Pagar"
                  :disabled="dashboardStore.isActionLoading(item.id)"
                  @click="handleUnmarkPaid(item)"
                >
                  <Undo2 class="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          </ul>
        </CardContent>
      </Card>
    </section>

    <!-- ============================================================ -->
    <!-- DRAWER 1: ADICIONAR CONTA FIXA, FATURA DE CARTÃO OU FINANCIAMENTO -->
    <!-- ============================================================ -->
    <Sheet
      v-model:open="addDrawerOpen"
      title="Adicionar conta ao mês"
      description="Cadastre uma conta fixa, fatura de cartão (com valor variável por mês) ou financiamento."
    >
      <form class="space-y-5" @submit.prevent="submitNewBill">
        <!-- Seletor: Conta Fixa vs Fatura Cartão vs Financiamento/Parcela -->
        <div class="grid grid-cols-3 gap-1.5 rounded-xl bg-muted p-1">
          <button
            type="button"
            class="flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all"
            :class="
              addMode === 'recurring'
                ? 'bg-background text-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            "
            @click="addMode = 'recurring'"
          >
            <Repeat class="h-3.5 w-3.5" />
            <span>Conta Fixa</span>
          </button>

          <button
            type="button"
            class="flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all"
            :class="
              addMode === 'card_invoice'
                ? 'bg-background text-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            "
            @click="addMode = 'card_invoice'"
          >
            <CreditCard class="h-3.5 w-3.5" />
            <span>Fatura Cartão</span>
          </button>

          <button
            type="button"
            class="flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all"
            :class="
              addMode === 'debt'
                ? 'bg-background text-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            "
            @click="addMode = 'debt'"
          >
            <Car class="h-3.5 w-3.5" />
            <span>Financiamento</span>
          </button>
        </div>

        <!-- Se for Fatura de Cartão, mostra sugestões rápidas de bancos -->
        <div v-if="addMode === 'card_invoice'" class="space-y-2">
          <label class="text-xs font-medium text-muted-foreground">
            Escolha rápida do cartão (ou digite abaixo):
          </label>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="preset in CARD_INVOICE_PRESETS"
              :key="preset"
              type="button"
              class="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10"
              @click="billName = preset"
            >
              {{ preset }}
            </button>
          </div>
        </div>

        <!-- Se for Financiamento, mostra os ícones de categoria -->
        <div v-if="addMode === 'debt'" class="space-y-2">
          <label class="text-xs font-medium text-foreground">
            Tipo de financiamento
          </label>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="cat in DEBT_CATEGORIES"
              :key="cat.value"
              type="button"
              class="flex flex-col items-center justify-center gap-1.5 rounded-xl border p-2.5 text-center transition-all"
              :class="
                billDebtCategory === cat.value
                  ? 'border-primary bg-primary/10 text-primary font-semibold'
                  : 'border-border bg-background text-muted-foreground hover:text-foreground'
              "
              @click="billDebtCategory = cat.value"
            >
              <component :is="cat.icon" class="h-4 w-4" />
              <span class="text-[11px]">{{ cat.shortLabel }}</span>
            </button>
          </div>
        </div>

        <div class="space-y-1.5">
          <label class="text-xs font-medium text-foreground">
            {{
              addMode === 'card_invoice'
                ? 'Nome da fatura / cartão'
                : addMode === 'recurring'
                  ? 'Nome da conta'
                  : 'Nome do financiamento / parcela'
            }}
          </label>
          <input
            v-model="billName"
            type="text"
            :placeholder="
              addMode === 'card_invoice'
                ? 'Ex: Fatura Nubank, Fatura Itaú...'
                : addMode === 'recurring'
                  ? 'Ex: Luz, Internet, Condomínio, Aluguel...'
                  : 'Ex: Financiamento Carro, Parcela Casa...'
            "
            required
            class="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p v-if="addMode === 'card_invoice'" class="text-[11px] text-muted-foreground">
            A fatura entra todo mês e você pode alterar o valor de cada mês clicando no preço quando ela fechar.
          </p>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-foreground">
              Valor no mês
            </label>
            <CurrencyInput
              v-model="billAmount"
              placeholder="150,00"
              required
            />
          </div>

          <div class="space-y-1.5">
            <label class="text-xs font-medium text-foreground">
              Dia do vencimento
            </label>
            <input
              v-model.number="billDueDay"
              type="number"
              min="1"
              max="31"
              placeholder="Dia 10"
              class="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div v-if="addMode === 'debt'" class="space-y-1.5">
          <label class="text-xs font-medium text-foreground">
            Prazo do contrato (nº de parcelas)
          </label>
          <input
            v-model.number="billInstallments"
            type="number"
            min="1"
            max="600"
            placeholder="Ex: 36"
            class="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <button
          type="button"
          class="flex h-10 w-full items-center justify-between rounded-lg border px-3 py-2 text-xs transition-colors"
          :class="
            billShared
              ? 'border-primary/40 bg-primary/10 text-foreground font-medium'
              : 'border-input bg-background text-muted-foreground'
          "
          @click="billShared = !billShared"
        >
          <span class="flex items-center gap-2">
            <Users class="h-4 w-4" :class="billShared ? 'text-primary' : 'text-muted-foreground'" />
            Conta compartilhada do casal
          </span>
          <span
            class="flex h-5 w-5 items-center justify-center rounded-full"
            :class="billShared ? 'bg-primary text-primary-foreground' : 'border border-muted-foreground/30'"
          >
            <Check v-if="billShared" class="h-3 w-3" />
          </span>
        </button>

        <div class="flex items-center justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" @click="addDrawerOpen = false">
            Cancelar
          </Button>
          <Button type="submit" :disabled="submitting">
            {{ submitting ? 'Salvando...' : 'Salvar no mês' }}
          </Button>
        </div>
      </form>
    </Sheet>

    <!-- ============================================================ -->
    <!-- DRAWER 2: DEFINIR RENDA DO MÊS & META DE GUARDAR -->
    <!-- ============================================================ -->
    <Sheet
      v-model:open="planDrawerOpen"
      :title="`Renda e Meta de ${periodLabel}`"
      description="Defina quanto entra no mês e quanto querem separar antes do saldo livre."
    >
      <form class="space-y-5" @submit.prevent="handleSavePlan">
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-foreground">
            1. Renda total do mês
          </label>
          <CurrencyInput
            v-model="incomeInput"
            placeholder="Ex: 16.000,00"
          />
          <p class="text-[11px] text-muted-foreground">
            Soma do que entra no mês para pagar as contas e viver.
          </p>
        </div>

        <div class="space-y-1.5">
          <label class="text-xs font-medium text-foreground">
            2. Meta para guardar / investir no mês
          </label>
          <CurrencyInput
            v-model="savingsInput"
            placeholder="Ex: 2.000,00"
          />
          <p class="text-[11px] text-muted-foreground">
            Valor que vocês separam logo no início ou ao longo do mês.
          </p>
        </div>

        <div class="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 space-y-1.5">
          <span class="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            Simulação com suas contas atuais ({{ formatCurrency(totalMonthBills) }}):
          </span>
          <div class="text-xl font-bold text-emerald-700 dark:text-emerald-300">
            Livre pra gastar: {{ formatCurrency((Number(incomeInput) || 0) - totalMonthBills - (Number(savingsInput) || 0)) }}
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" @click="planDrawerOpen = false">
            Cancelar
          </Button>
          <Button type="submit" :disabled="savingPlan">
            {{ savingPlan ? 'Salvando...' : 'Salvar planejamento' }}
          </Button>
        </div>
      </form>
    </Sheet>

    <!-- ============================================================ -->
    <!-- DRAWER 3: FECHAMENTO DO MÊS ("QUANTO AINDA TEM NA CONTA?") -->
    <!-- ============================================================ -->
    <Sheet
      v-model:open="checkinDrawerOpen"
      :title="`Fechamento de ${periodLabel}`"
      description="No fim do mês, informe quanto sobrou do saldo livre para fechar o balanço sem precisar anotar cada gasto."
    >
      <form class="space-y-5" @submit.prevent="handleSaveCheckin">
        <div class="rounded-xl border border-border bg-muted/40 p-4 space-y-2 text-xs">
          <div class="flex justify-between">
            <span class="text-muted-foreground">Renda do mês:</span>
            <strong class="text-foreground">{{ formatCurrency(configuredIncome) }}</strong>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">Contas do mês:</span>
            <strong class="text-foreground">{{ formatCurrency(totalMonthBills) }}</strong>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">Meta de guardar:</span>
            <strong class="text-primary">{{ formatCurrency(configuredSavings) }}</strong>
          </div>
          <div class="flex justify-between border-t border-border pt-2 text-sm">
            <span class="font-semibold text-foreground">Tinha livre pra gastar:</span>
            <strong class="text-emerald-600 dark:text-emerald-400">{{ formatCurrency(freeToSpendAmount) }}</strong>
          </div>
        </div>

        <div class="space-y-1.5">
          <label class="text-xs font-medium text-foreground">
            Quanto ainda sobrou na conta hoje?
          </label>
          <CurrencyInput
            v-model="leftoverInput"
            placeholder="Ex: 450,00"
            required
          />
          <p class="text-[11px] text-muted-foreground">
            Com esse valor, calculamos quanto vocês gastaram no livre e quanto guardaram no total.
          </p>
        </div>

        <div class="flex items-center justify-between gap-2 border-t border-border pt-4">
          <Button
            v-if="endOfMonthLeftover != null"
            type="button"
            variant="ghost"
            class="text-red-500 hover:text-red-600"
            :disabled="savingCheckin"
            @click="handleClearCheckin"
          >
            Reabrir mês
          </Button>
          <div class="ml-auto flex items-center gap-2">
            <Button type="button" variant="outline" @click="checkinDrawerOpen = false">
              Cancelar
            </Button>
            <Button type="submit" :disabled="savingCheckin">
              {{ savingCheckin ? 'Salvando...' : 'Confirmar fechamento' }}
            </Button>
          </div>
        </div>
      </form>
    </Sheet>

    <!-- ============================================================ -->
    <!-- DRAWER 4: CONFIRMAR VALOR AO PAGAR OU AJUSTAR VALOR SÓ DO MÊS -->
    <!-- ============================================================ -->
    <Sheet
      v-model:open="itemDrawerOpen"
      :title="
        itemDrawerMode === 'pay'
          ? `Pagar ${selectedItem?.title ?? 'conta'}`
          : `Valor de ${selectedItem?.title ?? 'conta'} em ${periodLabel}`
      "
      :description="
        itemDrawerMode === 'pay'
          ? 'Confirme o valor exato da fatura/boleto deste mês para dar baixa.'
          : 'Altere o valor apenas para este mês (os demais meses continuam com o valor base).'
      "
    >
      <form class="space-y-5" @submit.prevent="handleConfirmItemDrawer(false)">
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-foreground">
            Valor em {{ periodLabel }}
          </label>
          <CurrencyInput
            v-model="selectedItemAmount"
            placeholder="0,00"
            required
          />
          <p class="text-[11px] text-muted-foreground">
            Se a conta veio diferente neste mês (ex: Luz, Água), digite o valor real aqui sem afetar os outros meses.
          </p>
        </div>

        <!-- Se a conta for compartilhada (Casal) e houver par vinculado, permite registrar quem pagou -->
        <div
          v-if="selectedItem?.isShared && hasPartner && authStore.profile?.partner"
          class="space-y-2"
        >
          <label class="text-xs font-medium text-foreground">
            Quem pagou esta conta compartilhada?
          </label>
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              class="flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs transition-colors"
              :class="
                selectedPayerUserId === authStore.currentUserId
                  ? 'border-primary bg-primary/10 font-semibold text-foreground'
                  : 'border-border bg-background text-muted-foreground hover:text-foreground'
              "
              @click="selectedPayerUserId = authStore.currentUserId || ''"
            >
              <Check v-if="selectedPayerUserId === authStore.currentUserId" class="h-3.5 w-3.5 text-primary" />
              <span>{{ myShortName }} (Você)</span>
            </button>

            <button
              type="button"
              class="flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs transition-colors"
              :class="
                selectedPayerUserId === authStore.profile.partner.id
                  ? 'border-primary bg-primary/10 font-semibold text-foreground'
                  : 'border-border bg-background text-muted-foreground hover:text-foreground'
              "
              @click="selectedPayerUserId = authStore.profile.partner.id"
            >
              <Check v-if="selectedPayerUserId === authStore.profile.partner.id" class="h-3.5 w-3.5 text-primary" />
              <span>{{ partnerShortName }}</span>
            </button>
          </div>
        </div>

        <!-- Se for o item "Quero guardar", permite somar direto em um dos seus CDBs / Reservas -->
        <div
          v-if="selectedItem?.kind === 'savings' && myVaultAccounts.length > 0"
          class="space-y-2 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3.5"
        >
          <label class="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <PiggyBank class="h-3.5 w-3.5" />
            <span>Em qual CDB / Reserva você guardou esse valor?</span>
          </label>
          <select
            v-model="selectedVaultAccountId"
            class="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Apenas marcar como guardado (sem somar em conta)</option>
            <option v-for="acc in myVaultAccounts" :key="acc.id" :value="acc.id">
              {{ acc.name }} (Saldo atual: {{ formatCurrency(acc.balance) }})
            </option>
          </select>
          <p class="text-[11px] text-muted-foreground">
            O valor será somado automaticamente ao saldo do CDB escolhido ao confirmar.
          </p>
        </div>

        <div class="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" @click="itemDrawerOpen = false">
            Cancelar
          </Button>

          <Button
            v-if="itemDrawerMode === 'edit' && selectedItem && 'canMarkPaid' in selectedItem && selectedItem.canMarkPaid"
            type="button"
            variant="secondary"
            class="gap-1.5"
            :disabled="savingItemAction"
            @click="handleConfirmItemDrawer(true)"
          >
            <Check class="h-3.5 w-3.5" />
            <span>Salvar e já marcar como pago</span>
          </Button>

          <Button type="submit" class="gap-1.5" :disabled="savingItemAction">
            <Check v-if="itemDrawerMode === 'pay'" class="h-3.5 w-3.5" />
            <span>
              {{
                savingItemAction
                  ? 'Salvando...'
                  : itemDrawerMode === 'pay'
                    ? 'Confirmar pagamento'
                    : 'Salvar valor do mês'
              }}
            </span>
          </Button>
        </div>
      </form>
    </Sheet>
  </div>
</template>

<style scoped>
/* Styled with Tailwind CSS */
</style>

