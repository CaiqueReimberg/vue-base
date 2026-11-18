<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue?: number | string | null
    placeholder?: string
    required?: boolean
    disabled?: boolean
    id?: string
  }>(),
  {
    modelValue: '',
    placeholder: '0,00',
    required: false,
    disabled: false,
    id: undefined,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: number | '']
}>()

const isFocused = ref(false)
const rawText = ref('')

/**
 * Converte qualquer entrada digitada pelo usuário em pt-BR para número:
 * - "16000" -> 16000
 * - "1.500" -> 1500 (ponto com 3 dígitos = milhar no Brasil)
 * - "1.500,50" -> 1500.5
 * - "1500,50" -> 1500.5
 * - "1500.50" -> 1500.5 (ponto com 1 ou 2 dígitos = centavos)
 */
function parseBrlValue(input: string): number | '' {
  const cleaned = input.replace(/[^\d.,]/g, '').trim()
  if (!cleaned) return ''

  let normalized = cleaned

  if (cleaned.includes(',')) {
    // Tem vírgula: pontos são separadores de milhar e a última vírgula é decimal
    const parts = cleaned.split(',')
    const decimalPart = parts.pop() ?? ''
    const intPart = parts.join('').replace(/\./g, '')
    normalized = `${intPart || '0'}.${decimalPart.slice(0, 2)}`
  } else if (cleaned.includes('.')) {
    const parts = cleaned.split('.')
    if (parts.length > 2) {
      // Múltiplos pontos (ex: 1.000.000) -> todos são milhar
      normalized = parts.join('')
    } else {
      const [intPart, afterDot] = parts
      if (afterDot && afterDot.length === 3) {
        // Ex: "1.500" ou "16.000" -> milhar em pt-BR
        normalized = `${intPart}${afterDot}`
      } else {
        // Ex: "150.5" ou "150.50" -> decimal
        normalized = `${intPart || '0'}.${(afterDot ?? '').slice(0, 2)}`
      }
    }
  }

  const num = Number(normalized)
  if (!Number.isFinite(num)) return ''
  return Math.round(num * 100) / 100
}

function formatNumberToBrlText(val: number | string | null | undefined): string {
  if (val === '' || val === null || val === undefined) return ''
  const num = typeof val === 'number' ? val : parseBrlValue(String(val))
  if (num === '' || !Number.isFinite(num) || num === 0) return ''
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

const parsedPreview = computed(() => {
  const val = parseBrlValue(rawText.value)
  if (val === '' || val <= 0) return null
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val)
})

watch(
  () => props.modelValue,
  (newVal) => {
    if (!isFocused.value) {
      rawText.value = formatNumberToBrlText(newVal)
    }
  },
  { immediate: true },
)

function handleInput(e: Event) {
  const target = e.target as HTMLInputElement
  const filtered = target.value.replace(/[^\d.,]/g, '')
  if (filtered !== target.value) {
    target.value = filtered
  }
  rawText.value = filtered
  const parsed = parseBrlValue(filtered)
  emit('update:modelValue', parsed)
}

function handleFocus() {
  isFocused.value = true
}

function handleBlur() {
  isFocused.value = false
  const parsed = parseBrlValue(rawText.value)
  emit('update:modelValue', parsed)
  rawText.value = parsed === '' ? '' : formatNumberToBrlText(parsed)
}
</script>

<template>
  <div class="relative flex items-center">
    <span
      class="pointer-events-none absolute left-3 select-none text-xs font-semibold text-muted-foreground"
    >
      R$
    </span>
    <input
      :id="id"
      :value="rawText"
      type="text"
      inputmode="decimal"
      autocomplete="off"
      :placeholder="placeholder"
      :required="required"
      :disabled="disabled"
      class="flex h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm font-medium tabular-nums text-foreground placeholder:font-normal placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      :class="isFocused && parsedPreview ? 'pr-28' : 'pr-3'"
      @input="handleInput"
      @focus="handleFocus"
      @blur="handleBlur"
    />
    <span
      v-if="isFocused && parsedPreview"
      class="pointer-events-none absolute right-2.5 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-primary"
    >
      {{ parsedPreview }}
    </span>
  </div>
</template>
