<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import ConfirmModal from '@/components/ConfirmModal.vue'
import CrudListPage from '@/components/crud/CrudListPage.vue'
import CrudListItem from '@/components/crud/CrudListItem.vue'
import { useCardsStore } from '@/stores/cards/cards.store'
import { useToastStore } from '@/stores/toast/toast.store'
import type { Card } from '@/types/card'
import { ClipboardDocumentListIcon, PencilSquareIcon, TrashIcon } from '@heroicons/vue/24/outline'

const router = useRouter()
const store = useCardsStore()
const toastStore = useToastStore()
const { cards, loading, error, formatCurrency } = storeToRefs(store)

const confirmOpen = ref(false)
const cardToRemove = ref<Card | null>(null)

const confirmRemoveDescription = computed(() =>
  cardToRemove.value
    ? `Excluir o cartão "${cardToRemove.value.name}"? Esta ação não pode ser desfeita.`
    : ''
)

onMounted(async () => {
  try {
    await store.fetchAll()
  } catch {
    toastStore.error(store.error ?? 'Erro ao carregar cartões.')
  }
})

function goToNew() {
  router.push({ name: 'card-new' })
}

function goToEdit(card: Card) {
  router.push({ name: 'card-edit', params: { id: card.id } })
}

function goToInvoices(card: Card) {
  router.push({ name: 'card-invoices', params: { id: card.id } })
}

function openConfirmRemove(card: Card) {
  cardToRemove.value = card
  confirmOpen.value = true
}

function closeConfirm() {
  confirmOpen.value = false
  cardToRemove.value = null
}

async function confirmRemove() {
  const card = cardToRemove.value
  if (!card) return
  closeConfirm()
  try {
    await store.remove(card.id)
    toastStore.success('Cartão excluído com sucesso.')
  } catch {
    toastStore.error(store.error ?? 'Erro ao excluir cartão.')
  }
}
</script>

<template>
  <div class="crud-page">
    <ConfirmModal
      :open="confirmOpen"
      title="Excluir cartão"
      :description="confirmRemoveDescription"
      confirm-label="Excluir"
      cancel-label="Cancelar"
      variant="danger"
      @close="closeConfirm"
      @confirm="confirmRemove"
    />
    <CrudListPage
      title="Cartões"
      subtitle="Cadastro de cartões de crédito"
      :loading="loading"
      :error="error"
      :items="cards"
      count-label="cartão(ões)"
      empty-message="Nenhum cartão cadastrado."
    >
      <template #action>
        <button type="button" class="crud-btn-add" @click="goToNew">
          <span class="crud-btn-add-icon">+</span>
          Novo cartão
        </button>
      </template>
      <template #item="{ item }">
        <CrudListItem>
          <span class="crud-item-name">{{ (item as Card).name }}</span>
          <p class="crud-item-meta">
            Limite {{ formatCurrency((item as Card).limitAmount) }} •
            Fecha dia {{ (item as Card).closingDay }} •
            Vence dia {{ (item as Card).dueDay }}
          </p>
          <template #actions>
            <button
              type="button"
              class="crud-icon-btn"
              title="Faturas"
              aria-label="Ver faturas"
              @click="goToInvoices(item as Card)"
            >
              <ClipboardDocumentListIcon class="h-5 w-5" />
            </button>
            <button
              type="button"
              class="crud-icon-btn"
              title="Editar"
              aria-label="Editar"
              @click="goToEdit(item as Card)"
            >
              <PencilSquareIcon class="h-5 w-5" />
            </button>
            <button
              type="button"
              class="crud-icon-btn crud-icon-btn--danger"
              title="Excluir"
              aria-label="Excluir"
              @click="openConfirmRemove(item as Card)"
            >
              <TrashIcon class="h-5 w-5" />
            </button>
          </template>
        </CrudListItem>
      </template>
    </CrudListPage>
  </div>
</template>
