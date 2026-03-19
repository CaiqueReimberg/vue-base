import { defineStore } from 'pinia'
import type { Card, CardCreateInput, CardUpdateInput } from '@/types/card'
import { cardsApi } from '@/api/cards.api'

export const useCardsStore = defineStore('cards', {
  state: () => ({
    cards: [] as Card[],
    loading: false,
    error: null as string | null,
  }),

  getters: {
    formatCurrency() {
      return (value: number) =>
        new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }).format(value)
    },
    cardById: (state) => (id: string) => state.cards.find((c) => c.id === id),
  },

  actions: {
    async fetchAll() {
      this.loading = true
      this.error = null
      try {
        this.cards = await cardsApi.list()
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Erro ao carregar cartões'
      } finally {
        this.loading = false
      }
    },

    async fetchOne(id: string) {
      this.loading = true
      this.error = null
      try {
        const card = await cardsApi.getById(id)
        const idx = this.cards.findIndex((c) => c.id === id)
        if (idx >= 0) this.cards[idx] = card
        else this.cards.push(card)
        return card
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Erro ao carregar cartão'
        throw e
      } finally {
        this.loading = false
      }
    },

    async create(data: CardCreateInput) {
      this.loading = true
      this.error = null
      try {
        const card = await cardsApi.create(data)
        this.cards.push(card)
        return card
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Erro ao criar cartão'
        throw e
      } finally {
        this.loading = false
      }
    },

    async update(id: string, data: CardUpdateInput) {
      this.loading = true
      this.error = null
      try {
        const card = await cardsApi.update(id, data)
        const idx = this.cards.findIndex((c) => c.id === id)
        if (idx >= 0) this.cards[idx] = card
        return card
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Erro ao atualizar cartão'
        throw e
      } finally {
        this.loading = false
      }
    },

    async remove(id: string) {
      this.loading = true
      this.error = null
      try {
        await cardsApi.delete(id)
        this.cards = this.cards.filter((c) => c.id !== id)
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Erro ao excluir cartão'
        throw e
      } finally {
        this.loading = false
      }
    },
  },
})
