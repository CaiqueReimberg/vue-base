<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import ConfirmModal from '@/components/ConfirmModal.vue'
import { transactionsApi } from '@/api/transactions.api'
import { useAuthStore } from '@/stores/auth/auth.store'
import { useToastStore } from '@/stores/toast/toast.store'
import type { DebtCategory, Transaction } from '@/types/transaction'
import { ownerBadgeLabel, isMyResource } from '@/utils/owner'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Sheet } from '@/components/ui/sheet'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Car,
  Home,
  Landmark,
  GraduationCap,
  Receipt,
  Plus,
  Pencil,
  Trash2,
  Users,
  Check,
  CheckCircle2,
  Clock,
  X,
  Calendar,
} from 'lucide-vue-next'

const authStore = useAuthStore()
const toastStore = useToastStore()

const currentUserId = computed(() => authStore.currentUserId)

const DEBT_CATEGORIES: Array<{
  value: DebtCategory
  label: string
  shortLabel: string
  icon: any
}> = [
  { value: 'car', label: 'Veículo / Financiamento', shortLabel: 'Veículo', icon: Car },
  { value: 'home', label: 'Casa / Imóvel', shortLabel: 'Casa / Imóvel', icon: Home },
  { value: 'personal_loan', label: 'Empréstimo Pessoal', shortLabel: 'Empréstimo', icon: Landmark },
  { value: 'student', label: 'Estudos / Faculdade', shortLabel: 'Estudos', icon: GraduationCap },
  { value: 'other', label: 'Outro Parcelamento', shortLabel: 'Outro', icon: Receipt },
]

const DEBT_CATEGORY_LABELS: Record<DebtCategory, string> = {
  car: 'Veículo',
  home: 'Casa / Imóvel',
  personal_loan: 'Empréstimo',
  student: 'Estudos',
  other: 'Outro',
}

function getCategoryIcon(cat?: DebtCategory | null) {
  return DEBT_CATEGORIES.find((c) => c.value === cat)?.icon ?? Receipt
}

function currentReferenceMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const loading = ref(false)
const error = ref<string | null>(null)
const debts = ref<Transaction[]>([])

const filterReferenceMonth = ref(currentReferenceMonth())
const filterByReferenceMonth = ref(false)
const scopeFilter = ref<'all' | 'shared' | 'individual'>('all')

const filteredDebts = computed(() => {
  if (scopeFilter.value === 'shared') {
    return debts.value.filter((d) => Boolean(d.isShared))
  }
  if (scopeFilter.value === 'individual') {
    return debts.value.filter((d) => !d.isShared)
  }
  return debts.value
})

const sharedDebtsTotal = computed(() =>
  debts.value
    .filter((d) => Boolean(d.isShared))
    .reduce((acc, d) => acc + Number(d.amount || 0), 0),
)

const isFormOpen = ref(false)
const editingId = ref<string | null>(null)
const submitting = ref(false)
const editLoading = ref(false)
const formError = ref('')

const description = ref('')
const amount = ref<number | string>('')
const installmentTotal = ref<number | string>(12)
const debtCategory = ref<DebtCategory>('car')
const occurredAt = ref(new Date().toISOString().slice(0, 10))
const referenceMonth = ref(currentReferenceMonth())
const isShared = ref(true)
const notes = ref('')

const removeOpen = ref(false)
const debtToRemove = ref<Transaction | null>(null)

const isEditing = computed(() => Boolean(editingId.value))

const totalMonthlyInstallments = computed(() =>
  filteredDebts.value.reduce((acc, d) => acc + Number(d.amount || 0), 0),
)

const pendingMonthlyAmount = computed(() =>
  filteredDebts.value
    .filter((d) => d.status !== 'paid' && d.status !== 'cleared')
    .reduce((acc, d) => acc + Number(d.amount || 0), 0),
)

const paidMonthlyAmount = computed(() =>
  filteredDebts.value
    .filter((d) => d.status === 'paid' || d.status === 'cleared')
    .reduce((acc, d) => acc + Number(d.amount || 0), 0),
)

const paidDebtsCount = computed(
  () => filteredDebts.value.filter((d) => d.status === 'paid' || d.status === 'cleared').length,
)
const pendingDebtsCount = computed(
  () => filteredDebts.value.filter((d) => d.status !== 'paid' && d.status !== 'cleared').length,
)

const progressPercent = computed(() => {
  if (totalMonthlyInstallments.value <= 0) return 0
  return Math.round((paidMonthlyAmount.value / totalMonthlyInstallments.value) * 100)
})

function isDebtPaid(t: Transaction) {
  return t.status === 'paid' || t.status === 'cleared'
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Math.abs(value),
  )
}

function formatMonthLabel(ym: string | null | undefined) {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return ''
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  return d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
}

function formatInstallmentDuration(n?: number | null) {
  if (!n || n <= 1) return 'Parcela única'
  if (n >= 24 && n % 12 === 0) {
    const years = n / 12
    return `${n} parcelas (${years} ${years === 1 ? 'ano' : 'anos'})`
  }
  return `${n} parcelas`
}

function isoToDateInput(iso: string) {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isMyDebt(t: Transaction) {
  return isMyResource(t.owner ?? null, currentUserId.value)
}

async function fetchDebts() {
  loading.value = true
  error.value = null
  try {
    const activeYm = filterByReferenceMonth.value
      ? filterReferenceMonth.value || currentReferenceMonth()
      : currentReferenceMonth()
    const res = await transactionsApi.list({
      kind: 'debt',
      referenceMonth: activeYm,
      limit: 100,
      page: 1,
    })
    debts.value = res.data
  } catch (e) {
    error.value = 'Não foi possível carregar as parcelas.'
    console.error(e)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchDebts().catch(() => {
    toastStore.error(error.value ?? 'Erro ao carregar parcelas.')
  })
})

watch([filterReferenceMonth, filterByReferenceMonth], () => {
  fetchDebts().catch(() => {
    toastStore.error(error.value ?? 'Erro ao filtrar.')
  })
})

function openCreate() {
  editingId.value = null
  description.value = ''
  amount.value = ''
  installmentTotal.value = 12
  debtCategory.value = 'car'
  occurredAt.value = new Date().toISOString().slice(0, 10)
  referenceMonth.value = filterReferenceMonth.value || currentReferenceMonth()
  isShared.value = true
  notes.value = ''
  formError.value = ''
  editLoading.value = false
  isFormOpen.value = true
}

function closeForm() {
  isFormOpen.value = false
  formError.value = ''
  editLoading.value = false
}

async function openEdit(t: Transaction) {
  if (!isMyDebt(t)) {
    toastStore.error('Só é possível editar os seus próprios lançamentos.')
    return
  }
  editingId.value = t.id
  formError.value = ''
  isFormOpen.value = true
  editLoading.value = true
  try {
    const full = await transactionsApi.getById(t.id)
    description.value = full.description
    amount.value = full.amount
    installmentTotal.value =
      full.installmentTotal != null && full.installmentTotal >= 1 ? full.installmentTotal : 1
    debtCategory.value = (full.debtCategory as DebtCategory) ?? 'other'
    occurredAt.value = isoToDateInput(full.occurredAt)
    referenceMonth.value = full.referenceMonth?.slice(0, 7) ?? currentReferenceMonth()
    isShared.value = Boolean(full.isShared)
    notes.value = full.notes ?? ''
  } catch {
    description.value = t.description
    amount.value = t.amount
    installmentTotal.value =
      t.installmentTotal != null && t.installmentTotal >= 1 ? t.installmentTotal : 1
    debtCategory.value = (t.debtCategory as DebtCategory) ?? 'other'
    occurredAt.value = isoToDateInput(t.occurredAt)
    referenceMonth.value = t.referenceMonth?.slice(0, 7) ?? currentReferenceMonth()
    isShared.value = Boolean(t.isShared)
    notes.value = t.notes ?? ''
  } finally {
    editLoading.value = false
  }
}

function validateForm(): boolean {
  formError.value = ''
  if (!description.value.trim()) {
    formError.value = 'Informe uma descrição para identificar a parcela.'
    return false
  }
  const numAmount = Number(amount.value)
  if (!Number.isFinite(numAmount) || numAmount <= 0) {
    formError.value = 'Informe um valor de parcela maior que zero.'
    return false
  }
  const parcels = Number(installmentTotal.value)
  if (!Number.isInteger(parcels) || parcels < 1) {
    formError.value = 'A quantidade de parcelas deve ser pelo menos 1.'
    return false
  }
  if (!occurredAt.value) {
    formError.value = 'Informe a data de vencimento/registro.'
    return false
  }
  return true
}

async function submitForm() {
  if (editLoading.value || submitting.value || !validateForm()) return
  submitting.value = true
  const occurredAtIso = new Date(`${occurredAt.value}T12:00:00`).toISOString()
  try {
    if (editingId.value) {
      await transactionsApi.update(editingId.value, {
        amount: Number(amount.value),
        installmentTotal: Number(installmentTotal.value),
        description: description.value.trim(),
        occurredAt: occurredAtIso,
        referenceMonth: referenceMonth.value || undefined,
        debtCategory: debtCategory.value,
        isShared: isShared.value,
        notes: notes.value.trim(),
      })
      toastStore.success('Financiamento atualizado.')
    } else {
      await transactionsApi.createDebtExpense({
        amount: Number(amount.value),
        installmentTotal: Number(installmentTotal.value),
        description: description.value.trim(),
        occurredAt: occurredAtIso,
        debtCategory: debtCategory.value,
        referenceMonth: referenceMonth.value || undefined,
        isShared: isShared.value,
        notes: notes.value.trim() || undefined,
      })
      toastStore.success('Parcela adicionada.')
    }
    closeForm()
    await fetchDebts()
  } catch {
    toastStore.error('Não foi possível salvar.')
  } finally {
    submitting.value = false
  }
}

async function togglePaidStatus(t: Transaction) {
  const nextStatus = isDebtPaid(t) ? 'pending' : 'cleared'
  const activeYm = filterByReferenceMonth.value
    ? filterReferenceMonth.value || currentReferenceMonth()
    : currentReferenceMonth()
  try {
    await transactionsApi.update(t.id, {
      status: nextStatus,
      paidAt: nextStatus === 'cleared' ? new Date().toISOString() : undefined,
      paymentMonth: activeYm,
    })
    t.status = nextStatus
    toastStore.success(
      nextStatus === 'cleared' ? 'Parcela marcada como paga!' : 'Parcela voltou para pendente.',
    )
  } catch {
    toastStore.error('Não foi possível atualizar o status.')
  }
}

function openRemove(t: Transaction) {
  if (!isMyDebt(t)) {
    toastStore.error('Só é possível excluir os seus próprios lançamentos.')
    return
  }
  debtToRemove.value = t
  removeOpen.value = true
}

function closeRemove() {
  removeOpen.value = false
  debtToRemove.value = null
}

async function confirmRemove() {
  const t = debtToRemove.value
  if (!t) return
  closeRemove()
  try {
    await transactionsApi.delete(t.id)
    toastStore.success('Removido com sucesso.')
    await fetchDebts()
  } catch {
    toastStore.error('Não foi possível excluir.')
  }
}
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-6">
    <ConfirmModal
      :open="removeOpen"
      title="Excluir parcela / financiamento"
      :message="
        debtToRemove
          ? `Deseja remover &quot;${debtToRemove.description}&quot; (${formatCurrency(debtToRemove.amount)}/mês)?`
          : ''
      "
      confirm-label="Excluir"
      :danger="true"
      @close="closeRemove"
      @confirm="confirmRemove"
    />

    <!-- Cabeçalho Limpo -->
    <header class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h1 class="text-xl font-bold tracking-tight text-foreground">
          Financiamentos & Parcelas
        </h1>
        <p class="mt-0.5 text-xs text-muted-foreground">
          Quanto pesa no mês com carro, casa, empréstimos e parcelamentos.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <div class="inline-flex items-center rounded-lg border border-border bg-card p-0.5">
          <button
            type="button"
            class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
            :class="
              !filterByReferenceMonth
                ? 'bg-secondary text-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            "
            @click="filterByReferenceMonth = false"
          >
            Todos
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
            :class="
              filterByReferenceMonth
                ? 'bg-secondary text-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            "
            @click="filterByReferenceMonth = true"
          >
            <Calendar class="h-3 w-3" />
            <span>Por mês</span>
          </button>
        </div>

        <input
          v-if="filterByReferenceMonth"
          v-model="filterReferenceMonth"
          type="month"
          class="h-8 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />

        <Button class="gap-1.5" @click="openCreate">
          <Plus class="h-4 w-4" />
          <span>Adicionar parcela</span>
        </Button>
      </div>
    </header>

    <!-- Drawer (Sheet) de Cadastro / Edição -->
    <Sheet
      v-model:open="isFormOpen"
      :title="isEditing ? 'Editar parcela / financiamento' : 'Novo financiamento ou parcelamento'"
      description="Escolha a categoria e informe quanto paga por mês."
    >
      <div v-if="editLoading" class="space-y-5 py-2">
        <div class="space-y-2">
          <Skeleton class="h-3.5 w-20" />
          <div class="grid grid-cols-3 gap-2">
            <Skeleton v-for="n in 5" :key="n" class="h-14 rounded-xl" />
          </div>
        </div>
        <div class="space-y-1.5">
          <Skeleton class="h-3.5 w-28" />
          <Skeleton class="h-10 w-full rounded-lg" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <Skeleton class="h-10 w-full rounded-lg" />
          <Skeleton class="h-10 w-full rounded-lg" />
        </div>
        <Skeleton class="h-10 w-full rounded-lg" />
      </div>

      <form v-else class="space-y-5" @submit.prevent="submitForm">
        <div
          v-if="formError"
          class="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
        >
          {{ formError }}
        </div>

        <!-- 1. Seletor Visual de Categoria -->
        <div class="space-y-2">
          <label class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Categoria
          </label>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="cat in DEBT_CATEGORIES"
              :key="cat.value"
              type="button"
              class="flex flex-col items-center justify-center gap-1.5 rounded-xl border p-2.5 text-center transition-all"
              :class="
                debtCategory === cat.value
                  ? 'border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary/30'
                  : 'border-border bg-background text-muted-foreground hover:border-foreground/20 hover:bg-muted/40 hover:text-foreground'
              "
              @click="debtCategory = cat.value"
            >
              <component :is="cat.icon" class="h-4 w-4" />
              <span class="text-[11px] font-medium">{{ cat.shortLabel }}</span>
            </button>
          </div>
        </div>

        <!-- 2. Nome e Valor da Parcela -->
        <div class="space-y-1.5">
          <label for="debt-desc" class="text-xs font-medium text-foreground">
            Nome / Descrição
          </label>
          <input
            id="debt-desc"
            v-model="description"
            type="text"
            placeholder="Ex: Financiamento do Apê, Parcela do Carro..."
            required
            class="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <label for="debt-amount" class="text-xs font-medium text-foreground">
              Parcela mensal
            </label>
            <CurrencyInput
              id="debt-amount"
              v-model="amount"
              placeholder="2.500,00"
              required
            />
          </div>

          <div class="space-y-1.5">
            <label for="debt-installments" class="text-xs font-medium text-foreground">
              Prazo (parcelas)
            </label>
            <input
              id="debt-installments"
              v-model.number="installmentTotal"
              type="number"
              step="1"
              min="1"
              max="600"
              placeholder="36"
              required
              class="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        <!-- 3. Competência, Data e Divisão com o Par -->
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <label for="debt-ref-month" class="text-xs font-medium text-foreground">
              Mês da parcela
            </label>
            <input
              id="debt-ref-month"
              v-model="referenceMonth"
              type="month"
              class="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div class="space-y-1.5">
            <label for="debt-date" class="text-xs font-medium text-foreground">
              Vencimento
            </label>
            <input
              id="debt-date"
              v-model="occurredAt"
              type="date"
              required
              class="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        <button
          type="button"
          class="flex h-10 w-full items-center justify-between rounded-lg border px-3 py-2 text-xs transition-colors"
          :class="
            isShared
              ? 'border-primary/40 bg-primary/10 text-foreground font-medium'
              : 'border-input bg-background text-muted-foreground hover:bg-muted/50'
          "
          @click="isShared = !isShared"
        >
          <span class="flex items-center gap-2">
            <Users class="h-4 w-4" :class="isShared ? 'text-primary' : 'text-muted-foreground'" />
            Conta compartilhada do casal
          </span>
          <span
            class="flex h-5 w-5 items-center justify-center rounded-full text-xs"
            :class="
              isShared
                ? 'bg-primary text-primary-foreground'
                : 'border border-muted-foreground/30'
            "
          >
            <Check v-if="isShared" class="h-3 w-3" />
          </span>
        </button>

        <!-- 4. Observações opcionais -->
        <div class="space-y-1.5">
          <label for="debt-notes" class="text-xs font-medium text-foreground">
            Observações <span class="text-muted-foreground font-normal">(opcional)</span>
          </label>
          <input
            id="debt-notes"
            v-model="notes"
            type="text"
            placeholder="Ex: Débito automático dia 10..."
            class="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <!-- Ações -->
        <div class="flex items-center justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" @click="closeForm">
            Cancelar
          </Button>
          <Button type="submit" :disabled="submitting">
            {{ submitting ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Salvar parcela' }}
          </Button>
        </div>
      </form>
    </Sheet>

    <!-- Resumo Focado no Mês (Sem multiplicar 30 anos na cara!) -->
    <Card>
      <CardContent class="p-5 space-y-4">
        <template v-if="loading && debts.length === 0">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:divide-x sm:divide-border">
            <div v-for="n in 3" :key="n" :class="n > 1 ? 'sm:pl-6 space-y-2' : 'space-y-2'">
              <Skeleton class="h-3.5 w-28" />
              <Skeleton class="h-7 w-32" />
              <Skeleton class="h-3 w-24" />
            </div>
          </div>
          <Skeleton class="h-2 w-full rounded-full" />
        </template>

        <template v-else>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:divide-x sm:divide-border">
            <div>
              <span class="text-xs font-medium text-muted-foreground">
                Falta pagar no mês
              </span>
              <div class="mt-1 text-2xl font-bold tracking-tight tabular-nums text-foreground">
                {{ formatCurrency(pendingMonthlyAmount) }}
              </div>
              <span class="text-xs text-muted-foreground">
                {{ pendingDebtsCount }} {{ pendingDebtsCount === 1 ? 'parcela pendente' : 'parcelas pendentes' }}
              </span>
            </div>

            <div class="sm:pl-6">
              <span class="text-xs font-medium text-muted-foreground">
                Já pago no mês
              </span>
              <div class="mt-1 text-2xl font-bold tracking-tight tabular-nums text-emerald-600 dark:text-emerald-400">
                {{ formatCurrency(paidMonthlyAmount) }}
              </div>
              <span class="text-xs text-muted-foreground">
                {{ paidDebtsCount }} {{ paidDebtsCount === 1 ? 'parcela quitada' : 'parcelas quitadas' }}
              </span>
            </div>

            <div class="sm:pl-6">
              <span class="text-xs font-medium text-muted-foreground">
                Comprometimento mensal
              </span>
              <div class="mt-1 flex items-baseline gap-1">
                <span class="text-2xl font-bold tracking-tight tabular-nums text-muted-foreground">
                  {{ formatCurrency(totalMonthlyInstallments) }}
                </span>
                <span class="text-xs text-muted-foreground">/mês</span>
              </div>
              <span class="text-xs text-muted-foreground">
                {{ debts.length }} {{ debts.length === 1 ? 'contrato ativo' : 'contratos ativos' }}
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

    <!-- Filtro: Todas vs Com meu Par (Casal) vs Individuais -->
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
          Todas
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

      <div v-if="sharedDebtsTotal > 0" class="flex items-center gap-2 text-xs text-muted-foreground">
        <Users class="h-3.5 w-3.5 text-primary" />
        <span>
          Total com o par: <strong class="text-foreground">{{ formatCurrency(sharedDebtsTotal) }}/mês</strong>
          ({{ formatCurrency(sharedDebtsTotal / 2) }} / 50% pra cada)
        </span>
      </div>
    </div>

    <!-- Estado de Carregamento / Erro -->
    <div
      v-if="error"
      class="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive"
    >
      {{ error }}
    </div>

    <Card v-if="loading && debts.length === 0">
      <CardHeader class="flex flex-row items-center justify-between border-b border-border py-3.5 px-5">
        <Skeleton class="h-4 w-44" />
        <Skeleton class="h-3.5 w-16" />
      </CardHeader>
      <CardContent class="p-0">
        <ul class="divide-y divide-border" aria-label="Carregando parcelas">
          <li
            v-for="n in 4"
            :key="n"
            class="flex items-center justify-between gap-4 px-5 py-4"
          >
            <div class="flex items-center gap-3.5">
              <Skeleton class="h-10 w-10 rounded-xl" />
              <div class="space-y-2">
                <div class="flex items-center gap-2">
                  <Skeleton class="h-4 w-36" />
                  <Skeleton class="h-4 w-16 rounded-full" />
                </div>
                <Skeleton class="h-3 w-32" />
              </div>
            </div>
            <div class="flex items-center gap-3">
              <div class="space-y-1.5 text-right">
                <Skeleton class="h-4 w-24" />
                <Skeleton class="h-3 w-16 ml-auto" />
              </div>
              <Skeleton class="h-8 w-16 rounded-md" />
            </div>
          </li>
        </ul>
      </CardContent>
    </Card>

    <!-- Lista Limpa de Financiamentos / Parcelas -->
    <Card v-else-if="filteredDebts.length > 0">
      <CardHeader class="flex flex-row items-center justify-between border-b border-border py-3.5 px-5">
        <CardTitle class="text-sm font-semibold">Seus Contratos & Parcelas</CardTitle>
        <span class="text-xs text-muted-foreground">
          {{ filteredDebts.length }} {{ filteredDebts.length === 1 ? 'item' : 'itens' }}
        </span>
      </CardHeader>

      <CardContent class="p-0">
        <ul class="divide-y divide-border" role="list">
          <li
            v-for="t in filteredDebts"
            :key="t.id"
            class="flex flex-col justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center"
          >
            <!-- Ícone + Nome + Detalhes discretos -->
            <div class="flex items-center gap-3.5 min-w-0">
              <div
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
                :class="
                  isDebtPaid(t)
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'border-primary/20 bg-primary/10 text-primary'
                "
              >
                <component :is="getCategoryIcon(t.debtCategory)" class="h-5 w-5" />
              </div>

              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <span
                    class="text-sm font-semibold text-foreground truncate"
                    :class="isDebtPaid(t) ? 'line-through text-muted-foreground' : ''"
                  >
                    {{ t.description }}
                  </span>

                  <Badge variant="secondary" class="text-[11px] font-normal">
                    {{ t.debtCategory ? DEBT_CATEGORY_LABELS[t.debtCategory] : 'Outro' }}
                  </Badge>

                  <Badge v-if="t.isShared" variant="outline" class="gap-1 text-[11px] font-normal">
                    <Users class="h-3 w-3" />
                    Casal
                  </Badge>
                </div>

                <div class="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
                  <span v-if="t.installmentNumber && t.installmentTotal" class="font-medium text-foreground">
                    Parcela {{ t.installmentNumber }} de {{ t.installmentTotal }}
                  </span>
                  <span v-else>{{ formatInstallmentDuration(t.installmentTotal) }}</span>
                  <span v-if="t.referenceMonth">• Início {{ formatMonthLabel(t.referenceMonth) }}</span>
                  <span v-if="t.notes" class="truncate max-w-xs">• {{ t.notes }}</span>
                </div>
              </div>
            </div>

            <!-- Valor Mensal + Ações -->
            <div class="flex items-center justify-between gap-4 sm:justify-end">
              <div class="text-left sm:text-right">
                <div class="text-sm font-bold tabular-nums text-foreground">
                  {{ formatCurrency(t.amount) }}
                  <span class="text-xs font-normal text-muted-foreground">/mês</span>
                </div>
                <span
                  class="inline-flex items-center gap-1 text-[11px]"
                  :class="
                    isDebtPaid(t)
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  "
                >
                  <CheckCircle2 v-if="isDebtPaid(t)" class="h-3 w-3" />
                  <Clock v-else class="h-3 w-3" />
                  {{ isDebtPaid(t) ? 'Paga no mês' : 'Pendente' }}
                </span>
              </div>

              <div class="flex items-center gap-1">
                <Button
                  :variant="isDebtPaid(t) ? 'ghost' : 'outline'"
                  size="xs"
                  class="gap-1"
                  :class="
                    !isDebtPaid(t)
                      ? 'border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400'
                      : 'text-muted-foreground'
                  "
                  @click="togglePaidStatus(t)"
                >
                  <Check class="h-3.5 w-3.5" />
                  <span>{{ isDebtPaid(t) ? 'Pago' : 'Pagar' }}</span>
                </Button>

                <Button
                  v-if="isMyDebt(t)"
                  variant="ghost"
                  size="icon"
                  class="h-8 w-8 text-muted-foreground hover:text-foreground"
                  title="Editar"
                  @click="openEdit(t)"
                >
                  <Pencil class="h-3.5 w-3.5" />
                </Button>

                <Button
                  v-if="isMyDebt(t)"
                  variant="ghost"
                  size="icon"
                  class="h-8 w-8 text-muted-foreground hover:text-destructive"
                  title="Excluir"
                  @click="openRemove(t)"
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
          <Home class="h-5 w-5" />
        </div>
        <h3 class="text-sm font-semibold text-foreground">
          Nenhum financiamento cadastrado
        </h3>
        <p class="mt-1 max-w-sm text-xs text-muted-foreground">
          Adicione a parcela da casa, carro ou empréstimo para acompanhar quanto pesa por mês.
        </p>
        <Button size="sm" class="mt-4 gap-1.5" @click="openCreate">
          <Plus class="h-4 w-4" />
          <span>Adicionar primeira parcela</span>
        </Button>
      </CardContent>
    </Card>
  </div>
</template>

<style scoped>
/* Styled with Tailwind CSS */
</style>

