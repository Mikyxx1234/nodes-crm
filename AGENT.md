# AGENT.md — histórico de decisões

Este arquivo registra decisões estruturais tomadas ao longo do desenvolvimento do pacote `n8n-nodes-eduit-crm`. Uma entrada por decisão, ordem cronológica, formato fixo.

---

### 2026-07-30 - Nodes v0.2: Search by Ad Source ID + Note on Deal

**Decisão**
Adicionar dois novos nodes ao pacote:
1. Filtro `Ad Source ID (Meta CTWA)` em `Contact > Search` (com toggle opcional `Include Deals`) **e** em `Search > Search Full Record` como novo `Search By`.
2. Novo resource `Note` com operation `Create on Deal` — bate em `POST /api/deals/:id/notes`.

Ambos dependem de mudanças no backend (`Mikyxx1234/backend_crm1`), entregues em `backend-n8n-nodes-v2.patch` (na raiz deste repo):
- `GET /api/contacts` aceita query param `adSourceId` (match exato em `Contact.adSourceId`).
- `POST /api/deals/:id/notes` passa a aceitar **Bearer token** (via `authenticateApiRequest` + `runWithApiUserContext`) e, além do `Note` (que já existia), cria também uma `Message` `messageType="note", isPrivate=true` na conversa mais recente do contato do deal — assim a nota aparece **tanto em `/pipeline` (aba Notas do deal) quanto em `/inbox` (timeline)**. Emite `sseBus.publish("new_message", ...)` pra atualização em tempo real.

**Contexto**
O usuário precisa disparar dois fluxos comuns via n8n:
- Enumerar contatos originados por um anúncio Meta específico (`adSourceId` é o id do post/ad no referral).
- Registrar notas em deals a partir de webhooks/automation, com visibilidade nos dois lugares onde o operador consome contexto (chat do inbox e painel do deal).

**Alternativas descartadas**
- **`POST /api/conversations/:id/messages`** com `messageType: "note"` (endpoint que já espelhava nota em `Note`+`Message`): descartado porque exige `conversationId`, que hoje o token Bearer não consegue resolver a partir de contato/deal (o endpoint `POST /api/conversations/create` só aceita sessão). Passar por deal é mais idiomático pro caso de uso (n8n recebe `dealId` do webhook do CRM).
- **Endpoint novo `POST /api/deals/:id/conversation-note`**: descartado por gerar dois caminhos convivendo (o antigo `POST /api/deals/:id/notes` continuaria só criando `Note`). Preferimos evoluir o endpoint existente — o comportamento anterior é preservado quando o contato não tem conversa.
- **Novo resource inteiro pra "Search by Ad Source ID"**: descartado. Reutilizamos os handlers de `contact:search` e `search:fullRecord` — adicionar filtro é menos ruído no dropdown de operações.

**Impacto**
- Backend: 3 arquivos alterados (`src/services/contacts.ts`, `src/app/api/contacts/route.ts`, `src/app/api/deals/[id]/notes/route.ts`). Comportamento do frontend preservado (a rota de notas do deal continua funcionando com session — `authenticateApiRequest` faz fallback pra `auth()` quando não há Bearer).
- Nodes: 5 arquivos alterados/criados. Zero breaking change (nada removido; só adições).
- Isolamento multi-tenant: garantido pela `Prisma Extension` já existente — `runWithApiUserContext` ativa o `RequestContext` com `organizationId` do token, e todas as queries em `contact/deal/note/message/conversation` passam a filtrar por essa org automaticamente. Um token de uma org que tente acessar `dealId` de outra recebe 404.
