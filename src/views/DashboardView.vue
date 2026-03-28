<script setup lang="ts">
import { onMounted } from 'vue'
import DashboardHomeBanner from '@/components/dashboard/DashboardHomeBanner.vue'
import DashboardOverviewCard from '@/components/dashboard/DashboardOverviewCard.vue'
import DashboardIncomeCards from '@/components/dashboard/DashboardIncomeCards.vue'
import DashboardFilterChips from '@/components/dashboard/DashboardFilterChips.vue'
import DashboardAlertCard from '@/components/dashboard/DashboardAlertCard.vue'
import DashboardWhatsAppCard from '@/components/dashboard/DashboardWhatsAppCard.vue'
import DashboardLatestExpenses from '@/components/dashboard/DashboardLatestExpenses.vue'
import { useDashboardStore } from '@/stores/dashboard/dashboard.store'
import { useToastStore } from '@/stores/toast/toast.store'

const dashboardStore = useDashboardStore()
const toastStore = useToastStore()

onMounted(async () => {
  await dashboardStore.fetchSummary()
  if (dashboardStore.error) {
    toastStore.error(dashboardStore.error)
  }
})
</script>

<template>
  <div class="dashboard">
    <DashboardHomeBanner />
    <DashboardOverviewCard />
    <DashboardIncomeCards />
    <DashboardFilterChips />
    <DashboardAlertCard />
    <DashboardWhatsAppCard />
    <DashboardLatestExpenses />
  </div>
</template>

<style scoped>
.dashboard {
  max-width: 720px;
  margin: 0 auto;
  padding: 1rem 1.5rem 2rem;
}

@media (max-width: 640px) {
  .dashboard {
    padding: 0.75rem 1rem 1.5rem;
  }
}

@media (max-width: 380px) {
  .dashboard {
    padding: 0.5rem 0.75rem 1rem;
  }
}
</style>
