<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { X } from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
  title?: string
  description?: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  close: []
}>()

function closeSheet() {
  emit('update:open', false)
  emit('close')
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) {
    closeSheet()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  if (typeof document !== 'undefined' && props.open) {
    document.body.style.overflow = ''
  }
})

watch(
  () => props.open,
  (isOpen) => {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = isOpen ? 'hidden' : ''
    }
  },
)
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px]"
        aria-hidden="true"
        @click="closeSheet"
      />
    </Transition>

    <!-- Bottom Drawer (de baixo para cima, estilo Vaul / shadcn Drawer) -->
    <Transition
      enter-active-class="transform transition duration-250 cubic-bezier(0.32, 0.72, 0, 1)"
      enter-from-class="translate-y-full"
      enter-to-class="translate-y-0"
      leave-active-class="transform transition duration-200 ease-in"
      leave-from-class="translate-y-0"
      leave-to-class="translate-y-full"
    >
      <div
        v-if="open"
        class="fixed inset-x-0 bottom-0 z-50 flex justify-center pointer-events-none"
        role="dialog"
        aria-modal="true"
      >
        <aside
          class="pointer-events-auto flex max-h-[90dvh] w-full max-w-xl flex-col rounded-t-2xl border-t border-x border-border bg-card text-card-foreground shadow-2xl"
        >
          <!-- Handle pill superior estilo Bottom Drawer -->
          <div class="flex justify-center pt-3 pb-1" @click="closeSheet">
            <div class="h-1.5 w-12 cursor-pointer rounded-full bg-muted-foreground/25 hover:bg-muted-foreground/40 transition-colors" />
          </div>

          <div class="flex items-start justify-between border-b border-border px-6 pt-2 pb-4">
            <div class="space-y-1 pr-4">
              <h2 v-if="title" class="text-base font-semibold tracking-tight text-foreground">
                {{ title }}
              </h2>
              <p v-if="description" class="text-xs text-muted-foreground">
                {{ description }}
              </p>
            </div>
            <button
              type="button"
              class="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Fechar painel"
              @click="closeSheet"
            >
              <X class="h-4 w-4" />
            </button>
          </div>

          <div class="flex-1 overflow-y-auto px-6 py-5">
            <slot />
          </div>

          <div v-if="$slots.footer" class="border-t border-border bg-muted/20 px-6 py-4">
            <slot name="footer" />
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>
