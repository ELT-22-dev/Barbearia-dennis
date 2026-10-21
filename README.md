# Barbearia Dennis

Controle de atendimentos da barbearia: registra cada corte (barbeiro, serviço,
forma de pagamento), mostra na hora a divisão 50/50 e o resumo do dia, da
semana e do mês. O administrador ouve um aviso quando outro aparelho registra
um atendimento.

## Acesso

Cada pessoa entra tocando no próprio nome e digitando a senha.

- **Administrador (Dennis)**: vê tudo (Resumo, histórico, Ajustes), registra para
  qualquer barbeiro e, em **Ajustes → Acesso**, cria, troca ou remove a senha
  dos outros.
- **Barbeiros**: só a tela *Novo atendimento*, sempre em nome próprio. Não veem
  histórico nem editam nada (bloqueado também na API).
- 5 senhas erradas seguidas bloqueiam o login daquela pessoa por 10 minutos.
- Trocar a senha ou remover o acesso desloga a pessoa na hora.
- Primeiro acesso / senha esquecida do administrador: na tela de login, Dennis →
  "Esqueci minha senha", com o código de `ADMIN_RECOVERY_CODE`.

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
| `AUTH_SECRET` | Segredo aleatório que assina as sessões (trocar desloga todo mundo) |
| `ADMIN_RECOVERY_CODE` | Código para o administrador criar/recuperar a senha |

## API

| Método | Rota | O que faz |
| --- | --- | --- |
Todas exigem sessão (cookie httpOnly com JWT), exceto login/recuperação.

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | todos | `{ barber_id, password }` |
| POST | `/api/auth/logout` | todos | Sai |
| POST | `/api/auth/recover` | todos | `{ code, password }`: senha do administrador |
| GET | `/api/barbers` | logado | Admin: todos; barbeiro: só ele |
| PATCH | `/api/barbers/:id` | admin | Renomeia `{ name }` |
| PUT / DELETE | `/api/barbers/:id/access` | admin | Define senha `{ password }` / remove acesso |
| GET | `/api/services` | logado | Lista ativos |
| POST | `/api/services` | admin | Cria `{ name, price }` |
| PATCH / DELETE | `/api/services/:id` | admin | Edita `{ name?, price? }` / remove (lógico) |
| GET | `/api/appointments?since=&after=&limit=` | admin | Lista lançamentos |
| POST | `/api/appointments` | logado | Registra `{ barber_id, service_id, payment_method }` (barbeiro: sempre ele mesmo) |
| DELETE | `/api/appointments/:id` | admin | Apaga lançamento |
