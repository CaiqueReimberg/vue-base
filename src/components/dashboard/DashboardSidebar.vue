<script setup lang="ts">
import { useThemeStore } from '@/stores/theme/theme.store'
import { useAuthStore } from '@/stores/auth/auth.store'
import { storeToRefs } from 'pinia'
import {
  SunIcon,
  MoonIcon,
  Squares2X2Icon,
  ArrowsRightLeftIcon,
  CreditCardIcon,
  BuildingLibraryIcon,
  BanknotesIcon,
  ArrowRightOnRectangleIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  UserCircleIcon,
} from '@heroicons/vue/24/outline'
import { useRoute, useRouter } from 'vue-router'

defineProps<{
  collapsed: boolean
  mobileOpen: boolean
}>()

const emit = defineEmits<{
  'toggle-collapse': []
}>()

const router = useRouter()
const route = useRoute()
const themeStore = useThemeStore()
const authStore = useAuthStore()
const { isDark } = storeToRefs(themeStore)

const navItems = [
  { to: '/', label: 'Dashboard', icon: Squares2X2Icon, exact: true },
  { to: '/movements', label: 'Movimentações', icon: ArrowsRightLeftIcon, exact: false },
  { to: '/cards', label: 'Cartões', icon: CreditCardIcon, exact: false },
  { to: '/accounts', label: 'Contas', icon: BuildingLibraryIcon, exact: false },
  { to: '/budgets', label: 'Orçamentos', icon: BanknotesIcon, exact: false },
] as const

function toggleTheme() {
  themeStore.toggle()
}

function logout() {
  authStore.logout()
  router.push('/login')
}
</script>

<template>
  <aside
    class="sidebar"
    :class="{
      'sidebar--collapsed': collapsed,
      'sidebar--mobile-open': mobileOpen,
    }"
    aria-label="Menu principal"
  >
    <div class="sidebar-inner">
      <div class="sidebar-brand">
        <span class="logo-icon" aria-hidden="true">♥</span>
        <span v-show="mobileOpen || !collapsed" class="logo-text">DuoPact</span>
      </div>

      <nav class="sidebar-nav" aria-label="Navegação">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          v-slot="{ href, navigate, isActive, isExactActive }"
          :to="item.to"
          custom
        >
          <a
            :href="href"
            class="nav-item"
            :class="{ 'nav-item--active': item.exact ? isExactActive : isActive }"
            @click.prevent="navigate()"
          >
            <component :is="item.icon" class="nav-item-icon h-5 w-5 shrink-0" aria-hidden="true" />
            <span v-show="mobileOpen || !collapsed" class="nav-item-label">{{ item.label }}</span>
          </a>
        </RouterLink>
      </nav>

      <RouterLink
        to="/profile"
        class="sidebar-profile"
        :class="{ 'sidebar-profile--active': route.name === 'profile' }"
      >
        <UserCircleIcon class="sidebar-profile-icon h-6 w-6 shrink-0" aria-hidden="true" />
        <span v-show="mobileOpen || !collapsed" class="sidebar-profile-label">Perfil</span>
      </RouterLink>

      <div class="sidebar-footer">
        <button
          type="button"
          class="footer-btn"
          :title="isDark ? 'Usar tema claro' : 'Usar tema escuro'"
          :aria-label="isDark ? 'Usar tema claro' : 'Usar tema escuro'"
          @click="toggleTheme"
        >
          <SunIcon v-if="isDark" class="h-5 w-5 shrink-0" />
          <MoonIcon v-else class="h-5 w-5 shrink-0" />
          <span v-show="mobileOpen || !collapsed" class="footer-btn-label">Tema</span>
        </button>
        <button
          type="button"
          class="footer-btn footer-btn--danger"
          title="Sair"
          aria-label="Sair"
          @click="logout"
        >
          <ArrowRightOnRectangleIcon class="h-5 w-5 shrink-0" />
          <span v-show="mobileOpen || !collapsed" class="footer-btn-label">Sair</span>
        </button>

        <button
          type="button"
          class="collapse-toggle"
          :title="collapsed ? 'Expandir menu' : 'Recolher menu'"
          :aria-label="collapsed ? 'Expandir menu' : 'Recolher menu'"
          :aria-expanded="!collapsed"
          @click="emit('toggle-collapse')"
        >
          <ChevronDoubleRightIcon v-if="collapsed" class="h-5 w-5" />
          <ChevronDoubleLeftIcon v-else class="h-5 w-5" />
        </button>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  flex-shrink: 0;
  width: 15rem;
  min-height: 100vh;
  min-height: 100dvh;
  border-right: 1px solid var(--dp-border);
  background: var(--color-background-soft);
  transition: width 0.2s ease, transform 0.2s ease;
}

@media (min-width: 768px) {
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 30;
    height: 100vh;
    height: 100dvh;
  }

  .sidebar--collapsed {
    width: 4.5rem;
  }
}

.sidebar-inner {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  max-height: 100%;
  padding: 0.75rem 0.5rem;
  gap: 0.75rem;
  box-sizing: border-box;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.5rem 0.5rem;
  min-height: 2.5rem;
}

.logo-icon {
  color: var(--dp-green);
  font-size: 1.35rem;
  line-height: 1;
}

.logo-text {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--dp-text-primary);
  white-space: nowrap;
  overflow: hidden;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.sidebar-profile {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.55rem 0.65rem;
  margin-top: auto;
  border-radius: 0.5rem;
  color: var(--dp-text-secondary);
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 600;
  transition: background 0.15s, color 0.15s;
  flex-shrink: 0;
}

.sidebar-profile:hover {
  background: var(--dp-surface);
  color: var(--dp-text-primary);
}

.sidebar-profile--active {
  background: var(--dp-green-mute);
  color: var(--dp-green);
}

.sidebar-profile-label {
  white-space: nowrap;
  overflow: hidden;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.55rem 0.65rem;
  border-radius: 0.5rem;
  color: var(--dp-text-secondary);
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 500;
  transition: background 0.15s, color 0.15s;
}

.nav-item:hover {
  background: var(--dp-surface);
  color: var(--dp-text-primary);
}

.nav-item--active {
  background: var(--dp-green-mute);
  color: var(--dp-green);
}

.nav-item-label {
  white-space: nowrap;
  overflow: hidden;
}

.sidebar-footer {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--dp-border);
}

.footer-btn {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  width: 100%;
  padding: 0.5rem 0.65rem;
  border: none;
  border-radius: 0.5rem;
  background: transparent;
  color: var(--dp-text-secondary);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s, color 0.15s;
}

.footer-btn:hover {
  background: var(--dp-surface);
  color: var(--dp-text-primary);
}

.footer-btn--danger:hover {
  color: hsl(0, 65%, 45%);
}

.collapse-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  margin-top: 0.25rem;
  padding: 0.45rem;
  border: none;
  border-radius: 0.5rem;
  background: transparent;
  color: var(--dp-text-muted);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.collapse-toggle:hover {
  background: var(--dp-surface);
  color: var(--dp-text-primary);
}

@media (max-width: 767px) {
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 50;
    width: min(17rem, 88vw);
    min-height: 100dvh;
    transform: translateX(-100%);
    box-shadow: 4px 0 24px rgba(0, 0, 0, 0.12);
  }

  .sidebar--mobile-open {
    transform: translateX(0);
  }

  .sidebar--collapsed {
    width: min(17rem, 88vw);
  }

  .collapse-toggle {
    display: none;
  }
}
</style>
