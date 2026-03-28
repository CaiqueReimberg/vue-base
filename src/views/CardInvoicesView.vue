<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { cardsApi } from '@/api/cards.api'
import { useToastStore } from '@/stores/toast/toast.store'
import type { CardInvoicesResponse } from '@/types/card-invoice'
import { ArrowLeftIcon } from '@heroicons/vue/24/outline'

const route = useRoute()
const router = useRouter()
const toastStore = useToastStore()

const cardId = computed(() => route.params.id as string)

type InvoiceRangePreset = '3-3' | '6-3' | '12-3' | '6-6'

/** Fechamentos passados + futuros; o ciclo atual é o 1º item. */
const rangePreset = ref<InvoiceRangePreset>('3-3')

const presetParams: Record<
  InvoiceRangePreset,
  { pastCycles: number; futureCycles: number }
> = {
  '3-3': { pastCycles: 3, futureCycles: 3 },
  '6-3': { pastCycles: 6, futureCycles: 3 },
  '12-3': { pastCycles: 12, futureCycles: 3 },
  '6-6': { pastCycles: 6, futureCycles: 6 },
}

const loading = ref(true)
const error = ref<string | null>(null)
const data = ref<CardInvoicesResponse | null>(null)
const expanded = ref<Record<number, boolean>>({})

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

async function load() {
  loading.value = true
  error.value = null
  try {
    data.value = await cardsApi.getInvoices(
      cardId.value,
      presetParams[rangePreset.value],
    )
    expanded.value = {}
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erro ao carregar faturas'
    toastStore.error(error.value)
  } finally {
    loading.value = false
  }
}

onMounted(load)

watch(rangePreset, () => {
  load()
})

function toggle(idx: number) {
  expanded.value = { ...expanded.value, [idx]: !expanded.value[idx] }
}

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
        <h1 class="page-title">Faturas do cartão</h1>
        <p v-if="data" class="page-sub">
          {{ data.card.name }} • Fecha dia {{ data.card.closingDay }} • Vence dia {{ data.card.dueDay }} • Limite
          {{ formatCurrency(data.card.limitAmount) }}
        </p>
      </div>
    </header>

    <div class="cycles-toolbar">
      <label for="cycles-select" class="cycles-label">Janela de faturas</label>
      <select id="cycles-select" v-model="rangePreset" class="cycles-select">
        <option value="3-3">3 anteriores + atual + 3 futuras</option>
        <option value="6-3">6 anteriores + atual + 3 futuras</option>
        <option value="12-3">12 anteriores + atual + 3 futuras</option>
        <option value="6-6">6 anteriores + atual + 6 futuras</option>
      </select>
    </div>

    <p v-if="loading" class="muted">Carregando…</p>
    <p v-else-if="error" class="error-text">{{ error }}</p>

    <ul v-else-if="data" class="invoice-list">
      <li v-for="(inv, idx) in data.invoices" :key="idx" class="invoice-card">
        <button type="button" class="invoice-summary" @click="toggle(idx)">
          <div class="invoice-summary-main">
            <span class="invoice-period">{{ formatRange(inv.periodStart, inv.periodEnd) }}</span>
            <span class="invoice-due">Venc. {{ formatDue(inv.dueDate) }}</span>
          </div>
          <div class="invoice-totals">
            <span class="invoice-total">{{ formatCurrency(inv.total) }}</span>
            <span class="invoice-count">{{ inv.transactionCount }} lançamento(s)</span>
            <span class="chevron" :class="{ open: expanded[idx] }">▼</span>
          </div>
        </button>
        <ul v-if="expanded[idx]" class="tx-list">
          <li v-for="tx in inv.transactions" :key="tx.id" class="tx-row">
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
          <li v-if="inv.transactions.length === 0" class="tx-empty">Nenhum gasto neste ciclo.</li>
        </ul>
      </li>
    </ul>
  </div>
</template>

<style scoped>
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

.cycles-toolbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.cycles-label {
  font-size: 0.85rem;
  color: var(--dp-text-muted);
}

.cycles-select {
  padding: 0.45rem 2rem 0.45rem 0.65rem;
  font-size: 0.9rem;
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

.invoice-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.invoice-card {
  border: 1px solid var(--dp-border);
  border-radius: 0.75rem;
  background: var(--dp-surface);
  overflow: hidden;
}

.invoice-summary {
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 1rem 1.1rem;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.invoice-summary:hover {
  background: var(--dp-surface-hover);
}

.invoice-summary-main {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.invoice-period {
  font-weight: 600;
  color: var(--dp-text-primary);
  font-size: 0.95rem;
}

.invoice-due {
  font-size: 0.8rem;
  color: var(--dp-text-muted);
}

.invoice-totals {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.1rem;
}

.invoice-total {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--dp-text-primary);
}

.invoice-count {
  font-size: 0.75rem;
  color: var(--dp-text-muted);
}

.chevron {
  font-size: 0.65rem;
  color: var(--dp-text-muted);
  transition: transform 0.2s;
}

.chevron.open {
  transform: rotate(-180deg);
}

.tx-list {
  list-style: none;
  padding: 0 1rem 0.75rem;
  margin: 0;
  border-top: 1px solid var(--dp-border);
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
  padding: 0.55rem 0;
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
  padding: 0.75rem 0;
  font-size: 0.85rem;
  color: var(--dp-text-muted);
}
</style>
