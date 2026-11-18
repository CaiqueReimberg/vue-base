<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  usersApi,
  type AdminUserItem,
  type SystemFeatureFlagItem,
} from '@/api/users.api'
import { useAuthStore } from '@/stores/auth/auth.store'
import { useToastStore } from '@/stores/toast/toast.store'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Lock,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from 'lucide-vue-next'

const authStore = useAuthStore()
const toastStore = useToastStore()
const router = useRouter()

const loading = ref(true)
const usersList = ref<AdminUserItem[]>([])
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const totalPages = ref(1)
const searchQuery = ref('')
const updatingUserId = ref<string | null>(null)

const loadingFeatures = ref(true)
const systemFeatures = ref<SystemFeatureFlagItem[]>([])
const updatingFeatureKey = ref<string | null>(null)

function formatDateBr(iso: string) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return iso.slice(0, 10)
  }
}

async function fetchSystemFeatures() {
  loadingFeatures.value = true
  try {
    systemFeatures.value = await usersApi.listSystemFeatures()
  } catch (err) {
    toastStore.error(
      err instanceof Error ? err.message : 'Não foi possível carregar as funcionalidades do sistema.',
    )
  } finally {
    loadingFeatures.value = false
  }
}

async function toggleSystemFeature(feat: SystemFeatureFlagItem) {
  if (updatingFeatureKey.value) return
  updatingFeatureKey.value = feat.key
  const nextVal = !feat.enabled
  try {
    const updated = await usersApi.updateSystemFeature(feat.key, nextVal)
    systemFeatures.value = systemFeatures.value.map((f) =>
      f.key === updated.key ? updated : f,
    )
    await authStore.fetchProfile()
    toastStore.success(
      nextVal
        ? `Módulo "${updated.label}" habilitado no sistema!`
        : `Módulo "${updated.label}" bloqueado e ocultado do menu!`,
    )
  } catch (err) {
    toastStore.error(
      err instanceof Error ? err.message : 'Erro ao atualizar funcionalidade.',
    )
  } finally {
    updatingFeatureKey.value = null
  }
}

async function fetchUsers(targetPage = page.value) {
  loading.value = true
  try {
    const res = await usersApi.listAdminUsers({
      page: targetPage,
      pageSize: pageSize.value,
      search: searchQuery.value.trim() || undefined,
    })
    usersList.value = res.items
    page.value = res.page
    total.value = res.total
    totalPages.value = res.totalPages
  } catch (err) {
    toastStore.error(
      err instanceof Error ? err.message : 'Não foi possível carregar a lista de usuários.',
    )
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  page.value = 1
  fetchUsers(1)
}

function goToPage(nextPage: number) {
  if (nextPage < 1 || nextPage > totalPages.value || nextPage === page.value) return
  fetchUsers(nextPage)
}

async function toggleInvoiceFeature(user: AdminUserItem) {
  if (updatingUserId.value) return
  updatingUserId.value = user.id
  const nextVal = !user.invoiceAnalysisEnabled
  try {
    const updated = await usersApi.updateAdminUserFlags(user.id, {
      invoiceAnalysisEnabled: nextVal,
    })
    usersList.value = usersList.value.map((u) => (u.id === updated.id ? updated : u))
    if (updated.id === authStore.currentUserId) {
      await authStore.fetchProfile()
    }
    toastStore.success(
      nextVal
        ? `Análise de Faturas liberada para ${updated.email}`
        : `Análise de Faturas desativada para ${updated.email}`,
    )
  } catch (err) {
    toastStore.error(
      err instanceof Error ? err.message : 'Erro ao atualizar permissão do usuário.',
    )
  } finally {
    updatingUserId.value = null
  }
}

async function toggleAdminFlag(user: AdminUserItem) {
  if (updatingUserId.value) return
  if (user.id === authStore.currentUserId && user.isAdmin) {
    toastStore.error('Você não pode remover o seu próprio acesso de administrador.')
    return
  }
  updatingUserId.value = user.id
  const nextVal = !user.isAdmin
  try {
    const updated = await usersApi.updateAdminUserFlags(user.id, {
      isAdmin: nextVal,
    })
    usersList.value = usersList.value.map((u) => (u.id === updated.id ? updated : u))
    toastStore.success(
      nextVal
        ? `Permissão de Admin concedida para ${updated.email}`
        : `Permissão de Admin removida de ${updated.email}`,
    )
  } catch (err) {
    toastStore.error(
      err instanceof Error ? err.message : 'Erro ao atualizar permissão de administrador.',
    )
  } finally {
    updatingUserId.value = null
  }
}

onMounted(async () => {
  if (!authStore.profileLoaded) {
    await authStore.fetchProfile()
  }
  if (!authStore.isAdmin) {
    toastStore.error('Acesso restrito a administradores.')
    router.replace('/')
    return
  }
  fetchSystemFeatures()
  fetchUsers(1)
})
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-6">
    <!-- Cabeçalho -->
    <header class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-xl font-bold tracking-tight text-foreground">
            Gestão de Usuários e Features
          </h1>
          <Badge variant="default" class="text-[10px] px-2 py-0.5">
            Admin
          </Badge>
        </div>
        <p class="mt-0.5 text-xs text-muted-foreground">
          Visualize todos os usuários cadastrados e habilite recursos e permissões em tempo real.
        </p>
      </div>

      <!-- Busca por email ou nome -->
      <form class="flex items-center gap-2" @submit.prevent="handleSearch">
        <div class="relative">
          <Search class="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Buscar por email ou nome..."
            class="flex h-9 w-64 rounded-lg border border-input bg-background pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <Button type="submit" size="sm" variant="secondary">
          Buscar
        </Button>
      </form>
    </header>

    <!-- Card 1: Controle Global de Módulos e Funcionalidades do Sistema -->
    <Card>
      <CardHeader class="border-b border-border py-3.5 px-5">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <SlidersHorizontal class="h-4 w-4 text-primary" />
            <CardTitle class="text-sm font-semibold">
              Módulos e Funcionalidades do Sistema
            </CardTitle>
          </div>
          <CardDescription class="text-xs">
            Ligue ou bloqueie módulos inteiros do menu e da aplicação
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent class="p-5">
        <div v-if="loadingFeatures" class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton v-for="n in 6" :key="n" class="h-20 w-full rounded-xl" />
        </div>

        <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <button
            v-for="feat in systemFeatures"
            :key="feat.key"
            type="button"
            class="flex flex-col justify-between gap-2 rounded-xl border p-3.5 text-left transition-all disabled:opacity-50"
            :class="
              feat.enabled
                ? 'border-emerald-500/35 bg-emerald-500/5 hover:bg-emerald-500/10'
                : 'border-border bg-muted/30 opacity-80 hover:opacity-100'
            "
            :disabled="updatingFeatureKey === feat.key"
            @click="toggleSystemFeature(feat)"
          >
            <div class="flex items-center justify-between gap-2 w-full">
              <span class="text-xs font-bold text-foreground truncate">
                {{ feat.label }}
              </span>
              <Badge
                :variant="feat.enabled ? 'success' : 'secondary'"
                class="text-[10px] px-1.5 py-0 shrink-0 gap-1"
              >
                <Check v-if="feat.enabled" class="h-2.5 w-2.5" />
                <Lock v-else class="h-2.5 w-2.5" />
                <span>{{ feat.enabled ? 'Ativo' : 'Bloqueado' }}</span>
              </Badge>
            </div>

            <p class="text-[11px] text-muted-foreground line-clamp-2">
              {{ feat.description }}
            </p>
          </button>
        </div>
      </CardContent>
    </Card>

    <!-- Card 2: Lista Paginada de Usuários -->
    <Card>
      <CardHeader class="flex flex-row items-center justify-between border-b border-border py-3.5 px-5">
        <div class="flex items-center gap-2">
          <Users class="h-4 w-4 text-primary" />
          <CardTitle class="text-sm font-semibold">
            Usuários Cadastrados
          </CardTitle>
          <Badge variant="secondary">{{ total }}</Badge>
        </div>
        <CardDescription class="text-xs">
          Página {{ page }} de {{ totalPages }}
        </CardDescription>
      </CardHeader>

      <CardContent class="p-0">
        <!-- Skeleton Loader -->
        <div v-if="loading" class="divide-y divide-border">
          <div
            v-for="n in 5"
            :key="n"
            class="flex items-center justify-between gap-4 px-5 py-4"
          >
            <div class="space-y-1.5">
              <Skeleton class="h-4 w-48" />
              <Skeleton class="h-3 w-32" />
            </div>
            <div class="flex items-center gap-2">
              <Skeleton class="h-8 w-36 rounded-lg" />
              <Skeleton class="h-8 w-24 rounded-lg" />
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div
          v-else-if="usersList.length === 0"
          class="flex flex-col items-center justify-center py-12 text-center"
        >
          <p class="text-sm font-medium text-foreground">
            Nenhum usuário encontrado
          </p>
          <p class="mt-0.5 text-xs text-muted-foreground">
            Tente ajustar o termo de busca acima.
          </p>
        </div>

        <!-- Lista de Usuários -->
        <ul v-else class="divide-y divide-border" role="list">
          <li
            v-for="u in usersList"
            :key="u.id"
            class="flex flex-col justify-between gap-4 px-5 py-4 hover:bg-muted/30 sm:flex-row sm:items-center"
          >
            <div class="min-w-0 space-y-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-sm font-semibold text-foreground truncate">
                  {{ u.email }}
                </span>
                <Badge v-if="u.isAdmin" variant="default" class="text-[10px] px-1.5 py-0">
                  Admin
                </Badge>
                <Badge v-if="u.hasPartner" variant="secondary" class="text-[10px] px-1.5 py-0">
                  Em casal
                </Badge>
              </div>
              <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span v-if="u.name">{{ u.name }} ·</span>
                <span>Cadastrado em {{ formatDateBr(u.createdAt) }}</span>
              </div>
            </div>

            <!-- Botões de Toggle de Feature Flags -->
            <div class="flex flex-wrap items-center gap-2 shrink-0">
              <!-- Feature Flag: Análise de Faturas -->
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
                :class="
                  u.invoiceAnalysisEnabled
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground'
                "
                :disabled="updatingUserId === u.id"
                @click="toggleInvoiceFeature(u)"
              >
                <FileSpreadsheet class="h-3.5 w-3.5" />
                <span>Análise de Faturas</span>
                <span
                  class="flex h-4 w-4 items-center justify-center rounded-full"
                  :class="
                    u.invoiceAnalysisEnabled
                      ? 'bg-emerald-600 text-white'
                      : 'border border-muted-foreground/40'
                  "
                >
                  <Check v-if="u.invoiceAnalysisEnabled" class="h-2.5 w-2.5" />
                </span>
              </button>

              <!-- Flag: Admin -->
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
                :class="
                  u.isAdmin
                    ? 'border-primary/40 bg-primary/10 text-primary font-semibold'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground'
                "
                :disabled="updatingUserId === u.id || (u.id === authStore.currentUserId && u.isAdmin)"
                :title="
                  u.id === authStore.currentUserId
                    ? 'Sua conta atual de administrador'
                    : 'Alternar permissão de administrador'
                "
                @click="toggleAdminFlag(u)"
              >
                <ShieldCheck class="h-3.5 w-3.5" />
                <span>Admin</span>
                <span
                  class="flex h-4 w-4 items-center justify-center rounded-full"
                  :class="
                    u.isAdmin
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-muted-foreground/40'
                  "
                >
                  <Check v-if="u.isAdmin" class="h-2.5 w-2.5" />
                </span>
              </button>
            </div>
          </li>
        </ul>

        <!-- Rodapé de Paginação -->
        <div
          v-if="totalPages > 1"
          class="flex items-center justify-between border-t border-border px-5 py-3"
        >
          <span class="text-xs text-muted-foreground">
            Total de {{ total }} usuário(s)
          </span>

          <div class="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="xs"
              :disabled="page <= 1 || loading"
              @click="goToPage(page - 1)"
            >
              <ChevronLeft class="h-3.5 w-3.5" />
              <span>Anterior</span>
            </Button>

            <span class="px-2 text-xs font-medium text-foreground">
              {{ page }} / {{ totalPages }}
            </span>

            <Button
              variant="outline"
              size="xs"
              :disabled="page >= totalPages || loading"
              @click="goToPage(page + 1)"
            >
              <span>Próxima</span>
              <ChevronRight class="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
