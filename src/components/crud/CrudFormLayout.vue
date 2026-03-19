<script setup lang="ts">
defineProps<{
  title: string
  subtitle: string
  submitting: boolean
  submitLabel: string
}>()

const emit = defineEmits<{
  submit: []
  cancel: []
}>()
</script>

<template>
  <main class="crud-form-main">
      <header class="crud-form-header">
        <h1 class="crud-form-title">{{ title }}</h1>
        <p class="crud-form-subtitle">{{ subtitle }}</p>
      </header>

      <form class="crud-form" @submit.prevent="emit('submit')">
        <slot name="error" />
        <slot />
        <div class="crud-form-actions">
          <button type="button" class="crud-btn-secondary" @click="emit('cancel')">
            Cancelar
          </button>
          <button type="submit" class="crud-btn-primary" :disabled="submitting">
            {{ submitting ? 'Salvando…' : submitLabel }}
          </button>
        </div>
      </form>
  </main>
</template>
