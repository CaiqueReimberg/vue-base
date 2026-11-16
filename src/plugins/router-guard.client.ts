import { AUTH_TOKEN_KEY } from '@/api/client'

export default defineNuxtPlugin(() => {
  const router = useRouter()

  router.beforeEach((to) => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY)
    const isPublic = to.meta.public === true

    if (to.path === '/login') {
      if (token) return '/'
      return true
    }

    if (!token && !isPublic) {
      return { path: '/login', query: { redirect: to.fullPath } }
    }

    return true
  })
})
