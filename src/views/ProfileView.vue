<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { usersApi, type UserProfile } from '@/api/users.api'
import { useToastStore } from '@/stores/toast/toast.store'

const toastStore = useToastStore()

const loading = ref(true)
const savingPassword = ref(false)
const linking = ref(false)
const profile = ref<UserProfile | null>(null)

const newPassword = ref('')
const confirmPassword = ref('')

const partnerEmailInput = ref('')

async function load() {
  loading.value = true
  try {
    profile.value = await usersApi.getMe()
  } catch (e) {
    toastStore.error(e instanceof Error ? e.message : 'Não foi possível carregar o perfil.')
  } finally {
    loading.value = false
  }
}

onMounted(load)

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
    profile.value = await usersApi.updateMe({ password: newPassword.value })
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
    toastStore.error('Informe o e-mail da outra pessoa.')
    return
  }
  linking.value = true
  try {
    profile.value = await usersApi.linkPartner(email)
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
    profile.value = await usersApi.unlinkPartner()
    toastStore.success('Vínculo removido.')
  } catch (e) {
    toastStore.error(e instanceof Error ? e.message : 'Erro ao remover vínculo.')
  } finally {
    linking.value = false
  }
}
</script>

<template>
  <div class="profile-page">
    <header class="profile-head">
      <h1 class="profile-title">Perfil</h1>
      <p class="profile-lead">Seus dados e vínculo com outra pessoa</p>
    </header>

    <p v-if="loading" class="muted">Carregando…</p>

    <template v-else-if="profile">
      <section class="card">
        <h2 class="card-title">E-mail</h2>
        <p class="email-display">{{ profile.email }}</p>
      </section>

      <section class="card">
        <h2 class="card-title">Alterar senha</h2>
        <form class="stack" @submit.prevent="savePassword">
          <div class="field">
            <label for="pw-new">Nova senha</label>
            <input
              id="pw-new"
              v-model="newPassword"
              type="password"
              autocomplete="new-password"
              class="input"
              minlength="6"
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <div class="field">
            <label for="pw-confirm">Confirmar senha</label>
            <input
              id="pw-confirm"
              v-model="confirmPassword"
              type="password"
              autocomplete="new-password"
              class="input"
              minlength="6"
            />
          </div>
          <button type="submit" class="btn-primary" :disabled="savingPassword">
            {{ savingPassword ? 'Salvando…' : 'Salvar nova senha' }}
          </button>
        </form>
      </section>

      <section class="card">
        <h2 class="card-title">Vínculo com outra pessoa</h2>
        <p class="card-desc">
          Você pode se vincular a <strong>apenas uma</strong> outra conta pelo e-mail dela. Isso permite
          compartilhar dados de família no app.
        </p>

        <div v-if="profile.partner" class="partner-box">
          <p class="partner-label">Vinculado a</p>
          <p class="partner-email">{{ profile.partner.email }}</p>
          <p v-if="profile.partner.name" class="partner-name">{{ profile.partner.name }}</p>
          <button
            type="button"
            class="btn-danger-outline"
            :disabled="linking"
            @click="unlinkPartner"
          >
            Remover vínculo
          </button>
        </div>

        <form v-else class="stack" @submit.prevent="linkPartner">
          <div class="field">
            <label for="partner-email">E-mail da outra pessoa</label>
            <input
              id="partner-email"
              v-model="partnerEmailInput"
              type="email"
              class="input"
              placeholder="outra@email.com"
              autocomplete="off"
            />
          </div>
          <button type="submit" class="btn-primary" :disabled="linking">
            {{ linking ? 'Vinculando…' : 'Vincular' }}
          </button>
        </form>
      </section>
    </template>
  </div>
</template>

<style scoped>
.profile-page {
  max-width: 520px;
  margin: 0 auto;
  padding: 1rem 1.25rem 2.5rem;
}

.profile-head {
  margin-bottom: 1.5rem;
}

.profile-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--dp-text-primary);
  margin: 0 0 0.35rem;
}

.profile-lead {
  font-size: 0.9rem;
  color: var(--dp-text-muted);
  margin: 0;
}

.muted {
  color: var(--dp-text-muted);
}

.card {
  border: 1px solid var(--dp-border);
  border-radius: 0.75rem;
  background: var(--dp-surface);
  padding: 1.15rem 1.25rem;
  margin-bottom: 1rem;
}

.card-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--dp-text-primary);
  margin: 0 0 0.75rem;
}

.card-desc {
  font-size: 0.85rem;
  color: var(--dp-text-secondary);
  line-height: 1.45;
  margin: 0 0 1rem;
}

.email-display {
  font-size: 1rem;
  font-weight: 600;
  color: var(--dp-text-primary);
  margin: 0;
  word-break: break-all;
}

.stack {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.field label {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--dp-text-secondary);
}

.input {
  padding: 0.65rem 0.85rem;
  font-size: 0.95rem;
  border: 1px solid var(--dp-border);
  border-radius: 0.5rem;
  background: var(--color-background);
  color: var(--dp-text-primary);
}

.input:focus {
  outline: none;
  border-color: var(--dp-green);
}

.btn-primary {
  align-self: flex-start;
  padding: 0.6rem 1.1rem;
  font-size: 0.9rem;
  font-weight: 600;
  border: none;
  border-radius: 0.5rem;
  background: var(--dp-green);
  color: #fff;
  cursor: pointer;
}

.btn-primary:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.partner-box {
  padding: 0.85rem 1rem;
  border-radius: 0.5rem;
  background: var(--color-background);
  border: 1px solid var(--dp-border);
}

.partner-label {
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--dp-text-muted);
  margin: 0 0 0.25rem;
}

.partner-email {
  font-size: 1rem;
  font-weight: 600;
  color: var(--dp-text-primary);
  margin: 0 0 0.15rem;
  word-break: break-all;
}

.partner-name {
  font-size: 0.85rem;
  color: var(--dp-text-secondary);
  margin: 0 0 0.85rem;
}

.btn-danger-outline {
  padding: 0.45rem 0.85rem;
  font-size: 0.85rem;
  font-weight: 600;
  border: 1px solid hsl(0, 55%, 55%);
  border-radius: 0.5rem;
  background: transparent;
  color: hsl(0, 55%, 42%);
  cursor: pointer;
}

.btn-danger-outline:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
</style>
