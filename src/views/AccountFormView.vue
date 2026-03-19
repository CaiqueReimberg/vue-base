<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DashboardHeader from '@/components/dashboard/DashboardHeader.vue'
import CrudFormLayout from '@/components/crud/CrudFormLayout.vue'
import { useAccountsStore } from '@/stores/accounts/accounts.store'
import { useToastStore } from '@/stores/toast/toast.store'
import type { AccountCreateInput, AccountType } from '@/types/account'

const route = useRoute()
const router = useRouter()
const store = useAccountsStore()
const toastStore = useToastStore()

const isEdit = computed(() => route.name === 'account-edit')
const id = computed(() => (route.params.id as string) ?? '')

const name = ref('')
const type = ref<AccountType>('checking')
const initialBalance = ref<number>(1000)
const submitting = ref(false)
const formError = ref('')

const typeOptions: { value: AccountType; label: string }[] = [
  { value: 'checking', label: 'Conta corrente' },
  { value: 'savings', label: 'Poupança' },
]

onMounted(async () => {
  if (isEdit.value && id.value) {
    try {
      const account = await store.fetchOne(id.value)
      name.value = account.name
      type.value = account.type
      initialBalance.value = account.balance
    } catch {
      formError.value = store.error ?? 'Conta não encontrada'
      toastStore.error(store.error ?? 'Erro ao carregar conta.')
    }
  }
})

function valid(): boolean {
  formError.value = ''
  if (!name.value.trim()) {
    formError.value = 'Informe o nome da conta.'
    return false
  }
  return true
}

async function submit() {
  if (!valid() || submitting.value) return
  submitting.value = true
  formError.value = ''
  const data: AccountCreateInput = {
    name: name.value.trim(),
    type: type.value,
    initialBalance: Number(initialBalance.value),
  }
  try {
    if (isEdit.value) {
      await store.update(id.value, data)
      toastStore.success('Conta atualizada com sucesso.')
    } else {
      await store.create(data)
      toastStore.success('Conta cadastrada com sucesso.')
    }
    await router.push({ name: 'accounts' })
  } catch {
    formError.value = store.error ?? 'Erro ao salvar'
    toastStore.error(store.error ?? 'Erro ao salvar conta.')
  } finally {
    submitting.value = false
  }
}

function cancel() {
  router.push({ name: 'accounts' })
}
</script>

<template>
  <div class="crud-page">
    <DashboardHeader compact />
    <CrudFormLayout
      :title="isEdit ? 'Editar conta' : 'Nova conta'"
      :subtitle="isEdit ? 'Altere os dados da conta.' : 'Preencha os dados da conta bancária.'"
      :submitting="submitting"
      :submit-label="isEdit ? 'Atualizar' : 'Cadastrar'"
      @submit="submit"
      @cancel="cancel"
    >
      <template #error>
        <p v-if="formError" class="crud-form-error">{{ formError }}</p>
      </template>
      <div class="crud-form-group">
        <label for="account-name">Nome</label>
        <input
          id="account-name"
          v-model="name"
          type="text"
          class="crud-form-input"
          placeholder="Ex: Banco Principal"
          required
        />
      </div>
      <div class="crud-form-group">
        <label for="account-type">Tipo</label>
        <select id="account-type" v-model="type" class="crud-form-select">
          <option v-for="opt in typeOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>
      <div class="crud-form-group">
        <label for="account-balance">Saldo inicial (R$)</label>
        <input
          id="account-balance"
          v-model.number="initialBalance"
          type="number"
          step="0.01"
          class="crud-form-input"
          placeholder="1000"
        />
      </div>
    </CrudFormLayout>
  </div>
</template>
