# TESTING — n8n-nodes-eduit-crm

Testes manuais reais contra um ambiente do CRM. **Use primeiro um ambiente de DEV/staging** e um token de API de DEV. Só depois valide em produção (comece pelas operações de leitura).

## Pré-requisitos

1. `npm install && npm run build` no pacote.
2. n8n rodando com o node carregado (ver README).
3. Credencial `Eduit CRM API` configurada:
   - `Base URL`: URL do backend do CRM.
   - `API Token`: token `eduit_...` de um usuário com permissões de contato/deal.
4. Tenha à mão um `pipelineId`/`stageId` válidos (use o dropdown ou `GET /api/pipelines`).

> Dica: o botão **Test** da credencial chama `GET /api/contacts?perPage=1`. Deve passar antes de qualquer teste.

---

## 1. Criar contato novo + deal (Create Deal With Contact)

- Resource: **Deal + Contact** → **Create Deal With Contact**.
- Preencha: `Contact Name` (novo, ex.: "Teste n8n"), `Contact Phone` (um telefone que NÃO exista), `Pipeline`, `Stage`, `Deal Title`.
- Execute.
- **Esperado:** resposta com `contactCreated: true`, `dealCreated: true`, objetos `contact` e `deal` preenchidos. Status do contato/deal visível no CRM.

## 2. Criar deal para contato já existente (Create Deal With Contact)

- Mesmo node, mas use o `Contact Phone` (ou `Contact Email`) do contato criado no teste 1.
- Execute.
- **Esperado:** `contactCreated: false` (reaproveitou), `dealCreated: true`, `contact.id` igual ao do teste 1. Não deve duplicar o contato.

## 2b. Criar deal para contato já existente (Create Deal For Existing Contact)

- Resource: **Deal + Contact** → **Create Deal For Existing Contact**.
- Preencha: `Contact ID` (ou phone/email) do contato do teste 1, `Pipeline`, `Stage`, `Deal Title`.
- Execute.
- **Esperado:** `contactCreated: false`, `deal` preenchido, `contact.id` igual ao do teste 1.
- Repita com um telefone que **não** existe. **Esperado:** erro "Contato não encontrado" — **não** cria contato.

## 3. Mover deal de fase (Move Stage)

- Resource: **Deal** → **Move Stage**.
- `Deal ID` = id do deal criado; selecione um `Stage` diferente (mesmo pipeline).
- Execute.
- **Esperado:** retorno do deal com o novo `stageId`/stage. No CRM, o card mudou de coluna.
- **Observação:** confirme que está usando `PUT /api/deals/:id` (e não `/move`).

## 4. Update sem apagar campos existentes

- Resource: **Deal** → **Update** (ou **Contact** → **Update**).
- Informe apenas UM campo (ex.: `Value`) e deixe os outros vazios.
- Execute.
- **Esperado:** só o campo enviado muda; os demais (título, contato, etc.) permanecem. Teste também `Value = 0` → deve gravar `0` (não ser ignorado).

## 4b. Custom fields (campos personalizados)

- **Contact → Create**: preencha `Name` e, no bloco **Custom Fields**, escolha um campo no dropdown e informe um valor. Execute.
  - **Esperado:** contato criado e, no CRM, o campo personalizado com o valor. A resposta traz `customFields` com os valores atuais.
- **Deal → Update**: informe `Deal ID` e só um **Custom Field** (sem campos core). Execute.
  - **Esperado:** o custom field é gravado mesmo sem alterar campos padrão (update só de custom field é permitido).
- **Deal + Contact → Create Deal With Contact**: preencha **Contact Custom Fields** e **Deal Custom Fields**. Execute.
  - **Esperado:** contato + deal criados com os custom fields preenchidos.
- **Dropdown vazio?** Confirme que o backend com o ajuste de `GET /api/custom-fields` (Bearer) foi deployado e que o usuário do token tem visualização (`deal:view` para campos de negócio).

## 5. Token inválido

- Edite a credencial e troque o `API Token` por um valor inválido (ex.: `eduit_invalido`).
- Execute qualquer operação.
- **Esperado:** erro `401` ("Token inválido ou expirado").

## 6. Permissão insuficiente

- Use um token de um usuário SEM `deal:create`.
- Tente **Deal → Create** ou **Deal + Contact → Create Deal With Contact**.
- **Esperado:** erro `403` (acesso negado).

## 7. stageId inválido

- **Deal → Create** com `Stage Source = Manual` e `Stage ID = inexistente`.
- **Esperado:** erro `400` (estágio/referência inválida).

---

## Checklist de aceite

- [ ] Test da credencial passa.
- [ ] Teste 1 cria contato + deal.
- [ ] Teste 2 reaproveita contato (sem duplicar).
- [ ] Teste 2b cria deal para contato existente e recusa contato inexistente.
- [ ] Teste 3 move de fase via PUT.
- [ ] Teste 4 preserva campos e grava `0`.
- [ ] Teste 5 retorna 401.
- [ ] Teste 6 retorna 403.
- [ ] Teste 7 retorna 400.
- [ ] Search Full Record retorna todos os contatos + `mainContact`/`mainDeal`.
