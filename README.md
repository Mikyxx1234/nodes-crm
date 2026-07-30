# n8n-nodes-eduit-crm

Node privado do n8n para operar o **Eduit CRM** com campos amigáveis (sem montar JSON manual). Consome a API existente do CRM via token Bearer. Não altera o backend nem o frontend do CRM.

## Recursos e operações

- **Deal + Contact**
  - `Create Deal With Contact` (prioridade) — acha o contato (ID → telefone → e-mail) ou cria, e cria o negócio já vinculado. Usa `POST /api/leads` (atômico e idempotente por telefone/e-mail).
- **Contact**
  - `Search` — `GET /api/contacts` (termo, e-mail exato, telefone exato, lifecycle, **Ad Source ID Meta CTWA**). Toggle `Include Deals` enriquece cada contato com `deals: [...]` (chamada extra `GET /api/deals?contactId=...`).
  - `Create` — `POST /api/contacts`.
  - `Update` — `PUT /api/contacts/:id`.
- **Deal**
  - `Search` — `GET /api/deals` (pipeline, stage, status, dono, contato).
  - `Create` — `POST /api/deals`.
  - `Update` — `PUT /api/deals/:id`.
  - `Move Stage` — `PUT /api/deals/:id` com `stageId` (não usa `/api/deals/:id/move`, que depende de sessão).
- **Note**
  - `Create on Deal` — `POST /api/deals/:id/notes`. Cria uma nota vinculada ao negócio; a mesma nota aparece **tanto na aba "Notas" do deal em `/pipeline` quanto na timeline do `/inbox`** (como nota interna) se o contato do deal tiver conversa vigente. Requer o ajuste do backend que fez esta rota aceitar Bearer token e espelhar a nota como `Message` privada.
- **Search**
  - `Search Full Record` — busca contatos e os negócios de cada um; retorna todos os resultados + `mainContact`/`mainDeal`. Aceita `Search By`: General Term, Email, Phone ou **Ad Source ID (Meta CTWA)**.

## Credencial: `Eduit CRM API`

| Campo       | Descrição                                                        |
| ----------- | ---------------------------------------------------------------- |
| `Base URL`  | URL base do CRM, sem barra final. Ex.: `https://api.seu-crm.com` |
| `API Token` | Token gerado no CRM (formato `eduit_...`).                       |

- A organização é resolvida automaticamente a partir do token — não é preciso informar `organizationId`.
- O token vai sempre no header `Authorization: Bearer <token>` (nunca como campo do node).
- Gere o token no CRM em **Configurações > API Tokens**.

## Pré-requisitos de permissão

O usuário dono do token precisa das permissões:

- `contact:create`, `contact:edit`
- `deal:create`, `deal:edit`, `deal:change_stage` (e escopo do stage)

Sem elas, a API retorna `403`.

## Instalação

### Opção 1 — Local (desenvolvimento/teste)

```bash
cd "C:\Users\Caio\crm v3\n8n-nodes-eduit-crm"
npm install
npm run build
```

Carregue no n8n local apontando a pasta de extensões customizadas:

```bash
# Windows PowerShell
$env:N8N_CUSTOM_EXTENSIONS="C:\Users\Caio\crm v3\n8n-nodes-eduit-crm"
n8n start
```

Ou via `npm link` (linka o pacote no diretório `~/.n8n/custom`):

```bash
npm link
# em ~/.n8n/custom (crie se não existir):
npm link n8n-nodes-eduit-crm
```

### Opção 2 — Imagem Docker custom do n8n (Easypanel) — recomendado

Este repositório **não é uma aplicação independente**: ele gera uma imagem Docker baseada em `n8nio/n8n:latest` com o node já instalado. O `Dockerfile` na raiz:

1. Compila o pacote (`npm ci` + `npm run build`).
2. Empacota com `npm pack` (gera `n8n-nodes-eduit-crm-<versão>.tgz`).
3. Parte de `FROM n8nio/n8n:latest`.
4. Instala o `.tgz` em `/opt/n8n/custom`.
5. Define `N8N_CUSTOM_EXTENSIONS=/opt/n8n/custom`.

#### Build local

```bash
docker build -t n8n-eduit-crm .
# rodar localmente (exemplo):
docker run -it --rm -p 5678:5678 \
  -e N8N_ENCRYPTION_KEY="<a mesma chave do seu n8n atual>" \
  n8n-eduit-crm
```

#### Deploy no Easypanel

1. Crie um serviço/app no Easypanel usando **GitHub**.
2. Selecione o repositório `Mikyxx1234/nodes-crm`.
3. Selecione a branch `main`.
4. Use o **Dockerfile da raiz** (build por Dockerfile, não Nixpacks/Buildpacks).
5. **Mantenha as mesmas variáveis de ambiente do n8n atual** (host, webhook URL, DB, etc.).
6. **Mantenha os mesmos volumes e o mesmo banco** do n8n atual (para não perder workflows/credenciais).
7. **Imprescindível: mantenha a mesma `N8N_ENCRYPTION_KEY`** — sem ela, as credenciais existentes ficam ilegíveis.

> As variáveis `N8N_CUSTOM_EXTENSIONS`, `N8N_COMMUNITY_PACKAGES_ENABLED` e `N8N_UNVERIFIED_PACKAGES_ENABLED` já vêm definidas na imagem pelo Dockerfile; não precisa duplicar (mas se já existirem no serviço, não conflitam).

#### Validação pós-deploy

1. Abra o n8n.
2. Em um workflow, adicione um node e procure por **Eduit CRM**.
3. Crie a credencial **Eduit CRM API** (`Base URL` + `API Token`) e clique em **Test** (deve passar — chama `GET /api/contacts?perPage=1`).
4. Teste **Contact > Search** (busca simples).
5. Teste **Deal + Contact > Create Deal With Contact** (cria contato + negócio).

> Atualizou o node? Faça commit/push na branch `main` e rebuild do serviço no Easypanel — a imagem recompila o pacote do zero.

## UX dos campos

- **Pipeline** e **Stage** são dropdowns (carregados de `GET /api/pipelines`). O **Stage** depende do Pipeline selecionado. Se a dependência dinâmica não carregar no seu n8n, escolha **Stage Source = Enter Stage ID Manually** e informe o `stageId`.
- **Status** e **Lifecycle Stage** são listas fixas com os valores reais do backend (`OPEN/WON/LOST` e `SUBSCRIBER/LEAD/MQL/SQL/OPPORTUNITY/CUSTOMER/EVANGELIST/OTHER`).
- **Owner ID / Assigned To ID / Contact ID / Company ID** são campos de texto (ID).

## Campos personalizados (Custom Fields)

O node suporta campos personalizados (custom fields) da organização em:

- **Contact > Create / Update** — bloco **Custom Fields**.
- **Deal > Create / Update** — bloco **Custom Fields**.
- **Deal + Contact > Create Deal With Contact** — blocos **Contact Custom Fields** e **Deal Custom Fields**.

Cada entrada tem um **dropdown com a lista de campos** (carregada de `GET /api/custom-fields`) e um **Value**. Em `Create`, o node primeiro cria o registro e depois grava os custom fields; em `Update`, grava direto. No `Create Deal With Contact`, os valores vão inline no `POST /api/leads`.

Endpoints usados:

- `GET /api/custom-fields?entity=contact|deal` — lista as definições para o dropdown (aceita Bearer).
- `PUT /api/contacts/:id/custom-fields` e `PUT /api/deals/:id/custom-fields` — gravam os valores (`{ values: [{ fieldId, value }] }`).

> O dropdown depende do backend com o ajuste que faz `GET /api/custom-fields` aceitar Bearer token. Se o seu backend ainda não tem esse ajuste, o dropdown fica vazio (faça o deploy do backend atualizado).

## Limitações conhecidas / pendências

- **Owner (responsável) por dropdown:** indisponível nesta versão porque `GET /api/users` só aceita sessão NextAuth (não aceita token Bearer). Use o **Owner ID** manual. Quando existir um endpoint de usuários compatível com token, um dropdown será adicionado.
- **WhatsApp (resource `Message`):** fora do v1. Não há endpoint Bearer amigável por telefone/contato (o envio por token existe só em `POST /api/conversations/:id/messages`, que exige `conversationId`; e `POST /api/conversations/create` depende de sessão). Pendente até um endpoint auxiliar ser criado no backend.
- **`Note > Create on Deal`** só espelha a nota como `Message` no `/inbox` se o contato do deal tiver **alguma conversa vigente** (mais recente por `updatedAt`). Se o contato nunca teve conversa, a nota aparece só na aba "Notas" do deal em `/pipeline` (comportamento igual ao painel manual do deal).

## Atualização em Update (preservação de campos)

Em `Update Contact` e `Update Deal`, o node só envia campos realmente preenchidos: descarta `undefined`, `null` e strings vazias, mas **preserva `0` e `false`**. Assim, atualizar um campo não apaga os demais.
