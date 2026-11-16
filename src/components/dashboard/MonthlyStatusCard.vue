<script setup lang="ts">
import type { DashboardTone } from '@/stores/dashboard/dashboard.store'

defineProps<{
  periodLabel: string
  tone: DashboardTone
  title: string
  message: string
  recommendation?: string
}>()
</script>

<template>
  <section class="status-card" :class="`status-card--${tone}`">
    <div class="status-card__eyebrow">Status do mês</div>
    <div class="status-card__content">
      <div>
        <p class="status-card__period">{{ periodLabel }}</p>
        <h1 class="status-card__title">{{ title }}</h1>
        <p class="status-card__message">{{ message }}</p>
        <p v-if="recommendation" class="status-card__recommendation">{{ recommendation }}</p>
      </div>
      <div class="status-card__badge">
        <span class="status-card__dot" />
        <span>{{ tone === 'positive' ? 'Saudável' : tone === 'warning' ? 'Atenção' : tone === 'danger' ? 'Risco' : 'Neutro' }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.status-card {
  position: relative;
  overflow: hidden;
  border-radius: 1rem;
  padding: 1.2rem;
  border: 1px solid var(--dp-border);
  background: linear-gradient(135deg, var(--color-background-soft), var(--color-background-mute));
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.14);
}

.status-card::before {
  content: '';
  position: absolute;
  inset: -2px;
  opacity: 0;
  pointer-events: none;
  background: radial-gradient(
    800px 240px at 18% 0%,
    rgba(255, 255, 255, 0.55),
    transparent 62%
  );
}

.status-card::after {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
  background: radial-gradient(650px 220px at 0% 0%, var(--status-accent-soft), transparent 62%);
}

.status-card__content,
.status-card__eyebrow {
  position: relative;
  z-index: 1;
}

.status-card--positive {
  border-color: rgba(28, 189, 120, 0.38);
  box-shadow: 0 18px 42px rgba(13, 92, 58, 0.12);
  --status-accent: #3dd68c;
  --status-accent-soft: rgba(61, 214, 140, 0.22);
}

.status-card--warning {
  border-color: rgba(245, 173, 58, 0.35);
  box-shadow: 0 18px 42px rgba(105, 72, 7, 0.11);
  --status-accent: #f5ad3a;
  --status-accent-soft: rgba(245, 173, 58, 0.22);
}

.status-card--danger {
  border-color: rgba(239, 68, 68, 0.38);
  box-shadow: 0 18px 42px rgba(103, 21, 21, 0.14);
  --status-accent: #f87171;
  --status-accent-soft: rgba(248, 113, 113, 0.22);
}

.status-card--neutral {
  --status-accent: rgba(255, 255, 255, 0.55);
  --status-accent-soft: rgba(255, 255, 255, 0.06);
}

.status-card--positive::after,
.status-card--warning::after,
.status-card--danger::after,
.status-card--neutral::after {
  opacity: 1;
}

.status-card--positive::before,
.status-card--warning::before,
.status-card--danger::before,
.status-card--neutral::before {
  opacity: 0.18;
}

.status-card--positive::after,
.status-card--warning::after,
.status-card--danger::after,
.status-card--neutral::after {
  mix-blend-mode: multiply;
}

:global(html[data-theme='dark']) .status-card {
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.22);
}

:global(html[data-theme='dark']) .status-card::before {
  background: radial-gradient(800px 240px at 18% 0%, rgba(255, 255, 255, 0.08), transparent 60%);
}

:global(html[data-theme='dark']) .status-card--positive::before,
:global(html[data-theme='dark']) .status-card--warning::before,
:global(html[data-theme='dark']) .status-card--danger::before,
:global(html[data-theme='dark']) .status-card--neutral::before {
  opacity: 0.65;
}

:global(html[data-theme='dark']) .status-card--positive::after,
:global(html[data-theme='dark']) .status-card--warning::after,
:global(html[data-theme='dark']) .status-card--danger::after,
:global(html[data-theme='dark']) .status-card--neutral::after {
  mix-blend-mode: screen;
}

.status-card__eyebrow {
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--dp-text-muted);
  margin-bottom: 0.8rem;
}

.status-card__content {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}

.status-card__period {
  font-size: 0.9rem;
  color: var(--dp-text-secondary);
  margin-bottom: 0.35rem;
}

.status-card__title {
  font-size: clamp(1.5rem, 2vw, 2rem);
  line-height: 1.15;
  color: var(--dp-text-primary);
  margin: 0;
}

.status-card__message {
  margin-top: 0.6rem;
  color: var(--dp-text-secondary);
  max-width: 52rem;
  line-height: 1.5;
}

.status-card__recommendation {
  margin-top: 0.55rem;
  color: var(--dp-text-primary);
  font-weight: 600;
  line-height: 1.4;
}

.status-card__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 0.75rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--dp-text-primary);
  font-size: 0.82rem;
  font-weight: 600;
  white-space: nowrap;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.status-card__dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  background: currentColor;
}

.status-card--positive .status-card__badge {
  color: var(--status-accent);
}

.status-card--warning .status-card__badge {
  color: var(--status-accent);
}

.status-card--danger .status-card__badge {
  color: var(--status-accent);
}

@media (max-width: 700px) {
  .status-card__content {
    flex-direction: column;
  }
}
</style>
