<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  telegramApi,
  type TelegramConnectResponse,
  type TelegramDueReminderItem,
  type TelegramSessionStatus,
} from '@/api/telegram.api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Sheet } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import TruncatedText from '@/components/ui/tooltip/TruncatedText.vue'
import { useAuthStore } from '@/stores/auth/auth.store'
import { useToastStore } from '@/stores/toast/toast.store'
import { formatCurrency } from '@/utils/month'
import {
  AlertTriangle,
  Bell,
  BellOff,
  BellRing,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  History,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Unlink,
  Users,
} from 'lucide-vue-next'

const authStore = useAuthStore()
const toastStore = useToastStore()

const loading = ref(true)
const status = ref<TelegramSessionStatus | null>(null)

const startingConnect = ref(false)
const connectSheetOpen = ref(false)
const connectData = ref<TelegramConnectResponse | null>(null)
const verifyingLink = ref(false)

const sendingTest = ref(false)
const savingPref = ref(false)
const disconnecting = ref(false)
const disconnectSheetOpen = ref(false)
const syncingWebhook = ref(false)

let pollInterval: ReturnType<typeof setInterval> | null = null

const DAYS_OPTIONS = [
  { value: 0, label: 'Somente no dia' },
  { value: 1, label: '1 dia antes' },
  { value: 2, label: '2 dias antes' },
  { value: 3, label: '3 dias antes' },
  { value: 5, label: '5 dias antes' },
  { value: 7, label: '7 dias antes' },
]

const isConnected = computed(() => Boolean(status.value?.connection.connected))
const isNotifyActive = computed(() => Boolean(status.value?.preferences.notifyEnabled))
const hasPartner = computed(() => Boolean(authStore.profile?.partner))

const previewAllOwnItems = computed<TelegramDueReminderItem[]>(() => {
  if (!status.value) return []
  return [
    ...status.value.preview.dueToday,
    ...status.value.preview.overdue,
    ...status.value.preview.upcoming,
  ]
})

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}

async function fetchStatus() {
  loading.value = true
  try {
    status.value = await telegramApi.getStatus()
  } catch (err) {
    toastStore.error(
      err instanceof Error ? err.message : 'Não foi possível carregar os avisos do Telegram.',
    )
  } finally {
    loading.value = false
  }
}

async function handleOpenConnect() {
  startingConnect.value = true
  try {
    const res = await telegramApi.startConnect()
    connectData.value = res
    connectSheetOpen.value = true
    startLinkPolling()
  } catch (err) {
    toastStore.error(
      err instanceof Error ? err.message : 'Não foi possível gerar o link de conexão.',
    )
  } finally {
    startingConnect.value = false
  }
}

function startLinkPolling() {
  stopPolling()
  pollInterval = setInterval(async () => {
    if (!connectSheetOpen.value) {
      stopPolling()
      return
    }
    try {
      const updated = await telegramApi.verifyConnection()
      status.value = updated
      if (updated.connection.connected) {
        stopPolling()
        connectSheetOpen.value = false
        await authStore.fetchProfile()
        toastStore.success('Telegram conectado com sucesso!')
      }
    } catch {
      // Silencia erros transitórios durante o polling automático
    }
  }, 3500)
}

watch(connectSheetOpen, (open) => {
  if (!open) {
    stopPolling()
  }
})

async function handleManualVerify() {
  verifyingLink.value = true
  try {
    const updated = await telegramApi.verifyConnection()
    status.value = updated
    if (updated.connection.connected) {
      stopPolling()
      connectSheetOpen.value = false
      await authStore.fetchProfile()
      toastStore.success('Telegram conectado com sucesso!')
    } else {
      toastStore.error(
        'Ainda não recebemos o /start lá no Telegram. Abra o bot e toque em Começar.',
      )
    }
  } catch (err) {
    toastStore.error(err instanceof Error ? err.message : 'Falha ao verificar vínculo.')
  } finally {
    verifyingLink.value = false
  }
}

async function copyStartCommand() {
  if (!connectData.value?.startCommand) return
  try {
    await navigator.clipboard.writeText(connectData.value.startCommand)
    toastStore.success('Comando copiado para a área de transferência!')
  } catch {
    toastStore.error('Não foi possível copiar automaticamente.')
  }
}

async function handleSendTest() {
  if (sendingTest.value) return
  sendingTest.value = true
  try {
    status.value = await telegramApi.sendTest()
    toastStore.success('Aviso de teste enviado para o seu Telegram!')
  } catch (err) {
    toastStore.error(err instanceof Error ? err.message : 'Erro ao enviar aviso de teste.')
  } finally {
    sendingTest.value = false
  }
}

async function updatePref(payload: {
  notifyEnabled?: boolean
  daysBefore?: number
  notifyOverdue?: boolean
  includeCouple?: boolean
}) {
  if (savingPref.value) return
  savingPref.value = true
  try {
    status.value = await telegramApi.updatePreferences(payload)
    toastStore.success('Preferências atualizadas!')
  } catch (err) {
    toastStore.error(err instanceof Error ? err.message : 'Erro ao salvar preferências.')
  } finally {
    savingPref.value = false
  }
}

async function handleConfirmDisconnect() {
  if (disconnecting.value) return
  disconnecting.value = true
  try {
    status.value = await telegramApi.disconnect()
    disconnectSheetOpen.value = false
    await authStore.fetchProfile()
    toastStore.success('Conta do Telegram desconectada.')
  } catch (err) {
    toastStore.error(err instanceof Error ? err.message : 'Erro ao desconectar Telegram.')
  } finally {
    disconnecting.value = false
  }
}

async function handleSyncWebhook() {
  if (syncingWebhook.value) return
  syncingWebhook.value = true
  try {
    status.value = await telegramApi.syncWebhook()
    toastStore.success('Webhook do Telegram sincronizado com sucesso!')
  } catch (err) {
    toastStore.error(err instanceof Error ? err.message : 'Não foi possível sincronizar o webhook.')
  } finally {
    syncingWebhook.value = false
  }
}

function formatDueText(item: TelegramDueReminderItem): string {
  const dm = `${String(item.dueDay).padStart(2, '0')}/${String(item.dueMonth).padStart(2, '0')}`
  if (item.daysUntilDue < 0) {
    const d = Math.abs(item.daysUntilDue)
    return d === 1 ? `Venceu ontem (${dm})` : `Atrasada há ${d} dias (${dm})`
  }
  if (item.daysUntilDue === 0) return `Vence hoje (${dm})`
  if (item.daysUntilDue === 1) return `Vence amanhã (${dm})`
  return `Em ${item.daysUntilDue} dias (${dm})`
}

function dueBadgeVariant(item: TelegramDueReminderItem): 'destructive' | 'warning' | 'secondary' {
  if (item.daysUntilDue < 0) return 'destructive'
  if (item.daysUntilDue <= 1) return 'warning'
  return 'secondary'
}

function formatDateTimeBr(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function logKindLabel(kind: string): string {
  if (kind === 'cron') return 'Resumo matinal automático'
  if (kind === 'test') return 'Disparo de teste manual'
  if (kind === 'welcome') return 'Conexão realizada'
  return kind
}

onMounted(() => {
  fetchStatus()
})

onBeforeUnmount(() => {
  stopPolling()
})
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
    <!-- Cabeçalho -->
    <header class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div class="space-y-1">
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="text-xl font-bold tracking-tight text-foreground">
            Avisos no Telegram
          </h1>
          <Badge v-if="!loading && isConnected && isNotifyActive" variant="success" class="gap-1">
            <Check class="h-3 w-3" />
            <span>Conectado e ativo</span>
          </Badge>
          <Badge v-else-if="!loading && isConnected && !isNotifyActive" variant="warning" class="gap-1">
            <BellOff class="h-3 w-3" />
            <span>Avisos pausados</span>
          </Badge>
          <Badge v-else-if="!loading" variant="secondary">
            Não conectado
          </Badge>
        </div>
        <p class="text-xs text-muted-foreground">
          Receba todo dia pela manhã um resumo direto no celular com suas contas, faturas e parcelas próximas do vencimento.
        </p>
      </div>

      <Button
        v-if="!loading && isConnected"
        size="sm"
        variant="default"
        class="gap-1.5 self-start sm:self-auto"
        :disabled="sendingTest || !status?.botConfigured"
        @click="handleSendTest"
      >
        <Loader2 v-if="sendingTest" class="h-3.5 w-3.5 animate-spin" />
        <Send v-else class="h-3.5 w-3.5" />
        <span>{{ sendingTest ? 'Enviando...' : 'Testar aviso agora' }}</span>
      </Button>
    </header>

    <!-- Skeleton Inicial -->
    <div v-if="loading" class="space-y-4">
      <Skeleton class="h-36 w-full rounded-2xl" />
      <Skeleton class="h-52 w-full rounded-2xl" />
      <Skeleton class="h-44 w-full rounded-2xl" />
    </div>

    <template v-else-if="status">
      <!-- Aviso caso TELEGRAM_BOT_TOKEN ainda não esteja configurado no servidor -->
      <Card
        v-if="!status.botConfigured"
        class="border-amber-500/40 bg-amber-500/5"
      >
        <CardContent class="flex flex-col gap-3 p-5 sm:flex-row sm:items-start">
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <AlertTriangle class="h-4 w-4" />
          </div>
          <div class="space-y-1.5 text-xs">
            <p class="text-sm font-semibold text-foreground">
              Falta configurar o Token do Bot no ambiente
            </p>
            <p class="text-muted-foreground leading-relaxed">
              Adicione a variável <code class="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">TELEGRAM_BOT_TOKEN</code> (gerada no <code class="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">@BotFather</code>) e <code class="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">CRON_SECRET</code> no seu arquivo <code class="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">.env</code> local e nas Environment Variables da Vercel. Assim que reiniciar ou publicar, o botão de vínculo abaixo já funcionará na hora.
            </p>
          </div>
        </CardContent>
      </Card>

      <!-- Card 1: Vínculo da Conta -->
      <Card>
        <CardHeader class="border-b border-border px-5 py-4">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <Send class="h-4 w-4 text-primary" />
              <CardTitle class="text-sm font-semibold">
                Seu vínculo com o Bot
              </CardTitle>
            </div>
            <span
              v-if="status.botUsername"
              class="font-mono text-xs text-muted-foreground"
            >
              @{{ status.botUsername }}
            </span>
          </div>
        </CardHeader>

        <CardContent class="p-5">
          <!-- Estado Não Conectado -->
          <div
            v-if="!isConnected"
            class="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center"
          >
            <div class="space-y-1 max-w-xl">
              <p class="text-sm font-semibold text-foreground">
                Conecte seu Telegram em 1 clique
              </p>
              <p class="text-xs text-muted-foreground leading-relaxed">
                Cada pessoa do casal pode conectar o próprio celular individualmente. Ao clicar ao lado, abriremos o bot oficial para confirmar o vínculo sem precisar digitar ID manual.
              </p>
            </div>

            <Button
              size="sm"
              class="gap-1.5 shrink-0"
              :disabled="!status.botConfigured || startingConnect"
              @click="handleOpenConnect"
            >
              <Loader2 v-if="startingConnect" class="h-4 w-4 animate-spin" />
              <Sparkles v-else class="h-4 w-4" />
              <span>Conectar Telegram</span>
            </Button>
          </div>

          <!-- Estado Conectado -->
          <div
            v-else
            class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"
          >
            <div class="flex items-start gap-3">
              <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 class="h-5 w-5" />
              </div>
              <div class="space-y-0.5">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-sm font-semibold text-foreground">
                    {{ status.connection.username || 'Telegram vinculado' }}
                  </span>
                  <span
                    v-if="status.connection.chatIdMasked"
                    class="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
                  >
                    Chat {{ status.connection.chatIdMasked }}
                  </span>
                </div>
                <p class="text-xs text-muted-foreground">
                  Conectado em {{ formatDateTimeBr(status.connection.linkedAt) }}
                  <template v-if="status.preferences.lastSentDate">
                    · Último resumo matinal em {{ status.preferences.lastSentDate }}
                  </template>
                </p>
                <p class="text-[11px] text-muted-foreground/80 pt-0.5">
                  Dica: no chat do bot você também pode enviar <code class="rounded bg-muted px-1 py-0.5 font-mono">/hoje</code> a qualquer hora para consultar suas pendências.
                </p>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="xs"
                class="gap-1.5"
                :disabled="savingPref"
                @click="updatePref({ notifyEnabled: !isNotifyActive })"
              >
                <BellOff v-if="isNotifyActive" class="h-3.5 w-3.5" />
                <BellRing v-else class="h-3.5 w-3.5 text-emerald-600" />
                <span>{{ isNotifyActive ? 'Pausar avisos' : 'Reativar avisos' }}</span>
              </Button>

              <Button
                variant="ghost"
                size="xs"
                class="gap-1.5 text-red-600 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400"
                @click="disconnectSheetOpen = true"
              >
                <Unlink class="h-3.5 w-3.5" />
                <span>Desconectar</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Card 2: Preferências de Alerta -->
      <Card>
        <CardHeader class="border-b border-border px-5 py-4">
          <div class="flex items-center gap-2">
            <Bell class="h-4 w-4 text-primary" />
            <div>
              <CardTitle class="text-sm font-semibold">
                Regras e Antecedência dos Avisos
              </CardTitle>
              <CardDescription class="text-xs mt-0.5">
                O disparo automático roda todo dia pela manhã (08:00 BRT) e só envia mensagem quando houver pendências na sua janela.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent class="space-y-5 p-5">
          <!-- Seletor de dias de antecedência -->
          <div class="space-y-2">
            <label class="text-xs font-semibold text-foreground">
              Com quantos dias de antecedência avisar?
            </label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="opt in DAYS_OPTIONS"
                :key="opt.value"
                type="button"
                class="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
                :class="
                  status.preferences.daysBefore === opt.value
                    ? 'border-primary bg-primary text-primary-foreground font-semibold shadow-2xs'
                    : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground'
                "
                :disabled="savingPref"
                @click="updatePref({ daysBefore: opt.value })"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>

          <!-- Toggles adicionais -->
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              class="flex items-start justify-between gap-3 rounded-xl border p-3.5 text-left transition-colors disabled:opacity-50"
              :class="
                status.preferences.notifyOverdue
                  ? 'border-emerald-500/35 bg-emerald-500/5'
                  : 'border-border bg-muted/20'
              "
              :disabled="savingPref"
              @click="updatePref({ notifyOverdue: !status.preferences.notifyOverdue })"
            >
              <div class="space-y-0.5">
                <div class="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Clock class="h-3.5 w-3.5 text-amber-500" />
                  <span>Lembrar contas atrasadas no mês</span>
                </div>
                <p class="text-[11px] text-muted-foreground">
                  Inclui itens seus que já passaram do dia de vencimento e seguem em aberto no mês atual.
                </p>
              </div>
              <Badge :variant="status.preferences.notifyOverdue ? 'success' : 'secondary'" class="shrink-0 text-[10px]">
                {{ status.preferences.notifyOverdue ? 'Ligado' : 'Desligado' }}
              </Badge>
            </button>

            <button
              v-if="hasPartner"
              type="button"
              class="flex items-start justify-between gap-3 rounded-xl border p-3.5 text-left transition-colors disabled:opacity-50"
              :class="
                status.preferences.includeCouple
                  ? 'border-emerald-500/35 bg-emerald-500/5'
                  : 'border-border bg-muted/20'
              "
              :disabled="savingPref"
              @click="updatePref({ includeCouple: !status.preferences.includeCouple })"
            >
              <div class="space-y-0.5">
                <div class="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Users class="h-3.5 w-3.5 text-primary" />
                  <span>Mostrar contas compartilhadas do par</span>
                </div>
                <p class="text-[11px] text-muted-foreground">
                  Exibe em bloco separado informativo as contas de casal lançadas pelo par que vencem na mesma janela.
                </p>
              </div>
              <Badge :variant="status.preferences.includeCouple ? 'success' : 'secondary'" class="shrink-0 text-[10px]">
                {{ status.preferences.includeCouple ? 'Ligado' : 'Desligado' }}
              </Badge>
            </button>
          </div>
        </CardContent>
      </Card>

      <!-- Card 3: Prévia em Tempo Real do Resumo de Hoje -->
      <Card>
        <CardHeader class="flex flex-row items-center justify-between border-b border-border px-5 py-4">
          <div class="flex items-center gap-2">
            <CalendarClock class="h-4 w-4 text-primary" />
            <div>
              <CardTitle class="text-sm font-semibold">
                Prévia do que entra no aviso hoje
              </CardTitle>
              <CardDescription class="text-xs mt-0.5">
                Baseado nas suas contas em aberto e na janela de {{ status.preferences.daysBefore === 0 ? 'hoje' : `${status.preferences.daysBefore} dia(s)` }}
              </CardDescription>
            </div>
          </div>

          <div v-if="status.preview.totalOwnCount > 0" class="text-right">
            <span class="block text-[10px] uppercase tracking-wider text-muted-foreground">
              Total seu no aviso
            </span>
            <span class="text-sm font-bold tabular-nums text-foreground">
              {{ formatCurrency(status.preview.totalOwnAmount) }}
            </span>
          </div>
        </CardHeader>

        <CardContent class="p-0">
          <div
            v-if="status.preview.totalAllCount === 0"
            class="flex flex-col items-center justify-center px-5 py-10 text-center"
          >
            <CheckCircle2 class="h-8 w-8 text-emerald-500/80 mb-2" />
            <p class="text-sm font-semibold text-foreground">
              Tudo tranquilo nesta janela!
            </p>
            <p class="mt-0.5 text-xs text-muted-foreground max-w-md">
              Nenhuma conta pendente vence nos próximos dias configurados. Quando chegar perto de algum vencimento, ela aparecerá automaticamente aqui e no Telegram.
            </p>
          </div>

          <div v-else class="divide-y divide-border">
            <!-- Suas contas -->
            <div
              v-for="item in previewAllOwnItems"
              :key="item.id"
              class="flex items-center justify-between gap-3 px-5 py-3"
            >
              <div class="min-w-0 flex-1 space-y-0.5">
                <div class="flex items-center gap-2 min-w-0">
                  <TruncatedText
                    :text="item.name"
                    class="text-xs font-semibold text-foreground"
                  />
                  <Badge v-if="item.isShared" variant="secondary" class="text-[10px] px-1.5 py-0 shrink-0">
                    Casal
                  </Badge>
                </div>
                <p class="text-[11px] text-muted-foreground">
                  {{ item.categoryLabel }} · {{ formatDueText(item) }}
                </p>
              </div>

              <div class="flex items-center gap-2.5 shrink-0">
                <Badge :variant="dueBadgeVariant(item)" class="hidden sm:inline-flex text-[10px]">
                  {{ formatDueText(item) }}
                </Badge>
                <span class="text-xs font-bold tabular-nums text-foreground">
                  {{ formatCurrency(item.amount) }}
                </span>
              </div>
            </div>

            <!-- Contas compartilhadas do par (informativo) -->
            <template v-if="status.preview.coupleItems.length > 0">
              <div class="bg-muted/30 px-5 py-2 text-[11px] font-semibold text-muted-foreground">
                Visão do casal (adicionadas pelo par)
              </div>
              <div
                v-for="item in status.preview.coupleItems"
                :key="item.id"
                class="flex items-center justify-between gap-3 bg-muted/10 px-5 py-3"
              >
                <div class="min-w-0 flex-1 space-y-0.5">
                  <TruncatedText
                    :text="item.name"
                    class="text-xs font-medium text-foreground"
                  />
                  <p class="text-[11px] text-muted-foreground">
                    <template v-if="item.ownerName">De {{ item.ownerName }} · </template>
                    {{ item.categoryLabel }} · {{ formatDueText(item) }}
                  </p>
                </div>
                <span class="text-xs font-semibold tabular-nums text-muted-foreground shrink-0">
                  {{ formatCurrency(item.amount) }}
                </span>
              </div>
            </template>
          </div>
        </CardContent>
      </Card>

      <!-- Card 4: Histórico de Disparos -->
      <Card v-if="status.logs.length > 0">
        <CardHeader class="border-b border-border px-5 py-3.5">
          <div class="flex items-center gap-2">
            <History class="h-4 w-4 text-primary" />
            <CardTitle class="text-sm font-semibold">
              Últimos disparos registrados
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent class="p-0">
          <ul class="divide-y divide-border" role="list">
            <li
              v-for="log in status.logs"
              :key="log.id"
              class="flex flex-col justify-between gap-1 px-5 py-3 sm:flex-row sm:items-center"
            >
              <div class="space-y-0.5 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-semibold text-foreground">
                    {{ logKindLabel(log.kind) }}
                  </span>
                  <Badge
                    :variant="log.status === 'sent' ? 'success' : log.status === 'failed' ? 'destructive' : 'secondary'"
                    class="text-[10px] px-1.5 py-0"
                  >
                    {{ log.status === 'sent' ? 'Enviado' : log.status === 'failed' ? 'Falha' : 'Ignorado' }}
                  </Badge>
                </div>
                <p class="text-[11px] text-muted-foreground truncate">
                  {{ log.errorMessage || log.summary || 'Processado' }}
                </p>
              </div>
              <span class="text-[11px] text-muted-foreground shrink-0">
                {{ formatDateTimeBr(log.createdAt) }}
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>

      <!-- Card 5: Diagnóstico Admin (somente administradores) -->
      <Card v-if="authStore.isAdmin" class="border-border/80 bg-muted/15">
        <CardHeader class="border-b border-border px-5 py-3.5">
          <div class="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div class="flex items-center gap-2">
              <ShieldCheck class="h-4 w-4 text-primary" />
              <CardTitle class="text-sm font-semibold">
                Diagnóstico de Infraestrutura (Admin)
              </CardTitle>
            </div>

            <Button
              v-if="status.botConfigured"
              variant="outline"
              size="xs"
              class="gap-1.5 self-start sm:self-auto"
              :disabled="syncingWebhook"
              @click="handleSyncWebhook"
            >
              <RefreshCw class="h-3 w-3" :class="{ 'animate-spin': syncingWebhook }" />
              <span>Sincronizar Webhook HTTPS</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent class="grid grid-cols-1 gap-3 p-5 sm:grid-cols-3 text-xs">
          <div class="rounded-xl border border-border bg-card p-3 space-y-1">
            <div class="flex items-center justify-between">
              <span class="font-semibold text-foreground">Bot Token</span>
              <Badge :variant="status.botConfigured ? 'success' : 'warning'" class="text-[10px]">
                {{ status.botConfigured ? 'OK' : 'Pendente' }}
              </Badge>
            </div>
            <p class="text-[11px] text-muted-foreground truncate">
              {{ status.botUsername ? `@${status.botUsername}` : 'Configure TELEGRAM_BOT_TOKEN' }}
            </p>
          </div>

          <div class="rounded-xl border border-border bg-card p-3 space-y-1">
            <div class="flex items-center justify-between">
              <span class="font-semibold text-foreground">Vercel Cron Secret</span>
              <Badge :variant="status.cronSecretConfigured ? 'success' : 'warning'" class="text-[10px]">
                {{ status.cronSecretConfigured ? 'OK' : 'Pendente' }}
              </Badge>
            </div>
            <p class="text-[11px] text-muted-foreground">
              Rota diária: <code class="font-mono">/api/cron/telegram</code>
            </p>
          </div>

          <div class="rounded-xl border border-border bg-card p-3 space-y-1">
            <div class="flex items-center justify-between">
              <span class="font-semibold text-foreground">Webhook Telegram</span>
              <Badge :variant="status.webhook?.active ? 'success' : 'secondary'" class="text-[10px]">
                {{ status.webhook?.active ? 'Ativo' : 'Modo local' }}
              </Badge>
            </div>
            <p class="text-[11px] text-muted-foreground truncate" :title="status.webhook?.url || ''">
              {{ status.webhook?.url || 'Ativa automaticamente no domínio HTTPS' }}
            </p>
          </div>
        </CardContent>
      </Card>
    </template>

    <!-- Gaveta Inferior: Conectar Telegram -->
    <Sheet
      :open="connectSheetOpen"
      title="Conectar seu Telegram"
      description="Abra o bot no Telegram e toque em Começar para concluir o vínculo automaticamente."
      @update:open="connectSheetOpen = $event"
    >
      <div v-if="connectData" class="space-y-4">
        <div class="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-semibold text-foreground">
              1. Abra a conversa com @{{ connectData.botUsername }}
            </span>
            <Badge variant="success" class="text-[10px]">Link seguro</Badge>
          </div>

          <a
            :href="connectData.deepLink"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-xs transition-opacity hover:opacity-90"
          >
            <ExternalLink class="h-4 w-4" />
            <span>Abrir no Telegram e Começar</span>
          </a>
        </div>

        <div class="rounded-xl border border-border bg-muted/30 p-3.5 space-y-2">
          <p class="text-[11px] text-muted-foreground">
            Caso o aplicativo não envie o código sozinho ao abrir, basta colar e enviar este comando na conversa com o bot:
          </p>
          <div class="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2">
            <code class="font-mono text-xs text-foreground select-all truncate">
              {{ connectData.startCommand }}
            </code>
            <Button variant="ghost" size="xs" class="gap-1 shrink-0" @click="copyStartCommand">
              <Copy class="h-3.5 w-3.5" />
              <span>Copiar</span>
            </Button>
          </div>
        </div>

        <div class="flex items-center justify-between gap-3 pt-1">
          <div class="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 class="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
            <span>Aguardando confirmação do Telegram...</span>
          </div>

          <Button
            variant="secondary"
            size="sm"
            class="gap-1.5 shrink-0"
            :disabled="verifyingLink"
            @click="handleManualVerify"
          >
            <Check v-if="!verifyingLink" class="h-3.5 w-3.5" />
            <Loader2 v-else class="h-3.5 w-3.5 animate-spin" />
            <span>Já enviei lá</span>
          </Button>
        </div>
      </div>
    </Sheet>

    <!-- Gaveta Inferior: Confirmar Desconexão -->
    <Sheet
      :open="disconnectSheetOpen"
      title="Desconectar Telegram"
      description="Você deixará de receber os lembretes diários neste celular até conectar novamente."
      @update:open="disconnectSheetOpen = $event"
    >
      <div class="flex justify-end gap-2 pt-2">
        <Button variant="outline" size="sm" @click="disconnectSheetOpen = false">
          Cancelar
        </Button>
        <Button
          variant="destructive"
          size="sm"
          :disabled="disconnecting"
          @click="handleConfirmDisconnect"
        >
          {{ disconnecting ? 'Desconectando...' : 'Confirmar desconexão' }}
        </Button>
      </div>
    </Sheet>
  </div>
</template>
