<script setup lang="ts">
</script>

<template>
  <div class="expenses-placeholder">
    <p>Lista de gastos — em breve</p>
    <router-link to="/" class="back-link">← Voltar ao dashboard</router-link>
  </div>
</template>

<style scoped>
.expenses-placeholder {
  max-width: 720px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
  text-align: center;
}

.expenses-placeholder p {
  color: var(--dp-text-secondary);
  margin-bottom: 1rem;
}

.back-link {
  font-weight: 500;
}
</style>
