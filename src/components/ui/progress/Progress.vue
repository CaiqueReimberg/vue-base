<script setup lang="ts">
import { computed, type HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    modelValue?: number
    max?: number
    class?: HTMLAttributes['class']
    indicatorClass?: HTMLAttributes['class']
  }>(),
  {
    modelValue: 0,
    max: 100,
  },
)

const percentage = computed(() => {
  if (!props.max || props.max <= 0) return 0
  return Math.min(Math.max((props.modelValue / props.max) * 100, 0), 100)
})
</script>

<template>
  <div
    role="progressbar"
    :aria-valuenow="props.modelValue"
    :aria-valuemin="0"
    :aria-valuemax="props.max"
    :class="cn('relative h-2 w-full overflow-hidden rounded-full bg-secondary', props.class)"
  >
    <div
      :class="cn('h-full bg-primary transition-all duration-300 ease-out', props.indicatorClass)"
      :style="{ width: `${percentage}%` }"
    />
  </div>
</template>
