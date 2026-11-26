<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Sheet } from '@/components/ui/sheet'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/stores/auth/auth.store'
import { useRecurringStore } from '@/stores/recurring/recurring.store'
import { useToastStore } from '@/stores/toast/toast.store'
import { recurringApi } from '@/api/recurring.api'
import type { RecurringKind, RecurringMonthlyItem, RecurringPausedItem } from '@/types/recurring'
import { payerBadgeLabel, personShortName } from '@/utils/owner'
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
  Clock,
  CreditCard,
  AlertCircle,
  Home,
  PauseCircle,
  Pencil,
  Plus,
  Repeat,
  RotateCcw,
  Sparkles,
  Trash2,
  Tv,
  Users,
  Wifi,
  Zap,
} from 'lucide-vue-next'

const authStore = useAuthStore()
const recurringStore = useRecurringStore()
const toastStore = useToastStore()

const hasPartner = computed(() => Boolean(authStore.profile?.partner))
const myShortName = computed(() => personShortName(authStore.profile) || 'Você')
const partnerShortName = computed(() => personShortName(authStore.profile?.partner) || 'Par')

const { expenseItems, pausedItems, loading, referenceMonth } = storeToRefs(recurringStore)

function isOwnRecurring(item: { owner?: { id: string } | null }): boolean {
  if (!item.owner?.id || !authStore.currentUserId) return true
  return item.owner.id === authStore.currentUserId
}

const month = computed(() => referenceMonth?.value || currentReferenceMonth())
const periodLabel = computed(() => formatPeriodLabel(month.value))

// Sugestões rápidas para 1 clique no Drawer
const QUICK_PRESETS: Array<{ name: string; kind: RecurringKind; dueDay: number }> = [
  { name: 'Fatura Nubank', kind: 'fixed_bill', dueDay: 10 },
  { name: 'Fatura Cartão', kind: 'fixed_bill', dueDay: 10 },
  { name: 'Condomínio / Aluguel', kind: 'fixed_bill', dueDay: 10 },
  { name: 'Luz / Energia', kind: 'fixed_bill', dueDay: 15 },
  { name: 'Internet / Fibra', kind: 'fixed_bill', dueDay: 10 },
  { name: 'Água / Saneamento', kind: 'fixed_bill', dueDay: 12 },
  { name: 'Gás', kind: 'fixed_bill', dueDay: 15 },
  { name: 'Academia', kind: 'subscription', dueDay: 5 },
  { name: 'Streaming', kind: 'subscription', dueDay: 10 },
]

// Drawer de Criação / Edição
const drawerOpen = ref(false)
const editingId = ref<string | null>(null)
const formName = ref('')
const formAmount = ref<number | ''>('')
const formDueDay = ref<number | ''>(10)
const formKind = ref<RecurringKind>('fixed_bill')
const formShared = ref(false)
const submitting = ref(false)
const formError = ref('')

// Gaveta de Pausar ou Excluir
const removeOpen = ref(false)
const itemToRemove = ref<RecurringMonthlyItem | null>(null)
const processingRemoveAction = ref(false)
const resumingId = ref<string | null>(null)
const pausedToDelete = ref<RecurringPausedItem | null>(null)
const deletePausedOpen = ref(false)

const isEditing = computed(() => Boolean(editingId.value))

// KPIs do Mês
const totalMonthlyAmount = computed(() =>
  expenseItems.value.reduce((sum, i) => sum + Number(i.amount || 0), 0),
)

const paidMonthlyAmount = computed(() =>
  expenseItems.value
    .filter((i) => i.paid)
    .reduce((sum, i) => sum + Number(i.amount || 0), 0),
)

const pendingMonthlyAmount = computed(() =>
  expenseItems.value
    .filter((i) => !i.paid)
    .reduce((sum, i) => sum + Number(i.amount || 0), 0),
)

const paidCount = computed(() => expenseItems.value.filter((i) => i.paid).length)
const pendingCount = computed(() => expenseItems.value.filter((i) => !i.paid).length)

const progressPercent = computed(() => {
  if (totalMonthlyAmount.value <= 0) return 0
  return Math.round((paidMonthlyAmount.value / totalMonthlyAmount.value) * 100)
})

function getBillIcon(item: RecurringMonthlyItem) {
  const n = item.name.toLowerCase()
  if (
    n.includes('fatura') ||
    n.includes('cartão') ||
    n.includes('cartao') ||
    n.includes('nubank') ||
    n.includes('itaú') ||
    n.includes('itau') ||
    n.includes('inter') ||
    n.includes('c6') ||
    n.includes('xp')
  ) {
    return CreditCard
  }
  if (n.includes('luz') || n.includes('energia') || n.includes('elétrica')) return Zap
  if (n.includes('internet') || n.includes('wifi') || n.includes('fibra') || n.includes('celular')) return Wifi
  if (n.includes('casa') || n.includes('aluguel') || n.includes('condom') || n.includes('iptu')) return Home
  if (item.kind === 'subscription' || n.includes('netflix') || n.includes('spotify') || n.includes('stream')) return Tv
  return Repeat
}

function paidDateLabel(iso: string | null): string {
  if (!iso) return 'Pago no mês'
  return `Pago em ${new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  })}`
}

async function loadMonth(ym: string) {
  try {
    await recurringStore.fetchMonthlyStatus(ym)
  } catch (e) {
    toastStore.error(e instanceof Error ? e.message : 'Erro ao carregar contas fixas')
  }
}

function prevMonth() {
  loadMonth(shiftReferenceMonth(month.value, -1))
}

function nextMonth() {
  loadMonth(shiftReferenceMonth(month.value, 1))
}

function goToday() {
  loadMonth(currentReferenceMonth())
}

onMounted(() => {
  loadMonth(currentReferenceMonth())
})

function openCreate() {
  editingId.value = null
  formName.value = ''
  formAmount.value = ''
  formDueDay.value = 10
  formKind.value = 'fixed_bill'
  formShared.value = false
  formError.value = ''
  drawerOpen.value = true
}

function openEdit(item: RecurringMonthlyItem) {
  editingId.value = item.id
  formName.value = item.name
  formAmount.value = item.amount
  formDueDay.value = item.dueDay ?? ''
  formKind.value = item.kind
  formShared.value = Boolean(item.isShared)
  formError.value = ''
  drawerOpen.value = true
}

function applyPreset(preset: { name: string; kind: RecurringKind; dueDay: number }) {
  formName.value = preset.name
  formKind.value = preset.kind
  if (!formDueDay.value) {
    formDueDay.value = preset.dueDay
  }
}

async function submitForm() {
  formError.value = ''
  const name = formName.value.trim()
  const amount = Number(formAmount.value)
  if (!name) {
    formError.value = 'Informe o nome da conta fixa.'
    return
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    formError.value = 'Informe um valor mensal maior que zero.'
    return
  }

  submitting.value = true
  try {
    if (editingId.value) {
      await recurringApi.update(editingId.value, {
        name,
        amount,
        kind: formKind.value,
        dueDay: formDueDay.value ? Number(formDueDay.value) : undefined,
        isShared: formShared.value,
      })
      toastStore.success('Conta fixa atualizada!')
    } else {
      await recurringApi.create({
        name,
        kind: formKind.value,
        transactionType: 'expense',
        frequency: 'monthly',
        amount,
        dueDay: formDueDay.value ? Number(formDueDay.value) : undefined,
        startDate: `${month.value}-01`,
        isShared: formShared.value,
      })
      toastStore.success(`${name} adicionada às contas fixas!`)
    }
    drawerOpen.value = false
    await loadMonth(month.value)
  } catch (e) {
    toastStore.error(e instanceof Error ? e.message : 'Erro ao salvar conta fixa')
  } finally {
    submitting.value = false
  }
}

// Drawer rápido: Ajustar valor só deste mês ou Confirmar Pagamento
const monthValueDrawerOpen = ref(false)
const monthValueMode = ref<'pay' | 'edit'>('pay')
const selectedBill = ref<RecurringMonthlyItem | null>(null)
const selectedBillAmount = ref<number | ''>('')
const selectedPayerUserId = ref<string>('')
const savingMonthValue = ref(false)

function openMonthValueDrawer(item: RecurringMonthlyItem, mode: 'pay' | 'edit') {
  selectedBill.value = item
  selectedBillAmount.value = item.amount
  selectedPayerUserId.value = authStore.currentUserId || ''
  monthValueMode.value = mode
  monthValueDrawerOpen.value = true
}

async function submitMonthValueDrawer(alsoPay = false) {
  const item = selectedBill.value
  if (!item) return
  const numAmount = Number(selectedBillAmount.value)
  if (!Number.isFinite(numAmount) || numAmount <= 0) {
    toastStore.error('Informe um valor válido maior que zero.')
    return
  }

  savingMonthValue.value = true
  try {
    if (monthValueMode.value === 'pay' || alsoPay) {
      await recurringStore.markAsPaid(
        item.id,
        month.value,
        numAmount,
        item.isShared && selectedPayerUserId.value ? selectedPayerUserId.value : undefined,
      )
      toastStore.success(`${item.name} marcado como pago (${formatCurrency(numAmount)})!`)
    } else {
      await recurringStore.setMonthAmount(item.id, numAmount, month.value)
      toastStore.success(`Valor de ${item.name} em ${periodLabel.value} ajustado para ${formatCurrency(numAmount)}!`)
    }
    monthValueDrawerOpen.value = false
  } catch (e) {
    toastStore.error(e instanceof Error ? e.message : 'Erro ao atualizar valor do mês')
  } finally {
    savingMonthValue.value = false
  }
}

async function handleTogglePaid(item: RecurringMonthlyItem) {
  if (item.paid) {
    try {
      await recurringStore.unmarkAsPaid(item.id)
      toastStore.success(`${item.name} voltou para pendente.`)
    } catch (e) {
      toastStore.error(e instanceof Error ? e.message : 'Erro ao atualizar status')
    }
  } else {
    openMonthValueDrawer(item, 'pay')
  }
}

function openRemove(item: RecurringMonthlyItem) {
  itemToRemove.value = item
  removeOpen.value = true
}

function closeRemove() {
  removeOpen.value = false
  itemToRemove.value = null
}

async function handlePauseRecurring() {
  const item = itemToRemove.value
  if (!item || processingRemoveAction.value) return
  processingRemoveAction.value = true
  try {
    const res = await recurringApi.pause(item.id, month.value)
    closeRemove()
    toastStore.success(
      res.keptCurrentMonthPaid
        ? `${item.name} pausada para os próximos meses (histórico mantido).`
        : `${item.name} pausada a partir de ${periodLabel.value} (histórico mantido).`,
    )
    await loadMonth(month.value)
  } catch (e) {
    toastStore.error(e instanceof Error ? e.message : 'Não foi possível pausar a conta fixa.')
  } finally {
    processingRemoveAction.value = false
  }
}

async function confirmPermanentRemove() {
  const item = itemToRemove.value
  if (!item || processingRemoveAction.value) return
  processingRemoveAction.value = true
  try {
    await recurringApi.delete(item.id)
    closeRemove()
    toastStore.success(`${item.name} excluída permanentemente.`)
    await loadMonth(month.value)
  } catch {
    toastStore.error('Não foi possível excluir a conta fixa.')
  } finally {
    processingRemoveAction.value = false
  }
}

async function handleResumePaused(paused: RecurringPausedItem) {
  if (resumingId.value) return
  resumingId.value = paused.id
  try {
    await recurringApi.resume(paused.id, month.value)
    toastStore.success(`${paused.name} retomada a partir de ${periodLabel.value}!`)
    await loadMonth(month.value)
  } catch (e) {
    toastStore.error(e instanceof Error ? e.message : 'Não foi possível retomar a conta fixa.')
  } finally {
    resumingId.value = null
  }
}

async function confirmDeletePaused() {
  const target = pausedToDelete.value
  if (!target || processingRemoveAction.value) return
  processingRemoveAction.value = true
  try {
    await recurringApi.delete(target.id)
    deletePausedOpen.value = false
    pausedToDelete.value = null
    toastStore.success(`${target.name} excluída permanentemente.`)
    await loadMonth(month.value)
  } catch {
    toastStore.error('Não foi possível excluir a conta pausada.')
  } finally {
    processingRemoveAction.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-6">

    <!-- Cabeçalho Limpo -->
    <header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-xl font-bold tracking-tight text-foreground">
          Contas Fixas do Mês
        </h1>
        <p class="mt-0.5 text-xs text-muted-foreground">
          Contas que se repetem todo mês (Condomínio, Luz, Água, Internet, Assinaturas).
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <div class="inline-flex items-center rounded-lg border border-border bg-card p-0.5">
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8"
            aria-label="Mês anterior"
            @click="prevMonth"
          >
            <ChevronLeft class="h-4 w-4" />
          </Button>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-foreground hover:text-primary transition-colors"
            @click="goToday"
          >
            <Calendar class="h-3.5 w-3.5 text-muted-foreground" />
            <span>{{ periodLabel }}</span>
          </button>
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8"
            aria-label="Próximo mês"
            @click="nextMonth"
          >
            <ChevronRight class="h-4 w-4" />
          </Button>
        </div>

        <Button class="gap-1.5" @click="openCreate">
          <Plus class="h-4 w-4" />
          <span>Nova conta fixa</span>
        </Button>
      </div>
    </header>

    <!-- Resumo Direto das Contas Fixas no Mês -->
    <Card>
      <CardContent class="p-5 space-y-4">
        <template v-if="loading && expenseItems.length === 0">
          <div class="grid grid-cols-3 gap-3 sm:gap-4 sm:divide-x sm:divide-border">
            <div v-for="n in 3" :key="n" :class="n > 1 ? 'sm:pl-6 space-y-1.5' : 'space-y-1.5'">
              <Skeleton class="h-3 w-16 sm:w-28" />
              <Skeleton class="h-5 sm:h-7 w-20 sm:w-32" />
              <Skeleton class="h-2.5 w-14 sm:w-24" />
            </div>
          </div>
          <Skeleton class="h-1.5 w-full rounded-full" />
        </template>

        <template v-else>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:divide-x sm:divide-border">
            <div>
              <span class="text-xs font-medium text-muted-foreground">
                Falta pagar neste mês
              </span>
              <div class="mt-1 text-2xl font-bold tracking-tight tabular-nums text-foreground">
                {{ formatCurrency(pendingMonthlyAmount) }}
              </div>
              <span class="text-xs text-muted-foreground">
                {{ pendingCount }} {{ pendingCount === 1 ? 'conta pendente' : 'contas pendentes' }}
              </span>
            </div>

            <div class="sm:pl-6">
              <span class="text-xs font-medium text-muted-foreground">
                Já pago em {{ periodLabel }}
              </span>
              <div class="mt-1 text-2xl font-bold tracking-tight tabular-nums text-emerald-600 dark:text-emerald-400">
                {{ formatCurrency(paidMonthlyAmount) }}
              </div>
              <span class="text-xs text-muted-foreground">
                {{ paidCount }} {{ paidCount === 1 ? 'conta quitada' : 'contas quitadas' }}
              </span>
            </div>

            <div class="sm:pl-6">
              <span class="text-xs font-medium text-muted-foreground">
                Total de contas fixas
              </span>
              <div class="mt-1 flex items-baseline gap-1">
                <span class="text-2xl font-bold tracking-tight tabular-nums text-muted-foreground">
                  {{ formatCurrency(totalMonthlyAmount) }}
                </span>
                <span class="text-xs text-muted-foreground">/mês</span>
              </div>
              <span class="text-xs text-muted-foreground">
                {{ expenseItems.length }} {{ expenseItems.length === 1 ? 'conta cadastrada' : 'contas cadastradas' }}
              </span>
            </div>
          </div>

          <Progress
            :model-value="progressPercent"
            class="h-2"
            indicator-class="bg-emerald-600 dark:bg-emerald-500"
          />
        </template>
      </CardContent>
    </Card>

    <!-- Loading Skeleton da Lista -->
    <Card v-if="loading && expenseItems.length === 0">
      <CardHeader class="flex flex-row items-center justify-between border-b border-border py-3 px-4 sm:px-5">
        <Skeleton class="h-3.5 w-32 sm:w-48" />
        <Skeleton class="h-3 w-20 sm:w-32" />
      </CardHeader>
      <CardContent class="p-0">
        <ul class="divide-y divide-border" aria-label="Carregando contas fixas">
          <li
            v-for="n in 3"
            :key="n"
            class="flex items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4"
          >
            <div class="flex items-center gap-2.5">
              <Skeleton class="h-8 w-8 sm:h-10 sm:w-10 rounded-xl" />
              <div class="space-y-1">
                <Skeleton class="h-3.5 w-24 sm:w-32" />
                <Skeleton class="h-2.5 w-16 sm:w-28" />
              </div>
            </div>
            <div class="flex items-center gap-2">
              <Skeleton class="h-3.5 w-16 sm:w-24" />
              <Skeleton class="h-7 w-12 sm:h-8 sm:w-16 rounded-md" />
            </div>
          </li>
        </ul>
      </CardContent>
    </Card>

    <!-- Lista de Contas Fixas -->
    <Card v-else-if="expenseItems.length > 0">
      <CardHeader class="flex flex-row items-center justify-between border-b border-border py-3.5 px-5">
        <CardTitle class="text-sm font-semibold">
          Suas Contas Recorrentes ({{ periodLabel }})
        </CardTitle>
        <span class="text-xs text-muted-foreground">
          Repetem automaticamente todo mês
        </span>
      </CardHeader>

      <CardContent class="p-0">
        <ul class="divide-y divide-border" role="list">
          <li
            v-for="item in expenseItems"
            :key="item.id"
            class="flex flex-col justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center"
          >
            <!-- Ícone + Nome + Dia de Vencimento -->
            <div class="flex items-center gap-3.5 min-w-0">
              <div
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
                :class="
                  item.paid
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : recurringStore.statusFor(item) === 'overdue'
                      ? 'border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400'
                      : 'border-primary/20 bg-primary/10 text-primary'
                "
              >
                <component :is="getBillIcon(item)" class="h-5 w-5" />
              </div>

              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <span
                    class="text-sm font-semibold text-foreground truncate"
                    :class="item.paid ? 'line-through text-muted-foreground' : ''"
                  >
                    {{ item.name }}
                  </span>

                  <Badge variant="secondary" class="text-[11px] font-normal">
                    {{ item.kind === 'subscription' ? 'Assinatura' : 'Conta fixa' }}
                  </Badge>

                  <Badge
                    v-if="item.dueDay"
                    :variant="
                      item.paid
                        ? 'secondary'
                        : recurringStore.statusFor(item) === 'overdue'
                          ? 'destructive'
                          : 'outline'
                    "
                    class="text-[11px] font-normal"
                  >
                    Dia {{ item.dueDay }}
                  </Badge>
                </div>

                <div class="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <span v-if="item.paid">{{ paidDateLabel(item.paidAt) }}</span>
                  <span v-else-if="item.dueDay">Todo mês no dia {{ item.dueDay }}</span>
                  <span v-else>Recorrência mensal</span>
                  <span v-if="item.category?.name">• {{ item.category.name }}</span>
                </div>
              </div>
            </div>

            <!-- Valor + Botões Pagar / Editar / Excluir -->
            <div class="flex items-center justify-between gap-4 sm:justify-end">
              <div class="text-left sm:text-right">
                <button
                  type="button"
                  class="group/price inline-flex items-baseline gap-1 rounded-md px-1.5 py-0.5 text-sm font-bold tabular-nums text-foreground transition-colors hover:bg-muted hover:text-primary"
                  title="Clique para ajustar o valor apenas neste mês (ex: conta de luz variável)"
                  @click="openMonthValueDrawer(item, 'edit')"
                >
                  <span>{{ formatCurrency(item.amount) }}</span>
                  <span class="text-xs font-normal text-muted-foreground">/mês</span>
                  <Pencil class="h-3 w-3 self-center text-muted-foreground opacity-60 group-hover/price:opacity-100 group-hover/price:text-primary" />
                </button>
                <div class="flex items-center sm:justify-end gap-1.5">
                  <span
                    v-if="item.isMonthOverride"
                    class="text-[10px] font-medium text-primary"
                    :title="item.baseAmount ? `Valor base: ${formatCurrency(item.baseAmount)}` : ''"
                  >
                    Ajustado no mês •
                  </span>
                  <span
                    class="inline-flex items-center gap-1 text-[11px]"
                    :class="
                      item.paid
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : recurringStore.statusFor(item) === 'overdue'
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-amber-600 dark:text-amber-400'
                    "
                  >
                    <CheckCircle2 v-if="item.paid" class="h-3 w-3" />
                    <AlertCircle v-else-if="recurringStore.statusFor(item) === 'overdue'" class="h-3 w-3" />
                    <Clock v-else class="h-3 w-3" />
                    {{
                      item.paid
                        ? item.isShared && payerBadgeLabel(item.paidBy)
                          ? payerBadgeLabel(item.paidBy)
                          : 'Pago'
                        : recurringStore.statusFor(item) === 'overdue'
                          ? 'Vencida'
                          : 'Pendente'
                    }}
                  </span>
                </div>
              </div>

              <div class="flex items-center gap-1">
                <Button
                  :variant="item.paid ? 'ghost' : 'outline'"
                  size="xs"
                  class="gap-1"
                  :class="
                    !item.paid
                      ? 'border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400'
                      : 'text-muted-foreground'
                  "
                  :disabled="recurringStore.isToggling(item.id)"
                  @click="handleTogglePaid(item)"
                >
                  <Check class="h-3.5 w-3.5" />
                  <span>{{ item.paid ? 'Pago' : 'Pagar' }}</span>
                </Button>

                <Button
                  v-if="isOwnRecurring(item)"
                  variant="ghost"
                  size="icon"
                  class="h-8 w-8 text-muted-foreground hover:text-foreground"
                  title="Editar conta fixa"
                  @click="openEdit(item)"
                >
                  <Pencil class="h-3.5 w-3.5" />
                </Button>

                <Button
                  v-if="isOwnRecurring(item)"
                  variant="ghost"
                  size="icon"
                  class="h-8 w-8 text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400"
                  title="Pausar conta fixa mantendo o histórico"
                  @click="openRemove(item)"
                >
                  <PauseCircle class="h-3.5 w-3.5" />
                </Button>

                <Button
                  v-if="isOwnRecurring(item)"
                  variant="ghost"
                  size="icon"
                  class="h-8 w-8 text-muted-foreground hover:text-destructive"
                  title="Pausar ou excluir conta fixa"
                  @click="openRemove(item)"
                >
                  <Trash2 class="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </li>
        </ul>
      </CardContent>
    </Card>

    <!-- Empty State Limpo -->
    <Card v-else class="border-dashed">
      <CardContent class="flex flex-col items-center justify-center py-12 text-center">
        <div class="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Repeat class="h-5 w-5" />
        </div>
        <h3 class="text-sm font-semibold text-foreground">
          Nenhuma conta fixa cadastrada
        </h3>
        <p class="mt-1 max-w-sm text-xs text-muted-foreground">
          Cadastre Luz, Internet, Condomínio ou Aluguel uma única vez e acompanhe todo mês.
        </p>
        <Button size="sm" class="mt-4 gap-1.5" @click="openCreate">
          <Plus class="h-4 w-4" />
          <span>Cadastrar primeira conta fixa</span>
        </Button>
      </CardContent>
    </Card>

    <!-- Seção de Contas Fixas Pausadas (histórico preservado, prontas para retomar se voltar a ter a despesa) -->
    <Card v-if="pausedItems.length > 0" class="border-border/80 bg-muted/15">
      <CardHeader class="flex flex-row items-center justify-between border-b border-border py-3 px-5">
        <div class="flex items-center gap-2">
          <PauseCircle class="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <CardTitle class="text-sm font-semibold">
            Contas Pausadas ({{ pausedItems.length }})
          </CardTitle>
        </div>
        <span class="text-xs text-muted-foreground">
          Histórico passado preservado · Não entram nas cobranças atuais
        </span>
      </CardHeader>

      <CardContent class="p-0">
        <ul class="divide-y divide-border" role="list">
          <li
            v-for="paused in pausedItems"
            :key="paused.id"
            class="flex flex-col justify-between gap-3 px-5 py-3.5 sm:flex-row sm:items-center"
          >
            <div class="min-w-0 space-y-0.5">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-sm font-semibold text-foreground truncate">
                  {{ paused.name }}
                </span>
                <Badge variant="warning" class="text-[10px] px-1.5 py-0">
                  Pausada
                </Badge>
                <Badge v-if="paused.isShared" variant="secondary" class="text-[10px] px-1.5 py-0">
                  Casal
                </Badge>
              </div>
              <p class="text-xs text-muted-foreground">
                <span class="tabular-nums font-medium">{{ formatCurrency(paused.amount) }}</span>/mês
                <template v-if="paused.pausedAfterMonth">
                  · Encerrada após {{ formatPeriodLabel(paused.pausedAfterMonth) }}
                </template>
              </p>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="xs"
                class="gap-1.5"
                :disabled="resumingId === paused.id"
                @click="handleResumePaused(paused)"
              >
                <RotateCcw class="h-3.5 w-3.5 text-primary" />
                <span>Retomar em {{ periodLabel }}</span>
              </Button>

              <Button
                variant="ghost"
                size="icon"
                class="h-8 w-8 text-muted-foreground hover:text-destructive"
                title="Excluir permanentemente do histórico"
                @click="pausedToDelete = paused; deletePausedOpen = true"
              >
                <Trash2 class="h-3.5 w-3.5" />
              </Button>
            </div>
          </li>
        </ul>
      </CardContent>
    </Card>

    <!-- Gaveta Inferior: Escolher entre Pausar (mantendo histórico) ou Excluir Permanentemente -->
    <Sheet
      :open="removeOpen"
      :title="itemToRemove ? `O que fazer com ${itemToRemove.name}?` : 'Gerenciar conta fixa'"
      description="Escolha se deseja apenas encerrar as cobranças futuras mantendo o histórico ou apagar de vez."
      @update:open="removeOpen = $event"
    >
      <div v-if="itemToRemove" class="space-y-3">
        <!-- Opção 1: Pausar (Recomendado) -->
        <button
          type="button"
          class="flex w-full items-start gap-3.5 rounded-xl border border-emerald-500/35 bg-emerald-500/5 p-4 text-left transition-colors hover:bg-emerald-500/10 disabled:opacity-50"
          :disabled="processingRemoveAction"
          @click="handlePauseRecurring"
        >
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <PauseCircle class="h-5 w-5" />
          </div>
          <div class="space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-sm font-semibold text-foreground">
                Pausar conta fixa (manter histórico)
              </span>
              <Badge variant="success" class="text-[10px] px-1.5 py-0">
                Recomendado
              </Badge>
            </div>
            <p class="text-xs text-muted-foreground leading-relaxed">
              <template v-if="itemToRemove.paid">
                Mantém o pagamento já feito em {{ periodLabel }} e todos os meses anteriores no Histórico, deixando de cobrar a partir do próximo mês.
              </template>
              <template v-else>
                Deixa de cobrar já em {{ periodLabel }} e nos meses seguintes, mas preserva todos os pagamentos passados no seu Histórico (e você pode retomar quando quiser).
              </template>
            </p>
          </div>
        </button>

        <!-- Opção 2: Excluir Permanentemente -->
        <button
          type="button"
          class="flex w-full items-start gap-3.5 rounded-xl border border-red-500/25 bg-red-500/5 p-4 text-left transition-colors hover:bg-red-500/10 disabled:opacity-50"
          :disabled="processingRemoveAction"
          @click="confirmPermanentRemove"
        >
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/15 text-red-600 dark:text-red-400">
            <Trash2 class="h-5 w-5" />
          </div>
          <div class="space-y-1">
            <span class="text-sm font-semibold text-red-600 dark:text-red-400">
              Excluir permanentemente de tudo
            </span>
            <p class="text-xs text-muted-foreground leading-relaxed">
              Use apenas se cadastrou por engano: remove esta conta fixa e apaga também os pagamentos registrados nos meses passados.
            </p>
          </div>
        </button>

        <div class="flex justify-end pt-2">
          <Button variant="outline" size="sm" @click="closeRemove">
            Cancelar
          </Button>
        </div>
      </div>
    </Sheet>

    <!-- Gaveta Inferior: Excluir permanentemente conta já pausada -->
    <Sheet
      :open="deletePausedOpen"
      :title="pausedToDelete ? `Excluir ${pausedToDelete.name} de vez?` : 'Excluir conta pausada'"
      description="Isso apagará também os pagamentos antigos dessa conta nos meses anteriores."
      @update:open="deletePausedOpen = $event"
    >
      <div class="flex justify-end gap-2 pt-2">
        <Button variant="outline" size="sm" @click="deletePausedOpen = false">
          Cancelar
        </Button>
        <Button
          variant="destructive"
          size="sm"
          :disabled="processingRemoveAction"
          @click="confirmDeletePaused"
        >
          {{ processingRemoveAction ? 'Excluindo...' : 'Excluir permanentemente' }}
        </Button>
      </div>
    </Sheet>

    <!-- Bottom Drawer (Sheet) para Cadastrar / Editar Conta Fixa -->
    <Sheet
      v-model:open="drawerOpen"
      :title="isEditing ? 'Editar conta fixa' : 'Nova conta fixa mensal'"
      description="Contas fixas aparecem automaticamente na sua lista de pagamentos de todo mês."
    >
      <form class="space-y-5" @submit.prevent="submitForm">
        <div
          v-if="formError"
          class="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
        >
          {{ formError }}
        </div>

        <!-- Sugestões Rápidas em 1 clique (apenas ao criar) -->
        <div v-if="!isEditing" class="space-y-2">
          <label class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles class="h-3.5 w-3.5 text-primary" />
            <span>Sugestões rápidas (1 clique):</span>
          </label>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="preset in QUICK_PRESETS"
              :key="preset.name"
              type="button"
              class="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10"
              @click="applyPreset(preset)"
            >
              {{ preset.name }}
            </button>
          </div>
        </div>

        <!-- Tipo: Conta Fixa vs Assinatura -->
        <div class="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
          <button
            type="button"
            class="flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-all"
            :class="
              formKind === 'fixed_bill'
                ? 'bg-background text-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            "
            @click="formKind = 'fixed_bill'"
          >
            <Home class="h-3.5 w-3.5" />
            <span>Conta Fixa (Casa, Luz...)</span>
          </button>

          <button
            type="button"
            class="flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-all"
            :class="
              formKind === 'subscription'
                ? 'bg-background text-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            "
            @click="formKind = 'subscription'"
          >
            <Tv class="h-3.5 w-3.5" />
            <span>Assinatura / Mensalidade</span>
          </button>
        </div>

        <div class="space-y-1.5">
          <label class="text-xs font-medium text-foreground">
            Nome da conta
          </label>
          <input
            v-model="formName"
            type="text"
            placeholder="Ex: Condomínio, Luz, Internet, Academia..."
            required
            class="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-foreground">
              Valor mensal
            </label>
            <CurrencyInput
              v-model="formAmount"
              placeholder="150,00"
              required
            />
          </div>

          <div class="space-y-1.5">
            <label class="text-xs font-medium text-foreground">
              Dia do vencimento (1 a 31)
            </label>
            <input
              v-model.number="formDueDay"
              type="number"
              min="1"
              max="31"
              placeholder="Dia 10"
              class="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <button
          type="button"
          class="flex h-10 w-full items-center justify-between rounded-lg border px-3 py-2 text-xs transition-colors"
          :class="
            formShared
              ? 'border-primary/40 bg-primary/10 text-foreground font-medium'
              : 'border-input bg-background text-muted-foreground'
          "
          @click="formShared = !formShared"
        >
          <span class="flex items-center gap-2">
            <Users class="h-4 w-4" :class="formShared ? 'text-primary' : 'text-muted-foreground'" />
            Conta compartilhada do casal
          </span>
          <span
            class="flex h-5 w-5 items-center justify-center rounded-full"
            :class="formShared ? 'bg-primary text-primary-foreground' : 'border border-muted-foreground/30'"
          >
            <Check v-if="formShared" class="h-3 w-3" />
          </span>
        </button>

        <div class="flex items-center justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" @click="drawerOpen = false">
            Cancelar
          </Button>
          <Button type="submit" :disabled="submitting">
            {{ submitting ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Adicionar conta fixa' }}
          </Button>
        </div>
      </form>
    </Sheet>

    <!-- Bottom Drawer (Sheet) para Ajustar Valor Só do Mês ou Confirmar Pagamento -->
    <Sheet
      v-model:open="monthValueDrawerOpen"
      :title="
        monthValueMode === 'pay'
          ? `Pagar ${selectedBill?.name ?? 'conta'}`
          : `Valor de ${selectedBill?.name ?? 'conta'} em ${periodLabel}`
      "
      :description="
        monthValueMode === 'pay'
          ? 'Confirme o valor que veio na fatura/boleto deste mês para dar baixa.'
          : 'Ajuste o valor apenas para este mês sem alterar os meses anteriores ou futuros.'
      "
    >
      <form class="space-y-5" @submit.prevent="submitMonthValueDrawer(false)">
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-foreground">
            Valor da fatura em {{ periodLabel }}
          </label>
          <CurrencyInput
            v-model="selectedBillAmount"
            placeholder="0,00"
            required
          />
          <p class="text-[11px] text-muted-foreground">
            <template v-if="selectedBill?.baseAmount">
              Valor base cadastrado: <strong>{{ formatCurrency(selectedBill.baseAmount) }}</strong>.
            </template>
            Essa alteração vale somente para <strong>{{ periodLabel }}</strong>.
          </p>
        </div>

        <div
          v-if="selectedBill?.isShared && hasPartner && authStore.profile?.partner"
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

        <div class="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" @click="monthValueDrawerOpen = false">
            Cancelar
          </Button>

          <Button
            v-if="monthValueMode === 'edit' && selectedBill && !selectedBill.paid"
            type="button"
            variant="secondary"
            class="gap-1.5"
            :disabled="savingMonthValue"
            @click="submitMonthValueDrawer(true)"
          >
            <Check class="h-3.5 w-3.5" />
            <span>Salvar e marcar como pago</span>
          </Button>

          <Button type="submit" class="gap-1.5" :disabled="savingMonthValue">
            <Check v-if="monthValueMode === 'pay'" class="h-3.5 w-3.5" />
            <span>
              {{
                savingMonthValue
                  ? 'Salvando...'
                  : monthValueMode === 'pay'
                    ? 'Confirmar pagamento'
                    : 'Salvar valor no mês'
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

