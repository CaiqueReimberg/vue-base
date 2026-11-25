import type { RouterConfig } from '@nuxt/schema'
import DashboardView from '@/views/DashboardView.vue'

export default <RouterConfig>{
  routes: (_routes) => [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      component: () => import('@/layouts/DashboardShell.vue'),
      children: [
        {
          path: '',
          name: 'dashboard',
          component: DashboardView,
        },
        {
          path: 'incomes',
          name: 'incomes',
          component: () => import('@/views/IncomesView.vue'),
        },
        {
          path: 'movements',
          name: 'movements',
          component: () => import('@/views/MovementsView.vue'),
        },
        {
          path: 'debts',
          name: 'debts',
          component: () => import('@/views/DebtsView.vue'),
        },
        {
          path: 'invoices',
          name: 'invoices',
          component: () => import('@/views/InvoicesBreakdownView.vue'),
        },
        {
          path: 'monthly-control',
          name: 'monthly-control',
          component: () => import('@/views/MonthlyControlView.vue'),
        },
        {
          path: 'history',
          name: 'history',
          component: () => import('@/views/HistoryView.vue'),
        },
        {
          path: 'goals',
          name: 'goals',
          component: () => import('@/views/SavingsGoalsView.vue'),
        },
        {
          path: 'agenda',
          name: 'agenda',
          component: () => import('@/views/AgendaView.vue'),
        },
        {
          path: 'expenses',
          name: 'expenses',
          component: () => import('@/views/ExpensesView.vue'),
        },
        {
          path: 'cards',
          name: 'cards',
          component: () => import('@/views/CardsView.vue'),
        },
        {
          path: 'cards/novo',
          name: 'card-new',
          component: () => import('@/views/CardFormView.vue'),
        },
        {
          path: 'cards/:id/faturas',
          name: 'card-invoices',
          component: () => import('@/views/CardInvoicesView.vue'),
        },
        {
          path: 'cards/:id/editar',
          name: 'card-edit',
          component: () => import('@/views/CardFormView.vue'),
        },
        {
          path: 'accounts',
          name: 'accounts',
          component: () => import('@/views/AccountsView.vue'),
        },
        {
          path: 'accounts/novo',
          name: 'account-new',
          component: () => import('@/views/AccountFormView.vue'),
        },
        {
          path: 'accounts/:id/editar',
          name: 'account-edit',
          component: () => import('@/views/AccountFormView.vue'),
        },
        {
          path: 'budgets',
          name: 'budgets',
          component: () => import('@/views/BudgetsView.vue'),
        },
        {
          path: 'budgets/novo',
          name: 'budget-new',
          component: () => import('@/views/BudgetFormView.vue'),
        },
        {
          path: 'budgets/:id/editar',
          name: 'budget-edit',
          component: () => import('@/views/BudgetFormView.vue'),
        },
        {
          path: 'profile',
          name: 'profile',
          component: () => import('@/views/ProfileView.vue'),
        },
        {
          path: 'admin/users',
          name: 'admin-users',
          component: () => import('@/views/AdminUsersView.vue'),
        },
      ],
    },
  ],
}
