# Barbearia Dennis

Controle de atendimentos da barbearia: registra cada corte (barbeiro, serviço,
forma de pagamento), mostra na hora a divisão 50/50 e o resumo do dia, da
semana e do mês. O administrador recebe uma notificação push a cada corte que os
barbeiros registram, corrigem ou apagam.

## Acesso

Cada pessoa entra tocando no próprio nome e digitando a senha.

- **Administrador (Dennis)**: vê tudo (Resumo, histórico, Ajustes), registra para
  qualquer barbeiro e, em **Ajustes → Acesso**, cria, troca ou remove a senha
  dos outros.
- **Barbeiros**: *Novo atendimento* (sempre em nome próprio) e *Meus cortes*,
  onde veem, corrigem (serviço/pagamento) e apagam só os próprios lançamentos.
  Não veem os dos outros nem mexem em serviços, preços ou acessos (bloqueado
  também na API).
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
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Chaves das notificações push (`npx web-push generate-vapid-keys`) |
| `VAPID_SUBJECT` | Contato do remetente das notificações (URL do app) |

## Notificações

Em **Ajustes → Notificações** (ou no aviso do topo), o administrador ativa em cada
aparelho. No iPhone só funciona com o app adicionado à Tela de Início (iOS 16.4+).
O service worker é `public/sw.js`.

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
| GET | `/api/appointments?since=&after=&limit=` | logado | Lista lançamentos (barbeiro: só os dele) |
| POST | `/api/appointments` | logado | Registra `{ barber_id, service_id, payment_method }` (barbeiro: sempre ele mesmo) |
| PATCH | `/api/appointments/:id` | logado | Corrige `{ service_id?, payment_method?, barber_id? (admin) }` (barbeiro: só os dele) |
| DELETE | `/api/appointments/:id` | logado | Apaga lançamento (barbeiro: só os dele) |
| POST / DELETE | `/api/push` | admin | Ativa/desativa notificações deste aparelho |
