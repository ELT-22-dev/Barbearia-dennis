# Barbearia Dennis

Controle de atendimentos da barbearia: registra cada corte (barbeiro, serviço,
forma de pagamento), mostra na hora a divisão 50/50 e o resumo do dia, da
semana e do mês. Aparelhos abertos tocam um aviso quando outro aparelho
registra um atendimento.

Acesso aberto (sem login): quem tem o link usa todas as telas.

## Stack

- **Next.js (App Router)**: telas em `app/` e `components/`
- **API routes** em `app/api/*` são o backend (validação e preço vêm do servidor)
- **Neon Postgres**: o esquema e os dados iniciais são criados sozinhos no
  primeiro acesso (`lib/db.ts`)
- Deploy único na **Vercel**: cada `git push` na `main` publica tudo

## Rodar localmente

```sh
npm install
npm run dev     # sem DATABASE_URL usa um Postgres local (PGlite) em .pglite/
npm test        # regras da divisão + fluxo completo das API routes
```

Para usar o Neon localmente, crie `.env.local` com `DATABASE_URL` (veja
`.env.example`).

## Variáveis de ambiente (painel da Vercel)

| Nome | Origem |
| --- | --- |
| `DATABASE_URL` | Criada pela integração Neon (Storage → Neon) conectada ao projeto |

## API

| Método | Rota | O que faz |
| --- | --- | --- |
| GET | `/api/barbers` | Lista barbeiros |
| PATCH | `/api/barbers/:id` | Renomeia `{ name }` |
| GET / POST | `/api/services` | Lista ativos / cria `{ name, price }` |
| PATCH / DELETE | `/api/services/:id` | Edita `{ name?, price? }` / remove (lógico) |
| GET | `/api/appointments?since=&after=&limit=` | Lista lançamentos |
| POST | `/api/appointments` | Registra `{ barber_id, service_id, payment_method }` |
| DELETE | `/api/appointments/:id` | Apaga lançamento |
