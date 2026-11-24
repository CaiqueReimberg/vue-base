<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { savingsGoalsApi, type SavingsGoal } from '@/api/savings-goals.api'
import ConfirmModal from '@/components/ConfirmModal.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Progress } from '@/components/ui/progress'
import { Sheet } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { useAccountsStore } from '@/stores/accounts/accounts.store'
import { useAuthStore } from '@/stores/auth/auth.store'
import { useToastStore } from '@/stores/toast/toast.store'
import { formatCurrency } from '@/utils/month'
import {
  Archive,
  ArchiveRestore,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Landmark,
  Pencil,
  PiggyBank,
  Plus,
  Target,
  Trash2,
  Users,
} from 'lucide-vue-next'

const toastStore = useToastStore()
const authStore = useAuthStore()
const accountsStore = useAccountsStore()
const { accounts: vaultAccounts } = storeToRefs(accountsStore)

const goals = ref<SavingsGoal[]>([])
const loading = ref(true)
const showArchived = ref(false)
const expanded = ref<Record<string, boolean>>({})

// Drawer 1: Criar / Editar Meta
const goalDrawerOpen = ref(false)
const editingGoalId = ref<string | null>(null)
const formName = ref('')
const formTarget = ref<number | ''>('')
const formDate = ref('')
const formAccountId = ref<string>('')
const formShared = ref(true)
const savingGoal = ref(false)

// Drawer 2: Guardar / Retirar em uma Meta
const moveDrawerOpen = ref(false)
const moveTargetGoal = ref<SavingsGoal | null>(null)
const moveOperation = ref<'deposit' | 'withdraw'>('deposit')
const moveAmount = ref<number | ''>('')
const moveNote = ref('')
const moveExtraAccountId = ref<string>('')
const submittingMove = ref(false)

// Modal de confirmação de exclusão
const goalToDelete = ref<SavingsGoal | null>(null)

const visibleGoals = computed(() =>
  goals.value.filter((g) => (showArchived.value ? g.archived : !g.archived)),
)

const archivedCount = computed(() => goals.value.filter((g) => g.archived).length)

const activeTotals = computed(() => {
  const active = goals.value.filter((g) => !g.archived)
  const saved = active.reduce((s, g) => s + g.saved, 0)
  const target = active.reduce((s, g) => s + g.targetAmount, 0)
  const percent = target > 0 ? Math.min(Math.round((saved / target) * 100), 100) : 0
  return { saved, target, percent, count: active.length }
})

async function load() {
  loading.value = true
  try {
    const [goalsList] = await Promise.all([
      savingsGoalsApi.list(),
      accountsStore.fetchAll(),
    ])
    goals.value = goalsList
  } catch (e) {
    toastStore.error(e instanceof Error ? e.message : 'Erro ao carregar metas')
  } finally {
    loading.value = false
  }
}

onMounted(load)

function replaceGoal(updated: SavingsGoal | undefined) {
  if (!updated) return
  const idx = goals.value.findIndex((g) => g.id === updated.id)
  if (idx >= 0) goals.value[idx] = updated
  else goals.value.unshift(updated)
}

function canManageGoal(goal: SavingsGoal): boolean {
  return goal.ownerId === authStore.currentUserId
}

function formatShortDate(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}

function formatContributionDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    })
  } catch {
    return ''
  }
}

function openCreateDrawer() {
  editingGoalId.value = null
  formName.value = ''
  formTarget.value = ''
  formDate.value = ''
  formAccountId.value = ''
  formShared.value = true
  goalDrawerOpen.value = true
}

function openEditDrawer(goal: SavingsGoal) {
  editingGoalId.value = goal.id
  formName.value = goal.name
  formTarget.value = goal.targetAmount
  formDate.value = goal.targetDate ? goal.targetDate.slice(0, 10) : ''
  formAccountId.value = goal.accountId ?? ''
  formShared.value = goal.isShared
  goalDrawerOpen.value = true
}

async function handleSaveGoal() {
  const target = Number(formTarget.value)
  if (!formName.value.trim() || !(target > 0)) {
    toastStore.error('Informe o nome e um valor alvo maior que zero.')
    return
  }

  savingGoal.value = true
  const payload = {
    name: formName.value.trim(),
    targetAmount: target,
    targetDate: formDate.value ? new Date(`${formDate.value}T12:00:00`).toISOString() : null,
    isShared: formShared.value,
    accountId: formAccountId.value || null,
  }

  try {
    if (editingGoalId.value) {
      const updated = await savingsGoalsApi.update(editingGoalId.value, payload)
      replaceGoal(updated)
      toastStore.success('Meta atualizada!')
    } else {
      const created = await savingsGoalsApi.create(payload)
      replaceGoal(created)
      toastStore.success('Meta criada!')
    }
    goalDrawerOpen.value = false
  } catch (e) {
    toastStore.error(e instanceof Error ? e.message : 'Erro ao salvar meta.')
  } finally {
    savingGoal.value = false
  }
}

function openMoveDrawer(goal: SavingsGoal, op: 'deposit' | 'withdraw') {
  moveTargetGoal.value = goal
  moveOperation.value = op
  moveAmount.value = ''
  moveNote.value = ''
  moveExtraAccountId.value = goal.accountId ?? ''
  moveDrawerOpen.value = true
}

async function handleConfirmMove() {
  const goal = moveTargetGoal.value
  if (!goal) return
  const raw = Number(moveAmount.value)
  if (!(raw > 0)) {
    toastStore.error('Informe um valor maior que zero.')
    return
  }

  submittingMove.value = true
  const sign = moveOperation.value === 'deposit' ? 1 : -1
  try {
    const updated = await savingsGoalsApi.addContribution(goal.id, {
      amount: raw * sign,
      note: moveNote.value.trim() || null,
      accountId: goal.accountId || moveExtraAccountId.value || null,
    })
    replaceGoal(updated)
    // Sincroniza os saldos dos CDBs na store
    await accountsStore.fetchAll()
    moveDrawerOpen.value = false
    toastStore.success(
      sign === 1
        ? `${formatCurrency(raw)} guardados na meta ${goal.name}!`
        : `${formatCurrency(raw)} retirados da meta ${goal.name}.`,
    )
  } catch (e) {
    toastStore.error(e instanceof Error ? e.message : 'Erro ao registrar movimentação.')
  } finally {
    submittingMove.value = false
  }
}

async function toggleArchive(goal: SavingsGoal) {
  try {
    const updated = await savingsGoalsApi.update(goal.id, { archived: !goal.archived })
    replaceGoal(updated)
    toastStore.success(updated.archived ? 'Meta arquivada.' : 'Meta reativada.')
  } catch (e) {
    toastStore.error(e instanceof Error ? e.message : 'Erro ao arquivar meta.')
  }
}

async function handleDeleteGoal() {
  const goal = goalToDelete.value
  if (!goal) return
  goalToDelete.value = null
  try {
    await savingsGoalsApi.remove(goal.id)
    goals.value = goals.value.filter((g) => g.id !== goal.id)
    toastStore.success('Meta excluída.')
  } catch (e) {
    toastStore.error(e instanceof Error ? e.message : 'Erro ao excluir meta.')
  }
}

async function handleRemoveContribution(goal: SavingsGoal, contribId: string) {
  try {
    const updated = await savingsGoalsApi.removeContribution(goal.id, contribId)
    replaceGoal(updated)
    await accountsStore.fetchAll()
    toastStore.success('Registro removido.')
  } catch (e) {
    toastStore.error(e instanceof Error ? e.message : 'Erro ao remover registro.')
  }
}
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-6 sm:px-6 space-y-5">
    <ConfirmModal
      :open="Boolean(goalToDelete)"
      title="Excluir meta de poupança"
      :message="
        goalToDelete
          ? `Deseja excluir a meta &quot;${goalToDelete.name}&quot;? O saldo dos seus CDBs permanece intacto.`
          : ''
      "
      confirm-label="Excluir"
      :danger="true"
      @close="goalToDelete = null"
      @confirm="handleDeleteGoal"
    />

    <!-- Cabeçalho -->
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold tracking-tight text-foreground">
          Metas de Poupança
        </h1>
        <p class="mt-0.5 text-xs text-muted-foreground">
          Conecte objetivos aos seus CDBs ou acompanhe reservas dedicadas a dois.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <Button
          v-if="archivedCount > 0 || showArchived"
          variant="outline"
          size="sm"
          class="gap-1.5"
          @click="showArchived = !showArchived"
        >
          <Archive class="h-3.5 w-3.5" />
          <span>{{ showArchived ? 'Ver ativas' : `Arquivadas (${archivedCount})` }}</span>
        </Button>

        <Button size="sm" class="gap-1.5" @click="openCreateDrawer">
          <Plus class="h-4 w-4" />
          <span>Nova meta</span>
        </Button>
      </div>
    </header>

    <!-- Card de Resumo Consolidado -->
    <Card class="border-primary/25 bg-primary/5">
      <CardContent class="p-4 sm:p-5 space-y-3">
        <template v-if="loading && goals.length === 0">
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
              <div class="flex items-center gap-1.5">
                <Target class="h-4 w-4 text-primary" />
                <span class="text-xs font-semibold uppercase tracking-wide text-primary">
                  Acumulado nas metas
                </span>
              </div>
              <div class="mt-1.5 text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums text-foreground">
                {{ formatCurrency(activeTotals.saved) }}
              </div>
              <span class="text-xs text-muted-foreground">
                {{ activeTotals.count }} {{ activeTotals.count === 1 ? 'meta ativa' : 'metas ativas' }}
              </span>
            </div>

            <div class="sm:pl-6">
              <span class="text-xs font-medium text-muted-foreground">
                Objetivo total somado
              </span>
              <div class="mt-1.5 text-xl font-bold tabular-nums text-foreground">
                {{ formatCurrency(activeTotals.target) }}
              </div>
              <span class="text-xs text-muted-foreground tabular-nums">
                Faltam {{ formatCurrency(Math.max(activeTotals.target - activeTotals.saved, 0)) }}
              </span>
            </div>

            <div class="sm:pl-6">
              <span class="text-xs font-medium text-muted-foreground">
                Progresso geral
              </span>
              <div class="mt-1.5 text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {{ activeTotals.percent }}%
              </div>
              <span class="text-xs text-muted-foreground">
                Sincronizado com seus CDBs vinculados
              </span>
            </div>
          </div>

          <Progress
            :model-value="activeTotals.percent"
            class="h-2"
            indicator-class="bg-primary"
          />
        </template>
      </CardContent>
    </Card>

    <!-- Skeleton da lista -->
    <div v-if="loading && goals.length === 0" class="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
      <Card v-for="n in 2" :key="n">
        <CardContent class="p-4 sm:p-5 space-y-3">
          <div class="flex items-center justify-between">
            <Skeleton class="h-4 w-32" />
            <Skeleton class="h-5 w-20" />
          </div>
          <Skeleton class="h-2 w-full rounded-full" />
          <div class="flex gap-2">
            <Skeleton class="h-8 flex-1 rounded-lg" />
            <Skeleton class="h-8 flex-1 rounded-lg" />
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Empty State -->
    <Card v-else-if="visibleGoals.length === 0" class="border-dashed">
      <CardContent class="flex flex-col items-center justify-center py-12 text-center">
        <div class="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Target class="h-6 w-6" />
        </div>
        <h3 class="text-sm font-semibold text-foreground">
          {{ showArchived ? 'Nenhuma meta arquivada' : 'Nenhuma meta cadastrada' }}
        </h3>
        <p class="mt-1 max-w-sm text-xs text-muted-foreground">
          Crie uma meta (ex: Reserva de Emergência, Viagem, Entrada do Apê) e conecte direto a um dos seus CDBs.
        </p>
        <Button v-if="!showArchived" size="sm" class="mt-4 gap-1.5" @click="openCreateDrawer">
          <Plus class="h-4 w-4" />
          <span>Criar primeira meta</span>
        </Button>
      </CardContent>
    </Card>

    <!-- Grid de Metas -->
    <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Card
        v-for="goal in visibleGoals"
        :key="goal.id"
        class="flex flex-col justify-between transition-all hover:border-primary/30"
      >
        <CardContent class="p-5 space-y-4">
          <!-- Cabeçalho do Card -->
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 space-y-1">
              <div class="flex flex-wrap items-center gap-1.5">
                <h3 class="text-sm font-bold text-foreground truncate">
                  {{ goal.name }}
                </h3>
                <Badge v-if="goal.completed" variant="success" class="gap-1 text-[10px] px-1.5 py-0">
                  <CheckCircle2 class="h-2.5 w-2.5" />
                  Concluída
                </Badge>
                <Badge v-if="goal.isShared" variant="outline" class="gap-1 text-[10px] px-1.5 py-0 font-normal">
                  <Users class="h-2.5 w-2.5 text-primary" />
                  Casal
                </Badge>
              </div>

              <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span v-if="goal.linkedAccount" class="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                  <Landmark class="h-3 w-3" />
                  CDB: {{ goal.linkedAccount.name }}
                </span>
                <span v-else>Controle por aportes</span>
                <span v-if="goal.targetDate">· Prazo {{ formatShortDate(goal.targetDate) }}</span>
              </div>
            </div>

            <div v-if="canManageGoal(goal)" class="flex items-center gap-0.5 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7 text-muted-foreground hover:text-foreground"
                title="Editar meta ou trocar CDB vinculado"
                @click="openEditDrawer(goal)"
              >
                <Pencil class="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7 text-muted-foreground hover:text-foreground"
                :title="goal.archived ? 'Reativar meta' : 'Arquivar meta'"
                @click="toggleArchive(goal)"
              >
                <ArchiveRestore v-if="goal.archived" class="h-3.5 w-3.5" />
                <Archive v-else class="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7 text-muted-foreground hover:text-destructive"
                title="Excluir meta"
                @click="goalToDelete = goal"
              >
                <Trash2 class="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <!-- Progresso -->
          <div class="space-y-1.5">
            <div class="flex items-baseline justify-between gap-2">
              <div>
                <span class="text-2xl font-extrabold tracking-tight tabular-nums text-foreground">
                  {{ formatCurrency(goal.saved) }}
                </span>
                <span class="ml-1 text-xs text-muted-foreground tabular-nums">
                  de {{ formatCurrency(goal.targetAmount) }}
                </span>
              </div>
              <span class="text-xs font-bold tabular-nums text-primary">
                {{ goal.percent }}%
              </span>
            </div>

            <Progress
              :model-value="goal.percent"
              class="h-2"
              :indicator-class="goal.completed ? 'bg-emerald-600 dark:bg-emerald-500' : 'bg-primary'"
            />

            <div class="flex items-center justify-between text-[11px] text-muted-foreground">
              <span v-if="!goal.completed" class="tabular-nums">
                Faltam {{ formatCurrency(goal.remaining) }}
              </span>
              <span v-else class="text-emerald-600 dark:text-emerald-400 font-medium">
                Meta atingida!
              </span>

              <span v-if="goal.monthlyNeeded && !goal.completed" class="tabular-nums">
                Sugestão: {{ formatCurrency(goal.monthlyNeeded) }}/mês
              </span>
            </div>
          </div>

          <!-- Botões 1-clique: Guardar / Retirar -->
          <div class="grid grid-cols-2 gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              class="w-full gap-1.5 border-emerald-500/30 bg-emerald-500/5 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300"
              @click="openMoveDrawer(goal, 'deposit')"
            >
              <ArrowUpRight class="h-4 w-4" />
              <span>Guardar</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              class="w-full gap-1.5 text-muted-foreground hover:text-foreground"
              @click="openMoveDrawer(goal, 'withdraw')"
            >
              <ArrowDownLeft class="h-4 w-4" />
              <span>Retirar</span>
            </Button>
          </div>

          <!-- Histórico recolhível de aportes manuais -->
          <div v-if="goal.contributions.length > 0" class="border-t border-border pt-2.5">
            <button
              type="button"
              class="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors"
              @click="expanded[goal.id] = !expanded[goal.id]"
            >
              <span>{{ goal.contributions.length }} movimentação(ões) registrada(s)</span>
              <ChevronUp v-if="expanded[goal.id]" class="h-3.5 w-3.5" />
              <ChevronDown v-else class="h-3.5 w-3.5" />
            </button>

            <ul v-if="expanded[goal.id]" class="mt-2 space-y-1.5 divide-y divide-border/50 text-xs">
              <li
                v-for="c in goal.contributions.slice(0, 6)"
                :key="c.id"
                class="flex items-center justify-between pt-1.5"
              >
                <div class="min-w-0">
                  <span class="text-muted-foreground mr-2 tabular-nums">{{ formatContributionDate(c.contributedAt) }}</span>
                  <span class="text-foreground truncate">{{ c.note || (c.amount > 0 ? 'Aporte' : 'Retirada') }}</span>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <strong
                    class="tabular-nums"
                    :class="c.amount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'"
                  >
                    {{ c.amount >= 0 ? '+' : '' }}{{ formatCurrency(c.amount) }}
                  </strong>
                  <button
                    type="button"
                    class="text-muted-foreground hover:text-destructive"
                    title="Desfazer registro"
                    @click="handleRemoveContribution(goal, c.id)"
                  >
                    <Trash2 class="h-3 w-3" />
                  </button>
                </div>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- ============================================================ -->
    <!-- BOTTOM DRAWER 1: CRIAR / EDITAR META + VINCULAR CDB -->
    <!-- ============================================================ -->
    <Sheet
      v-model:open="goalDrawerOpen"
      :title="editingGoalId ? 'Editar meta de poupança' : 'Nova meta de poupança'"
      description="Defina seu objetivo e conecte opcionalmente a um CDB ou conta para sincronizar o saldo automaticamente."
    >
      <form class="space-y-4" @submit.prevent="handleSaveGoal">
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-foreground">Nome da meta</label>
          <input
            v-model="formName"
            type="text"
            required
            placeholder="Ex: Reserva de Emergência, Viagem Japão, Reforma..."
            class="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-foreground">Valor alvo</label>
            <CurrencyInput
              v-model="formTarget"
              placeholder="20.000,00"
              required
            />
          </div>

          <div class="space-y-1.5">
            <label class="text-xs font-medium text-foreground">Prazo desejado (opcional)</label>
            <input
              v-model="formDate"
              type="date"
              class="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <!-- Conexão Direta com CDB / Conta -->
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-foreground">
            Conectar a um CDB / Reserva existente (recomendado)
          </label>
          <select
            v-model="formAccountId"
            class="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Sem vínculo (controlar aportes manualmente)</option>
            <option v-for="acc in vaultAccounts" :key="acc.id" :value="acc.id">
              {{ acc.name }} ({{ formatCurrency(acc.balance) }})
            </option>
          </select>
          <p class="text-[11px] text-muted-foreground">
            Ao conectar a um CDB, sempre que o saldo desse CDB subir pela Home ou pela aba CDBs, esta meta avança sozinha sem precisar lançar duas vezes.
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
            Compartilhar meta com meu par (Casal)
          </span>
          <span
            class="flex h-5 w-5 items-center justify-center rounded-full"
            :class="formShared ? 'bg-primary text-primary-foreground' : 'border border-muted-foreground/30'"
          >
            <Check v-if="formShared" class="h-3 w-3" />
          </span>
        </button>

        <div class="flex items-center justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" @click="goalDrawerOpen = false">
            Cancelar
          </Button>
          <Button type="submit" :disabled="savingGoal">
            {{ savingGoal ? 'Salvando...' : editingGoalId ? 'Salvar alterações' : 'Criar meta' }}
          </Button>
        </div>
      </form>
    </Sheet>

    <!-- ============================================================ -->
    <!-- BOTTOM DRAWER 2: GUARDAR OU RETIRAR NA META -->
    <!-- ============================================================ -->
    <Sheet
      v-model:open="moveDrawerOpen"
      :title="
        moveOperation === 'deposit'
          ? `Guardar em ${moveTargetGoal?.name ?? ''}`
          : `Retirar de ${moveTargetGoal?.name ?? ''}`
      "
      :description="
        moveTargetGoal?.linkedAccount
          ? `Conectada a ${moveTargetGoal.linkedAccount.name}: o saldo do CDB também será atualizado automaticamente.`
          : 'Informe o valor da movimentação nesta meta.'
      "
    >
      <form class="space-y-4" @submit.prevent="handleConfirmMove">
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
            <span>Guardar</span>
          </button>

          <button
            type="button"
            class="flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all"
            :class="
              moveOperation === 'withdraw'
                ? 'bg-foreground text-background shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            "
            @click="moveOperation = 'withdraw'"
          >
            <ArrowDownLeft class="h-4 w-4" />
            <span>Retirar</span>
          </button>
        </div>

        <div class="space-y-1.5">
          <label class="text-xs font-medium text-foreground">Valor</label>
          <CurrencyInput
            v-model="moveAmount"
            placeholder="500,00"
            required
          />
        </div>

        <!-- Se a meta não tem CDB fixo vinculado, oferece atualizar um CDB opcionalmente -->
        <div v-if="!moveTargetGoal?.accountId && vaultAccounts.length > 0" class="space-y-1.5">
          <label class="text-xs font-medium text-foreground">
            Atualizar também o saldo de algum CDB? (opcional)
          </label>
          <select
            v-model="moveExtraAccountId"
            class="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Apenas registrar na meta</option>
            <option v-for="acc in vaultAccounts" :key="acc.id" :value="acc.id">
              {{ acc.name }} ({{ formatCurrency(acc.balance) }})
            </option>
          </select>
        </div>

        <div v-else-if="moveTargetGoal?.linkedAccount" class="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
          <PiggyBank class="h-4 w-4 shrink-0" />
          <span>
            Saldo atual em <strong>{{ moveTargetGoal.linkedAccount.name }}</strong>:
            <strong class="tabular-nums">{{ formatCurrency(moveTargetGoal.linkedAccount.balance) }}</strong>
          </span>
        </div>

        <div class="space-y-1.5">
          <label class="text-xs font-medium text-foreground">Observação (opcional)</label>
          <input
            v-model="moveNote"
            type="text"
            placeholder="Ex: Aporte de Novembro, 13º salário..."
            class="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div class="flex items-center justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" @click="moveDrawerOpen = false">
            Cancelar
          </Button>
          <Button type="submit" :disabled="submittingMove">
            {{ submittingMove ? 'Salvando...' : moveOperation === 'deposit' ? 'Confirmar aporte' : 'Confirmar retirada' }}
          </Button>
        </div>
      </form>
    </Sheet>
  </div>
</template>
