<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    text: string
    tag?: 'p' | 'span' | 'h3' | 'div'
  }>(),
  {
    tag: 'p',
  },
)

const textRef = ref<HTMLElement | null>(null)
const visible = ref(false)
const coords = ref({ top: 0, left: 0 })

function checkAndShow() {
  const el = textRef.value
  if (!el) return
  // Só abre o tooltip quando o texto realmente ficou cortado com reticências (...)
  if (el.scrollWidth <= el.clientWidth + 1) {
    visible.value = false
    return
  }
  const rect = el.getBoundingClientRect()
  coords.value = {
    top: Math.max(rect.top - 8, 8),
    left: Math.min(Math.max(rect.left, 12), window.innerWidth - 24),
  }
  visible.value = true
}

function hide() {
  visible.value = false
}

function handleTouch() {
  if (visible.value) {
    hide()
    return
  }
  checkAndShow()
}

onBeforeUnmount(() => {
  visible.value = false
})
</script>

<template>
  <component
    :is="tag"
    ref="textRef"
    class="truncate"
    :title="props.text"
    @mouseenter="checkAndShow"
    @mouseleave="hide"
    @focus="checkAndShow"
    @blur="hide"
    @click.stop="handleTouch"
  >
    {{ props.text }}
  </component>

  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="opacity-0 translate-y-0.5 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="visible"
        role="tooltip"
        class="pointer-events-none fixed z-[100] max-w-xs -translate-y-full rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs font-medium text-popover-foreground shadow-lg"
        :style="{ top: `${coords.top}px`, left: `${coords.left}px` }"
      >
        {{ props.text }}
      </div>
    </Transition>
  </Teleport>
</template>
