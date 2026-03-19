<script setup lang="ts">
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

      <div v-if="loading && items.length === 0" class="crud-loading">
        Carregando…
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
