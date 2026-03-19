<script setup lang="ts">
defineProps<{
  title: string
  subtitle: string
}>()
</script>

<template>
  <header class="crud-header">
    <div class="crud-title-block">
      <h1 class="crud-title">{{ title }}</h1>
      <p class="crud-subtitle">{{ subtitle }}</p>
    </div>
    <slot name="action" />
  </header>
</template>
