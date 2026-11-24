<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { usersApi, type UserProfile } from '@/api/users.api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/stores/auth/auth.store'
import { useToastStore } from '@/stores/toast/toast.store'
import {
  Crown,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  PlayCircle,
  ShieldCheck,
  User,
  Users,
} from 'lucide-vue-next'

const router = useRouter()
const authStore = useAuthStore()
const toastStore = useToastStore()

const loading = ref(true)
const savingProfile = ref(false)
const savingPassword = ref(false)
const linking = ref(false)
const profile = ref<UserProfile | null>(null)

const nameInput = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const partnerEmailInput = ref('')

const hasPremiumAccess = computed(() =>
  Boolean(profile.value?.isPremium || profile.value?.isAdmin),
)

async function load() {
  loading.value = true
  try {
    const me = await usersApi.getMe()
    profile.value = me
    nameInput.value = me.name ?? ''
    authStore.profile = me
    authStore.profileLoaded = true
  } catch (e) {
    toastStore.error(e instanceof Error ? e.message : 'Não foi possível carregar o perfil.')
  } finally {
    loading.value = false
  }
}

onMounted(load)

async function saveName() {
  savingProfile.value = true
  try {
    const updated = await usersApi.updateMe({ name: nameInput.value.trim() })
    profile.value = updated
    authStore.profile = updated
    toastStore.success('Nome atualizado com sucesso.')
  } catch (e) {
    toastStore.error(e instanceof Error ? e.message : 'Erro ao atualizar nome.')
  } finally {
    savingProfile.value = false
  }
}

async function savePassword() {
  if (!newPassword.value) {
    toastStore.error('Informe a nova senha.')
    return
  }
  if (newPassword.value.length < 6) {
    toastStore.error('A senha deve ter no mínimo 6 caracteres.')
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    toastStore.error('As senhas não coincidem.')
    return
  }
  savingPassword.value = true
  try {
    const updated = await usersApi.updateMe({ password: newPassword.value })
    profile.value = updated
    authStore.profile = updated
    newPassword.value = ''
    confirmPassword.value = ''
    toastStore.success('Senha atualizada.')
  } catch (e) {
    toastStore.error(e instanceof Error ? e.message : 'Erro ao atualizar senha.')
  } finally {
    savingPassword.value = false
  }
}

async function linkPartner() {
  const email = partnerEmailInput.value.trim()
  if (!email) {
    toastStore.error('Informe o email da outra pessoa.')
    return
  }
  linking.value = true
  try {
    const updated = await usersApi.linkPartner(email)
    profile.value = updated
    authStore.profile = updated
    partnerEmailInput.value = ''
    toastStore.success('Vínculo criado.')
  } catch (e) {
    toastStore.error(e instanceof Error ? e.message : 'Não foi possível vincular.')
  } finally {
    linking.value = false
  }
}

async function unlinkPartner() {
  linking.value = true
  try {
    const updated = await usersApi.unlinkPartner()
    profile.value = updated
    authStore.profile = updated
    toastStore.success('Vínculo removido.')
  } catch (e) {
    toastStore.error(e instanceof Error ? e.message : 'Erro ao remover vínculo.')
  } finally {
    linking.value = false
  }
}

function handleLogout() {
  authStore.logout()
  router.push('/login')
}
</script>

<template>
  <div class="mx-auto max-w-xl px-4 py-6 sm:px-6 space-y-5">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold tracking-tight text-foreground">
          {{ hasPremiumAccess ? 'Perfil e Casal' : 'Meu Perfil' }}
        </h1>
        <p class="mt-0.5 text-xs text-muted-foreground">
          {{
            hasPremiumAccess
              ? 'Gerencie seus dados de acesso e o compartilhamento em casal.'
              : 'Gerencie seus dados pessoais e sua senha de acesso.'
          }}
        </p>
      </div>

      <div v-if="profile" class="flex items-center gap-1.5">
        <Badge v-if="profile.isAdmin" variant="default" class="gap-1 text-xs">
          <ShieldCheck class="h-3 w-3" />
          Admin
        </Badge>
        <Badge v-if="hasPremiumAccess" variant="warning" class="gap-1 text-xs">
          <Crown class="h-3 w-3" />
          Premium
        </Badge>
        <Badge v-else variant="secondary" class="gap-1 text-xs">
          <Lock class="h-3 w-3" />
          Conta básica
        </Badge>
      </div>
    </header>

    <div v-if="loading" class="space-y-4">
      <Card v-for="n in 2" :key="n">
        <CardContent class="p-5 space-y-3">
          <Skeleton class="h-4 w-32" />
          <Skeleton class="h-9 w-full rounded-lg" />
          <Skeleton class="h-8 w-28 rounded-lg" />
        </CardContent>
      </Card>
    </div>

    <template v-else-if="profile">
      <!-- Aviso de restrição para usuários sem Premium -->
      <Card
        v-if="!hasPremiumAccess"
        class="border-amber-500/35 bg-amber-500/5"
      >
        <CardContent class="flex items-start gap-3 p-4 sm:p-5">
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <Crown class="h-4 w-4" />
          </div>
          <div class="space-y-1">
            <h2 class="text-sm font-bold text-foreground">
              Acesso exclusivo ao plano Premium
            </h2>
            <p class="text-xs leading-relaxed text-muted-foreground">
              Sua conta está ativa no modo básico, com visualização restrita ao seu próprio perfil.
              Assim que o administrador habilitar o <strong>Premium</strong> para o seu email, todos os módulos financeiros do DuoPact serão liberados automaticamente.
            </p>
          </div>
        </CardContent>
      </Card>

      <!-- Card 1: Dados Pessoais -->
      <Card>
        <CardHeader class="border-b border-border py-3.5 px-5">
          <div class="flex items-center gap-2">
            <User class="h-4 w-4 text-primary" />
            <CardTitle class="text-sm font-semibold">Seus dados</CardTitle>
          </div>
        </CardHeader>

        <CardContent class="p-5 space-y-4">
          <div class="space-y-1">
            <label class="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Mail class="h-3.5 w-3.5" />
              Email de acesso
            </label>
            <p class="text-sm font-semibold text-foreground break-all">
              {{ profile.email }}
            </p>
          </div>

          <form class="space-y-3 border-t border-border pt-4" @submit.prevent="saveName">
            <div class="space-y-1.5">
              <label for="profile-name" class="text-xs font-medium text-foreground">
                Seu nome
              </label>
              <input
                id="profile-name"
                v-model="nameInput"
                type="text"
                placeholder="Como prefere ser chamado"
                class="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <Button type="submit" size="sm" variant="secondary" :disabled="savingProfile">
              {{ savingProfile ? 'Salvando...' : 'Salvar nome' }}
            </Button>
          </form>
        </CardContent>
      </Card>

      <!-- Card 2: Alterar Senha -->
      <Card>
        <CardHeader class="border-b border-border py-3.5 px-5">
          <div class="flex items-center gap-2">
            <KeyRound class="h-4 w-4 text-primary" />
            <CardTitle class="text-sm font-semibold">Alterar senha</CardTitle>
          </div>
        </CardHeader>

        <CardContent class="p-5">
          <form class="space-y-3.5" @submit.prevent="savePassword">
            <div class="space-y-1.5">
              <label for="pw-new" class="text-xs font-medium text-foreground">
                Nova senha
              </label>
              <input
                id="pw-new"
                v-model="newPassword"
                type="password"
                autocomplete="new-password"
                minlength="6"
                placeholder="Mínimo 6 caracteres"
                class="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div class="space-y-1.5">
              <label for="pw-confirm" class="text-xs font-medium text-foreground">
                Confirmar nova senha
              </label>
              <input
                id="pw-confirm"
                v-model="confirmPassword"
                type="password"
                autocomplete="new-password"
                minlength="6"
                placeholder="Repita a nova senha"
                class="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <Button type="submit" size="sm" :disabled="savingPassword">
              {{ savingPassword ? 'Salvando...' : 'Salvar nova senha' }}
            </Button>
          </form>
        </CardContent>
      </Card>

      <!-- Card 3: Vínculo em Casal (somente para quem tem Premium) -->
      <Card v-if="hasPremiumAccess">
        <CardHeader class="border-b border-border py-3.5 px-5">
          <div class="flex items-center gap-2">
            <Users class="h-4 w-4 text-primary" />
            <CardTitle class="text-sm font-semibold">Vínculo com outra pessoa</CardTitle>
          </div>
          <CardDescription class="text-xs">
            Vincule sua conta a outra pessoa pelo email dela para compartilhar contas e metas do casal.
          </CardDescription>
        </CardHeader>

        <CardContent class="p-5">
          <div
            v-if="profile.partner"
            class="flex flex-col justify-between gap-3 rounded-xl border border-border bg-muted/30 p-4 sm:flex-row sm:items-center"
          >
            <div class="min-w-0">
              <span class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Vinculado a
              </span>
              <p class="text-sm font-bold text-foreground truncate">
                {{ profile.partner.email }}
              </p>
              <p v-if="profile.partner.name" class="text-xs text-muted-foreground">
                {{ profile.partner.name }}
              </p>
            </div>

            <Button
              type="button"
              variant="destructive"
              size="xs"
              :disabled="linking"
              @click="unlinkPartner"
            >
              Remover vínculo
            </Button>
          </div>

          <form v-else class="space-y-3.5" @submit.prevent="linkPartner">
            <div class="space-y-1.5">
              <label for="partner-email" class="text-xs font-medium text-foreground">
                Email da outra pessoa
              </label>
              <input
                id="partner-email"
                v-model="partnerEmailInput"
                type="email"
                placeholder="outra@email.com"
                autocomplete="off"
                class="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <Button type="submit" size="sm" :disabled="linking">
              {{ linking ? 'Vinculando...' : 'Vincular conta' }}
            </Button>
          </form>
        </CardContent>
      </Card>

      <!-- Rodapé rápido para rever tour ou sair da conta -->
      <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
        <Button
          v-if="hasPremiumAccess"
          type="button"
          variant="ghost"
          size="sm"
          class="gap-1.5 text-muted-foreground hover:text-primary"
          @click="router.push('/?tour=1')"
        >
          <PlayCircle class="h-3.5 w-3.5" />
          <span>Rever tour de boas vindas</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          class="ml-auto gap-1.5 text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
          @click="handleLogout"
        >
          <LogOut class="h-3.5 w-3.5" />
          <span>Sair da conta</span>
        </Button>
      </div>
    </template>
  </div>
</template>
