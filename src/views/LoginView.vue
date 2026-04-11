<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth/auth.store'
import { authApi } from '@/api/auth.api'

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
    error.value = 'Informe o e-mail.'
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
    error.value = e instanceof Error ? e.message : 'Falha ao entrar. Verifique e-mail e senha.'
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
    error.value = 'Informe o e-mail.'
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
  <div class="login-page">
    <div class="login-card">
      <div class="login-header">
        <span class="login-logo">♥</span>
        <h1 class="login-title">DuoPact</h1>
        <p class="login-subtitle">
          {{ mode === 'login' ? 'Entre na sua conta' : 'Crie sua conta' }}
        </p>
      </div>

      <div class="mode-switch" role="tablist" aria-label="Login ou cadastro">
        <button
          type="button"
          role="tab"
          class="mode-tab"
          :class="{ active: mode === 'login' }"
          :aria-selected="mode === 'login'"
          @click="setMode('login')"
        >
          Entrar
        </button>
        <button
          type="button"
          role="tab"
          class="mode-tab"
          :class="{ active: mode === 'register' }"
          :aria-selected="mode === 'register'"
          @click="setMode('register')"
        >
          Criar conta
        </button>
      </div>

      <form class="login-form" @submit.prevent="submit">
        <p v-if="error" class="form-error">{{ error }}</p>

        <div v-if="mode === 'register'" class="form-group">
          <label for="register-name">Nome</label>
          <input
            id="register-name"
            v-model="name"
            type="text"
            autocomplete="name"
            class="form-input"
            placeholder="Seu nome"
            required
          />
        </div>

        <div class="form-group">
          <label for="login-email">E-mail</label>
          <input
            id="login-email"
            v-model="email"
            type="email"
            autocomplete="email"
            class="form-input"
            placeholder="seu@email.com"
            required
          />
        </div>

        <div class="form-group">
          <label for="login-password">Senha</label>
          <input
            id="login-password"
            v-model="password"
            type="password"
            :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
            class="form-input"
            placeholder="••••••••"
            required
            minlength="6"
          />
        </div>

        <div v-if="mode === 'register'" class="form-group">
          <label for="register-password-confirm">Confirmar senha</label>
          <input
            id="register-password-confirm"
            v-model="passwordConfirm"
            type="password"
            autocomplete="new-password"
            class="form-input"
            placeholder="Repita a senha"
            required
            minlength="6"
          />
        </div>

        <button type="submit" class="btn-login" :disabled="loading">
          {{
            loading
              ? mode === 'login'
                ? 'Entrando…'
                : 'Criando conta…'
              : mode === 'login'
                ? 'Entrar'
                : 'Criar conta'
          }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: var(--color-background);
}

.login-card {
  width: 100%;
  max-width: 400px;
  padding: 1.5rem 1.25rem;
  background: var(--dp-surface);
  border: 1px solid var(--dp-border);
  border-radius: 1rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
}

.login-header {
  text-align: center;
  margin-bottom: 1.25rem;
}

.login-logo {
  display: inline-block;
  font-size: 2rem;
  color: var(--dp-green);
  margin-bottom: 0.5rem;
}

.login-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--dp-text-primary);
  margin-bottom: 0.25rem;
}

.login-subtitle {
  font-size: 0.9rem;
  color: var(--dp-text-muted);
}

.mode-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.35rem;
  margin-bottom: 1.25rem;
  padding: 0.25rem;
  border-radius: 0.65rem;
  background: var(--color-background);
  border: 1px solid var(--dp-border);
}

.mode-tab {
  padding: 0.55rem 0.75rem;
  font-size: 0.9rem;
  font-weight: 600;
  border: none;
  border-radius: 0.5rem;
  background: transparent;
  color: var(--dp-text-muted);
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
}

.mode-tab:hover {
  color: var(--dp-text-secondary);
}

.mode-tab.active {
  background: var(--dp-surface);
  color: var(--dp-text-primary);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-error {
  padding: 0.75rem 1rem;
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
  border-radius: 0.5rem;
  font-size: 0.9rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.form-group label {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--dp-text-secondary);
}

.form-input {
  width: 100%;
  padding: 0.75rem 1rem;
  font-size: 0.95rem;
  border: 1px solid var(--dp-border);
  border-radius: 0.5rem;
  background: var(--color-background);
  color: var(--dp-text-primary);
  outline: none;
  transition: border-color 0.2s;
}

.form-input::placeholder {
  color: var(--dp-text-muted);
}

.form-input:focus {
  border-color: var(--dp-green);
}

.btn-login {
  margin-top: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: var(--dp-green);
  color: white;
  font-size: 1rem;
  font-weight: 600;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-login:hover:not(:disabled) {
  opacity: 0.92;
}

.btn-login:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

@media (max-width: 380px) {
  .login-page {
    padding: 0.75rem;
  }

  .login-card {
    padding: 1.25rem 1rem;
  }

  .login-title {
    font-size: 1.25rem;
  }
}
</style>
