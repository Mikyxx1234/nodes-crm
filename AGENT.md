# AGENT.md — histórico de decisões

Este arquivo registra decisões estruturais tomadas ao longo do desenvolvimento do pacote `n8n-nodes-eduit-crm`. Uma entrada por decisão, ordem cronológica, formato fixo.

---

### 2026-08-04 - Message: envio WhatsApp com lista interativa (até 10 opções)

**Decisão**

Nova operation `Send WhatsApp List (Interactive)` no resource `Message`. Cobre o cenário de 4-10 opções, que o `type: button` (limitado a 3) não atende. Bate em `POST /api/deals/:id/messages` com `kind: "list"`:

```json
{
  "kind": "list",
  "body": "Escolha um curso:",
  "button": "Ver cursos",
  "sectionTitle": "Graduação",
  "rows": [
    { "id": "curso_adm", "title": "Administração", "description": "4 anos" },
    { "id": "curso_eng", "title": "Engenharia" }
  ]
}
```

Backend expõe `sendInteractiveListToConversation` em `outbound-messaging.ts` e `metaClient.sendInteractiveList` em `lib/meta-whatsapp/client.ts` (não existia). Reuso 100% do padrão de `sendInteractiveButtonsToConversation` (reabrir ticket resolved, `requireChannelScope`, SSE, `afterOutboundSideEffects`).

**Contexto**

`type: button` da Cloud API é limitado a 3 reply buttons por hard-limit da Meta. Casos comuns do CRM (menu de cursos, horários, produtos) precisam de mais opções e a Meta oferece `type: list` como caminho oficial: 1 botão que abre um menu de até 10 rows.

O node do n8n mantém UX simples — aceita `rows` no top-level e cria uma única seção por trás (`sectionTitle` opcional). O backend também aceita `sections: [{ title, rows }]` no shape puro da Cloud API como escape hatch para integrações que precisem de múltiplas seções.

**Alternativas descartadas**

- **Fundir buttons + list numa operation única** (com `Menu Type` como discriminador). Descartado: os campos são bastante diferentes (button não tem `Description` nem `Button Label`, list não tem `Header` estruturalmente idêntico). Duas operations deixam o formulário mais limpo.
- **Permitir múltiplas seções direto no UI.** Descartado por complexidade: fixedCollection aninhada em fixedCollection é ruim de operar. Deixamos o `sections` só como escape via HTTP.
- **Reaproveitar `messageType: "list"` no Message.** Descartado: mantivemos `messageType: "interactive"` para list e buttons (com `content` diferenciado — `[Lista: ...]` vs `[Botões: ...]`). Reduz variantes na timeline.

**Impacto**

- Backend: 3 arquivos — `lib/meta-whatsapp/client.ts` (novo método `sendInteractiveList`), `services/outbound-messaging.ts` (+250 LOC), `app/api/deals/[id]/messages/route.ts` (+55 LOC com o branch `list` e o parser `parseRows`).
- Nodes: 2 arquivos — `MessageDescription.ts` (nova operation + campos), `EduitCrm.node.ts` (handler `sendList`).
- Sem breaking change. `sendInteractive` (buttons) segue igual.

---

### 2026-08-04 - Message: envio WhatsApp com botões interativos (reply buttons)

**Decisão**

Nova operation `Send WhatsApp with Buttons (Interactive)` no resource `Message`. Body/header/footer/buttons aceitam expressões n8n (texto variável vindo do workflow). Meta Cloud API é o único destino — Baileys/Messenger/Instagram são rejeitados no service.

Bate no mesmo `POST /api/deals/:id/messages` com `kind: "interactive"`, novo shape no body:

```json
{ "kind": "interactive", "body": "...", "buttons": [{"id":"opt_yes","title":"Sim"}], "header":"...", "footer":"..." }
```

**Contexto**

O uso deste tipo de mensagem hoje só existia dentro do `automation-executor` (step `send_whatsapp_interactive`). n8n é o canal natural para orquestrar botões dinâmicos vindos de sistemas externos (ex.: qualificar lead com "Sim/Não/Falar com atendente" após um webhook). Sem esta operation, o operador precisava criar uma automação inteira só para expor o botão.

**Alternativas descartadas**

- **List messages, CTA URL, media header.** Fora do escopo pedido pelo usuário ("Pode fazer isso e mais nada?"). Cobrir só reply buttons — o formato mais comum.
- **Node autônomo `WhatsApp Interactive`.** Manter dentro de `Message` mantém a UX consistente com `sendText/sendTemplate` (mesmo `Deal ID`, mesmo bloco `Options`).
- **Aceitar 4+ botões e o servidor cortar em 3.** Rejeitar com 400 no service é mais claro que enviar mensagem incompleta silenciosamente. O n8n também valida antes do HTTP.

**Impacto**

- Backend: 2 arquivos (`src/services/outbound-messaging.ts` +200 LOC com `sendInteractiveButtonsToConversation`; `src/app/api/deals/[id]/messages/route.ts` +40 LOC com o branch `interactive` e o parser `parseButtons`).
- Nodes: 2 arquivos (`MessageDescription.ts` +65 LOC com a operation nova e seus campos; `EduitCrm.node.ts` +50 LOC com o handler).
- Formato do `content` gravado na `Message` (`"body\n[Botões: t1, t2, t3]"`) é idêntico ao já usado por `automation-executor` — timeline unificada.
- Isolamento por org: mantido via `authenticateApiRequest` + `runWithApiUserContext` já existentes na rota.

---

### 2026-08-03 - Resource `Message`: envio pelo deal com template, modelo interno e flow

**Decisão**

Novo resource `Message` com três operations, todas partindo de um **Deal ID**:

1. `Send Internal Note` — nota interna (inbox + aba Notas do deal).
2. `Send WhatsApp Message` — texto livre, com conteúdo manual, de modelo interno ou de resposta rápida.
3. `Send WhatsApp Template` — template aprovado da WABA, com preview e variáveis por seleção, incluindo templates com botão Flow.

Tudo bate em `POST /api/deals/:id/messages`, endpoint agregador criado no backend nesta mesma data. O node não resolve conversa nem monta JSON da Meta: envia `dealId` + `kind` + campos amigáveis, e o servidor faz o resto.

Sete `loadOptions` novos alimentam os dropdowns: templates aprovados, variáveis do template selecionado, modelos internos, respostas rápidas, variáveis do conteúdo interno, flows e campos das telas do flow.

**Contexto**

A entrada de 2026-07-30 registrava o resource `Message` como fora do v1 por falta de endpoint Bearer: enviar exigia `conversationId` e criar conversa dependia de sessão NextAuth. O backend resolveu isso resolvendo a conversa server-side a partir do deal.

**Alternativas descartadas**

- **Preview do template em campo próprio no node.** A UI de node do n8n não tem campo reativo a outro parâmetro — um `notice` é estático. Optamos por colocar cabeçalho, corpo e botões na `description` de cada opção do dropdown, que o n8n renderiza na própria lista no momento da escolha.
- **`Deal ID` como dropdown.** Descartado: listar todos os negócios da organização não escala e o caso de uso real recebe o `dealId` do webhook ou de um node `Deal > Search` anterior.
- **Buscar o corpo do template em runtime para renderizar o texto da timeline.** Descartado: `GET /whatsapp-template-configs/approved` pagina a Graph inteira e seria chamado uma vez por item processado. O backend passou a resolver corpo e idioma sozinho, então em runtime o node envia só o nome do template e as variáveis.
- **Campo único de `flow_action_data` em JSON.** Descartado pelo requisito de seleção: o dropdown de flows libera a lista de campos das telas daquele flow, e as chaves viram opções.

**Impacto**

- 3 arquivos do node alterados (`EduitCrm.node.ts`, `GenericFunctions.ts`, `descriptions/index.ts`) e 1 criado (`descriptions/MessageDescription.ts`). Zero breaking change — nenhum resource existente foi tocado.
- Depende do deploy do backend de 03/ago/26. Sem ele, os dropdowns ficam vazios e o envio retorna `404`.
- Isolamento multi-tenant continua garantido pelo token: a org sai do `ApiToken`, e um `dealId` de outra organização retorna 404.

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
