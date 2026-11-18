<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { dashboardApi } from '@/api/dashboard.api'
import { Skeleton } from '@/components/ui/skeleton'
import { useRecurringStore } from '@/stores/recurring/recurring.store'
import { useToastStore } from '@/stores/toast/toast.store'
import type { AgendaEvent, AgendaEventType } from '@/types/dashboard-commitment'
import {
  currentReferenceMonth,
  formatCurrency,
  formatPeriodLabel,
  shiftReferenceMonth,
} from '@/utils/month'
import {
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CreditCardIcon,
  CalendarDaysIcon,
} from '@heroicons/vue/24/outline'

const router = useRouter()
const recurringStore = useRecurringStore()
const toastStore = useToastStore()

const referenceMonth = ref(currentReferenceMonth())
const events = ref<AgendaEvent[]>([])
const loading = ref(true)

const typeLabels: Record<AgendaEventType, string> = {
  bill_due: 'Vencimento conta',
  invoice_close: 'Fechamento fatura',
  invoice_due: 'Vencimento fatura',
}

function periodLabel() {
  return formatPeriodLabel(referenceMonth.value)
}

function isUrgent(day: number, paid: boolean): boolean {
  if (paid) return false
  const today = new Date().getDate()
  const [y, m] = referenceMonth.value.split('-').map(Number)
  const now = new Date()
  if (now.getFullYear() !== y || now.getMonth() + 1 !== m) return false
  return day >= today && day - today <= 5
}

function isOverdue(day: number, paid: boolean): boolean {
  if (paid) return false
  const today = new Date().getDate()
  const [y, m] = referenceMonth.value.split('-').map(Number)
  const now = new Date()
  if (now.getFullYear() !== y || now.getMonth() + 1 !== m) return false
  return day < today
}

async function loadMonth(ym: string) {
  loading.value = true
  referenceMonth.value = ym
  try {
    const [agendaRes] = await Promise.all([
      dashboardApi.getAgenda(ym),
      recurringStore.fetchMonthlyStatus(ym),
    ])
    referenceMonth.value = agendaRes.month
    events.value = agendaRes.events
  } catch (e) {
    toastStore.error(e instanceof Error ? e.message : 'Erro ao carregar agenda')
  } finally {
    loading.value = false
  }
}

async function onEventClick(event: AgendaEvent) {
  if (event.type === 'bill_due') {
    try {
      if (event.paid) {
        await recurringStore.unmarkAsPaid(event.referenceId, referenceMonth.value)
      } else {
        await recurringStore.markAsPaid(event.referenceId, referenceMonth.value)
      }
      const idx = events.value.findIndex(
        (e) => e.referenceId === event.referenceId && e.type === event.type && e.day === event.day,
      )
      if (idx >= 0) {
        events.value[idx] = { ...events.value[idx], paid: !event.paid }
      }
    } catch (e) {
      toastStore.error(e instanceof Error ? e.message : 'Erro ao atualizar pagamento')
    }
    return
  }

  if (event.type === 'invoice_due' || event.type === 'invoice_close') {
    router.push({
      name: 'card-invoices',
      params: { id: event.referenceId },
      query: { month: referenceMonth.value },
    })
  }
}

const groupedByDay = computed(() => {
  const map = new Map<number, AgendaEvent[]>()
  for (const ev of events.value) {
    const list = map.get(ev.day) ?? []
    list.push(ev)
    map.set(ev.day, list)
  }
  return Array.from(map.entries()).sort(([a], [b]) => a - b)
})

onMounted(() => loadMonth(currentReferenceMonth()))
</script>

<template>
  <div class="agenda-page">
    <header class="agenda-page__header">
      <div>
        <h1 class="agenda-page__title">Agenda do mês</h1>
        <p class="agenda-page__subtitle">{{ periodLabel() }}</p>
      </div>
      <div class="month-nav">
        <button
          type="button"
          class="month-nav__btn"
          aria-label="Mês anterior"
          @click="loadMonth(shiftReferenceMonth(referenceMonth, -1))"
        >
          <ChevronLeftIcon class="h-5 w-5" />
        </button>
        <button type="button" class="month-nav__today" @click="loadMonth(currentReferenceMonth())">
          Hoje
        </button>
        <button
          type="button"
          class="month-nav__btn"
          aria-label="Próximo mês"
          @click="loadMonth(shiftReferenceMonth(referenceMonth, 1))"
        >
          <ChevronRightIcon class="h-5 w-5" />
        </button>
      </div>
    </header>

    <div v-if="loading" class="space-y-4">
      <div v-for="n in 4" :key="n" class="flex items-start gap-4">
        <Skeleton class="h-8 w-8 shrink-0 rounded-full" />
        <div class="flex-1 rounded-xl border border-border p-4 space-y-2">
          <Skeleton class="h-3 w-28" />
          <div class="flex items-center justify-between">
            <Skeleton class="h-4 w-40" />
            <Skeleton class="h-4 w-20" />
          </div>
        </div>
      </div>
    </div>
    <p v-else-if="events.length === 0" class="agenda-page__empty">
      Nenhum vencimento ou fechamento neste mês.
    </p>

    <ol v-else class="timeline" role="list">
      <li v-for="[day, dayEvents] in groupedByDay" :key="day" class="timeline-day">
        <div
          class="timeline-day__marker"
          :class="{
            'timeline-day__marker--paid': dayEvents.every((e) => e.paid),
            'timeline-day__marker--urgent': dayEvents.some((e) => isUrgent(e.day, e.paid)),
            'timeline-day__marker--overdue': dayEvents.some((e) => isOverdue(e.day, e.paid)),
          }"
        >
          {{ day }}
        </div>
        <ul class="timeline-day__events">
          <li
            v-for="ev in dayEvents"
            :key="`${ev.type}-${ev.referenceId}-${ev.day}`"
            class="timeline-event"
            :class="{
              'timeline-event--paid': ev.paid,
              'timeline-event--urgent': isUrgent(ev.day, ev.paid),
            }"
          >
            <button type="button" class="timeline-event__btn" @click="onEventClick(ev)">
              <span class="timeline-event__type">
                <CalendarDaysIcon
                  v-if="ev.type === 'bill_due'"
                  class="timeline-event__icon"
                />
                <CreditCardIcon v-else class="timeline-event__icon" />
                {{ typeLabels[ev.type] }}
              </span>
              <span class="timeline-event__name">{{ ev.name }}</span>
              <span v-if="ev.value != null" class="timeline-event__value">
                {{ formatCurrency(ev.value) }}
              </span>
              <span v-if="ev.paid" class="timeline-event__paid">
                <CheckCircleIcon class="h-4 w-4" />
                Pago
              </span>
            </button>
          </li>
        </ul>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.agenda-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 1rem 1.5rem 2rem;
}

.agenda-page__title {
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--dp-text-primary);
}

.agenda-page__subtitle {
  font-size: 0.88rem;
  color: var(--dp-text-muted);
}

.agenda-page__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
}

.month-nav {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.month-nav__btn,
.month-nav__today {
  border: 1px solid var(--dp-border);
  background: var(--color-background-soft);
  color: var(--dp-text-primary);
  border-radius: 0.5rem;
  padding: 0.35rem 0.55rem;
  cursor: pointer;
}

.month-nav__today {
  font-size: 0.8rem;
}

.agenda-page__loading,
.agenda-page__empty {
  color: var(--dp-text-muted);
  font-size: 0.9rem;
}

.timeline {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  border-left: 2px solid var(--dp-border);
  margin-left: 1.1rem;
  padding-left: 1.5rem;
}

.timeline-day {
  position: relative;
  display: flex;
  gap: 0.85rem;
}

.timeline-day__marker {
  position: absolute;
  left: -2.35rem;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  background: var(--color-background-soft);
  border: 2px solid var(--dp-border);
  color: var(--dp-text-primary);
}

.timeline-day__marker--paid {
  background: rgba(61, 214, 140, 0.2);
  border-color: var(--dp-green);
  color: var(--dp-green);
}

.timeline-day__marker--urgent {
  border-color: hsl(32, 90%, 45%);
  box-shadow: 0 0 0 3px rgba(245, 173, 58, 0.25);
}

.timeline-day__marker--overdue {
  border-color: #dc2626;
  color: #dc2626;
  background: rgba(248, 113, 113, 0.12);
}

.timeline-day__events {
  list-style: none;
  padding: 0;
  margin: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.timeline-event--paid {
  opacity: 0.65;
}

.timeline-event__btn {
  width: 100%;
  text-align: left;
  border: 1px solid var(--dp-border);
  border-radius: 0.65rem;
  background: var(--color-background-soft);
  padding: 0.65rem 0.75rem;
  cursor: pointer;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.65rem;
}

.timeline-event--urgent .timeline-event__btn {
  border-color: hsl(32, 80%, 55%);
}

.timeline-event__type {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.72rem;
  color: var(--dp-text-muted);
  width: 100%;
}

.timeline-event__icon {
  width: 0.95rem;
  height: 0.95rem;
}

.timeline-event__name {
  font-weight: 600;
  color: var(--dp-text-primary);
  flex: 1;
}

.timeline-event__value {
  font-size: 0.88rem;
  color: var(--dp-text-secondary);
}

.timeline-event__paid {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  font-size: 0.72rem;
  color: var(--dp-green);
  font-weight: 600;
}
</style>
