<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DashboardHeader from '@/components/dashboard/DashboardHeader.vue'
import CrudFormLayout from '@/components/crud/CrudFormLayout.vue'
import { useCardsStore } from '@/stores/cards/cards.store'
import { useToastStore } from '@/stores/toast/toast.store'
import type { CardCreateInput } from '@/types/card'

const route = useRoute()
const router = useRouter()
const store = useCardsStore()
const toastStore = useToastStore()

const isEdit = computed(() => route.name === 'card-edit')
const id = computed(() => (route.params.id as string) ?? '')

const name = ref('')
const limitAmount = ref<number>(5000)
const closingDay = ref<number>(10)
const dueDay = ref<number>(20)
const submitting = ref(false)
const formError = ref('')

onMounted(async () => {
  if (isEdit.value && id.value) {
    try {
      const card = await store.fetchOne(id.value)
      name.value = card.name
      limitAmount.value = card.limitAmount
      closingDay.value = card.closingDay
      dueDay.value = card.dueDay
    } catch {
      formError.value = store.error ?? 'Cartão não encontrado'
      toastStore.error(store.error ?? 'Erro ao carregar cartão.')
    }
  }
})

const dayOptions = Array.from({ length: 28 }, (_, i) => i + 1)

function valid(): boolean {
  formError.value = ''
  if (!name.value.trim()) {
    formError.value = 'Informe o nome do cartão.'
    return false
  }
  if (limitAmount.value <= 0) {
    formError.value = 'Limite deve ser maior que zero.'
    return false
  }
  if (closingDay.value < 1 || closingDay.value > 31) {
    formError.value = 'Dia de fechamento entre 1 e 31.'
    return false
  }
  if (dueDay.value < 1 || dueDay.value > 31) {
    formError.value = 'Dia de vencimento entre 1 e 31.'
    return false
  }
  return true
}

async function submit() {
  if (!valid() || submitting.value) return
  submitting.value = true
  formError.value = ''
  const data: CardCreateInput = {
    name: name.value.trim(),
    limitAmount: Number(limitAmount.value),
    closingDay: Number(closingDay.value),
    dueDay: Number(dueDay.value),
  }
  try {
    if (isEdit.value) {
      await store.update(id.value, data)
      toastStore.success('Cartão atualizado com sucesso.')
    } else {
      await store.create(data)
      toastStore.success('Cartão cadastrado com sucesso.')
    }
    await router.push({ name: 'cards' })
  } catch {
    formError.value = store.error ?? 'Erro ao salvar'
    toastStore.error(store.error ?? 'Erro ao salvar cartão.')
  } finally {
    submitting.value = false
  }
}

function cancel() {
  router.push({ name: 'cards' })
}
</script>

<template>
  <div class="crud-page">
    <DashboardHeader compact />
    <CrudFormLayout
      :title="isEdit ? 'Editar cartão' : 'Novo cartão'"
      :subtitle="isEdit ? 'Altere os dados do cartão.' : 'Preencha os dados do cartão.'"
      :submitting="submitting"
      :submit-label="isEdit ? 'Atualizar' : 'Cadastrar'"
      @submit="submit"
      @cancel="cancel"
    >
      <template #error>
        <p v-if="formError" class="crud-form-error">{{ formError }}</p>
      </template>
      <div class="crud-form-group">
        <label for="card-name">Nome</label>
        <input
          id="card-name"
          v-model="name"
          type="text"
          class="crud-form-input"
          placeholder="Ex: Cartão Nubank"
          required
        />
      </div>
      <div class="crud-form-group">
        <label for="card-limit">Limite (R$)</label>
        <input
          id="card-limit"
          v-model.number="limitAmount"
          type="number"
          min="1"
          step="0.01"
          class="crud-form-input"
          placeholder="5000"
        />
      </div>
      <div class="crud-form-row">
        <div class="crud-form-group">
          <label for="card-closing">Dia do fechamento</label>
          <select id="card-closing" v-model.number="closingDay" class="crud-form-select">
            <option v-for="d in dayOptions" :key="d" :value="d">{{ d }}</option>
          </select>
        </div>
        <div class="crud-form-group">
          <label for="card-due">Dia do vencimento</label>
          <select id="card-due" v-model.number="dueDay" class="crud-form-select">
            <option v-for="d in dayOptions" :key="d" :value="d">{{ d }}</option>
          </select>
        </div>
      </div>
    </CrudFormLayout>
  </div>
</template>
