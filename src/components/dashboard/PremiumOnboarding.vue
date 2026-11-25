<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { usersApi } from '@/api/users.api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Progress } from '@/components/ui/progress'
import { Sheet } from '@/components/ui/sheet'
import { useAccountsStore } from '@/stores/accounts/accounts.store'
import { useAuthStore } from '@/stores/auth/auth.store'
import { useDashboardStore } from '@/stores/dashboard/dashboard.store'
import { useToastStore } from '@/stores/toast/toast.store'
import {
  ArrowRight,
  CalendarCheck2,
  Check,
  CheckCircle2,
  ChevronRight,
  Crown,
  HeartHandshake,
  Lightbulb,
  PiggyBank,
  PlayCircle,
  Receipt,
  Sparkles,
  User,
  Users,
  Wallet,
  X,
} from 'lucide-vue-next'

const props = defineProps<{
  ready: boolean
  configuredIncome: number
  configuredSavings: number
  totalBillsCount: number
}>()

const emit = defineEmits<{
  'open-plan': []
  'open-add-bill': []
}>()

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const dashboardStore = useDashboardStore()
const accountsStore = useAccountsStore()
const toastStore = useToastStore()

const { accounts: vaultAccounts } = storeToRefs(accountsStore)
const { formatCurrency } = storeToRefs(dashboardStore)

const checklistDismissed = ref(false)
const soloConfirmed = ref(false)
const initializedForUser = ref<string | null>(null)
const checklistDrawerOpen = ref(false)

// Estado do Tour de Boas Vindas (Bottom Drawer em 3 etapas)
const tourOpen = ref(false)
const tourStep = ref<1 | 2 | 3>(1)
const tourIncome = ref<number | ''>('')
const tourSavings = ref<number | ''>('')
const savingTourPlan = ref(false)
const tourPartnerMode = ref<'couple' | 'solo'>('couple')
const tourPartnerEmail = ref('')
const savingTourPartner = ref(false)

// Drawer rápido para criar o primeiro CDB / Reserva sem sair da Home
const quickVaultOpen = ref(false)
const vaultName = ref('Reserva de Emergência')
const vaultBank = ref('')
const vaultBalance = ref<number | ''>('')
const vaultShared = ref(false)
const savingVault = ref(false)

// Drawer rápido para escolher Casal ou Uso Individual a partir do checklist
const quickPartnerOpen = ref(false)
const quickPartnerEmail = ref('')
const savingQuickPartner = ref(false)

const VAULT_PRESETS = [
  'Reserva de Emergência',
  'CDB Liquidez Diária',
  'Caixinha Viagem',
  'Caixinha Casal',
]

function storageKey(prefix: string, uid: string) {
  return `dp_onb_${prefix}_${uid}`
}

function syncUserFlags() {
  const dbDismissed = Boolean(authStore.profile?.onboardingCompletedAt)
  const dbSolo = Boolean(authStore.profile?.soloMode)

  if (typeof window === 'undefined') {
    checklistDismissed.value = dbDismissed
    soloConfirmed.value = dbSolo
    return
  }

  const uid = authStore.currentUserId
  if (!uid) return
  checklistDismissed.value =
    dbDismissed || localStorage.getItem(storageKey('dismissed', uid)) === '1'
  soloConfirmed.value =
    dbSolo || localStorage.getItem(storageKey('solo', uid)) === '1'
}

function markWelcomeSeen() {
  if (typeof window === 'undefined') return
  const uid = authStore.currentUserId
  if (!uid) return
  localStorage.setItem(storageKey('welcome_seen', uid), '1')
}

function hasSeenWelcome(): boolean {
  if (authStore.profile?.onboardingCompletedAt || authStore.profile?.soloMode) {
    return true
  }
  if (typeof window === 'undefined') return true
  const uid = authStore.currentUserId
  if (!uid) return true
  return localStorage.getItem(storageKey('welcome_seen', uid)) === '1'
}

const hasPartnerLinked = computed(() => Boolean(authStore.profile?.partner))

const stepIncomeDone = computed(() => props.configuredIncome > 0)
const stepBillsDone = computed(() => props.totalBillsCount > 0)
const stepVaultDone = computed(() => vaultAccounts.value.length > 0)
const stepPartnerDone = computed(() => hasPartnerLinked.value || soloConfirmed.value)

const steps = computed(() => [
  {
    id: 'income',
    title: 'Definir renda e meta do mês',
    subtitle: stepIncomeDone.value
      ? `Renda configurada (${formatCurrency.value(props.configuredIncome)})`
      : 'Base para calcular sua sobra livre mensal',
    done: stepIncomeDone.value,
    icon: Wallet,
  },
  {
    id: 'bills',
    title: 'Cadastrar primeira conta fixa ou parcela',
    subtitle: stepBillsDone.value
      ? `${props.totalBillsCount} ${props.totalBillsCount === 1 ? 'conta cadastrada' : 'contas cadastradas'} no mês`
      : 'Aluguel, luz, internet ou financiamento com vencimento',
    done: stepBillsDone.value,
    icon: Receipt,
  },
  {
    id: 'vault',
    title: 'Criar sua primeira reserva ou CDB',
    subtitle: stepVaultDone.value
      ? `${vaultAccounts.value.length} ${vaultAccounts.value.length === 1 ? 'reserva criada' : 'reservas criadas'}`
      : 'Onde seu dinheiro guardado rende e alimenta suas metas',
    done: stepVaultDone.value,
    icon: PiggyBank,
  },
  {
    id: 'partner',
    title: 'Convidar seu par ou escolher uso individual',
    subtitle: hasPartnerLinked.value
      ? `Vinculado com ${authStore.profile?.partner?.email}`
      : soloConfirmed.value
        ? 'Configurado para uso individual'
        : 'Divida contas do casal 50/50 mantendo gastos pessoais separados',
    done: stepPartnerDone.value,
    icon: Users,
  },
])

const completedCount = computed(() => steps.value.filter((s) => s.done).length)
const progressPercent = computed(() => Math.round((completedCount.value / 4) * 100))
const allStepsCompleted = computed(() => completedCount.value === 4)

const showFloatingTrigger = computed(() => {
  if (!props.ready) return false
  if (checklistDismissed.value) return false
  if (
    checklistDrawerOpen.value ||
    tourOpen.value ||
    quickVaultOpen.value ||
    quickPartnerOpen.value
  ) {
    return false
  }
  return true
})

const showPulseBadge = computed(
  () => completedCount.value === 0 && !hasSeenWelcome(),
)

const tourEstimatedFree = computed(() => {
  const inc = Number(tourIncome.value) || 0
  const sav = Number(tourSavings.value) || 0
  return Math.max(inc - sav, 0)
})

function openChecklistDrawer() {
  markWelcomeSeen()
  checklistDrawerOpen.value = true
}

function openWelcomeTour(startStep: 1 | 2 | 3 = 1) {
  checklistDrawerOpen.value = false
  tourStep.value = startStep
  tourIncome.value = props.configuredIncome > 0 ? props.configuredIncome : ''
  tourSavings.value = props.configuredSavings > 0 ? props.configuredSavings : ''
  tourPartnerMode.value = soloConfirmed.value && !hasPartnerLinked.value ? 'solo' : 'couple'
  tourPartnerEmail.value = ''
  tourOpen.value = true
  markWelcomeSeen()
}

async function persistUserOnboardingFlags(payload: {
  soloMode?: boolean
  onboardingCompleted?: boolean
}) {
  try {
    const updated = await usersApi.updateMe(payload)
    authStore.profile = updated
  } catch {
    // Mantém o estado local caso a rede oscile
  }
}

function dismissChecklist() {
  const uid = authStore.currentUserId
  checklistDismissed.value = true
  checklistDrawerOpen.value = false
  if (uid && typeof window !== 'undefined') {
    localStorage.setItem(storageKey('dismissed', uid), '1')
  }
  void persistUserOnboardingFlags({ onboardingCompleted: true })
}

function confirmSoloUsage() {
  const uid = authStore.currentUserId
  soloConfirmed.value = true
  if (uid && typeof window !== 'undefined') {
    localStorage.setItem(storageKey('solo', uid), '1')
  }
  void persistUserOnboardingFlags({ soloMode: true })
}

watch(allStepsCompleted, (done) => {
  if (done && props.ready && !authStore.profile?.onboardingCompletedAt) {
    void persistUserOnboardingFlags({ onboardingCompleted: true })
  }
})

async function handleTourSavePlan() {
  const inc = Number(tourIncome.value) || 0
  const sav = Number(tourSavings.value) || 0
  if (inc <= 0) {
    tourStep.value = 3
    return
  }
  savingTourPlan.value = true
  try {
    await dashboardStore.saveMonthlyPlan({
      monthlyIncome: inc,
      savingsGoal: sav >= 0 ? sav : 0,
    })
    toastStore.success('Renda e meta do mês salvas!')
    tourStep.value = 3
  } catch {
    toastStore.error('Não foi possível salvar a renda agora.')
  } finally {
    savingTourPlan.value = false
  }
}

async function handleFinishTour() {
  // Caso tenha digitado renda na etapa 2 e pulado pelas barrinhas de etapa sem salvar, salva agora
  const inc = Number(tourIncome.value) || 0
  const sav = Number(tourSavings.value) || 0
  if (
    inc > 0 &&
    (inc !== props.configuredIncome || Math.max(sav, 0) !== props.configuredSavings)
  ) {
    try {
      await dashboardStore.saveMonthlyPlan({
        monthlyIncome: inc,
        savingsGoal: sav >= 0 ? sav : 0,
      })
    } catch {
      // Prossegue para conclusão do tour
    }
  }

  if (tourPartnerMode.value === 'solo' && !hasPartnerLinked.value) {
    confirmSoloUsage()
    tourOpen.value = false
    toastStore.success('Painel pronto! Siga os primeiros passos quando quiser.')
    return
  }

  const email = tourPartnerEmail.value.trim()
  if (tourPartnerMode.value === 'couple' && email && !hasPartnerLinked.value) {
    savingTourPartner.value = true
    try {
      const updated = await usersApi.linkPartner(email)
      authStore.profile = updated
      await dashboardStore.fetchSummary()
      toastStore.success(`Conta vinculada com ${email}!`)
      tourOpen.value = false
    } catch (e) {
      toastStore.error(
        e instanceof Error
          ? e.message
          : 'Não foi possível vincular agora. Verifique se a outra pessoa já criou conta.',
      )
    } finally {
      savingTourPartner.value = false
    }
    return
  }

  tourOpen.value = false
}

function handleStepClick(stepId: string) {
  checklistDrawerOpen.value = false
  if (stepId === 'income') {
    emit('open-plan')
  } else if (stepId === 'bills') {
    emit('open-add-bill')
  } else if (stepId === 'vault') {
    vaultName.value = 'Reserva de Emergência'
    vaultBank.value = ''
    vaultBalance.value = ''
    vaultShared.value = false
    quickVaultOpen.value = true
  } else if (stepId === 'partner') {
    quickPartnerEmail.value = ''
    quickPartnerOpen.value = true
  }
}

async function submitQuickVault() {
  const name = vaultName.value.trim()
  const initialBalance = Number(vaultBalance.value) || 0
  if (!name) {
    toastStore.error('Informe um nome para sua reserva ou CDB.')
    return
  }
  if (initialBalance < 0) {
    toastStore.error('O saldo inicial não pode ser negativo.')
    return
  }
  savingVault.value = true
  try {
    await accountsStore.create({
      name,
      type: 'investment',
      initialBalance,
      bankName: vaultBank.value.trim() || null,
      shareWithPartner: vaultShared.value,
    })
    toastStore.success(`${name} criada com sucesso!`)
    quickVaultOpen.value = false
  } catch (e) {
    toastStore.error(e instanceof Error ? e.message : 'Erro ao criar reserva.')
  } finally {
    savingVault.value = false
  }
}

async function submitQuickPartner() {
  const email = quickPartnerEmail.value.trim()
  if (!email) {
    toastStore.error('Informe o email da outra pessoa.')
    return
  }
  savingQuickPartner.value = true
  try {
    const updated = await usersApi.linkPartner(email)
    authStore.profile = updated
    await dashboardStore.fetchSummary()
    toastStore.success(`Vínculo criado com ${email}!`)
    quickPartnerOpen.value = false
  } catch (e) {
    toastStore.error(e instanceof Error ? e.message : 'Não foi possível vincular.')
  } finally {
    savingQuickPartner.value = false
  }
}

function chooseQuickSolo() {
  confirmSoloUsage()
  quickPartnerOpen.value = false
  toastStore.success('Marcado como uso individual! Você pode vincular alguém no Perfil quando quiser.')
}

function maybeTriggerInitialOnboarding() {
  if (!props.ready) return
  const uid = authStore.currentUserId
  if (!uid) return

  if (route.query.tour === '1') {
    syncUserFlags()
    initializedForUser.value = uid
    const nextQuery = { ...route.query }
    delete nextQuery.tour
    router.replace({ path: route.path, query: nextQuery })
    openWelcomeTour(1)
    return
  }

  if (initializedForUser.value === uid) return
  initializedForUser.value = uid
  syncUserFlags()

  // Se a conta já possui dados completos de uso anterior, oculta o botão flutuante automaticamente
  if (props.configuredIncome > 0 && props.totalBillsCount > 0 && vaultAccounts.value.length > 0 && hasSeenWelcome()) {
    if (hasPartnerLinked.value || soloConfirmed.value) {
      checklistDismissed.value = true
    }
  }
}

onMounted(maybeTriggerInitialOnboarding)

watch(
  () => [props.ready, authStore.currentUserId, route.query.tour],
  () => {
    maybeTriggerInitialOnboarding()
  },
)
</script>

<template>
  <!-- BOTÃO FLUTUANTE COMPACTO / NOTIFICAÇÃO DE PRIMEIROS PASSOS -->
  <div
    v-if="showFloatingTrigger"
    class="fixed right-4 bottom-[4.65rem] md:bottom-6 md:right-6 z-30 flex items-center gap-1 rounded-full border border-primary/35 bg-card/95 p-1 pl-3 shadow-lg backdrop-blur transition-all hover:border-primary"
  >
    <button
      type="button"
      class="flex items-center gap-2 py-1 pr-1.5 text-left text-xs font-semibold text-foreground transition-colors hover:text-primary"
      @click="openChecklistDrawer"
    >
      <span class="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
        <span
          v-if="showPulseBadge"
          class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/40"
        />
        <CheckCircle2 v-if="allStepsCompleted" class="relative h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
        <Crown v-else class="relative h-3 w-3" />
      </span>

      <span class="whitespace-nowrap">
        {{ allStepsCompleted ? 'Tudo configurado!' : 'Primeiros passos' }}
      </span>

      <Badge
        :variant="allStepsCompleted ? 'success' : 'secondary'"
        class="px-1.5 py-0 text-[10px] font-bold"
      >
        {{ completedCount }}/4
      </Badge>
    </button>

    <button
      type="button"
      class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      title="Dispensar primeiros passos"
      aria-label="Dispensar primeiros passos"
      @click="dismissChecklist"
    >
      <X class="h-3.5 w-3.5" />
    </button>
  </div>

  <!-- ============================================================ -->
  <!-- BOTTOM DRAWER: CHECKLIST INTERATIVO DE PRIMEIROS PASSOS      -->
  <!-- ============================================================ -->
  <Sheet
    v-model:open="checklistDrawerOpen"
    :title="allStepsCompleted ? 'Tudo pronto para dominar o mês!' : 'Primeiros passos no DuoPact'"
    :description="
      allStepsCompleted
        ? 'Você concluiu toda a configuração essencial da sua conta.'
        : 'Toque em uma etapa abaixo para configurar em menos de 2 minutos ou veja o tour rápido.'
    "
  >
    <div class="space-y-4">
      <div class="flex items-center justify-between gap-2 text-xs">
        <span class="font-medium text-muted-foreground">
          Progresso da configuração
        </span>
        <strong class="font-bold text-primary">
          {{ completedCount }} de 4 concluídos ({{ progressPercent }}%)
        </strong>
      </div>

      <Progress
        :model-value="progressPercent"
        class="h-2"
        indicator-class="bg-primary"
      />

      <!-- Atalho destacado para o Tour rápido de 3 etapas -->
      <button
        type="button"
        class="flex w-full items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-left transition-colors hover:bg-primary/10"
        @click="openWelcomeTour(1)"
      >
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <PlayCircle class="h-4 w-4" />
          </div>
          <div class="min-w-0">
            <p class="text-xs font-bold text-foreground">
              Tour rápido de boas vindas (30s)
            </p>
            <p class="text-[11px] text-muted-foreground truncate">
              Entenda a lógica Renda, Contas, Reserva e Sobra Livre
            </p>
          </div>
        </div>
        <ChevronRight class="h-4 w-4 shrink-0 text-primary" />
      </button>

      <!-- Lista interativa dos 4 passos -->
      <div class="space-y-2">
        <button
          v-for="step in steps"
          :key="step.id"
          type="button"
          class="group flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-all"
          :class="
            step.done
              ? 'border-emerald-500/25 bg-emerald-500/5 opacity-85 hover:opacity-100'
              : 'border-border bg-background hover:border-primary/40 hover:bg-muted/30'
          "
          @click="handleStepClick(step.id)"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <div
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors"
              :class="
                step.done
                  ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : 'border-primary/20 bg-primary/10 text-primary'
              "
            >
              <Check v-if="step.done" class="h-4 w-4" />
              <component :is="step.icon" v-else class="h-4 w-4" />
            </div>

            <div class="min-w-0">
              <p
                class="text-xs font-semibold truncate"
                :class="step.done ? 'line-through text-muted-foreground' : 'text-foreground group-hover:text-primary'"
              >
                {{ step.title }}
              </p>
              <p class="text-[11px] text-muted-foreground truncate">
                {{ step.subtitle }}
              </p>
            </div>
          </div>

          <ChevronRight
            v-if="!step.done"
            class="h-4 w-4 shrink-0 text-muted-foreground group-hover:translate-x-0.5 group-hover:text-primary transition-all"
          />
        </button>
      </div>

      <div class="flex items-center justify-between gap-2 border-t border-border pt-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          class="text-xs text-muted-foreground hover:text-foreground"
          @click="dismissChecklist"
        >
          Não mostrar novamente
        </Button>

        <Button
          type="button"
          size="sm"
          variant="secondary"
          @click="checklistDrawerOpen = false"
        >
          Fechar
        </Button>
      </div>
    </div>
  </Sheet>

  <!-- ============================================================ -->
  <!-- BOTTOM DRAWER: TOUR DE BOAS VINDAS AO DUOPACT PREMIUM (3 ETAPAS) -->
  <!-- ============================================================ -->
  <Sheet
    v-model:open="tourOpen"
    :title="
      tourStep === 1
        ? 'Boas vindas ao DuoPact Premium!'
        : tourStep === 2
          ? 'Passo 1: Sua renda e meta do mês'
          : 'Passo 2: Seu estilo de uso e dicas rápidas'
    "
    :description="
      tourStep === 1
        ? 'Seu acesso completo está liberado! Veja em 30 segundos como funciona o método sem planilhas.'
        : tourStep === 2
          ? 'Preencha uma estimativa rápida agora (você pode alterar a qualquer momento no painel).'
          : 'Escolha se vai organizar sozinho ou em casal e veja os atalhos que facilitam o mês.'
    "
  >
    <div class="space-y-5">
      <!-- Indicador de etapas do Tour -->
      <div class="flex items-center gap-1.5">
        <button
          v-for="s in ([1, 2, 3] as const)"
          :key="s"
          type="button"
          class="h-1.5 flex-1 rounded-full transition-colors"
          :class="tourStep >= s ? 'bg-primary' : 'bg-muted'"
          :aria-label="`Ir para etapa ${s}`"
          @click="tourStep = s"
        />
      </div>

      <!-- ETAPA 1: A FILOSOFIA DO DUOPACT -->
      <div v-if="tourStep === 1" class="space-y-4">
        <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <div class="rounded-xl border border-border bg-muted/30 p-3 space-y-1">
            <div class="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Wallet class="h-3.5 w-3.5 text-primary" />
              <span>1. Sua Renda</span>
            </div>
            <p class="text-[11px] text-muted-foreground leading-relaxed">
              Você informa quanto entra no mês sem precisar lançar cada centavo do extrato.
            </p>
          </div>

          <div class="rounded-xl border border-border bg-muted/30 p-3 space-y-1">
            <div class="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <CalendarCheck2 class="h-3.5 w-3.5 text-amber-500" />
              <span>2. Contas e Reserva</span>
            </div>
            <p class="text-[11px] text-muted-foreground leading-relaxed">
              Separe primeiro suas contas fixas, parcelas e o valor que quer guardar no CDB.
            </p>
          </div>

          <div class="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 space-y-1">
            <div class="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
              <Sparkles class="h-3.5 w-3.5" />
              <span>3. Sobra Livre</span>
            </div>
            <p class="text-[11px] text-emerald-800/80 dark:text-emerald-200/80 leading-relaxed">
              O que sobra é seu orçamento livre real por mês e por semana para gastar em paz!
            </p>
          </div>
        </div>

        <div class="flex items-start gap-2.5 rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
          <HeartHandshake class="h-4 w-4 shrink-0 text-primary mt-0.5" />
          <p class="leading-relaxed">
            <strong class="text-foreground">Feito para 1 ou 2 pessoas:</strong> você pode controlar tudo sozinho ou vincular seu par para dividir contas marcadas como <strong>Casal</strong> meio a meio.
          </p>
        </div>

        <div class="flex items-center justify-between gap-2 border-t border-border pt-4">
          <Button type="button" variant="ghost" size="sm" @click="tourOpen = false">
            Explorar sozinho
          </Button>
          <Button type="button" class="gap-1.5" @click="tourStep = 2">
            <span>Configurar meu mês</span>
            <ArrowRight class="h-4 w-4" />
          </Button>
        </div>
      </div>

      <!-- ETAPA 2: DEFINIR RENDA E META DO MÊS JÁ NO TOUR -->
      <form v-else-if="tourStep === 2" class="space-y-4" @submit.prevent="handleTourSavePlan">
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-foreground">
            Qual a renda líquida deste mês?
          </label>
          <CurrencyInput
            v-model="tourIncome"
            placeholder="0,00"
          />
          <p class="text-[11px] text-muted-foreground">
            Salário líquido ou soma das entradas previstas para o mês.
          </p>
        </div>

        <div class="space-y-1.5">
          <label class="text-xs font-medium text-foreground">
            Quanto você quer guardar neste mês? (opcional)
          </label>
          <CurrencyInput
            v-model="tourSavings"
            placeholder="0,00"
          />
          <p class="text-[11px] text-muted-foreground">
            Esse valor entra na sua lista do mês como um compromisso com o seu futuro.
          </p>
        </div>

        <div
          v-if="Number(tourIncome) > 0"
          class="flex items-center justify-between rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-2.5 text-xs"
        >
          <span class="text-emerald-800 dark:text-emerald-200">
            Disponível para contas + livre:
          </span>
          <strong class="font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
            {{ formatCurrency(tourEstimatedFree) }}
          </strong>
        </div>

        <div class="flex items-center justify-between gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" size="sm" @click="tourStep = 1">
            Voltar
          </Button>
          <div class="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" @click="tourStep = 3">
              Pular agora
            </Button>
            <Button type="submit" class="gap-1.5" :disabled="savingTourPlan">
              <span>{{ savingTourPlan ? 'Salvando...' : 'Salvar e continuar' }}</span>
              <ArrowRight class="h-4 w-4" />
            </Button>
          </div>
        </div>
      </form>

      <!-- ETAPA 3: CASAL OU INDIVIDUAL + DICAS RÁPIDAS -->
      <form v-else class="space-y-4" @submit.prevent="handleFinishTour">
        <div v-if="!hasPartnerLinked" class="space-y-2.5">
          <label class="text-xs font-medium text-foreground">
            Como você pretende usar o DuoPact?
          </label>
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              class="flex items-center gap-2 rounded-xl border p-3 text-left text-xs transition-colors"
              :class="
                tourPartnerMode === 'couple'
                  ? 'border-primary bg-primary/10 font-semibold text-foreground'
                  : 'border-border bg-background text-muted-foreground hover:text-foreground'
              "
              @click="tourPartnerMode = 'couple'"
            >
              <Users class="h-4 w-4 shrink-0 text-primary" />
              <span>Em casal</span>
            </button>

            <button
              type="button"
              class="flex items-center gap-2 rounded-xl border p-3 text-left text-xs transition-colors"
              :class="
                tourPartnerMode === 'solo'
                  ? 'border-primary bg-primary/10 font-semibold text-foreground'
                  : 'border-border bg-background text-muted-foreground hover:text-foreground'
              "
              @click="tourPartnerMode = 'solo'"
            >
              <User class="h-4 w-4 shrink-0 text-primary" />
              <span>Individual</span>
            </button>
          </div>

          <div v-if="tourPartnerMode === 'couple'" class="space-y-1.5 pt-1">
            <label class="text-xs font-medium text-foreground">
              Email do seu par (opcional, se já tiver cadastro)
            </label>
            <input
              v-model="tourPartnerEmail"
              type="email"
              placeholder="par@email.com (ou deixe em branco para vincular depois)"
              class="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <!-- Dica prática de ouro -->
        <div class="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs">
          <Lightbulb class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div class="space-y-1 text-muted-foreground">
            <p class="font-semibold text-foreground">
              Dica rápida para o dia a dia:
            </p>
            <p class="leading-relaxed">
              Cadastre suas contas com o <strong>dia de vencimento</strong> para montar sua <strong>Agenda</strong> automaticamente. Quando uma conta variável (como Luz ou Água) vier diferente no mês, basta tocar sobre o valor dela para ajustar só naquele mês!
            </p>
          </div>
        </div>

        <div class="flex items-center justify-between gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" size="sm" @click="tourStep = 2">
            Voltar
          </Button>
          <Button type="submit" class="gap-1.5" :disabled="savingTourPartner">
            <Check class="h-4 w-4" />
            <span>{{ savingTourPartner ? 'Concluindo...' : 'Ir para o meu painel' }}</span>
          </Button>
        </div>
      </form>
    </div>
  </Sheet>

  <!-- ============================================================ -->
  <!-- BOTTOM DRAWER RÁPIDO: CRIAR PRIMEIRA RESERVA / CDB -->
  <!-- ============================================================ -->
  <Sheet
    v-model:open="quickVaultOpen"
    title="Criar primeira reserva ou CDB"
    description="Cadastre onde você guarda suas economias para acompanhar seu patrimônio e vincular às metas."
  >
    <form class="space-y-4" @submit.prevent="submitQuickVault">
      <div class="space-y-1.5">
        <label class="text-xs font-medium text-foreground">Sugestões rápidas</label>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="preset in VAULT_PRESETS"
            :key="preset"
            type="button"
            class="rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors"
            :class="
              vaultName === preset
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-muted/30 text-muted-foreground hover:text-foreground'
            "
            @click="vaultName = preset"
          >
            {{ preset }}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-foreground">Nome da reserva</label>
          <input
            v-model="vaultName"
            type="text"
            required
            placeholder="Ex: Reserva de Emergência"
            class="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div class="space-y-1.5">
          <label class="text-xs font-medium text-foreground">Banco / Corretora (opcional)</label>
          <input
            v-model="vaultBank"
            type="text"
            placeholder="Ex: Nubank, Itaú, Inter"
            class="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div class="space-y-1.5">
        <label class="text-xs font-medium text-foreground">
          Saldo já guardado hoje (pode começar em R$ 0,00)
        </label>
        <CurrencyInput
          v-model="vaultBalance"
          placeholder="0,00"
        />
      </div>

      <button
        type="button"
        class="flex h-10 w-full items-center justify-between rounded-lg border px-3 py-2 text-xs transition-colors"
        :class="
          vaultShared
            ? 'border-primary/40 bg-primary/10 text-foreground font-medium'
            : 'border-input bg-background text-muted-foreground'
        "
        @click="vaultShared = !vaultShared"
      >
        <span class="flex items-center gap-2">
          <Users class="h-4 w-4" :class="vaultShared ? 'text-primary' : 'text-muted-foreground'" />
          Compartilhar visualização com meu par
        </span>
        <span
          class="flex h-5 w-5 items-center justify-center rounded-full"
          :class="vaultShared ? 'bg-primary text-primary-foreground' : 'border border-muted-foreground/30'"
        >
          <Check v-if="vaultShared" class="h-3 w-3" />
        </span>
      </button>

      <div class="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" @click="quickVaultOpen = false">
          Cancelar
        </Button>
        <Button type="submit" :disabled="savingVault">
          {{ savingVault ? 'Criando...' : 'Criar reserva' }}
        </Button>
      </div>
    </form>
  </Sheet>

  <!-- ============================================================ -->
  <!-- BOTTOM DRAWER RÁPIDO: VINCULAR PAR OU ESCOLHER USO INDIVIDUAL -->
  <!-- ============================================================ -->
  <Sheet
    v-model:open="quickPartnerOpen"
    title="Usar em casal ou individual?"
    description="Vincule a conta do seu par pelo email ou confirme uso individual por enquanto."
  >
    <div class="space-y-4">
      <form class="space-y-3" @submit.prevent="submitQuickPartner">
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-foreground">
            Email da outra pessoa (ela precisa ter criado conta no DuoPact)
          </label>
          <input
            v-model="quickPartnerEmail"
            type="email"
            placeholder="outra@email.com"
            class="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <Button type="submit" class="w-full gap-1.5" :disabled="savingQuickPartner">
          <Users class="h-4 w-4" />
          <span>{{ savingQuickPartner ? 'Vinculando...' : 'Vincular conta do par' }}</span>
        </Button>
      </form>

      <div class="relative py-1 text-center">
        <span class="bg-card px-2 text-[11px] text-muted-foreground">ou</span>
      </div>

      <Button
        type="button"
        variant="secondary"
        class="w-full gap-1.5"
        @click="chooseQuickSolo"
      >
        <User class="h-4 w-4" />
        <span>Vou usar individual por enquanto</span>
      </Button>
    </div>
  </Sheet>
</template>
