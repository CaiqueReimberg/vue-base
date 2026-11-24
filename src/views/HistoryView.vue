<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { dashboardApi, type MonthlyHistoryEntry } from '@/api/dashboard.api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useDashboardStore } from '@/stores/dashboard/dashboard.store'
import { useToastStore } from '@/stores/toast/toast.store'
import { currentReferenceMonth, formatCurrency, formatPeriodLabel } from '@/utils/month'
import {
  ArrowUpRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  PiggyBank,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-vue-next'

const router = useRouter()
const dashboardStore = useDashboardStore()
const toastStore = useToastStore()

const periodMonths = ref<6 | 12>(6)
const entries = ref<MonthlyHistoryEntry[]>([])
const loading = ref(true)
const initialLoaded = ref(false)
const currentYm = currentReferenceMonth()

async function load() {
  loading.value = true
  try {
    const res = await dashboardApi.getHistory(periodMonths.value, currentYm)
    entries.value = res.months
  } catch (e) {
    toastStore.error(e instanceof Error ? e.message : 'Erro ao carregar histórico')
  } finally {
    loading.value = false
    initialLoaded.value = true
  }
}

onMounted(load)
watch(periodMonths, load)

// Filtra meses que tiveram qualquer atividade (renda, contas ou reserva)
const activeEntries = computed(() =>
  entries.value.filter(
    (e) => e.hasActivity || e.hasPlan || e.bills > 0 || e.income > 0 || e.saved > 0,
  ),
)

// Lista do mais recente para o mais antigo
const rowsDesc = computed(() => [...activeEntries.value].reverse())

const currentEntry = computed(
  () => entries.value.find((e) => e.month === currentYm) ?? entries.value[entries.value.length - 1] ?? null,
)

const previousEntry = computed(() => {
  if (entries.value.length < 2) return null
  const idx = entries.value.findIndex((e) => e.month === currentEntry.value?.month)
  return idx > 0 ? entries.value[idx - 1] : null
})

// Indicadores consolidados do período
const totalSavedInPeriod = computed(() =>
  activeEntries.value.reduce((sum, e) => sum + Number(e.saved || 0), 0),
)

const averageBillsInPeriod = computed(() => {
  const withBills = activeEntries.value.filter((e) => e.bills > 0)
  if (withBills.length === 0) return 0
  const total = withBills.reduce((sum, e) => sum + e.bills, 0)
  return total / withBills.length
})

const averageFreeInPeriod = computed(() => {
  const withIncome = activeEntries.value.filter((e) => e.income > 0)
  if (withIncome.length === 0) return 0
  const total = withIncome.reduce((sum, e) => sum + e.free, 0)
  return total / withIncome.length
})

const billsDeltaVsPrev = computed(() => {
  if (!currentEntry.value || !previousEntry.value || previousEntry.value.bills <= 0) return null
  return currentEntry.value.bills - previousEntry.value.bills
})

// Escala do gráfico de barras comparativo
const maxChartValue = computed(() => {
  let max = 1
  for (const e of entries.value) {
    const top = Math.max(
      e.income || 0,
      (e.bills || 0) + (e.savingsGoal || 0),
      Math.abs(e.free || 0),
    )
    if (top > max) max = top
  }
  return max
})

const hasNegativeMonth = computed(() =>
  entries.value.some((e) => (e.income > 0 || e.bills > 0) && e.free < 0),
)

function barHeightPercent(val: number): number {
  if (val <= 0 || maxChartValue.value <= 0) return 4
  return Math.max(8, Math.min(100, Math.round((val / maxChartValue.value) * 100)))
}

function surplusBarParts(e: MonthlyHistoryEntry) {
  const saved = Math.max(e.savingsGoal || 0, 0)
  const free = Math.max(e.free || 0, 0)
  const total = saved + free
  if (total <= 0) return { savedPct: 0, freePct: 0 }
  const savedPct = Math.round((saved / total) * 100)
  return { savedPct, freePct: Math.max(0, 100 - savedPct) }
}

function allocationShares(e: MonthlyHistoryEntry) {
  const base = Math.max(e.income, e.bills + e.savingsGoal, 1)
  const billsPct = Math.min(100, Math.round((e.bills / base) * 100))
  const savePct = Math.min(100 - billsPct, Math.round((e.savingsGoal / base) * 100))
  const freePct = Math.max(0, 100 - billsPct - savePct)
  return { billsPct, savePct, freePct }
}

function shortMonthLabel(ym: string): string {
  const label = formatPeriodLabel(ym)
  return label.split(' ')[0] || label
}

async function openMonthInDashboard(ym: string) {
  dashboardStore.referenceMonth = ym
  await router.push('/')
  dashboardStore.fetchSummary(ym)
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-6 sm:px-6 space-y-5">
    <!-- Cabeçalho com seletor 6M / 12M -->
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold tracking-tight text-foreground">
          Histórico Mensal
        </h1>
        <p class="mt-0.5 text-xs text-muted-foreground">
          Evolução das suas contas, reservas guardadas e saldo livre mês a mês.
        </p>
      </div>

      <div class="inline-flex items-center rounded-xl border border-border bg-card p-1">
        <button
          type="button"
          class="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
          :class="
            periodMonths === 6
              ? 'bg-secondary text-foreground font-semibold shadow-2xs'
              : 'text-muted-foreground hover:text-foreground'
          "
          @click="periodMonths = 6"
        >
          Últimos 6 meses
        </button>
        <button
          type="button"
          class="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
          :class="
            periodMonths === 12
              ? 'bg-secondary text-foreground font-semibold shadow-2xs'
              : 'text-muted-foreground hover:text-foreground'
          "
          @click="periodMonths = 12"
        >
          12 meses
        </button>
      </div>
    </header>

    <!-- Skeleton compacto -->
    <div v-if="!initialLoaded" class="space-y-4">
      <div class="grid grid-cols-3 gap-2.5 sm:gap-4">
        <Card v-for="n in 3" :key="n">
          <CardContent class="p-3 sm:p-5 space-y-1.5">
            <Skeleton class="h-3 w-16 sm:w-28" />
            <Skeleton class="h-5 sm:h-7 w-20 sm:w-32" />
            <Skeleton class="h-2.5 w-14 sm:w-24" />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardContent class="p-4 sm:p-5 space-y-3">
          <Skeleton class="h-4 w-40" />
          <Skeleton class="h-36 w-full rounded-xl" />
        </CardContent>
      </Card>
    </div>

    <!-- Empty State -->
    <Card v-else-if="activeEntries.length === 0" class="border-dashed">
      <CardContent class="flex flex-col items-center justify-center py-12 text-center">
        <div class="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <BarChart3 class="h-5 w-5" />
        </div>
        <h3 class="text-sm font-semibold text-foreground">
          Nenhum histórico registrado ainda
        </h3>
        <p class="mt-1 max-w-sm text-xs text-muted-foreground">
          Assim que você definir sua renda ou cadastrar contas nos meses, o comparativo aparecerá aqui.
        </p>
        <Button size="sm" class="mt-4" @click="router.push('/')">
          Ir para o Mês Atual
        </Button>
      </CardContent>
    </Card>

    <div
      v-else
      class="space-y-5 transition-opacity"
      :class="loading ? 'opacity-60' : ''"
    >
      <!-- 1. Cards de Resumo Consolidado do Período -->
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <!-- Total Guardado no Período -->
        <Card class="border-emerald-500/25 bg-emerald-500/5">
          <CardContent class="p-4 sm:p-5">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                Guardado no período
              </span>
              <PiggyBank class="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div class="mt-1.5 text-2xl font-extrabold tracking-tight tabular-nums text-emerald-700 dark:text-emerald-300">
              {{ formatCurrency(totalSavedInPeriod) }}
            </div>
            <p class="mt-1 text-[11px] text-muted-foreground">
              Soma das reservas confirmadas nos últimos {{ periodMonths }} meses
            </p>
          </CardContent>
        </Card>

        <!-- Média de Contas por Mês -->
        <Card>
          <CardContent class="p-4 sm:p-5">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-muted-foreground">
                Média de contas / mês
              </span>
              <Receipt class="h-4 w-4 text-primary" />
            </div>
            <div class="mt-1.5 text-2xl font-bold tracking-tight tabular-nums text-foreground">
              {{ formatCurrency(averageBillsInPeriod) }}
            </div>
            <p
              v-if="billsDeltaVsPrev !== null && previousEntry"
              class="mt-1 inline-flex items-center gap-1 text-[11px] tabular-nums"
              :class="
                billsDeltaVsPrev > 0
                  ? 'text-amber-600 dark:text-amber-400'
                  : billsDeltaVsPrev < 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-muted-foreground'
              "
            >
              <TrendingUp v-if="billsDeltaVsPrev > 0" class="h-3 w-3" />
              <TrendingDown v-else-if="billsDeltaVsPrev < 0" class="h-3 w-3" />
              <span>
                {{ billsDeltaVsPrev > 0 ? '+' : '' }}{{ formatCurrency(billsDeltaVsPrev) }} em contas vs {{ formatPeriodLabel(previousEntry.month) }}
              </span>
            </p>
            <p v-else class="mt-1 text-[11px] text-muted-foreground">
              Fixas, parcelas e faturas somadas
            </p>
          </CardContent>
        </Card>

        <!-- Média Livre pra Gastar -->
        <Card>
          <CardContent class="p-4 sm:p-5">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-muted-foreground">
                Média livre / mês
              </span>
              <Wallet class="h-4 w-4 text-primary" />
            </div>
            <div
              class="mt-1.5 text-2xl font-bold tracking-tight tabular-nums"
              :class="averageFreeInPeriod >= 0 ? 'text-foreground' : 'text-red-600 dark:text-red-400'"
            >
              {{ formatCurrency(averageFreeInPeriod) }}
            </div>
            <p class="mt-1 text-[11px] text-muted-foreground">
              Após pagar contas e separar a reserva
            </p>
          </CardContent>
        </Card>
      </div>

      <!-- 2. Gráfico Visual Comparativo Mês a Mês -->
      <Card>
        <CardHeader class="flex flex-col gap-3 border-b border-border py-3.5 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <CardTitle class="text-sm font-semibold">
              Comparativo Mês a Mês
            </CardTitle>
            <CardDescription class="text-xs">
              Toque em qualquer mês para abrir o planejamento completo dele
            </CardDescription>
          </div>

          <!-- Legenda sempre visível (mobile e desktop) com cores distintas -->
          <div
            class="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 rounded-lg border border-border/60 bg-muted/30 px-3 py-1.5 text-xs text-foreground"
            aria-label="Legenda do gráfico"
          >
            <span class="inline-flex items-center gap-1.5">
              <span class="h-2.5 w-2.5 shrink-0 rounded-xs bg-amber-500" />
              <span>Contas</span>
            </span>
            <span class="inline-flex items-center gap-1.5">
              <span class="h-2.5 w-2.5 shrink-0 rounded-xs bg-sky-500" />
              <span>Reserva</span>
            </span>
            <span class="inline-flex items-center gap-1.5">
              <span class="h-2.5 w-2.5 shrink-0 rounded-xs bg-emerald-500" />
              <span>Saldo livre</span>
            </span>
            <span v-if="hasNegativeMonth" class="inline-flex items-center gap-1.5">
              <span class="h-2.5 w-2.5 shrink-0 rounded-xs bg-red-500" />
              <span>Acima da renda</span>
            </span>
          </div>
        </CardHeader>

        <CardContent class="p-4 sm:p-5">
          <div
            class="grid gap-2 sm:gap-3 items-end pt-2"
            :class="periodMonths === 12 ? 'grid-cols-6 sm:grid-cols-12' : 'grid-cols-6'"
          >
            <button
              v-for="e in entries"
              :key="e.month"
              type="button"
              class="group flex flex-col items-center gap-2 rounded-xl p-1.5 transition-colors hover:bg-muted/50"
              :class="e.month === currentYm ? 'bg-primary/5 ring-1 ring-primary/30' : ''"
              :title="`Abrir ${formatPeriodLabel(e.month)}`"
              @click="openMonthInDashboard(e.month)"
            >
              <!-- Valor das Contas no topo da barra -->
              <span
                class="text-[10px] font-semibold tabular-nums truncate max-w-full transition-colors"
                :class="
                  e.bills > 0
                    ? 'text-amber-600 dark:text-amber-400 group-hover:text-amber-500'
                    : 'text-muted-foreground'
                "
              >
                {{ e.bills > 0 ? formatCurrency(e.bills) : 'R$ 0' }}
              </span>

              <!-- Barras verticais (Contas vs Reserva + Saldo livre) -->
              <div class="flex h-28 w-full items-end justify-center gap-1 px-1">
                <!-- Barra 1: Contas -->
                <div
                  class="w-3 sm:w-4 rounded-t-md transition-all"
                  :class="e.bills > 0 ? 'bg-amber-500/90 group-hover:bg-amber-500' : 'bg-muted'"
                  :style="{ height: `${barHeightPercent(e.bills)}%` }"
                  :title="`Contas: ${formatCurrency(e.bills)}`"
                />

                <!-- Barra 2: Reserva (azul) + Saldo Livre (verde), ou Acima da renda (vermelho) -->
                <div
                  v-if="e.income > 0 && e.free < 0"
                  class="w-3 sm:w-4 rounded-t-md bg-red-500/85 group-hover:bg-red-500 transition-all"
                  :style="{ height: `${barHeightPercent(Math.abs(e.free))}%` }"
                  :title="`Acima da renda: ${formatCurrency(e.free)}`"
                />
                <div
                  v-else-if="e.income > 0 || e.savingsGoal > 0"
                  class="flex w-3 sm:w-4 flex-col justify-end overflow-hidden rounded-t-md transition-all"
                  :style="{ height: `${barHeightPercent(Math.max(e.free, 0) + Math.max(e.savingsGoal, 0))}%` }"
                  :title="`Reserva: ${formatCurrency(e.savingsGoal)} · Saldo livre: ${formatCurrency(Math.max(e.free, 0))}`"
                >
                  <div
                    v-if="e.free > 0"
                    class="w-full bg-emerald-500/90 group-hover:bg-emerald-500 transition-all"
                    :style="{ height: `${surplusBarParts(e).freePct}%` }"
                  />
                  <div
                    v-if="e.savingsGoal > 0"
                    class="w-full bg-sky-500/90 group-hover:bg-sky-500 transition-all"
                    :style="{ height: `${surplusBarParts(e).savedPct}%` }"
                  />
                </div>
              </div>

              <!-- Rótulo do Mês -->
              <div class="flex flex-col items-center leading-tight">
                <span
                  class="text-xs font-semibold"
                  :class="e.month === currentYm ? 'text-primary' : 'text-foreground'"
                >
                  {{ shortMonthLabel(e.month) }}
                </span>
                <span class="text-[10px] text-muted-foreground">
                  {{ e.month.slice(0, 4) }}
                </span>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      <!-- 3. Lista Detalhada de Cada Mês -->
      <Card class="overflow-hidden">
        <CardHeader class="flex flex-row items-center justify-between border-b border-border py-3.5 px-5">
          <div class="flex items-center gap-2">
            <Calendar class="h-4 w-4 text-primary" />
            <CardTitle class="text-sm font-semibold">
              Detalhamento por Mês
            </CardTitle>
            <Badge variant="secondary">{{ rowsDesc.length }}</Badge>
          </div>
          <span class="text-xs text-muted-foreground">
            Clique em um mês para abrir
          </span>
        </CardHeader>

        <CardContent class="p-0">
          <ul class="divide-y divide-border" role="list">
            <li
              v-for="e in rowsDesc"
              :key="e.month"
              class="group cursor-pointer px-4 py-4 transition-colors hover:bg-muted/30 sm:px-5"
              @click="openMonthInDashboard(e.month)"
            >
              <!-- Linha 1: Nome do Mês + Badges + Saldo Livre -->
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                    {{ formatPeriodLabel(e.month) }}
                  </span>

                  <Badge
                    v-if="e.month === currentYm"
                    variant="default"
                    class="text-[10px] px-1.5 py-0"
                  >
                    Mês atual
                  </Badge>

                  <Badge
                    v-if="e.savingsPaid && e.savingsGoal > 0"
                    variant="success"
                    class="gap-1 text-[10px] px-1.5 py-0"
                  >
                    <CheckCircle2 class="h-2.5 w-2.5" />
                    Reserva guardada
                  </Badge>

                  <Badge
                    v-else-if="e.bills > 0 && (e.billsPending ?? 0) === 0"
                    variant="secondary"
                    class="text-[10px] px-1.5 py-0"
                  >
                    Contas quitadas
                  </Badge>
                </div>

                <div class="flex items-center gap-2">
                  <div class="text-right inline-flex items-center gap-1.5">
                    <span
                      class="h-2 w-2 rounded-full shrink-0"
                      :class="e.free < 0 ? 'bg-red-500' : 'bg-emerald-500'"
                    />
                    <span class="text-[11px] text-muted-foreground">Livre:</span>
                    <strong
                      class="text-sm font-bold tabular-nums"
                      :class="
                        e.free < 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      "
                    >
                      {{ formatCurrency(e.free) }}
                    </strong>
                  </div>
                  <ArrowUpRight class="h-4 w-4 text-muted-foreground opacity-60 group-hover:opacity-100 group-hover:text-primary transition-all" />
                </div>
              </div>

              <!-- Linha 2: Barra de Distribuição da Renda (Contas / Reserva / Livre) -->
              <div
                v-if="e.income > 0 || e.bills > 0"
                class="mt-2.5 flex h-2 w-full overflow-hidden rounded-full bg-secondary"
              >
                <div
                  class="bg-amber-500 transition-all"
                  :style="{ width: `${allocationShares(e).billsPct}%` }"
                  :title="`Contas: ${allocationShares(e).billsPct}%`"
                />
                <div
                  class="bg-sky-500 transition-all"
                  :style="{ width: `${allocationShares(e).savePct}%` }"
                  :title="`Reserva: ${allocationShares(e).savePct}%`"
                />
                <div
                  class="bg-emerald-500 transition-all"
                  :style="{ width: `${allocationShares(e).freePct}%` }"
                  :title="`Saldo livre: ${allocationShares(e).freePct}%`"
                />
              </div>

              <!-- Linha 3: Métricas Detalhadas do Mês -->
              <div class="mt-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span class="whitespace-nowrap">
                    Renda: <strong class="tabular-nums text-foreground">{{ formatCurrency(e.income) }}</strong>
                  </span>
                  <span class="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <span class="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                    <span>
                      Contas: <strong class="tabular-nums text-foreground">{{ formatCurrency(e.bills) }}</strong>
                      <span v-if="(e.recurringTotal ?? 0) > 0 || (e.debtsTotal ?? 0) > 0" class="text-[11px] text-muted-foreground">
                        ({{ (e.recurringTotal ?? 0) > 0 ? `Fixas ${formatCurrency(e.recurringTotal ?? 0)}` : '' }}{{ (e.recurringTotal ?? 0) > 0 && (e.debtsTotal ?? 0) > 0 ? ' · ' : '' }}{{ (e.debtsTotal ?? 0) > 0 ? `Parcelas ${formatCurrency(e.debtsTotal ?? 0)}` : '' }})
                      </span>
                    </span>
                  </span>
                  <span v-if="e.savingsGoal > 0" class="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <span class="h-2 w-2 rounded-full bg-sky-500 shrink-0" />
                    <span>
                      Reserva: <strong class="tabular-nums text-sky-600 dark:text-sky-400">{{ formatCurrency(e.savingsGoal) }}</strong>
                    </span>
                  </span>
                </div>

                <span
                  v-if="e.bills > 0"
                  class="text-[11px] tabular-nums"
                  :class="(e.billsPending ?? 0) === 0 ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-muted-foreground'"
                >
                  {{
                    (e.billsPending ?? 0) === 0
                      ? '100% pago'
                      : `Pago ${formatCurrency(e.billsPaid ?? 0)} · Falta ${formatCurrency(e.billsPending ?? 0)}`
                  }}
                </span>
              </div>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
