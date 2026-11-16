<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    orientation?: 'horizontal' | 'vertical'
    class?: HTMLAttributes['class']
  }>(),
  {
    orientation: 'horizontal',
  },
)
</script>

<template>
  <div
    role="separator"
    :class="
      cn(
        'shrink-0 bg-border',
        props.orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
        props.class,
      )
    "
  />
</template>
