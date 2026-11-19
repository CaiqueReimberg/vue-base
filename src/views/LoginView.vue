<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth/auth.store'
import { authApi } from '@/api/auth.api'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { HeartHandshake } from 'lucide-vue-next'

const config = useRuntimeConfig()
const appVersion = config.public.appVersion || '1.0.0'
const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

type Mode = 'login' | 'register'

const mode = ref<Mode>('login')

const email = ref('')
const password = ref('')
const name = ref('')
const passwordConfirm = ref('')

const loading = ref(false)
const error = ref('')

function getTokenFromResponse(res: { access_token?: string }): string | null {
  return res.access_token ?? null
}

function setMode(next: Mode) {
  mode.value = next
  error.value = ''
}

async function submitLogin() {
  error.value = ''
  if (!email.value.trim()) {
    error.value = 'Informe o email.'
    return
  }
  if (!password.value) {
    error.value = 'Informe a senha.'
    return
  }
  loading.value = true
  try {
    const res = await authApi.login({ email: email.value.trim(), password: password.value })
    const token = getTokenFromResponse(res)
    if (!token) {
      error.value = 'Resposta da API sem access_token.'
      return
    }
    authStore.setToken(token)
    await nextTick()
    const redirect = (route.query.redirect as string) || '/'
    await router.push(redirect)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Falha ao entrar. Verifique email e senha.'
  } finally {
    loading.value = false
  }
}

async function submitRegister() {
  error.value = ''
  const n = name.value.trim()
  if (!n) {
    error.value = 'Informe seu nome.'
    return
  }
  if (!email.value.trim()) {
    error.value = 'Informe o email.'
    return
  }
  if (!password.value) {
    error.value = 'Informe a senha.'
    return
  }
  if (password.value.length < 6) {
    error.value = 'A senha deve ter no mínimo 6 caracteres.'
    return
  }
  if (password.value !== passwordConfirm.value) {
    error.value = 'As senhas não coincidem.'
    return
  }
  loading.value = true
  try {
    const res = await authApi.register({
      email: email.value.trim(),
      name: n,
      password: password.value,
    })
    const token = getTokenFromResponse(res)
    if (!token) {
      error.value = 'Resposta da API sem access_token.'
      return
    }
    authStore.setToken(token)
    await nextTick()
    const redirect = (route.query.redirect as string) || '/'
    await router.push(redirect)
  } catch (e) {
    error.value =
      e instanceof Error ? e.message : 'Não foi possível criar a conta. Tente novamente.'
  } finally {
    loading.value = false
  }
}

async function submit() {
  if (mode.value === 'login') {
    await submitLogin()
  } else {
    await submitRegister()
  }
}
</script>

<template>
  <div class="flex min-h-dvh items-center justify-center bg-background p-4">
    <Card class="w-full max-w-sm">
      <CardHeader class="items-center text-center pb-4">
        <div class="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <HeartHandshake class="h-5 w-5" />
        </div>
        <CardTitle class="text-xl">DuoPact</CardTitle>
        <CardDescription>
          {{
            mode === 'login'
              ? 'Entre para gerenciar suas finanças e contas do mês'
              : 'Crie sua conta para organizar a vida financeira a dois'
          }}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <!-- Mode Switcher (shadcn Tabs look) -->
        <div
          class="mb-5 grid grid-cols-2 rounded-lg bg-secondary p-1"
          role="tablist"
          aria-label="Login ou cadastro"
        >
          <button
            type="button"
            role="tab"
            class="rounded-md py-1.5 text-xs font-medium transition-all"
            :class="
              mode === 'login'
                ? 'bg-card text-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            "
            :aria-selected="mode === 'login'"
            @click="setMode('login')"
          >
            Entrar
          </button>
          <button
            type="button"
            role="tab"
            class="rounded-md py-1.5 text-xs font-medium transition-all"
            :class="
              mode === 'register'
                ? 'bg-card text-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            "
            :aria-selected="mode === 'register'"
            @click="setMode('register')"
          >
            Criar conta
          </button>
        </div>

        <form class="space-y-4" @submit.prevent="submit">
          <div
            v-if="error"
            class="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400"
          >
            {{ error }}
          </div>

          <div v-if="mode === 'register'" class="space-y-1.5">
            <label for="register-name" class="block text-xs font-medium text-foreground">
              Nome
            </label>
            <input
              id="register-name"
              v-model="name"
              type="text"
              autocomplete="name"
              class="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Seu nome"
              required
            />
          </div>

          <div class="space-y-1.5">
            <label for="login-email" class="block text-xs font-medium text-foreground">
              Email
            </label>
            <input
              id="login-email"
              v-model="email"
              type="email"
              autocomplete="email"
              class="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="seu@email.com"
              required
            />
          </div>

          <div class="space-y-1.5">
            <label for="login-password" class="block text-xs font-medium text-foreground">
              Senha
            </label>
            <input
              id="login-password"
              v-model="password"
              type="password"
              :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
              class="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="••••••••"
              required
              minlength="6"
            />
          </div>

          <div v-if="mode === 'register'" class="space-y-1.5">
            <label for="register-password-confirm" class="block text-xs font-medium text-foreground">
              Confirmar senha
            </label>
            <input
              id="register-password-confirm"
              v-model="passwordConfirm"
              type="password"
              autocomplete="new-password"
              class="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Repita a senha"
              required
              minlength="6"
            />
          </div>

          <Button type="submit" class="w-full" :disabled="loading">
            {{
              loading
                ? mode === 'login'
                  ? 'Entrando…'
                  : 'Criando conta…'
                : mode === 'login'
                  ? 'Entrar'
                  : 'Criar conta'
            }}
          </Button>
        </form>

        <div class="mt-5 text-center text-[11px] text-muted-foreground">
          <span>DuoPact</span>
          <span class="mx-1">•</span>
          <span class="font-mono">v{{ appVersion }}</span>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
