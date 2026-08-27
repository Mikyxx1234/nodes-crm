# ──────────────────────────────────────────────
# Stage 1: build do pacote n8n-nodes-eduit-crm
# ──────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /package

COPY package*.json ./
RUN npm ci

COPY . .
# Falha o build se o ícone novo não entrou no contexto (evita imagem com PNG antigo em cache).
RUN test -f nodes/EduitCrm/bwipo-icon-v2.png
RUN npm run build
RUN npm pack

# ──────────────────────────────────────────────
# Stage 2: imagem final do n8n com o node instalado
# ──────────────────────────────────────────────
# NÃO usar `n8nio/n8n:latest` — cada rebuild puxaria uma versão nova e
# derrubaria o editor. Pin na 2.33.3 (versão estável em produção).
FROM n8nio/n8n:2.33.3

USER root

RUN mkdir -p /opt/n8n/custom

COPY --from=builder /package/n8n-nodes-eduit-crm-*.tgz /tmp/n8n-nodes-eduit-crm.tgz

WORKDIR /opt/n8n/custom

RUN npm init -y \
  && npm install /tmp/n8n-nodes-eduit-crm.tgz --omit=dev

RUN chown -R node:node /opt/n8n/custom

ENV N8N_CUSTOM_EXTENSIONS=/opt/n8n/custom
ENV N8N_COMMUNITY_PACKAGES_ENABLED=true
ENV N8N_UNVERIFIED_PACKAGES_ENABLED=true

USER node
