<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import ConfirmModal from '@/components/ConfirmModal.vue'
import CrudListPage from '@/components/crud/CrudListPage.vue'
import CrudListItem from '@/components/crud/CrudListItem.vue'
import { useAccountsStore } from '@/stores/accounts/accounts.store'
import { useToastStore } from '@/stores/toast/toast.store'
import type { Account } from '@/types/account'
import { PencilSquareIcon, TrashIcon } from '@heroicons/vue/24/outline'

const router = useRouter()
const store = useAccountsStore()
const toastStore = useToastStore()
const { accounts, loading, error, formatCurrency, typeLabel } = storeToRefs(store)

const confirmOpen = ref(false)
const accountToRemove = ref<Account | null>(null)

const confirmRemoveDescription = computed(() =>
  accountToRemove.value
    ? `Excluir a conta "${accountToRemove.value.name}"? Esta ação não pode ser desfeita.`
    : ''
)

onMounted(async () => {
  try {
    await store.fetchAll()
  } catch {
    toastStore.error(store.error ?? 'Erro ao carregar contas.')
  }
})

function goToNew() {
  router.push({ name: 'account-new' })
}

function goToEdit(account: Account) {
  router.push({ name: 'account-edit', params: { id: account.id } })
}

function openConfirmRemove(account: Account) {
  accountToRemove.value = account
  confirmOpen.value = true
}

function closeConfirm() {
  confirmOpen.value = false
  accountToRemove.value = null
}

async function confirmRemove() {
  const account = accountToRemove.value
  if (!account) return
  closeConfirm()
  try {
    await store.remove(account.id)
    toastStore.success('Conta excluída com sucesso.')
  } catch {
    toastStore.error(store.error ?? 'Erro ao excluir conta.')
  }
}
</script>

<template>
  <div class="crud-page">
    <ConfirmModal
      :open="confirmOpen"
      title="Excluir conta"
      :description="confirmRemoveDescription"
      confirm-label="Excluir"
      cancel-label="Cancelar"
      variant="danger"
      @close="closeConfirm"
      @confirm="confirmRemove"
    />
    <CrudListPage
      title="Contas bancárias"
      subtitle="Cadastro de contas corrente e poupança"
      :loading="loading"
      :error="error"
      :items="accounts"
      count-label="conta(s)"
      empty-message="Nenhuma conta cadastrada."
    >
      <template #action>
        <button type="button" class="crud-btn-add" @click="goToNew">
          <span class="crud-btn-add-icon">+</span>
          Nova conta
        </button>
      </template>
      <template #item="{ item }">
        <CrudListItem>
          <span class="crud-item-name">{{ (item as Account).name }}</span>
          <p class="crud-item-meta">
            {{ typeLabel((item as Account).type) }} •
            Saldo inicial {{ formatCurrency((item as Account).balance) }}
          </p>
          <template #actions>
            <button
              type="button"
              class="crud-icon-btn"
              title="Editar"
              aria-label="Editar"
              @click="goToEdit(item as Account)"
            >
              <PencilSquareIcon class="h-5 w-5" />
            </button>
            <button
              type="button"
              class="crud-icon-btn crud-icon-btn--danger"
              title="Excluir"
              aria-label="Excluir"
              @click="openConfirmRemove(item as Account)"
            >
              <TrashIcon class="h-5 w-5" />
            </button>
          </template>
        </CrudListItem>
      </template>
    </CrudListPage>
  </div>
</template>
