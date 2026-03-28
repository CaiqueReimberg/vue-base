<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import ConfirmModal from '@/components/ConfirmModal.vue'
import { useMovementsStore } from '@/stores/movements/movements.store'
import { useAccountsStore } from '@/stores/accounts/accounts.store'
import { useCardsStore } from '@/stores/cards/cards.store'
import { useToastStore } from '@/stores/toast/toast.store'
import type { Movement, MovementType } from '@/stores/movements/movements.store'
import { transactionsApi } from '@/api/transactions.api'
import type { TransactionCreateInput } from '@/types/transaction'
import { PencilSquareIcon, TrashIcon } from '@heroicons/vue/24/outline'

const store = useMovementsStore()
const accountsStore = useAccountsStore()
const cardsStore = useCardsStore()
const toastStore = useToastStore()
const {
  filteredMovements,
  movementsCount,
  loading,
  error,
  formatCurrency,
  typeLabel,
  searchQuery,
  filterType,
  filterAccountId,
  filterCardId,
  page,
  totalPages,
} = storeToRefs(store)

const typeOptions: { value: MovementType | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos os tipos' },
  { value: 'expense', label: 'Gasto' },
  { value: 'income', label: 'Entrada' },
]

const isFormOpen = ref(false)
const editingId = ref<string | null>(null)
const submitting = ref(false)
const description = ref('')
const amount = ref<number>(0)
const type = ref<MovementType>('expense')
const paymentSource = ref<'account' | 'card'>('account')
const accountId = ref('')
const cardId = ref('')
const isRecurring = ref(false)
const recurringMonths = ref<number | ''>('')
const isInstallment = ref(false)
const installmentTotal = ref(2)
const occurredAt = ref(new Date().toISOString().slice(0, 10))
const formError = ref('')
const removeOpen = ref(false)
const movementToRemove = ref<Movement | null>(null)
const editLoading = ref(false)
const editInstallmentLabel = ref<string | null>(null)

const accountOptions = computed(() => accountsStore.accounts)
const cardOptions = computed(() => cardsStore.cards)
const isEditing = computed(() => Boolean(editingId.value))
const amountLabel = computed(() =>
  isInstallment.value && !isEditing.value && type.value === 'expense' ? 'Valor total' : 'Valor',
)

const parcelOptions = Array.from({ length: 23 }, (_, i) => i + 2)
const removeDescription = computed(() =>
  movementToRemove.value
    ? `Excluir a movimentação "${movementToRemove.value.description}"? Esta ação não pode ser desfeita.`
    : '',
)

onMounted(async () => {
  try {
    await Promise.all([
      store.fetchAll(),
      accountsStore.fetchAll(),
      cardsStore.fetchAll(),
    ])
  } catch {
    toastStore.error(
      store.error ?? accountsStore.error ?? cardsStore.error ?? 'Erro ao carregar movimentações.',
    )
  }
})

watch(type, (t) => {
  if (t === 'income') {
    paymentSource.value = 'account'
    isRecurring.value = false
    isInstallment.value = false
  }
})

watch(isRecurring, (v) => {
  if (v) isInstallment.value = false
})

watch(isInstallment, (v) => {
  if (v) {
    isRecurring.value = false
    recurringMonths.value = ''
  }
})

watch([filterType, filterAccountId, filterCardId], async () => {
  store.setPage(1)
  try {
    await store.fetchAll()
  } catch {
    toastStore.error(store.error ?? 'Erro ao filtrar movimentações.')
  }
})

function getMovementMeta(m: Movement) {
  const accountName = m.account?.name || m.card?.name || 'Sem origem'
  const createdAt = new Date(m.createdAt).toLocaleDateString('pt-BR')
  return `${accountName} • ${createdAt}`
}

function getAmountClass(m: Movement) {
  if (m.type === 'expense') return 'amount amount--expense'
  return 'amount amount--income'
}

function formatMovementAmount(m: Movement) {
  const formatted = formatCurrency.value(m.amount)
  if (m.type === 'expense') return `- ${formatted}`
  return `+ ${formatted}`
}

function openCreateForm() {
  editingId.value = null
  description.value = ''
  amount.value = 0
  type.value = 'expense'
  paymentSource.value = 'account'
  accountId.value = accountOptions.value[0]?.id ?? ''
  cardId.value = cardOptions.value[0]?.id ?? ''
  isRecurring.value = false
  recurringMonths.value = ''
  isInstallment.value = false
  installmentTotal.value = 2
  occurredAt.value = new Date().toISOString().slice(0, 10)
  formError.value = ''
  editInstallmentLabel.value = null
  editLoading.value = false
  isFormOpen.value = true
}

function isoToDateInput(iso: string) {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

async function openEditForm(movement: Movement) {
  editingId.value = movement.id
  formError.value = ''
  editInstallmentLabel.value = null
  isFormOpen.value = true
  editLoading.value = true
  try {
    const full = await transactionsApi.getById(movement.id)
    description.value = full.description
    amount.value = full.amount
    type.value = full.type
    if (full.card?.id) {
      paymentSource.value = 'card'
      cardId.value = full.card.id
      accountId.value = accountOptions.value[0]?.id ?? ''
    } else {
      paymentSource.value = 'account'
      accountId.value = full.account?.id ?? accountOptions.value[0]?.id ?? ''
      cardId.value = cardOptions.value[0]?.id ?? ''
    }
    occurredAt.value = isoToDateInput(full.occurredAt)
    if (
      full.installmentTotal != null &&
      full.installmentTotal > 1 &&
      full.installmentNumber != null
    ) {
      editInstallmentLabel.value = `Parcela ${full.installmentNumber} de ${full.installmentTotal}`
    }
  } catch {
    description.value = movement.description
    amount.value = movement.amount
    type.value = movement.type
    if (movement.card?.id) {
      paymentSource.value = 'card'
      cardId.value = movement.card.id
      accountId.value = accountOptions.value[0]?.id ?? ''
    } else {
      paymentSource.value = 'account'
      accountId.value = movement.account?.id ?? accountOptions.value[0]?.id ?? ''
      cardId.value = cardOptions.value[0]?.id ?? ''
    }
    occurredAt.value = isoToDateInput(movement.occurredAt)
    if (
      movement.installmentTotal != null &&
      movement.installmentTotal > 1 &&
      movement.installmentNumber != null
    ) {
      editInstallmentLabel.value = `Parcela ${movement.installmentNumber} de ${movement.installmentTotal}`
    }
    toastStore.error('Não foi possível recarregar os dados. Editando com informações da lista.')
  } finally {
    editLoading.value = false
  }
  isRecurring.value = false
  recurringMonths.value = ''
  isInstallment.value = false
  installmentTotal.value = 2
}

function closeForm() {
  isFormOpen.value = false
  formError.value = ''
  editInstallmentLabel.value = null
  editLoading.value = false
}

function openRemoveConfirm(movement: Movement) {
  movementToRemove.value = movement
  removeOpen.value = true
}

function closeRemoveConfirm() {
  removeOpen.value = false
  movementToRemove.value = null
}

function validateForm() {
  formError.value = ''
  if (!description.value.trim()) {
    formError.value = 'Informe a descrição.'
    return false
  }
  if (amount.value <= 0) {
    formError.value = 'Informe um valor maior que zero.'
    return false
  }
  if (type.value === 'income') {
    if (!accountId.value) {
      formError.value = 'Entradas precisam estar vinculadas a uma conta.'
      return false
    }
  } else if (paymentSource.value === 'card') {
    if (!cardId.value) {
      formError.value = 'Selecione um cartão.'
      return false
    }
  } else if (!accountId.value) {
    formError.value = 'Selecione uma conta.'
    return false
  }
  if (!occurredAt.value) {
    formError.value = 'Informe a data da movimentação.'
    return false
  }
  if (!isEditing.value && type.value === 'expense' && isInstallment.value) {
    const n = Number(installmentTotal.value)
    if (Number.isNaN(n) || n < 2 || n > 24) {
      formError.value = 'Informe entre 2 e 24 parcelas.'
      return false
    }
  }
  if (isRecurring.value && recurringMonths.value !== '') {
    const m = Number(recurringMonths.value)
    if (Number.isNaN(m) || m < 1 || m > 24) {
      formError.value = 'Duração da recorrência inválida.'
      return false
    }
  }
  return true
}

function onAccountFilterChange() {
  if (filterAccountId.value !== 'all') {
    store.setFilterCardId('all')
  }
}

function onCardFilterChange() {
  if (filterCardId.value !== 'all') {
    store.setFilterAccountId('all')
  }
}

function buildTransactionPayload(): TransactionCreateInput {
  const occurredAtIso = new Date(`${occurredAt.value}T12:00:00`).toISOString()
  const base = {
    description: description.value.trim(),
    amount: Number(amount.value),
    occurredAt: occurredAtIso,
  }
  if (type.value === 'income') {
    return { ...base, accountId: accountId.value }
  }
  if (paymentSource.value === 'card') {
    return { ...base, cardId: cardId.value }
  }
  return { ...base, accountId: accountId.value }
}

async function submitForm() {
  if (editLoading.value) return
  if (!validateForm() || submitting.value) return
  submitting.value = true
  const payload = buildTransactionPayload()
  try {
    if (isEditing.value && editingId.value) {
      await store.update(editingId.value, { ...payload, type: type.value })
      toastStore.success('Movimentação atualizada com sucesso.')
    } else {
      const useInstallment =
        type.value === 'expense' && isInstallment.value && Number(installmentTotal.value) >= 2
      await store.create({
        ...payload,
        type: type.value,
        installmentTotal: useInstallment ? Number(installmentTotal.value) : undefined,
        createRecurringFromCard:
          type.value === 'expense' &&
          paymentSource.value === 'card' &&
          isRecurring.value &&
          !useInstallment,
        recurringMonths:
          isRecurring.value && recurringMonths.value !== ''
            ? Number(recurringMonths.value)
            : undefined,
      })
      toastStore.success(
        useInstallment ? 'Parcelas criadas com sucesso.' : 'Movimentação criada com sucesso.',
      )
    }
    closeForm()
  } catch {
    formError.value = store.error ?? 'Erro ao salvar movimentação.'
    toastStore.error(formError.value)
  } finally {
    submitting.value = false
  }
}

async function confirmRemove() {
  if (!movementToRemove.value) return
  const id = movementToRemove.value.id
  closeRemoveConfirm()
  try {
    await store.remove(id)
    toastStore.success('Movimentação excluída com sucesso.')
  } catch {
    toastStore.error(store.error ?? 'Erro ao excluir movimentação.')
  }
}

async function prevPage() {
  if (page.value <= 1 || loading.value) return
  store.setPage(page.value - 1)
  try {
    await store.fetchAll()
  } catch {
    toastStore.error(store.error ?? 'Erro ao paginar movimentações.')
  }
}

async function nextPage() {
  if (page.value >= totalPages.value || loading.value) return
  store.setPage(page.value + 1)
  try {
    await store.fetchAll()
  } catch {
    toastStore.error(store.error ?? 'Erro ao paginar movimentações.')
  }
}
</script>

<template>
  <div class="movements-page">
    <ConfirmModal
      :open="removeOpen"
      title="Excluir movimentação"
      :description="removeDescription"
      confirm-label="Excluir"
      cancel-label="Cancelar"
      variant="danger"
      @close="closeRemoveConfirm"
      @confirm="confirmRemove"
    />
    <main class="movements-main">
      <header class="movements-header">
        <div class="movements-title-block">
          <h1 class="movements-title">Movimentações</h1>
          <p class="movements-subtitle">Entradas, saídas e ajustes do casal</p>
        </div>
        <button type="button" class="btn-add" @click="openCreateForm">
          <span class="btn-add-icon">+</span>
          Adicionar
        </button>
      </header>

      <form v-if="isFormOpen" class="movement-form" @submit.prevent="submitForm">
        <h2 class="movement-form-title">{{ isEditing ? 'Editar movimentação' : 'Nova movimentação' }}</h2>
        <p v-if="editLoading" class="movement-form-hint">Carregando dados…</p>
        <p v-else-if="isEditing && editInstallmentLabel" class="movement-form-hint movement-form-hint--strong">
          {{ editInstallmentLabel }} — valor desta parcela; demais parcelas permanecem nas respectivas datas.
        </p>
        <p v-if="formError" class="movement-form-error">{{ formError }}</p>
        <div class="movement-form-row">
          <div class="movement-form-group">
            <label for="movement-description">Descrição</label>
            <input
              id="movement-description"
              v-model="description"
              type="text"
              class="search-input"
              placeholder="Ex: Mercado"
            />
          </div>
          <div class="movement-form-group">
            <label for="movement-amount">{{ amountLabel }}</label>
            <input id="movement-amount" v-model.number="amount" type="number" min="0.01" step="0.01" class="search-input" />
          </div>
        </div>
        <div class="movement-form-row">
          <div class="movement-form-group">
            <label for="movement-type">Tipo</label>
            <select id="movement-type" v-model="type" class="filter-select movement-form-select">
              <option value="expense">Gasto</option>
              <option value="income">Entrada</option>
            </select>
          </div>
          <div v-if="type === 'expense'" class="movement-form-group movement-form-group--wide">
            <span class="movement-form-label-text">Origem do gasto</span>
            <div class="segmented">
              <button
                type="button"
                class="segmented-btn"
                :class="{ 'segmented-btn--active': paymentSource === 'account' }"
                @click="paymentSource = 'account'"
              >
                Conta
              </button>
              <button
                type="button"
                class="segmented-btn"
                :class="{ 'segmented-btn--active': paymentSource === 'card' }"
                @click="paymentSource = 'card'"
              >
                Cartão
              </button>
            </div>
          </div>
          <div v-if="type === 'income' || paymentSource === 'account'" class="movement-form-group">
            <label for="movement-account">Conta</label>
            <select id="movement-account" v-model="accountId" class="filter-select movement-form-select">
              <option value="" disabled>Selecione</option>
              <option v-for="account in accountOptions" :key="account.id" :value="account.id">
                {{ account.name }}
              </option>
            </select>
          </div>
          <div v-if="type === 'expense' && paymentSource === 'card'" class="movement-form-group">
            <label for="movement-card">Cartão</label>
            <select id="movement-card" v-model="cardId" class="filter-select movement-form-select">
              <option value="" disabled>Selecione</option>
              <option v-for="card in cardOptions" :key="card.id" :value="card.id">
                {{ card.name }}
              </option>
            </select>
          </div>
          <div class="movement-form-group">
            <label for="movement-date">Data</label>
            <input id="movement-date" v-model="occurredAt" type="date" class="search-input" />
          </div>
        </div>
        <div
          v-if="type === 'expense' && !isEditing"
          class="movement-form-row movement-form-row--checkbox"
        >
          <label class="checkbox-label">
            <input v-model="isInstallment" type="checkbox" :disabled="isRecurring" />
            <span>Parcelado (divide o valor total em parcelas mensais nas faturas)</span>
          </label>
        </div>
        <div v-if="type === 'expense' && !isEditing && isInstallment" class="movement-form-row">
          <div class="movement-form-group">
            <label for="installment-total">Número de parcelas</label>
            <select
              id="installment-total"
              v-model.number="installmentTotal"
              class="filter-select movement-form-select"
            >
              <option v-for="n in parcelOptions" :key="n" :value="n">{{ n }}x</option>
            </select>
            <p class="movement-form-hint">Máximo 24 faturas. Cada parcela aparece no mês correspondente (cartão ou conta).</p>
          </div>
        </div>
        <div
          v-if="type === 'expense' && paymentSource === 'card' && !isEditing && !isInstallment"
          class="movement-form-row movement-form-row--checkbox"
        >
          <label class="checkbox-label">
            <input v-model="isRecurring" type="checkbox" />
            <span>Recorrente (mensal no cartão — para projeção da fatura)</span>
          </label>
        </div>
        <div
          v-if="type === 'expense' && paymentSource === 'card' && !isEditing && isRecurring && !isInstallment"
          class="movement-form-row"
        >
          <div class="movement-form-group">
            <label for="recurring-months">Encerrar recorrência após (opcional)</label>
            <select id="recurring-months" v-model="recurringMonths" class="filter-select movement-form-select">
              <option value="">Sem data final</option>
              <option v-for="m in 24" :key="m" :value="m">{{ m }} {{ m === 1 ? 'mês' : 'meses' }}</option>
            </select>
            <p class="movement-form-hint">Define até quando a recorrência entra nas projeções (data final).</p>
          </div>
        </div>
        <div class="movement-form-actions">
          <button type="button" class="btn-secondary" @click="closeForm">Cancelar</button>
          <button type="submit" class="btn-add" :disabled="submitting || editLoading">
            {{ submitting ? 'Salvando...' : isEditing ? 'Atualizar' : 'Salvar' }}
          </button>
        </div>
      </form>

      <div class="search-wrap">
        <span class="search-icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
        </span>
        <input
          v-model="searchQuery"
          type="search"
          class="search-input"
          placeholder="Buscar por descrição..."
          aria-label="Buscar por descrição"
        />
      </div>

      <div class="filters-row">
        <span class="filter-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>
          </svg>
        </span>
        <select v-model="filterType" class="filter-select" aria-label="Filtrar por tipo">
          <option v-for="opt in typeOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
        <select
          v-model="filterAccountId"
          class="filter-select"
          aria-label="Filtrar por conta"
          @change="onAccountFilterChange"
        >
          <option value="all">Todas as contas</option>
          <option v-for="account in accountOptions" :key="account.id" :value="account.id">
            {{ account.name }}
          </option>
        </select>
        <select
          v-model="filterCardId"
          class="filter-select"
          aria-label="Filtrar por cartão"
          @change="onCardFilterChange"
        >
          <option value="all">Todos os cartões</option>
          <option v-for="card in cardOptions" :key="card.id" :value="card.id">
            {{ card.name }}
          </option>
        </select>
      </div>

      <p class="movements-count">{{ movementsCount }} movimentações</p>
      <p v-if="error" class="movements-count movements-error">{{ error }}</p>
      <p v-if="loading" class="movements-count">Carregando...</p>

      <ul class="movements-list">
        <li v-for="movement in filteredMovements" :key="movement.id" class="movement-item">
          <span
            class="movement-icon"
            :class="`movement-icon--${movement.type}`"
            :aria-label="typeLabel(movement.type)"
          >
            <svg v-if="movement.type === 'expense'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M5 12h14"/>
            </svg>
            <svg v-else-if="movement.type === 'income'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 4v6h-6M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </span>
          <div class="movement-body">
            <div class="movement-head">
              <span class="movement-description">{{ movement.description }}</span>
              <span
                v-if="movement.installmentTotal && movement.installmentTotal > 1 && movement.installmentNumber"
                class="movement-parcel-tag"
                :title="`Parcela ${movement.installmentNumber} de ${movement.installmentTotal}`"
              >
                {{ movement.installmentNumber }}/{{ movement.installmentTotal }}
              </span>
              <span class="movement-type-tag" :class="`movement-type-tag--${movement.type}`">
                {{ typeLabel(movement.type) }}
              </span>
            </div>
            <p class="movement-meta">{{ getMovementMeta(movement) }}</p>
          </div>
          <span :class="getAmountClass(movement)">{{ formatMovementAmount(movement) }}</span>
          <div class="movement-actions">
            <button type="button" class="crud-icon-btn" title="Editar" aria-label="Editar" @click="openEditForm(movement)">
              <PencilSquareIcon class="h-5 w-5" />
            </button>
            <button
              type="button"
              class="crud-icon-btn crud-icon-btn--danger"
              title="Excluir"
              aria-label="Excluir"
              @click="openRemoveConfirm(movement)"
            >
              <TrashIcon class="h-5 w-5" />
            </button>
          </div>
        </li>
      </ul>
      <div class="pagination">
        <button type="button" class="btn-secondary" :disabled="page <= 1 || loading" @click="prevPage">
          Anterior
        </button>
        <span class="movements-count">Página {{ page }} de {{ totalPages }}</span>
        <button type="button" class="btn-secondary" :disabled="page >= totalPages || loading" @click="nextPage">
          Próxima
        </button>
      </div>
    </main>
  </div>
</template>

<style scoped>
.movements-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 1rem 1.5rem 2rem;
}

@media (max-width: 640px) {
  .movements-page {
    padding: 0.75rem 1rem 1.5rem;
  }

  .movements-title {
    font-size: 1.25rem;
  }

  .movements-subtitle {
    font-size: 0.85rem;
  }

  .btn-add {
    width: 100%;
    justify-content: center;
  }

  .movement-item {
    flex-wrap: wrap;
    padding: 0.875rem 1rem;
  }

  .movement-body {
    flex: 1 1 calc(100% - 3rem);
  }
}

@media (max-width: 380px) {
  .movements-page {
    padding: 0.5rem 0.75rem 1rem;
  }
}

.movements-main {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.movements-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
}

.movements-title-block {
  flex: 1;
  min-width: 0;
}

.movements-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--dp-text-primary);
  margin-bottom: 0.2rem;
  line-height: 1.2;
}

.movements-subtitle {
  font-size: 0.9rem;
  color: var(--dp-text-muted);
}

.btn-add {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 1.25rem;
  background: var(--dp-green);
  color: white;
  font-size: 0.95rem;
  font-weight: 600;
  border-radius: 0.5rem;
  text-decoration: none;
  border: 0;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.05s;
}

.btn-add:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.6rem 1.25rem;
  background: var(--dp-surface-hover);
  color: var(--dp-text-primary);
  font-size: 0.95rem;
  font-weight: 600;
  border-radius: 0.5rem;
  border: 1px solid var(--dp-border);
  cursor: pointer;
}

.btn-add:hover {
  opacity: 0.92;
}

.btn-add:active {
  transform: scale(0.98);
}

.btn-add-icon {
  font-size: 1.1rem;
  line-height: 1;
}

.search-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 1rem;
  display: flex;
  color: var(--dp-text-muted);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 0.75rem 1rem 0.75rem 2.75rem;
  font-size: 0.95rem;
  border: 1px solid var(--dp-border);
  border-radius: 0.75rem;
  background: var(--color-background);
  color: var(--dp-text-primary);
  outline: none;
  transition: border-color 0.2s;
}

.search-input::placeholder {
  color: var(--dp-text-muted);
}

.search-input:focus {
  border-color: var(--dp-green);
}

.filters-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.filter-icon {
  display: flex;
  color: var(--dp-text-muted);
}

.filter-select {
  padding: 0.5rem 2rem 0.5rem 0.75rem;
  font-size: 0.9rem;
  border: 1px solid var(--dp-border);
  border-radius: 0.5rem;
  background: var(--color-background);
  color: var(--dp-text-primary);
  cursor: pointer;
  outline: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23737373' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.5rem center;
}

.movements-count {
  font-size: 0.85rem;
  color: var(--dp-text-muted);
}

.movements-error {
  color: #dc2626;
}

.movements-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.movement-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  background: var(--dp-surface);
  border: 1px solid var(--dp-border);
  border-radius: 0.75rem;
}

.movement-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  flex-shrink: 0;
  color: white;
}

.movement-icon--expense {
  background: #dc2626;
}

.movement-icon--income {
  background: var(--dp-green);
}

.movement-icon--adjustment {
  background: var(--dp-text-muted);
}

.movement-body {
  flex: 1;
  min-width: 0;
}

.movement-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.2rem;
}

.movement-description {
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--dp-text-primary);
}

.movement-type-tag {
  font-size: 0.75rem;
  padding: 0.15rem 0.5rem;
  border-radius: 9999px;
  font-weight: 500;
}

.movement-type-tag--expense {
  background: rgba(220, 38, 38, 0.15);
  color: #dc2626;
}

.movement-type-tag--income {
  background: var(--dp-green-mute);
  color: var(--dp-green);
}

.movement-type-tag--adjustment {
  background: var(--dp-surface-hover);
  color: var(--dp-text-muted);
}

.movement-meta {
  font-size: 0.8rem;
  color: var(--dp-text-muted);
}

.amount {
  font-size: 1rem;
  font-weight: 600;
  flex-shrink: 0;
}

.amount--expense {
  color: #dc2626;
}

.amount--income {
  color: var(--dp-green);
}

.movement-actions {
  display: inline-flex;
  gap: 0.25rem;
}

.crud-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: 1px solid var(--dp-border);
  border-radius: 0.5rem;
  background: transparent;
  color: var(--dp-text-primary);
  cursor: pointer;
}

.crud-icon-btn--danger {
  color: #dc2626;
}

.movement-form {
  border: 1px solid var(--dp-border);
  border-radius: 0.75rem;
  background: var(--dp-surface);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.movement-form-title {
  font-size: 1rem;
  font-weight: 600;
}

.movement-form-error {
  font-size: 0.85rem;
  color: #dc2626;
}

.movement-form-hint {
  font-size: 0.75rem;
  color: var(--dp-text-muted);
  margin: 0.25rem 0 0;
  line-height: 1.35;
}

.movement-form-hint--strong {
  color: var(--dp-text-secondary);
  font-weight: 500;
}

.movement-parcel-tag {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.1rem 0.4rem;
  border-radius: 0.25rem;
  background: var(--dp-surface-hover);
  color: var(--dp-text-muted);
}

.movement-form-row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.movement-form-group {
  flex: 1;
  min-width: 160px;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.movement-form-group label {
  font-size: 0.85rem;
  color: var(--dp-text-muted);
}

.movement-form-label-text {
  font-size: 0.85rem;
  color: var(--dp-text-muted);
}

.movement-form-group--wide {
  min-width: 200px;
}

.segmented {
  display: flex;
  border: 1px solid var(--dp-border);
  border-radius: 0.5rem;
  overflow: hidden;
  background: var(--color-background);
}

.segmented-btn {
  flex: 1;
  padding: 0.5rem 0.75rem;
  font-size: 0.9rem;
  font-weight: 500;
  border: none;
  background: transparent;
  color: var(--dp-text-secondary);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.segmented-btn--active {
  background: var(--dp-green-soft);
  color: var(--dp-green);
}

.movement-form-row--checkbox {
  align-items: center;
}

.checkbox-label {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: var(--dp-text-secondary);
  cursor: pointer;
}

.checkbox-label input {
  margin-top: 0.15rem;
  flex-shrink: 0;
}

.movement-form-select {
  width: 100%;
}

.movement-form-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>
