<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{
  modelValue?: boolean
  class?: HTMLAttributes['class']
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<template>
  <input
    type="checkbox"
    :checked="props.modelValue"
    :class="
      cn(
        'h-4 w-4 shrink-0 cursor-pointer rounded border border-border accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        props.class,
      )
    "
    @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
  />
</template>
