# DuoPact — Controle Financeiro a Dois (Nuxt 3 Full-stack)

Aplicação unificada em **Nuxt 3** (Vue 3 + Pinia + Tailwind CSS no front e **Nitro + Drizzle ORM + SQLite** no backend integrado em `/api/*`).

## Como rodar

Não precisa de Docker nem de servidor backend separado! O banco SQLite é criado e populado com as categorias padrão automaticamente em `.data/dualpact.sqlite` na primeira execução.

```bash
# Instalar dependências
npm install

# Subir aplicação completa (Front + API Nitro + SQLite)
npm run dev
```

Acesse em `http://localhost:3000`.

## Estrutura

- `src/` — Interface Vue 3 (`views/`, `components/`, `stores/`, `layouts/`, `api/`)
- `server/database/` — Schema Drizzle ORM (`schema.ts`) e inicialização/seed automático do SQLite (`index.ts`)
- `server/api/` — Endpoints da API Nitro (`/api/auth`, `/api/users`, `/api/accounts`, `/api/cards`, `/api/categories`, `/api/transactions`, `/api/recurring`, `/api/budgets`, `/api/dashboard`)
- `server/utils/` — Autenticação JWT, regras de visibilidade do casal (household), ciclos de fatura e cálculos financeiros
