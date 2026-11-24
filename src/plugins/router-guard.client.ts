import { useAuthStore } from '@/stores/auth/auth.store'

export default defineNuxtPlugin(() => {
  const router = useRouter()

  router.beforeEach(async (to) => {
    const authStore = useAuthStore()
    const token = authStore.syncTokenFromStorage()
    const isPublic = to.meta.public === true

    if (to.path === '/login') {
      if (token && authStore.isAuthenticated) {
        if (!authStore.profileLoaded) {
          await authStore.fetchProfile()
        }
        return authStore.isPremium ? '/' : '/profile'
      }
      return true
    }

    if (!token || !authStore.isAuthenticated) {
      if (!isPublic) {
        return { path: '/login', query: { redirect: to.fullPath } }
      }
      return true
    }

    // Garante que o perfil do token atual seja validado quando necessário
    if (
      !authStore.profileLoaded ||
      (authStore.profile && authStore.profile.id !== authStore.currentUserId)
    ) {
      await authStore.fetchProfile()
    }

    // Usuários sem Premium (e que não são Admin) só podem acessar o próprio perfil
    if (!authStore.isPremium && to.path !== '/profile') {
      return '/profile'
    }

    return true
  })
})
