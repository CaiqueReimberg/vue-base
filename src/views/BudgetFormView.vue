<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CrudFormLayout from '@/components/crud/CrudFormLayout.vue'
import { budgetsApi } from '@/api/budgets.api'
import { useBudgetsStore } from '@/stores/budgets/budgets.store'
import { useToastStore } from '@/stores/toast/toast.store'
import type { BudgetAudience, BudgetFormOptions, MonthlyBudgetUpdateInput } from '@/types/budget'

const route = useRoute()
const router = useRouter()
const store = useBudgetsStore()
const toastStore = useToastStore()

const isEdit = computed(() => route.name === 'budget-edit')
const id = computed(() => (route.params.id as string) ?? '')

const formOptions = ref<BudgetFormOptions | null>(null)
const optionsLoading = ref(true)

const name = ref('')
const referenceMonth = ref('')
const limitAmount = ref<number>(0)
const personId = ref('')
const linkFamily = ref(false)
const isActive = ref(true)
const audience = ref<BudgetAudience>('individual')

const submitting = ref(false)
const formError = ref('')

const canLinkFamily = computed(() => !!formOptions.value?.family)

onMounted(async () => {
  try {
    formOptions.value = await budgetsApi.getFormOptions()
    if (!isEdit.value && formOptions.value.persons.length > 0) {
      personId.value = formOptions.value.persons[0].id
    }
  } catch {
    formError.value = 'Não foi possível carregar pessoas e família.'
    toastStore.error('Erro ao carregar opções do formulário.')
  } finally {
    optionsLoading.value = false
  }

  if (isEdit.value && id.value) {
    try {
      const b = await store.fetchOne(id.value)
      if (b.period !== 'monthly' || b.scope !== 'person') {
        formError.value = 'Este registro não é um orçamento mensal por pessoa.'
      }
      name.value = b.name
      referenceMonth.value = b.referenceMonth ?? ''
      limitAmount.value = b.limitAmount
      personId.value = b.person?.id ?? ''
      linkFamily.value = !!b.family
      isActive.value = b.isActive
      audience.value = b.audience ?? 'individual'
    } catch {
      formError.value = store.error ?? 'Orçamento não encontrado'
      toastStore.error(store.error ?? 'Erro ao carregar orçamento.')
    }
  }
})

function personLabel(p: { name: string | null; email: string }) {
  return p.name?.trim() || p.email
}

function valid(): boolean {
  formError.value = ''
  if (!name.value.trim()) {
    formError.value = 'Informe um nome para o orçamento.'
    return false
  }
  if (!referenceMonth.value || !/^\d{4}-\d{2}$/.test(referenceMonth.value)) {
    formError.value = 'Informe o mês de referência (AAAA-MM).'
    return false
  }
  if (limitAmount.value == null || Number(limitAmount.value) < 0.01) {
    formError.value = 'Informe o valor limite (mín. 0,01).'
    return false
  }
  if (!personId.value) {
    formError.value = 'Selecione a pessoa.'
    return false
  }
  return true
}

async function submit() {
  if (!valid() || submitting.value) return
  submitting.value = true
  formError.value = ''

  const base = {
    name: name.value.trim(),
    referenceMonth: referenceMonth.value,
    limitAmount: Number(limitAmount.value),
    personId: personId.value,
    isActive: isActive.value,
    audience: audience.value,
  }

  try {
    if (isEdit.value) {
      const patch: MonthlyBudgetUpdateInput = { ...base }
      if (canLinkFamily.value) {
        patch.familyId =
          linkFamily.value && formOptions.value?.family ? formOptions.value.family.id : null
      }
      await store.update(id.value, patch)
      toastStore.success('Orçamento atualizado com sucesso.')
    } else {
      await store.create({
        ...base,
        ...(canLinkFamily.value && linkFamily.value && formOptions.value?.family
          ? { familyId: formOptions.value.family.id }
          : {}),
      })
      toastStore.success('Orçamento cadastrado com sucesso.')
    }
    await router.push({ name: 'budgets' })
  } catch {
    formError.value = store.error ?? 'Erro ao salvar'
    toastStore.error(store.error ?? 'Erro ao salvar orçamento.')
  } finally {
    submitting.value = false
  }
}

function cancel() {
  router.push({ name: 'budgets' })
}
</script>

<template>
  <div class="crud-page">
    <CrudFormLayout
      :title="isEdit ? 'Editar orçamento mensal' : 'Novo orçamento mensal'"
      :subtitle="
        isEdit
          ? 'Ajuste o limite, o mês, a pessoa ou o vínculo com a família.'
          : 'Defina o limite de gastos no mês para uma pessoa; vincule à família se quiser.'
      "
      :submitting="submitting || optionsLoading"
      :submit-label="isEdit ? 'Atualizar' : 'Cadastrar'"
      @submit="submit"
      @cancel="cancel"
    >
      <template #error>
        <p v-if="formError" class="crud-form-error">{{ formError }}</p>
      </template>

      <div v-if="optionsLoading" class="muted">Carregando opções…</div>

      <template v-else>
        <div class="crud-form-group">
          <label for="budget-name">Nome</label>
          <input
            id="budget-name"
            v-model="name"
            type="text"
            class="crud-form-input"
            placeholder="Ex: Março — Beatriz"
            required
          />
        </div>

        <div class="crud-form-group">
          <label for="budget-month">Mês de referência</label>
          <input id="budget-month" v-model="referenceMonth" type="month" class="crud-form-input" required />
        </div>

        <div class="crud-form-group">
          <label for="budget-audience">Tipo de orçamento</label>
          <select id="budget-audience" v-model="audience" class="crud-form-select">
            <option value="individual">Individual (só você vê; só gastos privados contam)</option>
            <option value="shared">Compartilhado (casal vê; entradas/gastos marcados como compartilhados)</option>
          </select>
          <p class="field-hint">
            No compartilhado, entradas com “compartilhar” somam ao disponível e gastos compartilhados
            consomem o limite.
          </p>
        </div>

        <div class="crud-form-group">
          <label for="budget-limit">Valor limite (R$)</label>
          <input
            id="budget-limit"
            v-model.number="limitAmount"
            type="number"
            min="0.01"
            step="0.01"
            class="crud-form-input"
            required
          />
        </div>

        <div class="crud-form-group">
          <label for="budget-person">Pessoa</label>
          <select id="budget-person" v-model="personId" class="crud-form-select" required>
            <option value="" disabled>Selecione…</option>
            <option v-for="p in formOptions?.persons ?? []" :key="p.id" :value="p.id">
              {{ personLabel(p) }}
            </option>
          </select>
        </div>

        <div v-if="canLinkFamily" class="crud-form-group crud-form-group--checkbox">
          <label class="checkbox-label">
            <input v-model="linkFamily" type="checkbox" />
            <span
              >Vincular à família
              <template v-if="formOptions?.family">“{{ formOptions.family.name }}”</template></span
            >
          </label>
          <p class="field-hint">Útil para organizar orçamentos do mesmo lar; só famílias às quais você pertence.</p>
        </div>

        <div class="crud-form-group crud-form-group--checkbox">
          <label class="checkbox-label">
            <input v-model="isActive" type="checkbox" />
            <span>Orçamento ativo</span>
          </label>
        </div>
      </template>
    </CrudFormLayout>
  </div>
</template>

<style scoped>
.field-hint {
  margin: 0.35rem 0 0;
  font-size: 0.8rem;
  color: var(--dp-text-muted);
  line-height: 1.35;
}

.crud-form-group--checkbox {
  margin-bottom: 0.75rem;
}

.checkbox-label {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: var(--dp-text-primary);
  cursor: pointer;
}

.checkbox-label input {
  margin-top: 0.2rem;
}
</style>
