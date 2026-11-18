<script setup lang="ts">
import { Skeleton } from '@/components/ui/skeleton'
import CrudPageHeader from './CrudPageHeader.vue'

defineProps<{
  title: string
  subtitle: string
  loading: boolean
  error: string | null
  items: { id: string }[]
  countLabel: string
  emptyMessage: string
}>()
</script>

<template>
  <main class="crud-main">
      <CrudPageHeader :title="title" :subtitle="subtitle">
        <template #action>
          <slot name="action" />
        </template>
      </CrudPageHeader>

      <p v-if="error" class="crud-error">{{ error }}</p>

      <div v-if="loading && items.length === 0" class="space-y-3 py-2">
        <Skeleton class="h-4 w-28" />
        <div
          v-for="n in 3"
          :key="n"
          class="flex items-center justify-between rounded-xl border border-border bg-card p-4"
        >
          <div class="space-y-2">
            <Skeleton class="h-4 w-40" />
            <Skeleton class="h-3 w-56" />
          </div>
          <div class="flex items-center gap-2">
            <Skeleton class="h-8 w-8 rounded-lg" />
            <Skeleton class="h-8 w-8 rounded-lg" />
          </div>
        </div>
      </div>

      <template v-else>
        <p class="crud-count">{{ items.length }} {{ countLabel }}</p>
        <ul class="crud-list">
          <li v-for="item in items" :key="item.id">
            <slot name="item" :item="item" />
          </li>
        </ul>
        <p v-if="items.length === 0" class="crud-empty">{{ emptyMessage }}</p>
      </template>
  </main>
</template>
