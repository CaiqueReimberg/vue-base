<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import ConfirmModal from '@/components/ConfirmModal.vue'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Sheet } from '@/components/ui/sheet'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAccountsStore } from '@/stores/accounts/accounts.store'
import { useAuthStore } from '@/stores/auth/auth.store'
import { useToastStore } from '@/stores/toast/toast.store'
import { RouterLink } from 'vue-router'
import { savingsGoalsApi, type SavingsGoal } from '@/api/savings-goals.api'
import type { Account, AccountType } from '@/types/account'
import { ownerBadgeLabel, isMyResource } from '@/utils/owner'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Landmark,
  Pencil,
  PiggyBank,
  Plus,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-vue-next'

const store = useAccountsStore()
const authStore = useAuthStore()
const toastStore = useToastStore()
const { accounts, loading, error, formatCurrency, typeLabel } = storeToRefs(store)

const currentUserId = computed(() => authStore.currentUserId)

const QUICK_VAULT_PRESETS: Array<{ name: string; type: AccountType }> = [
  { name: 'CDB Nubank', type: 'investment' },
  { name: 'CDB Itaú', type: 'investment' },
  { name: 'CDB Inter', type: 'investment' },
  { name: 'Caixinha Reserva', type: 'savings' },
  { name: 'CDB XP', type: 'investment' },
  { name: 'CDB C6 Bank', type: 'investment' },
  { name: 'Tesouro Selic', type: 'investment' },
]

const QUICK_AMOUNTS = [200, 500, 1000, 2000, 5000]

// Filtro: Todas | Casal | Individuais
const scopeFilter = ref<'all' | 'shared' | 'individual'>('all')

const filteredAccounts = computed(() => {
  const list = [...accounts.value].sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0))
  if (scopeFilter.value === 'shared') {
    return list.filter((a) => Boolean(a.shareWithPartner))
  }
  if (scopeFilter.value === 'individual') {
    return list.filter((a) => !a.shareWithPartner)
  }
  return list
})

const totalFilteredBalance = computed(() =>
  filteredAccounts.value.reduce((sum, a) => sum + Number(a.balance || 0), 0),
)

const totalSharedBalance = computed(() =>
  accounts.value
    .filter((a) => Boolean(a.shareWithPartner))
    .reduce((sum, a) => sum + Number(a.balance || 0), 0),
)

const topAccount = computed(() => filteredAccounts.value[0] ?? null)

function sharePercent(balance: number): number {
  if (totalFilteredBalance.value <= 0 || balance <= 0) return 0
  return Math.round((balance / totalFilteredBalance.value) * 100)
}

function getAccountIcon(type: AccountType) {
  if (type === 'investment') return TrendingUp
  if (type === 'savings') return PiggyBank
  return Landmark
}

function accountOwnerLabel(a: Account) {
  return ownerBadgeLabel(a.owner ?? null, currentUserId.value)
}

function canManageAccount(a: Account) {
  return isMyResource(a.owner ?? null, currentUserId.value) || Boolean(a.shareWithPartner)
}

// 1. Drawer: Criar / Editar Conta ou CDB
const formDrawerOpen = ref(false)
const editingAccount = ref<Account | null>(null)
const formName = ref('')
const formType = ref<AccountType>('investment')
const formBalance = ref<number | ''>('')
const formShared = ref(true)
const submittingForm = ref(false)

// 2. Drawer Rápido: + Guardar (Aportar) ou − Retirar (Resgatar)
const moveDrawerOpen = ref(false)
const moveOperation = ref<'deposit' | 'withdraw'>('deposit')
const moveTargetAccount = ref<Account | null>(null)
const moveAmount = ref<number | ''>('')
const submittingMove = ref(false)

// 3. Modal: Excluir
const confirmOpen = ref(false)
const accountToRemove = ref<Account | null>(null)
const linkedGoalsList = ref<SavingsGoal[]>([])

function goalsForAccount(accountId: string): SavingsGoal[] {
  return linkedGoalsList.value.filter((g) => !g.archived && g.accountId === accountId)
}

async function refreshLinkedGoals() {
  try {
    linkedGoalsList.value = await savingsGoalsApi.list()
  } catch {
    // silencioso
  }
}

onMounted(async () => {
  try {
    await Promise.all([store.fetchAll(), refreshLinkedGoals()])
  } catch {
    toastStore.error(store.error ?? 'Erro ao carregar reservas.')
  }
})

function openCreateDrawer() {
  editingAccount.value = null
  formName.value = ''
  formType.value = 'investment'
  formBalance.value = ''
  formShared.value = true
  formDrawerOpen.value = true
}

function openEditDrawer(account: Account) {
  editingAccount.value = account
  formName.value = account.name
  formType.value = account.type
  formBalance.value = account.balance
  formShared.value = Boolean(account.shareWithPartner)
  formDrawerOpen.value = true
}

async function handleSaveAccount() {
  const name = formName.value.trim()
  if (!name) {
    toastStore.error('Informe o nome da conta ou CDB.')
    return
  }
  const balanceVal = Number(formBalance.value) || 0
  if (balanceVal < 0) {
    toastStore.error('O saldo não pode ser negativo.')
    return
  }

  submittingForm.value = true
  try {
    if (editingAccount.value) {
      await store.update(editingAccount.value.id, {
        name,
        type: formType.value,
        balance: balanceVal,
        shareWithPartner: formShared.value,
      })
      toastStore.success(`${name} atualizado!`)
    } else {
      await store.create({
        name,
        type: formType.value,
        initialBalance: balanceVal,
        shareWithPartner: formShared.value,
      })
      toastStore.success(`${name} adicionado às suas reservas!`)
    }
    formDrawerOpen.value = false
  } catch {
    toastStore.error(store.error ?? 'Erro ao salvar conta.')
  } finally {
    submittingForm.value = false
  }
}

function openMoveDrawer(account: Account, operation: 'deposit' | 'withdraw') {
  moveTargetAccount.value = account
  moveOperation.value = operation
  moveAmount.value = ''
  moveDrawerOpen.value = true
}

const simulatedNewBalance = computed(() => {
  const current = Number(moveTargetAccount.value?.balance || 0)
  const val = Number(moveAmount.value) || 0
  if (moveOperation.value === 'deposit') return current + val
  return Math.max(0, current - val)
})

async function handleConfirmMove() {
  const account = moveTargetAccount.value
  if (!account) return
  const val = Number(moveAmount.value)
  if (!Number.isFinite(val) || val <= 0) {
    toastStore.error('Informe um valor maior que zero.')
    return
  }

  const delta = moveOperation.value === 'deposit' ? val : -val
  submittingMove.value = true
  try {
    await store.adjustBalance(account.id, delta)
    await refreshLinkedGoals()
    toastStore.success(
      moveOperation.value === 'deposit'
        ? `${formatCurrency.value(val)} guardados em ${account.name}!`
        : `${formatCurrency.value(val)} retirados de ${account.name}.`,
    )
    moveDrawerOpen.value = false
  } catch {
    toastStore.error('Não foi possível atualizar o saldo.')
  } finally {
    submittingMove.value = false
  }
}

function openConfirmRemove(account: Account) {
  accountToRemove.value = account
  confirmOpen.value = true
}

async function confirmRemove() {
  const account = accountToRemove.value
  if (!account) return
  confirmOpen.value = false
  try {
    await store.remove(account.id)
    toastStore.success(`${account.name} removido.`)
  } catch {
    toastStore.error(store.error ?? 'Erro ao excluir conta.')
  }
}
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-6">
    <ConfirmModal
      :open="confirmOpen"
      title="Excluir conta / reserva"
      :message="
        accountToRemove
          ? `Deseja remover &quot;${accountToRemove.name}&quot; (${formatCurrency(accountToRemove.balance)})?`
          : ''
      "
      confirm-label="Excluir"
      :danger="true"
      @close="confirmOpen = false"
      @confirm="confirmRemove"
    />

    <!-- Cabeçalho -->
    <header class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h1 class="text-xl font-bold tracking-tight text-foreground">
          Dinheiro Guardado & CDBs
        </h1>
        <p class="mt-0.5 text-xs text-muted-foreground">
          Visão única das suas reservas, caixinhas e CDBs para adicionar ou retirar dinheiro com 1 clique.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <RouterLink to="/goals">
          <Button variant="outline" class="gap-1.5">
            <Target class="h-4 w-4 text-primary" />
            <span>Metas vinculadas</span>
          </Button>
        </RouterLink>

        <Button class="gap-1.5" @click="openCreateDrawer">
          <Plus class="h-4 w-4" />
          <span>Nova conta / CDB</span>
        </Button>
      </div>
    </header>

    <!-- Card Principal: Visão Única do Total Guardado -->
    <Card class="border-emerald-500/25 bg-emerald-500/5">
      <CardContent class="p-5 space-y-4">
        <template v-if="loading && accounts.length === 0">
          <div class="grid grid-cols-3 gap-3 sm:gap-4 sm:divide-x sm:divide-border">
            <div v-for="n in 3" :key="n" :class="n > 1 ? 'sm:pl-6 space-y-1.5' : 'space-y-1.5'">
              <Skeleton class="h-3 w-16 sm:w-28" />
              <Skeleton class="h-5 sm:h-7 w-20 sm:w-36" />
              <Skeleton class="h-2.5 w-14 sm:w-24" />
            </div>
          </div>
        </template>

        <template v-else>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:divide-x sm:divide-border">
            <!-- Total Guardado -->
            <div>
              <div class="flex items-center gap-1.5">
                <PiggyBank class="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span class="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  Total guardado
                </span>
              </div>
              <div class="mt-1.5 text-3xl font-extrabold tracking-tight tabular-nums text-emerald-700 dark:text-emerald-300">
                {{ formatCurrency(totalFilteredBalance) }}
              </div>
              <span class="text-xs text-muted-foreground">
                Somando {{ filteredAccounts.length }} {{ filteredAccounts.length === 1 ? 'conta/CDB' : 'contas/CDBs' }}
              </span>
            </div>

            <!-- Maior Reserva -->
            <div class="sm:pl-6">
              <span class="text-xs font-medium text-muted-foreground">
                Maior posição atual
              </span>
              <div class="mt-1.5 text-lg font-bold text-foreground truncate">
                {{ topAccount ? topAccount.name : 'Nenhuma' }}
              </div>
              <span class="text-xs text-muted-foreground">
                <template v-if="topAccount">
                  {{ formatCurrency(topAccount.balance) }} ({{ sharePercent(topAccount.balance) }}% do total)
                </template>
                <template v-else>Nenhuma conta cadastrada</template>
              </span>
            </div>

            <!-- Reserva do Casal -->
            <div class="sm:pl-6">
              <span class="text-xs font-medium text-muted-foreground">
                Compartilhado com o par
              </span>
              <div class="mt-1.5 text-lg font-bold tabular-nums text-foreground">
                {{ formatCurrency(totalSharedBalance) }}
              </div>
              <span class="text-xs text-muted-foreground">
                {{ formatCurrency(totalSharedBalance / 2) }} (50% de cada)
              </span>
            </div>
          </div>
        </template>
      </CardContent>
    </Card>

    <!-- Filtro: Todas | Com meu par (Casal) | Individuais -->
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
          Todas ({{ accounts.length }})
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
    </div>

    <div
      v-if="error"
      class="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive"
    >
      {{ error }}
    </div>

    <!-- Skeleton durante carregamento -->
    <div v-if="loading && accounts.length === 0" class="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
      <Card v-for="n in 2" :key="n">
        <CardContent class="p-4 sm:p-5 space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <Skeleton class="h-8 w-8 sm:h-10 sm:w-10 rounded-xl" />
              <div class="space-y-1">
                <Skeleton class="h-3.5 w-24 sm:w-32" />
                <Skeleton class="h-2.5 w-16 sm:w-20" />
              </div>
            </div>
            <Skeleton class="h-5 w-20 sm:w-24" />
          </div>
          <Skeleton class="h-1.5 w-full rounded-full" />
          <div class="flex gap-2">
            <Skeleton class="h-8 flex-1 rounded-lg" />
            <Skeleton class="h-8 flex-1 rounded-lg" />
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Grid das Contas / CDBs -->
    <div v-else-if="filteredAccounts.length > 0" class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Card
        v-for="acc in filteredAccounts"
        :key="acc.id"
        class="flex flex-col justify-between transition-all hover:border-primary/30"
      >
        <CardContent class="p-5 space-y-4">
          <!-- Topo do Card: Ícone + Nome + Saldo -->
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <component :is="getAccountIcon(acc.type)" class="h-5 w-5" />
              </div>

              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-1.5">
                  <h3 class="text-sm font-bold text-foreground truncate">
                    {{ acc.name }}
                  </h3>
                  <Badge v-if="acc.shareWithPartner" variant="outline" class="gap-1 text-[10px] px-1.5 py-0 font-normal">
                    <Users class="h-2.5 w-2.5 text-primary" />
                    Casal
                  </Badge>
                </div>
                <div class="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{{ typeLabel(acc.type) }}</span>
                  <span v-if="accountOwnerLabel(acc)">• De {{ accountOwnerLabel(acc) }}</span>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-1 shrink-0">
              <Button
                v-if="canManageAccount(acc)"
                variant="ghost"
                size="icon"
                class="h-7 w-7 text-muted-foreground hover:text-foreground"
                title="Editar ou ajustar saldo total"
                @click="openEditDrawer(acc)"
              >
                <Pencil class="h-3.5 w-3.5" />
              </Button>
              <Button
                v-if="canManageAccount(acc)"
                variant="ghost"
                size="icon"
                class="h-7 w-7 text-muted-foreground hover:text-destructive"
                title="Excluir conta"
                @click="openConfirmRemove(acc)"
              >
                <Trash2 class="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <!-- Saldo Atual + Participação no Total -->
          <div class="space-y-1.5">
            <div class="flex items-baseline justify-between">
              <span class="text-2xl font-extrabold tracking-tight tabular-nums text-foreground">
                {{ formatCurrency(acc.balance) }}
              </span>
              <span class="text-xs font-medium text-muted-foreground">
                {{ sharePercent(acc.balance) }}% do total
              </span>
            </div>
            <Progress
              :model-value="sharePercent(acc.balance)"
              class="h-1.5"
              indicator-class="bg-emerald-600 dark:bg-emerald-500"
            />
          </div>

          <!-- Metas Conectadas a este CDB -->
          <div
            v-if="goalsForAccount(acc.id).length > 0"
            class="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 space-y-1.5"
          >
            <RouterLink
              v-for="g in goalsForAccount(acc.id)"
              :key="g.id"
              to="/goals"
              class="block group/goal"
            >
              <div class="flex items-center justify-between text-xs">
                <span class="inline-flex items-center gap-1.5 font-medium text-foreground group-hover/goal:text-primary transition-colors truncate">
                  <Target class="h-3 w-3 text-primary shrink-0" />
                  <span class="truncate">{{ g.name }}</span>
                </span>
                <span class="text-[11px] font-semibold tabular-nums text-primary shrink-0">
                  {{ g.percent }}% de {{ formatCurrency(g.targetAmount) }}
                </span>
              </div>
            </RouterLink>
          </div>

          <!-- Botões de Ação Rápida: Guardar e Retirar -->
          <div class="grid grid-cols-2 gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              class="w-full gap-1.5 border-emerald-500/30 bg-emerald-500/5 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300"
              @click="openMoveDrawer(acc, 'deposit')"
            >
              <ArrowUpRight class="h-4 w-4" />
              <span>Guardar</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              class="w-full gap-1.5 text-muted-foreground hover:text-foreground"
              @click="openMoveDrawer(acc, 'withdraw')"
            >
              <ArrowDownLeft class="h-4 w-4" />
              <span>Retirar</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Empty State -->
    <Card v-else class="border-dashed">
      <CardContent class="flex flex-col items-center justify-center py-12 text-center">
        <div class="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <PiggyBank class="h-6 w-6" />
        </div>
        <h3 class="text-sm font-semibold text-foreground">
          Nenhuma conta ou CDB cadastrado
        </h3>
        <p class="mt-1 max-w-sm text-xs text-muted-foreground">
          Cadastre seus CDBs, caixinhas ou reservas para ver todo o seu dinheiro guardado em um só lugar.
        </p>
        <Button size="sm" class="mt-4 gap-1.5" @click="openCreateDrawer">
          <Plus class="h-4 w-4" />
          <span>Cadastrar primeiro CDB / Reserva</span>
        </Button>
      </CardContent>
    </Card>

    <!-- ============================================================ -->
    <!-- DRAWER 1: GUARDAR (APORTAR) OU RETIRAR (RESGATAR) -->
    <!-- ============================================================ -->
    <Sheet
      v-model:open="moveDrawerOpen"
      :title="
        moveOperation === 'deposit'
          ? `Guardar dinheiro em ${moveTargetAccount?.name ?? ''}`
          : `Retirar dinheiro de ${moveTargetAccount?.name ?? ''}`
      "
      :description="
        moveOperation === 'deposit'
          ? 'Informe quanto você está adicionando nessa reserva/CDB.'
          : 'Informe quanto você está resgatando/retirando dessa reserva/CDB.'
      "
    >
      <form class="space-y-5" @submit.prevent="handleConfirmMove">
        <!-- Alternador rápido: Guardar vs Retirar -->
        <div class="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
          <button
            type="button"
            class="flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all"
            :class="
              moveOperation === 'deposit'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            "
            @click="moveOperation = 'deposit'"
          >
            <ArrowUpRight class="h-4 w-4" />
            <span>Guardar (Adicionar)</span>
          </button>

          <button
            type="button"
            class="flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all"
            :class="
              moveOperation === 'withdraw'
                ? 'bg-background text-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            "
            @click="moveOperation = 'withdraw'"
          >
            <ArrowDownLeft class="h-4 w-4" />
            <span>Retirar (Resgatar)</span>
          </button>
        </div>

        <!-- Valores rápidos em 1 clique -->
        <div class="space-y-2">
          <label class="text-xs font-medium text-muted-foreground">
            Atalhos rápidos:
          </label>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="val in QUICK_AMOUNTS"
              :key="val"
              type="button"
              class="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10"
              @click="moveAmount = val"
            >
              {{ formatCurrency(val) }}
            </button>
          </div>
        </div>

        <div class="space-y-1.5">
          <label class="text-xs font-medium text-foreground">
            {{ moveOperation === 'deposit' ? 'Valor a adicionar' : 'Valor a retirar' }}
          </label>
          <CurrencyInput
            v-model="moveAmount"
            placeholder="Ex: 2.000,00"
            required
          />
        </div>

        <!-- Preview de como ficará o saldo -->
        <div class="rounded-xl border border-border bg-muted/30 p-4 space-y-2 text-xs">
          <div class="flex justify-between">
            <span class="text-muted-foreground">Saldo atual em {{ moveTargetAccount?.name }}:</span>
            <strong class="text-foreground">{{ formatCurrency(moveTargetAccount?.balance ?? 0) }}</strong>
          </div>
          <div class="flex justify-between border-t border-border pt-2 text-sm">
            <span class="font-semibold text-foreground">Novo saldo após operação:</span>
            <strong class="text-emerald-600 dark:text-emerald-400">
              {{ formatCurrency(simulatedNewBalance) }}
            </strong>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" @click="moveDrawerOpen = false">
            Cancelar
          </Button>
          <Button type="submit" :disabled="submittingMove">
            {{
              submittingMove
                ? 'Atualizando...'
                : moveOperation === 'deposit'
                  ? 'Confirmar aporte'
                  : 'Confirmar retirada'
            }}
          </Button>
        </div>
      </form>
    </Sheet>

    <!-- ============================================================ -->
    <!-- DRAWER 2: CRIAR OU EDITAR CONTA / CDB -->
    <!-- ============================================================ -->
    <Sheet
      v-model:open="formDrawerOpen"
      :title="editingAccount ? `Editar ${editingAccount.name}` : 'Nova conta / CDB'"
      description="Cadastre uma conta onde você guarda dinheiro (CDB, Caixinha, Tesouro ou Conta)."
    >
      <form class="space-y-5" @submit.prevent="handleSaveAccount">
        <!-- Sugestões rápidas -->
        <div v-if="!editingAccount" class="space-y-2">
          <label class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles class="h-3.5 w-3.5 text-primary" />
            <span>Sugestões rápidas (1 clique):</span>
          </label>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="preset in QUICK_VAULT_PRESETS"
              :key="preset.name"
              type="button"
              class="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10"
              @click="
                formName = preset.name;
                formType = preset.type
              "
            >
              {{ preset.name }}
            </button>
          </div>
        </div>

        <!-- Tipo -->
        <div class="grid grid-cols-3 gap-1.5 rounded-xl bg-muted p-1">
          <button
            type="button"
            class="flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all"
            :class="
              formType === 'investment'
                ? 'bg-background text-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            "
            @click="formType = 'investment'"
          >
            <TrendingUp class="h-3.5 w-3.5" />
            <span>CDB / Invest.</span>
          </button>

          <button
            type="button"
            class="flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all"
            :class="
              formType === 'savings'
                ? 'bg-background text-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            "
            @click="formType = 'savings'"
          >
            <PiggyBank class="h-3.5 w-3.5" />
            <span>Caixinha</span>
          </button>

          <button
            type="button"
            class="flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all"
            :class="
              formType === 'checking'
                ? 'bg-background text-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            "
            @click="formType = 'checking'"
          >
            <Landmark class="h-3.5 w-3.5" />
            <span>Conta</span>
          </button>
        </div>

        <div class="space-y-1.5">
          <label class="text-xs font-medium text-foreground">
            Nome da reserva / CDB
          </label>
          <input
            v-model="formName"
            type="text"
            placeholder="Ex: CDB Itaú, Caixinha Nubank, CDB Inter..."
            required
            class="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div class="space-y-1.5">
          <label class="text-xs font-medium text-foreground">
            Saldo guardado hoje
          </label>
          <CurrencyInput
            v-model="formBalance"
            placeholder="Ex: 5.000,00"
          />
          <p class="text-[11px] text-muted-foreground">
            Você também pode usar este campo para atualizar o saldo quando o CDB render juros.
          </p>
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
            Reserva compartilhada com o par (Casal)
          </span>
          <span
            class="flex h-5 w-5 items-center justify-center rounded-full"
            :class="formShared ? 'bg-primary text-primary-foreground' : 'border border-muted-foreground/30'"
          >
            <Check v-if="formShared" class="h-3 w-3" />
          </span>
        </button>

        <div class="flex items-center justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" @click="formDrawerOpen = false">
            Cancelar
          </Button>
          <Button type="submit" :disabled="submittingForm">
            {{ submittingForm ? 'Salvando...' : editingAccount ? 'Salvar alterações' : 'Criar reserva' }}
          </Button>
        </div>
      </form>
    </Sheet>
  </div>
</template>

<style scoped>
/* Styled with Tailwind CSS */
</style>
