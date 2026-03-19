import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '../views/DashboardView.vue'
import { AUTH_TOKEN_KEY } from '@/api/client'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      name: 'dashboard',
      component: DashboardView,
    },

    {
      path: '/movements',
      name: 'movements',
      component: () => import('../views/MovementsView.vue'),
    },
    {
      path: '/expenses',
      name: 'expenses',
      component: () => import('../views/ExpensesView.vue'),
    },
    {
      path: '/cards',
      name: 'cards',
      component: () => import('../views/CardsView.vue'),
    },
    {
      path: '/cards/novo',
      name: 'card-new',
      component: () => import('../views/CardFormView.vue'),
    },
    {
      path: '/cards/:id/editar',
      name: 'card-edit',
      component: () => import('../views/CardFormView.vue'),
    },
    {
      path: '/accounts',
      name: 'accounts',
      component: () => import('../views/AccountsView.vue'),
    },
    {
      path: '/accounts/novo',
      name: 'account-new',
      component: () => import('../views/AccountFormView.vue'),
    },
    {
      path: '/accounts/:id/editar',
      name: 'account-edit',
      component: () => import('../views/AccountFormView.vue'),
    },
  ],
})

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  const isPublic = to.meta.public === true

  if (to.path === '/login') {
    if (token) next('/')
    else next()
    return
  }

  if (!token && !isPublic) {
    next({ path: '/login', query: { redirect: to.fullPath } })
    return
  }

  next()
})

export default router
