<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { cardsApi } from '@/api/cards.api'
import { useAuthStore } from '@/stores/auth/auth.store'
import { useToastStore } from '@/stores/toast/toast.store'
import type { CardInvoicePeriod, CardInvoicesResponse } from '@/types/card-invoice'
import { ownerBadgeLabel } from '@/utils/owner'
import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/vue/24/outline'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const toastStore = useToastStore()

const currentUserId = computed(() => authStore.currentUserId)

const cardId = computed(() => route.params.id as string)

function currentMonthYm(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

const selectedMonth = ref(currentMonthYm())

const loading = ref(true)
const error = ref<string | null>(null)
const data = ref<CardInvoicesResponse | null>(null)

const invoice = computed<CardInvoicePeriod | null>(() => {
  const inv = data.value?.invoices?.[0]
  return inv ?? null
})

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function formatRange(startIso: string, endIso: string) {
  const start = new Date(startIso)
  const end = new Date(endIso)
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' }
  return `${start.toLocaleDateString('pt-BR', opts)} – ${end.toLocaleDateString('pt-BR', { ...opts, year: 'numeric' })}`
}

function formatDue(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function monthHeading(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m) return ym
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })
}

function shiftMonth(delta: number) {
  const [y, m] = selectedMonth.value.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  selectedMonth.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

async function load() {
  loading.value = true
  error.value = null
  try {
    data.value = await cardsApi.getInvoices(cardId.value, {
      pastCycles: 0,
      futureCycles: 0,
      referenceMonth: selectedMonth.value,
    })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erro ao carregar faturas'
    toastStore.error(error.value)
  } finally {
    loading.value = false
  }
}

watch([cardId, selectedMonth], load, { immediate: true })

function back() {
  router.push({ name: 'cards' })
}
</script>

<template>
  <div class="invoices-page">
    <header class="page-head">
      <button type="button" class="back-btn" aria-label="Voltar" @click="back">
        <ArrowLeftIcon class="h-5 w-5" />
      </button>
      <div class="page-head-text">
        <h1 class="page-title">Fatura do cartão</h1>
        <p v-if="data" class="page-sub">
          {{ data.card.name }} • Fecha dia {{ data.card.closingDay }} • Vence dia {{ data.card.dueDay }} • Limite
          {{ formatCurrency(data.card.limitAmount) }}
          <template v-if="ownerBadgeLabel(data.card.owner ?? null, currentUserId)">
            • Cartão de {{ ownerBadgeLabel(data.card.owner ?? null, currentUserId) }}
          </template>
        </p>
      </div>
    </header>

    <div class="month-bar">
      <button type="button" class="month-nav" aria-label="Mês anterior" @click="shiftMonth(-1)">
        <ChevronLeftIcon class="h-5 w-5" />
      </button>
      <label class="month-picker-wrap">
        <span class="month-picker-label">Mês de referência</span>
        <input v-model="selectedMonth" class="month-input" type="month" />
      </label>
      <button type="button" class="month-nav" aria-label="Próximo mês" @click="shiftMonth(1)">
        <ChevronRightIcon class="h-5 w-5" />
      </button>
    </div>

    <p v-if="loading" class="muted">Carregando…</p>
    <p v-else-if="error" class="error-text">{{ error }}</p>

    <template v-else-if="invoice">
      <section class="invoice-hero" aria-labelledby="invoice-heading">
        <h2 id="invoice-heading" class="sr-only">Fatura de {{ monthHeading(selectedMonth) }}</h2>
        <p class="invoice-month-label">{{ monthHeading(selectedMonth) }}</p>
        <p class="invoice-period">{{ formatRange(invoice.periodStart, invoice.periodEnd) }}</p>
        <p class="invoice-due">Vencimento {{ formatDue(invoice.dueDate) }}</p>
        <p class="invoice-total">{{ formatCurrency(invoice.total) }}</p>
        <p class="invoice-meta">
          {{ invoice.transactionCount }}
          {{ invoice.transactionCount === 1 ? 'lançamento' : 'lançamentos' }}
        </p>
      </section>

      <ul class="tx-list">
        <li v-for="tx in invoice.transactions" :key="tx.id" class="tx-row">
          <div class="tx-desc-wrap">
            <span class="tx-desc">{{ tx.description }}</span>
            <span
              v-if="tx.installmentTotal && tx.installmentTotal > 1 && tx.installmentNumber"
              class="tx-parcel"
            >
              Parcela {{ tx.installmentNumber }}/{{ tx.installmentTotal }}
            </span>
          </div>
          <span class="tx-date">{{ new Date(tx.occurredAt).toLocaleDateString('pt-BR') }}</span>
          <span class="tx-amount">{{ formatCurrency(tx.amount) }}</span>
        </li>
        <li v-if="invoice.transactions.length === 0" class="tx-empty">Nenhum gasto neste ciclo.</li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.invoices-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 1rem 1.5rem 2rem;
}

.page-head {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 1px solid var(--dp-border);
  border-radius: 0.5rem;
  background: var(--color-background);
  color: var(--dp-text-secondary);
  cursor: pointer;
}

.page-head-text {
  min-width: 0;
}

.page-title {
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--dp-text-primary);
  line-height: 1.2;
}

.page-sub {
  font-size: 0.85rem;
  color: var(--dp-text-muted);
  margin-top: 0.25rem;
}

.month-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
  border: 1px solid var(--dp-border);
  border-radius: 0.75rem;
  padding: 0.65rem 0.75rem;
  background: var(--dp-surface);
}

.month-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border: none;
  border-radius: 0.5rem;
  background: var(--color-background);
  color: var(--dp-text-secondary);
  cursor: pointer;
}

.month-nav:hover {
  background: var(--dp-surface-hover);
}

.month-picker-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  min-width: 0;
}

.month-picker-label {
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--dp-text-muted);
}

.month-input {
  width: 100%;
  max-width: 12rem;
  padding: 0.4rem 0.6rem;
  font-size: 1rem;
  font-weight: 600;
  text-align: center;
  border: 1px solid var(--dp-border);
  border-radius: 0.5rem;
  background: var(--color-background);
  color: var(--dp-text-primary);
  cursor: pointer;
}

.muted,
.error-text {
  font-size: 0.9rem;
}

.error-text {
  color: #dc2626;
}

.invoice-hero {
  border: 1px solid var(--dp-border);
  border-radius: 0.75rem;
  background: linear-gradient(145deg, var(--dp-surface) 0%, var(--color-background) 100%);
  padding: 1.25rem 1.35rem;
  margin-bottom: 1rem;
  text-align: center;
}

.invoice-month-label {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: capitalize;
  color: var(--dp-text-muted);
  margin: 0 0 0.35rem;
}

.invoice-period {
  font-size: 0.85rem;
  color: var(--dp-text-secondary);
  margin: 0 0 0.35rem;
}

.invoice-due {
  font-size: 0.8rem;
  color: var(--dp-text-muted);
  margin: 0 0 0.75rem;
}

.invoice-total {
  font-size: 1.85rem;
  font-weight: 800;
  color: var(--dp-text-primary);
  line-height: 1.1;
  margin: 0 0 0.35rem;
}

.invoice-meta {
  font-size: 0.85rem;
  color: var(--dp-text-muted);
  margin: 0;
}

.tx-list {
  list-style: none;
  padding: 0;
  margin: 0;
  border: 1px solid var(--dp-border);
  border-radius: 0.75rem;
  padding: 0.65rem 0.85rem;
  background: var(--dp-surface);
}

.tx-desc-wrap {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.tx-parcel {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--dp-text-muted);
}

.tx-row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 0.5rem;
  align-items: center;
  padding: 0.65rem 0;
  font-size: 0.88rem;
  border-bottom: 1px solid var(--dp-border);
}

.tx-row:last-child {
  border-bottom: none;
}

.tx-desc {
  color: var(--dp-text-primary);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tx-date {
  color: var(--dp-text-muted);
  font-size: 0.8rem;
}

.tx-amount {
  font-weight: 600;
  color: var(--dp-text-primary);
}

.tx-empty {
  padding: 1rem 0;
  font-size: 0.9rem;
  color: var(--dp-text-muted);
  text-align: center;
  border: none;
}
</style>
