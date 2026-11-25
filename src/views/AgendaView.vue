<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { dashboardApi } from '@/api/dashboard.api'
import { recurringApi } from '@/api/recurring.api'
import { transactionsApi } from '@/api/transactions.api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Progress } from '@/components/ui/progress'
import { Sheet } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/stores/auth/auth.store'
import { useToastStore } from '@/stores/toast/toast.store'
import type { AgendaEvent } from '@/types/dashboard-commitment'
import { payerBadgeLabel, personShortName } from '@/utils/owner'
import {
  currentReferenceMonth,
  formatCurrency,
  formatPeriodLabel,
  shiftReferenceMonth,
} from '@/utils/month'
import {
  AlertCircle,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Pencil,
  Repeat,
  Scale,
  Users,
} from 'lucide-vue-next'

const router = useRouter()
const authStore = useAuthStore()
const toastStore = useToastStore()

const hasPartner = computed(() => Boolean(authStore.profile?.partner))
const myShortName = computed(() => personShortName(authStore.profile) || 'Você')
const partnerShortName = computed(() => personShortName(authStore.profile?.partner) || 'Par')

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const referenceMonth = ref(currentReferenceMonth())
const events = ref<AgendaEvent[]>([])
const loading = ref(true)
const statusFilter = ref<'all' | 'pending' | 'paid'>('all')
const togglingKey = ref<string | null>(null)

const now = new Date()
const currentYm = currentReferenceMonth()
const todayDay = now.getDate()

const isViewingCurrentMonth = computed(() => referenceMonth.value === currentYm)

const isPastMonth = computed(() => referenceMonth.value < currentYm)

const periodText = computed(() => formatPeriodLabel(referenceMonth.value))

function weekdayLabelForDay(day: number): string {
  const [y, m] = referenceMonth.value.split('-').map(Number)
  if (!y || !m) return ''
  const maxDay = new Date(y, m, 0).getDate()
  const safeDay = Math.min(Math.max(day, 1), maxDay)
  const d = new Date(y, m - 1, safeDay)
  return WEEKDAYS[d.getDay()] || ''
}

type DayStatusTone = 'overdue' | 'today' | 'urgent' | 'upcoming' | 'paid'

function getDayStatus(day: number, allPaid: boolean): { tone: DayStatusTone; label: string } {
  if (allPaid) {
    return { tone: 'paid', label: 'Quitado' }
  }
  if (isPastMonth.value) {
    return { tone: 'overdue', label: 'Mês anterior em aberto' }
  }
  if (!isViewingCurrentMonth.value) {
    return { tone: 'upcoming', label: 'Programado' }
  }
  const diff = day - todayDay
  if (diff < 0) {
    const d = Math.abs(diff)
    return { tone: 'overdue', label: d === 1 ? 'Atrasado há 1 dia' : `Atrasado há ${d} dias` }
  }
  if (diff === 0) {
    return { tone: 'today', label: 'Vence hoje' }
  }
  if (diff <= 5) {
    return { tone: 'urgent', label: diff === 1 ? 'Vence amanhã' : `Em ${diff} dias` }
  }
  return { tone: 'upcoming', label: `Faltam ${diff} dias` }
}

function isEventOverdue(ev: AgendaEvent): boolean {
  if (ev.paid || ev.type === 'invoice_close') return false
  if (isPastMonth.value) return true
  if (!isViewingCurrentMonth.value) return false
  return ev.day != null && ev.day < todayDay
}

// Eventos que possuem valor financeiro a pagar (exclui fechamento informativo de fatura)
const payableEvents = computed(() =>
  events.value.filter((e) => e.type !== 'invoice_close' && (e.value ?? 0) > 0),
)

const totalMonthAmount = computed(() =>
  payableEvents.value.reduce((s, e) => s + Number(e.value || 0), 0),
)

const paidMonthAmount = computed(() =>
  payableEvents.value.filter((e) => e.paid).reduce((s, e) => s + Number(e.value || 0), 0),
)

const pendingMonthAmount = computed(() =>
  payableEvents.value.filter((e) => !e.paid).reduce((s, e) => s + Number(e.value || 0), 0),
)

const overdueEvents = computed(() => payableEvents.value.filter((e) => isEventOverdue(e)))
const overdueAmount = computed(() =>
  overdueEvents.value.reduce((s, e) => s + Number(e.value || 0), 0),
)

const paidCount = computed(() => payableEvents.value.filter((e) => e.paid).length)
const pendingCount = computed(() => payableEvents.value.filter((e) => !e.paid).length)

const progressPercent = computed(() => {
  if (totalMonthAmount.value <= 0) return 0
  return Math.round((paidMonthAmount.value / totalMonthAmount.value) * 100)
})

// Próximo vencimento pendente
const nextPendingEvent = computed(() => {
  const pendingWithDay = payableEvents.value
    .filter((e) => !e.paid && e.day != null)
    .sort((a, b) => (a.day ?? 99) - (b.day ?? 99))

  if (pendingWithDay.length === 0) return null
  if (isViewingCurrentMonth.value) {
    return pendingWithDay.find((e) => (e.day ?? 0) >= todayDay) ?? pendingWithDay[0]
  }
  return pendingWithDay[0]
})

// Aplicação do filtro (Todas | Pendentes | Pagas)
const filteredEvents = computed(() => {
  if (statusFilter.value === 'pending') {
    return events.value.filter((e) => !e.paid)
  }
  if (statusFilter.value === 'paid') {
    return events.value.filter((e) => e.paid)
  }
  return events.value
})

interface TimelineRow {
  kind: 'day' | 'today_divider'
  day: number
  events: AgendaEvent[]
}

// Linha do tempo com dias ordenados + separador explícito de "HOJE" quando estamos no mês atual
const timelineRows = computed<TimelineRow[]>(() => {
  const map = new Map<number, AgendaEvent[]>()
  for (const ev of filteredEvents.value) {
    if (ev.day == null) continue
    const list = map.get(ev.day) ?? []
    list.push(ev)
    map.set(ev.day, list)
  }

  const dayEntries = Array.from(map.entries()).sort(([a], [b]) => a - b)
  const rows: TimelineRow[] = []
  let insertedToday = false

  for (const [day, dayEvents] of dayEntries) {
    if (isViewingCurrentMonth.value && !insertedToday && day > todayDay) {
      rows.push({ kind: 'today_divider', day: todayDay, events: [] })
      insertedToday = true
    }
    if (isViewingCurrentMonth.value && day === todayDay) {
      insertedToday = true
    }
    rows.push({ kind: 'day', day, events: dayEvents })
  }

  if (isViewingCurrentMonth.value && !insertedToday && dayEntries.length > 0) {
    rows.push({ kind: 'today_divider', day: todayDay, events: [] })
  }

  return rows
})

// Contas sem dia fixo cadastrado
const undatedEvents = computed(() => filteredEvents.value.filter((e) => e.day == null))

function eventKey(ev: AgendaEvent): string {
  return `${ev.type}:${ev.referenceId}:${ev.day ?? 'none'}`
}

function getEventIcon(ev: AgendaEvent) {
  if (ev.type === 'debt_due') return Scale
  if (ev.type === 'bill_due') return Repeat
  return CreditCard
}

async function loadMonth(ym: string) {
  loading.value = true
  referenceMonth.value = ym
  try {
    const res = await dashboardApi.getAgenda(ym)
    referenceMonth.value = res.month
    events.value = res.events
  } catch (e) {
    toastStore.error(e instanceof Error ? e.message : 'Erro ao carregar agenda')
  } finally {
    loading.value = false
  }
}

// Bottom Drawer para confirmar valor ao pagar ou ajustar valor só do mês
const payDrawerOpen = ref(false)
const payDrawerMode = ref<'pay' | 'edit'>('pay')
const selectedEvent = ref<AgendaEvent | null>(null)
const selectedEventAmount = ref<number | ''>('')
const selectedPayerUserId = ref<string>('')
const savingEventAction = ref(false)

function openPayDrawer(ev: AgendaEvent, mode: 'pay' | 'edit') {
  selectedEvent.value = ev
  selectedEventAmount.value = ev.value ?? ''
  selectedPayerUserId.value = authStore.currentUserId || ''
  payDrawerMode.value = mode
  payDrawerOpen.value = true
}

async function submitPayDrawer(alsoPay = false) {
  const ev = selectedEvent.value
  if (!ev) return

  const numAmount = Number(selectedEventAmount.value)
  if (!Number.isFinite(numAmount) || numAmount <= 0) {
    toastStore.error('Informe um valor válido maior que zero.')
    return
  }

  savingEventAction.value = true
  try {
    const shouldMarkPaid = payDrawerMode.value === 'pay' || alsoPay
    const payerId = ev.isShared && selectedPayerUserId.value ? selectedPayerUserId.value : undefined

    if (ev.type === 'bill_due') {
      if (shouldMarkPaid) {
        const res = await recurringApi.markAsPaid(
          ev.referenceId,
          referenceMonth.value,
          numAmount,
          payerId,
        )
        ev.paidBy = res.paidBy ?? null
      } else {
        await recurringApi.setMonthAmount(ev.referenceId, referenceMonth.value, numAmount)
      }
    } else if (ev.type === 'debt_due') {
      if (shouldMarkPaid) {
        const updated = await transactionsApi.update(ev.referenceId, {
          status: 'cleared',
          paidAt: new Date().toISOString(),
          paidByUserId: payerId,
          paymentMonth: referenceMonth.value,
          amount: numAmount,
        })
        ev.paidBy = updated.paidBy ?? null
      } else {
        await transactionsApi.update(ev.referenceId, {
          amount: numAmount,
        })
      }
    }

    ev.value = numAmount
    if (shouldMarkPaid) {
      ev.paid = true
      toastStore.success(`${ev.name} marcado como pago (${formatCurrency(numAmount)})!`)
    } else {
      toastStore.success(
        `Valor de ${ev.name} em ${periodText.value} ajustado para ${formatCurrency(numAmount)}!`,
      )
    }

    payDrawerOpen.value = false
  } catch (e) {
    toastStore.error(e instanceof Error ? e.message : 'Erro ao salvar valor do pagamento.')
  } finally {
    savingEventAction.value = false
  }
}

async function toggleEventPaid(ev: AgendaEvent) {
  const key = eventKey(ev)
  if (togglingKey.value) return

  if (ev.type === 'invoice_due' || ev.type === 'invoice_close') {
    router.push('/invoices')
    return
  }

  // Se ainda não está pago, abre o Bottom Drawer para confirmar o valor igual às outras telas
  if (!ev.paid) {
    openPayDrawer(ev, 'pay')
    return
  }

  togglingKey.value = key
  try {
    if (ev.type === 'bill_due') {
      await recurringApi.unmarkAsPaid(ev.referenceId, referenceMonth.value)
    } else if (ev.type === 'debt_due') {
      await transactionsApi.update(ev.referenceId, {
        status: 'pending',
        paidAt: undefined,
        paymentMonth: referenceMonth.value,
      })
    }

    ev.paid = false
    toastStore.success(`${ev.name} voltou para pendente.`)
  } catch (e) {
    toastStore.error(e instanceof Error ? e.message : 'Erro ao atualizar pagamento.')
  } finally {
    togglingKey.value = null
  }
}

onMounted(() => loadMonth(currentReferenceMonth()))
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-6 sm:px-6 space-y-5">
    <!-- Cabeçalho Minimalista com Navegação de Mês -->
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold tracking-tight text-foreground">
          Agenda de Vencimentos
        </h1>
        <p class="mt-0.5 text-xs text-muted-foreground">
          Linha do tempo de todas as contas fixas e parcelas do mês por data de vencimento.
        </p>
      </div>

      <div class="inline-flex items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-2xs">
        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8 rounded-lg"
          aria-label="Mês anterior"
          @click="loadMonth(shiftReferenceMonth(referenceMonth, -1))"
        >
          <ChevronLeft class="h-4 w-4" />
        </Button>

        <button
          type="button"
          class="inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1 text-sm font-bold tracking-tight text-foreground hover:text-primary transition-colors"
          title="Voltar para o mês atual"
          @click="loadMonth(currentReferenceMonth())"
        >
          <Calendar class="h-3.5 w-3.5 shrink-0 text-primary" />
          <span>{{ periodText }}</span>
        </button>

        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8 rounded-lg"
          aria-label="Próximo mês"
          @click="loadMonth(shiftReferenceMonth(referenceMonth, 1))"
        >
          <ChevronRight class="h-4 w-4" />
        </Button>
      </div>
    </header>

    <!-- Resumo da Agenda no Topo -->
    <Card>
      <CardContent class="p-4 sm:p-5 space-y-3.5">
        <template v-if="loading && events.length === 0">
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
            <!-- Bloco 1: Falta pagar -->
            <div>
              <span class="text-xs font-medium text-muted-foreground">
                Falta pagar na agenda
              </span>
              <div class="mt-1 text-2xl font-bold tracking-tight tabular-nums text-foreground">
                {{ formatCurrency(pendingMonthAmount) }}
              </div>
              <span
                v-if="overdueEvents.length > 0"
                class="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400"
              >
                <AlertCircle class="h-3 w-3" />
                {{ overdueEvents.length }} {{ overdueEvents.length === 1 ? 'vencimento em atraso' : 'vencimentos em atraso' }} ({{ formatCurrency(overdueAmount) }})
              </span>
              <span v-else class="text-xs text-muted-foreground">
                {{ pendingCount }} {{ pendingCount === 1 ? 'conta pendente' : 'contas pendentes' }}
              </span>
            </div>

            <!-- Bloco 2: Próximo vencimento -->
            <div class="sm:pl-6">
              <span class="text-xs font-medium text-muted-foreground">
                Próximo compromisso
              </span>
              <template v-if="nextPendingEvent">
                <div class="mt-1 text-base font-bold text-foreground truncate">
                  {{ nextPendingEvent.name }}
                </div>
                <span class="text-xs text-muted-foreground tabular-nums">
                  Dia {{ nextPendingEvent.day }} ({{ weekdayLabelForDay(nextPendingEvent.day!) }}) · {{ formatCurrency(nextPendingEvent.value ?? 0) }}
                </span>
              </template>
              <template v-else>
                <div class="mt-1 text-base font-bold text-emerald-600 dark:text-emerald-400">
                  Tudo em dia!
                </div>
                <span class="text-xs text-muted-foreground">
                  Nenhum vencimento pendente
                </span>
              </template>
            </div>

            <!-- Bloco 3: Já quitado -->
            <div class="sm:pl-6">
              <span class="text-xs font-medium text-muted-foreground">
                Já pago em {{ periodText }}
              </span>
              <div class="mt-1 text-2xl font-bold tracking-tight tabular-nums text-emerald-600 dark:text-emerald-400">
                {{ formatCurrency(paidMonthAmount) }}
              </div>
              <span class="text-xs text-muted-foreground">
                {{ paidCount }} de {{ payableEvents.length }} quitados ({{ progressPercent }}%)
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

    <!-- Filtros rápidos -->
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="inline-flex items-center rounded-xl border border-border bg-card p-1">
        <button
          type="button"
          class="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
          :class="
            statusFilter === 'all'
              ? 'bg-secondary text-foreground font-semibold shadow-2xs'
              : 'text-muted-foreground hover:text-foreground'
          "
          @click="statusFilter = 'all'"
        >
          Todas ({{ events.length }})
        </button>
        <button
          type="button"
          class="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
          :class="
            statusFilter === 'pending'
              ? 'bg-secondary text-foreground font-semibold shadow-2xs'
              : 'text-muted-foreground hover:text-foreground'
          "
          @click="statusFilter = 'pending'"
        >
          Pendentes ({{ pendingCount }})
        </button>
        <button
          type="button"
          class="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
          :class="
            statusFilter === 'paid'
              ? 'bg-secondary text-foreground font-semibold shadow-2xs'
              : 'text-muted-foreground hover:text-foreground'
          "
          @click="statusFilter = 'paid'"
        >
          Pagas ({{ paidCount }})
        </button>
      </div>

      <span v-if="isViewingCurrentMonth" class="text-xs text-muted-foreground">
        Hoje é dia <strong class="text-foreground">{{ todayDay }}</strong> ({{ weekdayLabelForDay(todayDay) }})
      </span>
    </div>

    <!-- Skeleton da Linha do Tempo -->
    <div v-if="loading && events.length === 0" class="space-y-3">
      <Card v-for="n in 3" :key="n">
        <CardContent class="p-4 flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <Skeleton class="h-10 w-10 rounded-xl" />
            <div class="space-y-1.5">
              <Skeleton class="h-3.5 w-32" />
              <Skeleton class="h-2.5 w-20" />
            </div>
          </div>
          <Skeleton class="h-7 w-16 rounded-lg" />
        </CardContent>
      </Card>
    </div>

    <!-- Empty State -->
    <Card
      v-else-if="timelineRows.length === 0 && undatedEvents.length === 0"
      class="border-dashed"
    >
      <CardContent class="flex flex-col items-center justify-center py-12 text-center">
        <div class="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CalendarDays class="h-5 w-5" />
        </div>
        <h3 class="text-sm font-semibold text-foreground">
          {{
            statusFilter === 'pending'
              ? 'Nenhuma conta pendente neste mês!'
              : statusFilter === 'paid'
                ? 'Nenhuma conta paga registrada ainda'
                : 'Nenhum vencimento programado neste mês'
          }}
        </h3>
        <p class="mt-1 max-w-sm text-xs text-muted-foreground">
          Contas fixas e financiamentos com dia de vencimento aparecem automaticamente aqui em ordem cronológica.
        </p>
      </CardContent>
    </Card>

    <!-- LINHA DO TEMPO CRONOLÓGICA CLARA -->
    <div v-else class="space-y-4">
      <ol v-if="timelineRows.length > 0" class="relative ml-4 border-l-2 border-border pl-6 space-y-5" role="list">
        <template v-for="row in timelineRows" :key="`${row.kind}-${row.day}`">
          <!-- Separador explícito de HOJE quando hoje não tem conta, mas divide passado e futuro -->
          <li v-if="row.kind === 'today_divider'" class="relative py-1">
            <span
              class="absolute -left-[31px] top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full bg-primary ring-4 ring-primary/20"
            />
            <div class="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <span>Hoje · Dia {{ row.day }} ({{ weekdayLabelForDay(row.day) }})</span>
            </div>
          </li>

          <!-- Grupo de Vencimentos de um Dia -->
          <li v-else class="relative space-y-2.5">
            <!-- Bolinha do Dia na Linha do Tempo -->
            <div
              class="absolute -left-[39px] top-0 flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold tabular-nums shadow-2xs"
              :class="
                row.events.every((e) => e.paid)
                  ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  : getDayStatus(row.day, false).tone === 'overdue'
                    ? 'border-red-500 bg-red-500/15 text-red-600 dark:text-red-400'
                    : getDayStatus(row.day, false).tone === 'today' || getDayStatus(row.day, false).tone === 'urgent'
                      ? 'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                      : 'border-border bg-card text-foreground'
              "
            >
              {{ row.day }}
            </div>

            <!-- Cabeçalho do Dia: Dia da Semana + Status explícito -->
            <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div class="flex items-center gap-2">
                <span class="text-sm font-bold text-foreground">
                  Dia {{ row.day }} · {{ weekdayLabelForDay(row.day) }}
                </span>

                <Badge
                  v-if="isViewingCurrentMonth && row.day === todayDay"
                  variant="default"
                  class="text-[10px] px-1.5 py-0"
                >
                  Hoje
                </Badge>

                <Badge
                  :variant="
                    row.events.every((e) => e.paid)
                      ? 'success'
                      : getDayStatus(row.day, false).tone === 'overdue'
                        ? 'destructive'
                        : getDayStatus(row.day, false).tone === 'today' || getDayStatus(row.day, false).tone === 'urgent'
                          ? 'warning'
                          : 'secondary'
                  "
                  class="text-[10px] px-2 py-0 font-medium"
                >
                  {{ getDayStatus(row.day, row.events.every((e) => e.paid)).label }}
                </Badge>
              </div>

              <span
                v-if="row.events.length > 1"
                class="text-xs font-medium tabular-nums text-muted-foreground"
              >
                Soma do dia: {{ formatCurrency(row.events.reduce((s, e) => s + Number(e.value || 0), 0)) }}
              </span>
            </div>

            <!-- Cards das Contas daquele Dia -->
            <div class="space-y-2">
              <Card
                v-for="ev in row.events"
                :key="eventKey(ev)"
                class="transition-colors"
                :class="
                  ev.paid
                    ? 'opacity-75 bg-muted/20'
                    : isEventOverdue(ev)
                      ? 'border-red-500/35'
                      : ''
                "
              >
                <CardContent class="flex flex-col justify-between gap-3 p-3.5 sm:flex-row sm:items-center sm:px-4">
                  <div class="flex items-center gap-3 min-w-0">
                    <div
                      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border"
                      :class="
                        ev.paid
                          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : isEventOverdue(ev)
                            ? 'border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400'
                            : 'border-primary/20 bg-primary/10 text-primary'
                      "
                    >
                      <component :is="getEventIcon(ev)" class="h-4 w-4" />
                    </div>

                    <div class="min-w-0">
                      <div class="flex flex-wrap items-center gap-1.5">
                        <span
                          class="text-sm font-semibold truncate"
                          :class="ev.paid ? 'line-through text-muted-foreground' : 'text-foreground'"
                        >
                          {{ ev.name }}
                        </span>

                        <Badge
                          v-if="ev.isShared"
                          variant="outline"
                          class="gap-1 text-[10px] px-1.5 py-0 font-normal"
                        >
                          <Users class="h-2.5 w-2.5 text-primary" />
                          Casal
                        </Badge>
                      </div>

                      <p class="text-xs text-muted-foreground truncate">
                        {{ ev.subtitle || 'Vencimento mensal' }}
                      </p>
                    </div>
                  </div>

                  <div class="flex items-center justify-between gap-3 sm:justify-end shrink-0">
                    <div class="text-left sm:text-right">
                      <button
                        v-if="ev.value != null && (ev.type === 'bill_due' || ev.type === 'debt_due')"
                        type="button"
                        class="group/price inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-sm font-bold tabular-nums text-foreground transition-colors hover:bg-muted hover:text-primary"
                        title="Clique para ajustar o valor deste mês"
                        @click="openPayDrawer(ev, 'edit')"
                      >
                        <span>{{ formatCurrency(ev.value) }}</span>
                        <Pencil class="h-3 w-3 text-muted-foreground opacity-60 group-hover/price:opacity-100 group-hover/price:text-primary" />
                      </button>
                      <span
                        v-else-if="ev.value != null"
                        class="text-sm font-bold tabular-nums text-foreground"
                      >
                        {{ formatCurrency(ev.value) }}
                      </span>
                      <div
                        class="flex items-center sm:justify-end gap-1 text-[11px]"
                        :class="
                          ev.paid
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : isEventOverdue(ev)
                              ? 'text-red-600 dark:text-red-400 font-medium'
                              : 'text-muted-foreground'
                        "
                      >
                        <CheckCircle2 v-if="ev.paid" class="h-3 w-3" />
                        <Clock v-else class="h-3 w-3" />
                        <span>
                          {{
                            ev.paid
                              ? ev.isShared && payerBadgeLabel(ev.paidBy)
                                ? payerBadgeLabel(ev.paidBy)
                                : 'Quitado'
                              : isEventOverdue(ev)
                                ? 'Em atraso'
                                : 'Em aberto'
                          }}
                        </span>
                      </div>
                    </div>

                    <Button
                      v-if="ev.type === 'bill_due' || ev.type === 'debt_due'"
                      :variant="ev.paid ? 'ghost' : 'outline'"
                      size="xs"
                      class="gap-1 min-w-[74px]"
                      :class="
                        !ev.paid
                          ? 'border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400'
                          : 'text-muted-foreground'
                      "
                      :disabled="togglingKey === eventKey(ev)"
                      @click="toggleEventPaid(ev)"
                    >
                      <Check class="h-3.5 w-3.5" />
                      <span>{{ ev.paid ? 'Pago' : 'Pagar' }}</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </li>
        </template>
      </ol>

      <!-- Seção para contas cadastradas sem dia fixo de vencimento -->
      <Card v-if="undatedEvents.length > 0">
        <CardHeader class="border-b border-border py-3 px-4 sm:px-5">
          <CardTitle class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Sem dia fixo de vencimento ({{ undatedEvents.length }})
          </CardTitle>
        </CardHeader>
        <CardContent class="p-0 divide-y divide-border">
          <div
            v-for="ev in undatedEvents"
            :key="eventKey(ev)"
            class="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"
          >
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span
                  class="text-sm font-semibold truncate"
                  :class="ev.paid ? 'line-through text-muted-foreground' : 'text-foreground'"
                >
                  {{ ev.name }}
                </span>
                <Badge v-if="ev.isShared" variant="outline" class="gap-1 text-[10px] px-1.5 py-0 font-normal">
                  <Users class="h-2.5 w-2.5 text-primary" />
                  Casal
                </Badge>
              </div>
              <p class="text-xs text-muted-foreground">{{ ev.subtitle }}</p>
            </div>

            <div class="flex items-center gap-3 shrink-0">
              <button
                v-if="ev.value != null && (ev.type === 'bill_due' || ev.type === 'debt_due')"
                type="button"
                class="group/price inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-sm font-bold tabular-nums text-foreground transition-colors hover:bg-muted hover:text-primary"
                title="Clique para ajustar o valor deste mês"
                @click="openPayDrawer(ev, 'edit')"
              >
                <span>{{ formatCurrency(ev.value) }}</span>
                <Pencil class="h-3 w-3 text-muted-foreground opacity-60 group-hover/price:opacity-100 group-hover/price:text-primary" />
              </button>
              <span v-else-if="ev.value != null" class="text-sm font-bold tabular-nums text-foreground">
                {{ formatCurrency(ev.value) }}
              </span>
              <Button
                :variant="ev.paid ? 'ghost' : 'outline'"
                size="xs"
                class="gap-1"
                :class="
                  !ev.paid
                    ? 'border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400'
                    : 'text-muted-foreground'
                "
                :disabled="togglingKey === eventKey(ev)"
                @click="toggleEventPaid(ev)"
              >
                <Check class="h-3.5 w-3.5" />
                <span>{{ ev.paid ? 'Pago' : 'Pagar' }}</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Bottom Drawer para Confirmar Pagamento ou Ajustar Valor do Mês -->
    <Sheet
      v-model:open="payDrawerOpen"
      :title="
        payDrawerMode === 'pay'
          ? `Pagar ${selectedEvent?.name ?? 'conta'}`
          : `Valor de ${selectedEvent?.name ?? 'conta'} em ${periodText}`
      "
      :description="
        payDrawerMode === 'pay'
          ? 'Confirme o valor que veio na fatura ou boleto deste mês para dar baixa.'
          : 'Ajuste o valor desta conta sem precisar sair da agenda.'
      "
    >
      <form class="space-y-5" @submit.prevent="submitPayDrawer(false)">
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-foreground">
            Valor em {{ periodText }}
          </label>
          <CurrencyInput
            v-model="selectedEventAmount"
            placeholder="0,00"
            required
          />
          <p class="text-[11px] text-muted-foreground">
            <template v-if="selectedEvent?.type === 'bill_due'">
              Essa confirmação de valor vale somente para <strong>{{ periodText }}</strong>.
            </template>
            <template v-else>
              Confirme o valor exato da parcela em <strong>{{ periodText }}</strong>.
            </template>
          </p>
        </div>

        <div
          v-if="selectedEvent?.isShared && hasPartner && authStore.profile?.partner"
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
          <Button type="button" variant="outline" @click="payDrawerOpen = false">
            Cancelar
          </Button>

          <Button
            v-if="payDrawerMode === 'edit' && selectedEvent && !selectedEvent.paid"
            type="button"
            variant="secondary"
            class="gap-1.5"
            :disabled="savingEventAction"
            @click="submitPayDrawer(true)"
          >
            <Check class="h-3.5 w-3.5" />
            <span>Salvar e marcar como pago</span>
          </Button>

          <Button type="submit" class="gap-1.5" :disabled="savingEventAction">
            <Check v-if="payDrawerMode === 'pay'" class="h-3.5 w-3.5" />
            <span>
              {{
                savingEventAction
                  ? 'Salvando...'
                  : payDrawerMode === 'pay'
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
