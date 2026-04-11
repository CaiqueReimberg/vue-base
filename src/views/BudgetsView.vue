<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import ConfirmModal from '@/components/ConfirmModal.vue'
import CrudListPage from '@/components/crud/CrudListPage.vue'
import CrudListItem from '@/components/crud/CrudListItem.vue'
import { useBudgetsStore } from '@/stores/budgets/budgets.store'
import { useAuthStore } from '@/stores/auth/auth.store'
import { useToastStore } from '@/stores/toast/toast.store'
import type { Budget } from '@/types/budget'
import { ownerBadgeLabel, isMyResource } from '@/utils/owner'
import { PencilSquareIcon, TrashIcon } from '@heroicons/vue/24/outline'

const router = useRouter()
const store = useBudgetsStore()
const authStore = useAuthStore()
const toastStore = useToastStore()
const { budgets, loading, error, formatCurrency } = storeToRefs(store)

const currentUserId = computed(() => authStore.currentUserId)

function budgetCreatorLabel(b: Budget) {
  return ownerBadgeLabel(b.owner, currentUserId.value)
}

function canManageBudget(b: Budget) {
  return isMyResource(b.owner, currentUserId.value)
}

const confirmOpen = ref(false)
const budgetToRemove = ref<Budget | null>(null)

const confirmRemoveDescription = computed(() =>
  budgetToRemove.value
    ? `Excluir o orçamento "${budgetToRemove.value.name}"? Esta ação não pode ser desfeita.`
    : '',
)

onMounted(async () => {
  try {
    await store.fetchMonthlyList()
  } catch {
    toastStore.error(store.error ?? 'Erro ao carregar orçamentos.')
  }
})

function formatMonth(ym: string | null) {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return '—'
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

function personLabel(b: Budget) {
  const p = b.person
  if (!p) return '—'
  return p.name?.trim() || p.email
}

function audienceLabel(b: Budget) {
  return b.audience === 'shared' ? 'Compartilhado' : 'Individual'
}

function goToNew() {
  router.push({ name: 'budget-new' })
}

function goToEdit(b: Budget) {
  router.push({ name: 'budget-edit', params: { id: b.id } })
}

function openConfirmRemove(b: Budget) {
  budgetToRemove.value = b
  confirmOpen.value = true
}

function closeConfirm() {
  confirmOpen.value = false
  budgetToRemove.value = null
}

async function confirmRemove() {
  const b = budgetToRemove.value
  if (!b) return
  closeConfirm()
  try {
    await store.remove(b.id)
    toastStore.success('Orçamento excluído com sucesso.')
  } catch {
    toastStore.error(store.error ?? 'Erro ao excluir orçamento.')
  }
}
</script>

<template>
  <div class="crud-page">
    <ConfirmModal
      :open="confirmOpen"
      title="Excluir orçamento"
      :description="confirmRemoveDescription"
      confirm-label="Excluir"
      cancel-label="Cancelar"
      variant="danger"
      @close="closeConfirm"
      @confirm="confirmRemove"
    />
    <CrudListPage
      title="Orçamentos mensais"
      subtitle="Limite por pessoa e mês de referência; família opcional."
      :loading="loading"
      :error="error"
      :items="budgets"
      count-label="orçamento(s)"
      empty-message="Nenhum orçamento mensal cadastrado."
    >
      <template #action>
        <button type="button" class="crud-btn-add" @click="goToNew">
          <span class="crud-btn-add-icon">+</span>
          Novo orçamento
        </button>
      </template>
      <template #item="{ item }">
        <CrudListItem>
          <div class="crud-item-title-row">
            <span class="crud-item-title">{{ (item as Budget).name }}</span>
            <span v-if="budgetCreatorLabel(item as Budget)" class="owner-chip">
              Criado por {{ budgetCreatorLabel(item as Budget) }}
            </span>
          </div>
          <p class="crud-item-meta">
            {{ formatMonth((item as Budget).referenceMonth) }} •
            {{ audienceLabel(item as Budget) }} •
            {{ personLabel(item as Budget) }} •
            {{ formatCurrency((item as Budget).limitAmount) }}
            <template v-if="(item as Budget).family"> • {{ (item as Budget).family!.name }}</template>
            <span v-if="!(item as Budget).isActive" class="crud-item-inactive"> • inativo</span>
          </p>
          <template #actions>
            <button
              v-if="canManageBudget(item as Budget)"
              type="button"
              class="crud-icon-btn"
              title="Editar"
              aria-label="Editar"
              @click="goToEdit(item as Budget)"
            >
              <PencilSquareIcon class="h-5 w-5" />
            </button>
            <button
              v-if="canManageBudget(item as Budget)"
              type="button"
              class="crud-icon-btn crud-icon-btn--danger"
              title="Excluir"
              aria-label="Excluir"
              @click="openConfirmRemove(item as Budget)"
            >
              <TrashIcon class="h-5 w-5" />
            </button>
          </template>
        </CrudListItem>
      </template>
    </CrudListPage>
  </div>
</template>

<style scoped>
.crud-item-title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.owner-chip {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.15rem 0.45rem;
  border-radius: 0.35rem;
  background: var(--dp-green-mute);
  color: var(--dp-green);
}

.crud-item-inactive {
  color: var(--dp-text-muted);
  font-style: italic;
}
</style>
