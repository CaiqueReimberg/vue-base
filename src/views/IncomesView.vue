<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Sheet } from '@/components/ui/sheet'
import { CurrencyInput } from '@/components/ui/currency-input'
import ConfirmModal from '@/components/ConfirmModal.vue'
import IncomeEntrySheet from '@/components/incomes/IncomeEntrySheet.vue'
import { incomesApi } from '@/api/incomes.api'
import { dashboardApi, type MonthlyPlanResponse } from '@/api/dashboard.api'
import { useDashboardStore } from '@/stores/dashboard/dashboard.store'
import { useToastStore } from '@/stores/toast/toast.store'
import type { IncomeCategory, IncomeEntry, IncomeSourceSummary } from '@/types/income'
import {
  currentReferenceMonth,
  formatCurrency,
  formatPeriodLabel,
  shiftReferenceMonth,
} from '@/utils/month'
import {
  Briefcase,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Coins,
  Gift,
  HandCoins,
  Pencil,
  Plus,
  Repeat,
  ShoppingBag,
  Sparkles,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-vue-next'

const dashboardStore = useDashboardStore()
const toastStore = useToastStore()

const referenceMonth = ref(dashboardStore.referenceMonth || currentReferenceMonth())
const periodLabel = computed(() => formatPeriodLabel(referenceMonth.value))

const loading = ref(false)
const items = ref<IncomeEntry[]>([])
const bySource = ref<IncomeSourceSummary[]>([])
const recentSources = ref<string[]>([])
const fixedEntriesTotal = ref(0)
const variableEntriesTotal = ref(0)
const entriesTotal = ref(0)
const monthlyPlan = ref<MonthlyPlanResponse | null>(null)

const typeFilter = ref<'all' | 'variable' | 'fixed'>('all')
const sourceFilter = ref<string | null>(null)

const sheetOpen = ref(false)
const editingEntry = ref<IncomeEntry | null>(null)

// Edição rápida da renda base fixa do plano (caso a pessoa use o campo do plano)
const baseIncomeDrawerOpen = ref(false)
const baseIncomeInput = ref<number | ''>('')
const savingBaseIncome = ref(false)

// Confirmação de exclusão
const deleteTarget = ref<IncomeEntry | null>(null)
const deleting = ref(false)

const CATEGORY_META: Record<IncomeCategory, { label: string; icon: any }> = {
  freelance: { label: 'Freela / Serviço', icon: Briefcase },
  salary: { label: 'Salário / Fixo', icon: Building2 },
  client: { label: 'Cliente / Projeto', icon: HandCoins },
  commission: { label: 'Comissão', icon: TrendingUp },
  bonus: { label: 'Bônus / Extra', icon: Gift },
  sale: { label: 'Venda', icon: ShoppingBag },
  investment: { label: 'Rendimentos', icon: Coins },
  other: { label: 'Outro', icon: Sparkles },
}

const basePlanIncome = computed(() => monthlyPlan.value?.baseMonthlyIncome ?? 0)
const totalMonthIncome = computed(() => basePlanIncome.value + entriesTotal.value)
const totalFixedIncome = computed(() => basePlanIncome.value + fixedEntriesTotal.value)

const filteredItems = computed(() => {
  return items.value.filter((item) => {
    if (typeFilter.value === 'variable' && item.isRecurring) return false
    if (typeFilter.value === 'fixed' && !item.isRecurring) return false
    if (
      sourceFilter.value &&
      item.source.trim().toLowerCase() !== sourceFilter.value.toLowerCase()
    ) {
      return false
    }
    return true
  })
})

function formatShortDate(dateStr: string): string {
  if (!dateStr) return ''
  const parts = dateStr.slice(0, 10).split('-').map(Number)
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return dateStr
  const d = new Date(parts[0], parts[1] - 1, parts[2])
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

async function fetchData() {
  loading.value = true
  try {
    const [incRes, planRes] = await Promise.all([
      incomesApi.listByMonth(referenceMonth.value),
      dashboardApi.getMonthlyPlan(referenceMonth.value),
    ])
    items.value = incRes.items
    bySource.value = incRes.bySource
    recentSources.value = incRes.recentSources
    fixedEntriesTotal.value = incRes.fixedTotal
    variableEntriesTotal.value = incRes.variableTotal
    entriesTotal.value = incRes.total
    monthlyPlan.value = planRes
  } catch (e) {
    toastStore.error(e instanceof Error ? e.message : 'Erro ao carregar entradas do mês.')
  } finally {
    loading.value = false
  }
}

async function changeMonth(delta: number) {
  referenceMonth.value = shiftReferenceMonth(referenceMonth.value, delta)
  sourceFilter.value = null
  await fetchData()
}

function openCreate() {
  editingEntry.value = null
  sheetOpen.value = true
}

function openEdit(entry: IncomeEntry) {
  editingEntry.value = entry
  sheetOpen.value = true
}

async function handleSaved() {
  await fetchData()
  if (dashboardStore.referenceMonth === referenceMonth.value) {
    dashboardStore.fetchSummary(referenceMonth.value)
  }
}

function openBaseIncomeDrawer() {
  baseIncomeInput.value = basePlanIncome.value > 0 ? basePlanIncome.value : ''
  baseIncomeDrawerOpen.value = true
}

async function handleSaveBaseIncome() {
  const val = Number(baseIncomeInput.value) || 0
  if (val < 0) {
    toastStore.error('O valor não pode ser negativo.')
    return
  }
  savingBaseIncome.value = true
  try {
    await dashboardApi.saveMonthlyPlan({
      referenceMonth: referenceMonth.value,
      monthlyIncome: val,
    })
    baseIncomeDrawerOpen.value = false
    toastStore.success('Renda base atualizada!')
    await handleSaved()
  } catch (e) {
    toastStore.error(e instanceof Error ? e.message : 'Erro ao atualizar renda base.')
  } finally {
    savingBaseIncome.value = false
  }
}

function askDelete(entry: IncomeEntry) {
  deleteTarget.value = entry
}

async function confirmDelete() {
  const target = deleteTarget.value
  if (!target || deleting.value) return
  deleting.value = true
  try {
    const stopFrom =
      target.isRecurring && referenceMonth.value > target.referenceMonth
        ? referenceMonth.value
        : undefined
    const res = await incomesApi.remove(target.id, stopFrom)
    toastStore.success(
      res.stopped
        ? `Ganho fixo encerrado a partir de ${periodLabel.value}.`
        : 'Entrada removida com sucesso.',
    )
    deleteTarget.value = null
    await handleSaved()
  } catch (e) {
    toastStore.error(e instanceof Error ? e.message : 'Não foi possível remover a entrada.')
  } finally {
    deleting.value = false
  }
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <!-- Cabeçalho com seletor de mês e botão rápido -->
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
          <h1 class="text-base font-bold text-foreground leading-tight">Entradas do Mês</h1>
          <p class="text-xs text-muted-foreground">
            Acompanhe seus ganhos fixos, freelas e de onde veio cada valor
          </p>
        </div>
      </div>

      <Button size="sm" class="h-9 gap-1.5 px-3.5" @click="openCreate">
        <Plus class="h-4 w-4" />
        <span>Novo ganho</span>
      </Button>
    </header>

    <!-- Cards de Resumo da Renda no Mês -->
    <div v-if="loading && items.length === 0" class="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
      <Card v-for="n in 3" :key="n">
        <CardContent class="p-4 space-y-2">
          <Skeleton class="h-3.5 w-28" />
          <Skeleton class="h-7 w-36" />
          <Skeleton class="h-3 w-44" />
        </CardContent>
      </Card>
    </div>

    <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
      <!-- Card 1: Renda Total Composta no Mês -->
      <Card class="border-emerald-500/25 bg-emerald-500/5">
        <CardContent class="p-4">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-emerald-700 dark:text-emerald-300">
              Renda total em {{ periodLabel }}
            </span>
            <TrendingUp class="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div class="mt-2 text-2xl font-extrabold tracking-tight tabular-nums text-emerald-700 dark:text-emerald-300">
            {{ formatCurrency(totalMonthIncome) }}
          </div>
          <p class="mt-1 text-[11px] text-muted-foreground">
            {{ items.length }} {{ items.length === 1 ? 'entrada registrada' : 'entradas registradas' }}
            <template v-if="basePlanIncome > 0">
              + renda base
            </template>
          </p>
        </CardContent>
      </Card>

      <!-- Card 2: Ganhos Variáveis / Autônomo no Mês -->
      <Card>
        <CardContent class="p-4">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-muted-foreground">
              Variáveis & Autônomo
            </span>
            <Briefcase class="h-4 w-4 text-primary" />
          </div>
          <div class="mt-2 text-2xl font-bold tracking-tight tabular-nums text-foreground">
            {{ formatCurrency(variableEntriesTotal) }}
          </div>
          <p class="mt-1 text-[11px] text-muted-foreground">
            Entradas pontuais somadas neste mês
          </p>
        </CardContent>
      </Card>

      <!-- Card 3: Ganhos Fixos Mensais -->
      <Card>
        <CardContent class="p-4">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-muted-foreground">
              Fixos mensais
            </span>
            <Repeat class="h-4 w-4 text-muted-foreground" />
          </div>
          <div class="mt-2 text-2xl font-bold tracking-tight tabular-nums text-foreground">
            {{ formatCurrency(totalFixedIncome) }}
          </div>
          <div class="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span class="truncate">
              <template v-if="basePlanIncome > 0">
                Inclui {{ formatCurrency(basePlanIncome) }} de renda base
              </template>
              <template v-else>
                Salários e contratos recorrentes
              </template>
            </span>
            <button
              v-if="basePlanIncome > 0"
              type="button"
              class="shrink-0 font-medium text-primary hover:underline"
              @click="openBaseIncomeDrawer"
            >
              Ajustar base
            </button>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Origens do Mês ("De onde veio") -->
    <Card v-if="bySource.length > 0">
      <CardHeader class="pb-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle class="text-sm font-semibold">De onde veio sua renda em {{ periodLabel }}</CardTitle>
            <CardDescription class="text-xs">
              Toque em uma origem para filtrar os lançamentos abaixo
            </CardDescription>
          </div>
          <Button
            v-if="sourceFilter"
            variant="ghost"
            size="xs"
            class="gap-1 text-xs"
            @click="sourceFilter = null"
          >
            <X class="h-3 w-3" />
            <span>Limpar filtro ({{ sourceFilter }})</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          v-for="src in bySource"
          :key="src.source"
          type="button"
          class="rounded-xl border p-3 text-left transition-all"
          :class="
            sourceFilter?.toLowerCase() === src.source.toLowerCase()
              ? 'border-emerald-500 bg-emerald-500/10'
              : 'border-border bg-background hover:border-primary/40'
          "
          @click="
            sourceFilter =
              sourceFilter?.toLowerCase() === src.source.toLowerCase() ? null : src.source
          "
        >
          <div class="flex items-center justify-between gap-2 text-xs">
            <div class="flex items-center gap-2 min-w-0">
              <Building2 class="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span class="font-semibold text-foreground truncate">{{ src.source }}</span>
              <Badge variant="secondary" class="text-[10px] px-1.5 py-0 shrink-0">
                {{ src.count }}x
              </Badge>
            </div>
            <div class="shrink-0 text-right">
              <strong class="font-bold tabular-nums text-foreground">
                {{ formatCurrency(src.amount) }}
              </strong>
              <span class="ml-1.5 text-[11px] text-muted-foreground tabular-nums">
                ({{ src.share }}%)
              </span>
            </div>
          </div>

          <Progress
            :model-value="src.share"
            class="mt-2 h-1.5"
            indicator-class="bg-emerald-600 dark:bg-emerald-500"
          />
        </button>
      </CardContent>
    </Card>

    <!-- Aviso amigável caso exista Renda Base manual configurada no plano -->
    <div
      v-if="basePlanIncome > 0"
      class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-xs"
    >
      <div class="flex items-center gap-2 text-muted-foreground">
        <Sparkles class="h-4 w-4 shrink-0 text-primary" />
        <span>
          Você também tem uma <strong>renda base rápida</strong> de
          <strong class="tabular-nums text-foreground">{{ formatCurrency(basePlanIncome) }}</strong>
          configurada no orçamento. Se preferir controlar tudo pelas entradas detalhadas abaixo, basta zerar a renda base.
        </span>
      </div>
      <Button variant="outline" size="xs" @click="openBaseIncomeDrawer">
        Editar renda base
      </Button>
    </div>

    <!-- Lista de Entradas do Mês -->
    <Card>
      <CardHeader class="flex flex-col gap-3 border-b border-border py-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-center gap-2">
          <CardTitle class="text-sm font-semibold">Lançamentos de Entrada</CardTitle>
          <Badge variant="secondary">{{ filteredItems.length }}</Badge>
        </div>

        <div class="inline-flex items-center rounded-xl border border-border bg-muted/40 p-1 self-start sm:self-auto">
          <button
            type="button"
            class="rounded-lg px-2.5 py-1 text-xs font-medium transition-colors"
            :class="
              typeFilter === 'all'
                ? 'bg-background text-foreground font-semibold shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            "
            @click="typeFilter = 'all'"
          >
            Todas
          </button>
          <button
            type="button"
            class="rounded-lg px-2.5 py-1 text-xs font-medium transition-colors"
            :class="
              typeFilter === 'variable'
                ? 'bg-background text-foreground font-semibold shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            "
            @click="typeFilter = 'variable'"
          >
            Variáveis
          </button>
          <button
            type="button"
            class="rounded-lg px-2.5 py-1 text-xs font-medium transition-colors"
            :class="
              typeFilter === 'fixed'
                ? 'bg-background text-foreground font-semibold shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            "
            @click="typeFilter = 'fixed'"
          >
            Fixos
          </button>
        </div>
      </CardHeader>

      <CardContent class="p-0">
        <div
          v-if="!loading && filteredItems.length === 0"
          class="flex flex-col items-center justify-center px-4 py-14 text-center"
        >
          <div class="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <TrendingUp class="h-5 w-5" />
          </div>
          <p class="text-sm font-semibold text-foreground">
            Nenhuma entrada registrada neste filtro em {{ periodLabel }}
          </p>
          <p class="mt-1 max-w-md text-xs text-muted-foreground">
            Adicione seu salário fixo ou vá lançando cada freela, cliente, plantão ou venda conforme entrar para compor a renda do mês.
          </p>
          <Button size="sm" class="mt-4 gap-1.5" @click="openCreate">
            <Plus class="h-4 w-4" />
            <span>Registrar primeiro ganho</span>
          </Button>
        </div>

        <ul v-else class="divide-y divide-border" role="list">
          <li
            v-for="item in filteredItems"
            :key="item.id"
            class="group flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 sm:px-5"
          >
            <div class="flex min-w-0 items-center gap-3">
              <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <component
                  :is="CATEGORY_META[item.category]?.icon || TrendingUp"
                  class="h-4 w-4"
                />
              </div>

              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="truncate text-sm font-semibold text-foreground">
                    {{ item.title }}
                  </p>
                  <Badge
                    variant="outline"
                    class="gap-1 text-[10px] px-1.5 py-0 font-medium border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                  >
                    <Building2 class="h-2.5 w-2.5" />
                    {{ item.source }}
                  </Badge>
                  <Badge
                    v-if="item.isRecurring"
                    variant="secondary"
                    class="gap-1 text-[10px] px-1.5 py-0 font-normal"
                  >
                    <Repeat class="h-2.5 w-2.5" />
                    Fixo mensal
                  </Badge>
                </div>

                <p class="mt-0.5 text-[11px] text-muted-foreground">
                  {{ CATEGORY_META[item.category]?.label || 'Entrada' }}
                  · {{ formatShortDate(item.receivedAt) }}
                </p>
              </div>
            </div>

            <div class="flex shrink-0 items-center gap-2">
              <span class="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                + {{ formatCurrency(item.amount) }}
              </span>

              <button
                type="button"
                class="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Editar entrada"
                @click="openEdit(item)"
              >
                <Pencil class="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                class="rounded-md p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors"
                title="Remover entrada"
                @click="askDelete(item)"
              >
                <Trash2 class="h-3.5 w-3.5" />
              </button>
            </div>
          </li>
        </ul>
      </CardContent>
    </Card>

    <!-- Drawer de Criar / Editar Entrada -->
    <IncomeEntrySheet
      v-model:open="sheetOpen"
      :reference-month="referenceMonth"
      :period-label="periodLabel"
      :editing-entry="editingEntry"
      :recent-sources="recentSources"
      @saved="handleSaved"
    />

    <!-- Drawer para ajustar ou zerar Renda Base do plano -->
    <Sheet
      v-model:open="baseIncomeDrawerOpen"
      :title="`Renda base de ${periodLabel}`"
      description="Defina um valor base fixo rápido ou deixe em zero para compor sua renda somente pelas entradas detalhadas."
    >
      <form class="space-y-4" @submit.prevent="handleSaveBaseIncome">
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-foreground">Renda base rápida</label>
          <CurrencyInput
            v-model="baseIncomeInput"
            placeholder="0,00"
          />
          <p class="text-[11px] text-muted-foreground">
            Somada com as {{ items.length }} entradas registradas ({{ formatCurrency(entriesTotal) }}), sua renda total em {{ periodLabel }} ficará em
            <strong class="tabular-nums text-foreground">
              {{ formatCurrency((Number(baseIncomeInput) || 0) + entriesTotal) }}
            </strong>.
          </p>
        </div>

        <div class="flex items-center justify-between gap-2 border-t border-border pt-4">
          <Button
            v-if="basePlanIncome > 0"
            type="button"
            variant="ghost"
            class="text-xs text-red-500 hover:text-red-600"
            @click="baseIncomeInput = 0"
          >
            Zerar renda base
          </Button>
          <div class="ml-auto flex items-center gap-2">
            <Button type="button" variant="outline" @click="baseIncomeDrawerOpen = false">
              Cancelar
            </Button>
            <Button type="submit" :disabled="savingBaseIncome">
              {{ savingBaseIncome ? 'Salvando...' : 'Salvar' }}
            </Button>
          </div>
        </div>
      </form>
    </Sheet>

    <!-- Modal de Confirmação de Exclusão -->
    <ConfirmModal
      :open="Boolean(deleteTarget)"
      :title="
        deleteTarget?.isRecurring && referenceMonth > (deleteTarget?.referenceMonth || '')
          ? `Encerrar ganho fixo em ${periodLabel}?`
          : 'Remover esta entrada?'
      "
      :description="
        deleteTarget?.isRecurring && referenceMonth > (deleteTarget?.referenceMonth || '')
          ? `O ganho fixo de ${deleteTarget?.source} deixará de entrar a partir de ${periodLabel}, mantendo o histórico dos meses anteriores.`
          : `A entrada de ${deleteTarget?.source ?? ''} será removida da renda do mês.`
      "
      :confirm-label="
        deleteTarget?.isRecurring && referenceMonth > (deleteTarget?.referenceMonth || '')
          ? 'Encerrar ganho fixo'
          : 'Remover entrada'
      "
      variant="danger"
      @close="deleteTarget = null"
      @confirm="confirmDelete"
    />
  </div>
</template>
