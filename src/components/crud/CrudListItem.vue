<template>
  <div class="crud-item">
    <div class="crud-item-body">
      <slot />
    </div>
    <div v-if="$slots.actions" class="crud-item-actions">
      <slot name="actions" />
    </div>
  </div>
</template>
