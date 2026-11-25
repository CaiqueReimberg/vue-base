<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Sheet } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { CurrencyInput } from '@/components/ui/currency-input'
import { incomesApi } from '@/api/incomes.api'
import { useToastStore } from '@/stores/toast/toast.store'
import type { IncomeCategory, IncomeEntry } from '@/types/income'
import {
  Briefcase,
  Building2,
  Coins,
  Gift,
  HandCoins,
  Repeat,
  ShoppingBag,
  Sparkles,
  TrendingUp,
} from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    open: boolean
    referenceMonth: string
    periodLabel?: string
    editingEntry?: IncomeEntry | null
    recentSources?: string[]
  }>(),
  {
    periodLabel: 'este mês',
    editingEntry: null,
    recentSources: () => [],
  },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: [entry: IncomeEntry]
}>()

const toastStore = useToastStore()

const INCOME_CATEGORIES: Array<{
  value: IncomeCategory
  label: string
  icon: any
}> = [
  { value: 'freelance', label: 'Freela / Serviço', icon: Briefcase },
  { value: 'salary', label: 'Salário / Fixo', icon: Building2 },
  { value: 'client', label: 'Cliente / Projeto', icon: HandCoins },
  { value: 'commission', label: 'Comissão', icon: TrendingUp },
  { value: 'bonus', label: 'Bônus / Extra', icon: Gift },
  { value: 'sale', label: 'Venda', icon: ShoppingBag },
  { value: 'investment', label: 'Rendimentos', icon: Coins },
  { value: 'other', label: 'Outro', icon: Sparkles },
]

const isRecurring = ref(false)
const amount = ref<number | ''>('')
const source = ref('')
const title = ref('')
const category = ref<IncomeCategory>('freelance')
const receivedAt = ref('')
const notes = ref('')
const submitting = ref(false)
const loadedSources = ref<string[]>([])

const availableSources = computed(() => {
  const merged = [...props.recentSources, ...loadedSources.value]
  const unique: string[] = []
  const seen = new Set<string>()
  for (const s of merged) {
    const clean = s.trim()
    const key = clean.toLowerCase()
    if (clean && !seen.has(key)) {
      seen.add(key)
      unique.push(clean)
      if (unique.length >= 6) break
    }
  }
  return unique
})

function defaultDateForMonth(ym: string): string {
  const now = new Date()
  const curYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  if (ym === curYm) {
    return `${ym}-${String(now.getDate()).padStart(2, '0')}`
  }
  return `${ym}-05`
}

function resetForm() {
  if (props.editingEntry) {
    isRecurring.value = props.editingEntry.isRecurring
    amount.value = props.editingEntry.amount
    source.value = props.editingEntry.source
    title.value =
      props.editingEntry.title === props.editingEntry.source ? '' : props.editingEntry.title
    category.value = props.editingEntry.category
    receivedAt.value = props.editingEntry.receivedAt
    notes.value = props.editingEntry.notes ?? ''
  } else {
    isRecurring.value = false
    amount.value = ''
    source.value = ''
    title.value = ''
    category.value = 'freelance'
    receivedAt.value = defaultDateForMonth(props.referenceMonth)
    notes.value = ''
  }
}

watch(
  () => [props.open, props.editingEntry, props.referenceMonth] as const,
  async ([isOpen]) => {
    if (!isOpen) return
    resetForm()
    if (props.recentSources.length === 0 && loadedSources.value.length === 0) {
      try {
        const res = await incomesApi.listByMonth(props.referenceMonth)
        loadedSources.value = res.recentSources
      } catch {
        // sugestão silenciosa
      }
    }
  },
  { immediate: true },
)

function selectMode(recurring: boolean) {
  isRecurring.value = recurring
  if (!props.editingEntry) {
    category.value = recurring ? 'salary' : 'freelance'
  }
}

async function handleSubmit() {
  const cleanSource = source.value.trim()
  const numericAmount = Number(amount.value)

  if (!cleanSource) {
    toastStore.error('Informe de onde veio esse ganho.')
    return
  }
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    toastStore.error('Informe um valor válido maior que zero.')
    return
  }

  submitting.value = true
  try {
    const cleanTitle = title.value.trim() || cleanSource
    let saved: IncomeEntry

    if (props.editingEntry) {
      saved = await incomesApi.update(props.editingEntry.id, {
        title: cleanTitle,
        source: cleanSource,
        category: category.value,
        amount: numericAmount,
        receivedAt: receivedAt.value || defaultDateForMonth(props.referenceMonth),
        isRecurring: isRecurring.value,
        notes: notes.value.trim() || null,
      })
      toastStore.success('Entrada atualizada com sucesso!')
    } else {
      saved = await incomesApi.create({
        title: cleanTitle,
        source: cleanSource,
        category: category.value,
        amount: numericAmount,
        referenceMonth: props.referenceMonth,
        receivedAt: receivedAt.value || defaultDateForMonth(props.referenceMonth),
        isRecurring: isRecurring.value,
        notes: notes.value.trim() || null,
      })
      toastStore.success('Ganho adicionado na renda do mês!')
    }

    emit('saved', saved)
    emit('update:open', false)
  } catch (e) {
    toastStore.error(e instanceof Error ? e.message : 'Não foi possível salvar a entrada.')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Sheet
    :open="open"
    :title="editingEntry ? 'Editar entrada' : `Novo ganho em ${periodLabel}`"
    description="Registre de onde veio o valor para compor automaticamente a sua renda do mês."
    @update:open="emit('update:open', $event)"
  >
    <form class="space-y-4" @submit.prevent="handleSubmit">
      <!-- Seletor: Ganho deste mês vs Ganho fixo mensal -->
      <div class="grid grid-cols-2 gap-1.5 rounded-xl border border-border bg-muted/40 p-1">
        <button
          type="button"
          class="flex items-center justify-center gap-1.5 rounded-lg py-2 px-2 text-xs font-medium transition-all"
          :class="
            !isRecurring
              ? 'bg-background text-foreground shadow-2xs font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          "
          @click="selectMode(false)"
        >
          <TrendingUp class="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span class="truncate">Entrada do mês</span>
        </button>

        <button
          type="button"
          class="flex items-center justify-center gap-1.5 rounded-lg py-2 px-2 text-xs font-medium transition-all"
          :class="
            isRecurring
              ? 'bg-background text-foreground shadow-2xs font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          "
          @click="selectMode(true)"
        >
          <Repeat class="h-3.5 w-3.5 text-primary shrink-0" />
          <span class="truncate">Fixo todo mês</span>
        </button>
      </div>

      <!-- Valor -->
      <div class="space-y-1.5">
        <label class="text-xs font-medium text-foreground">Valor recebido</label>
        <CurrencyInput
          v-model="amount"
          placeholder="Ex: 2.500,00"
          required
        />
      </div>

      <!-- De onde veio (Origem) -->
      <div class="space-y-1.5">
        <label class="text-xs font-medium text-foreground">De onde veio?</label>
        <input
          v-model="source"
          type="text"
          required
          :placeholder="
            isRecurring
              ? 'Ex: Empresa Acme, Contrato PJ, Clínica...'
              : 'Ex: Cliente João, Projeto Site, Plantão, Loja...'
          "
          class="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />

        <div v-if="availableSources.length > 0" class="flex flex-wrap items-center gap-1.5 pt-1">
          <span class="text-[11px] text-muted-foreground">Recentes:</span>
          <button
            v-for="item in availableSources"
            :key="item"
            type="button"
            class="rounded-full border px-2.5 py-0.5 text-[11px] transition-colors"
            :class="
              source.trim().toLowerCase() === item.toLowerCase()
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium'
                : 'border-border bg-muted/50 text-muted-foreground hover:text-foreground'
            "
            @click="source = item"
          >
            {{ item }}
          </button>
        </div>
      </div>

      <!-- Descrição opcional -->
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div class="space-y-1.5 sm:col-span-2">
          <label class="text-xs font-medium text-foreground">
            Descrição <span class="text-muted-foreground font-normal">(opcional)</span>
          </label>
          <input
            v-model="title"
            type="text"
            :placeholder="
              isRecurring ? 'Ex: Salário mensal, Pró labore' : 'Ex: Parcela 1 do projeto, Consultoria'
            "
            class="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div class="space-y-1.5">
          <label class="text-xs font-medium text-foreground">Data</label>
          <input
            v-model="receivedAt"
            type="date"
            class="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      <!-- Categoria rápida -->
      <div class="space-y-1.5">
        <label class="text-xs font-medium text-foreground">Tipo de ganho</label>
        <div class="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <button
            v-for="cat in INCOME_CATEGORIES"
            :key="cat.value"
            type="button"
            class="flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs transition-colors text-left"
            :class="
              category === cat.value
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold'
                : 'border-border bg-background text-muted-foreground hover:text-foreground'
            "
            @click="category = cat.value"
          >
            <component :is="cat.icon" class="h-3.5 w-3.5 shrink-0" />
            <span class="truncate">{{ cat.label }}</span>
          </button>
        </div>
      </div>

      <p class="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[11px] text-muted-foreground">
        <template v-if="isRecurring">
          Esse valor entra automaticamente na sua renda todos os meses a partir de {{ periodLabel }}, até você editar ou encerrar.
        </template>
        <template v-else>
          Esse valor soma na sua renda apenas em {{ periodLabel }}, ideal para freelas, plantões, vendas e ganhos variáveis.
        </template>
      </p>

      <div class="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" @click="emit('update:open', false)">
          Cancelar
        </Button>
        <Button type="submit" :disabled="submitting">
          {{ submitting ? 'Salvando...' : editingEntry ? 'Salvar alterações' : 'Adicionar ganho' }}
        </Button>
      </div>
    </form>
  </Sheet>
</template>
