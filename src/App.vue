<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import AppToast from '@/components/AppToast.vue'
import { useThemeStore } from '@/stores/theme/theme.store'

const themeStore = useThemeStore()
themeStore.init()

onMounted(() => {
  themeStore.init()
})
</script>

<template>
  <RouterView />
  <AppToast />
</template>
