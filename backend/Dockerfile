# Build context: raiz do repo (automacao-xml/ + backend/)
# Railway: Root Directory = / (vazio) — ver railway.toml na raiz do repo
# Deploy CLI local: cd backend && npm run deploy:railway
# Tag do Alpine fixada de propósito: 'node:18-alpine' hoje aponta para
# alpine3.21, que é a primeira release com postgresql17-client (3.20 só tem até
# o 16, e pg_dump 16 RECUSA dump de servidor 17). Se a tag flutuar para uma
# Alpine sem esse pacote, o build quebra aqui em vez de o backup quebrar calado.
FROM node:18-alpine3.21 AS builder

WORKDIR /app

COPY backend/package*.json backend/tsconfig.json ./
RUN if [ -f package-lock.json ]; then npm ci --ignore-scripts; else npm install --ignore-scripts; fi

COPY backend/src ./src
RUN npm run build || (test -f dist/server.js && echo "TypeScript warnings; dist emitted.")

FROM node:18-alpine3.21

WORKDIR /app

# postgresql17-client: o pg_dump do backupService. O major precisa acompanhar o
# do servidor (Supabase está em PostgreSQL 17) — pg_dump se recusa a dumpar um
# servidor mais novo que ele. Ao subir o Postgres de major, subir aqui também.
RUN apk add --no-cache dumb-init python3 py3-pip tzdata \
    libxml2 libxslt openssl postgresql17-client \
    && apk add --no-cache --virtual .py-build-deps \
    python3-dev gcc musl-dev libffi-dev openssl-dev libxml2-dev libxslt-dev \
    && apk add --no-cache --virtual .node-build-deps python3 make g++

COPY backend/package*.json ./
RUN node -e "const fs=require('fs'); const p=require('./package.json'); if (p.scripts && p.scripts.prepare) delete p.scripts.prepare; fs.writeFileSync('package.json', JSON.stringify(p, null, 2));" \
    && if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi \
    && apk del .node-build-deps

COPY --from=builder /app/dist ./dist
COPY automacao-xml /app/automacao-xml

RUN pip3 install --no-cache-dir --break-system-packages \
    -r /app/automacao-xml/requirements.txt \
    && apk del .py-build-deps

ENV FISCAL_AUTOMATION_DIR=/app/automacao-xml
ENV FISCAL_XML_ROOT=/app/data/fiscal-xmls
ENV FISCAL_CERTS_DIR=/app/data/fiscal-certs
# Dentro de /app/data porque é o mount path do volume persistente (ver
# railway.toml). Fora do volume o backup é apagado no deploy seguinte.
ENV BACKUP_DIR=/app/data/backups
ENV PYTHON_BIN=python3
ENV NODE_ENV=production
# Sem TZ o container roda em UTC: a NF-e emitida depois das 21h (horário de
# Brasília) sai com dhEmi do dia seguinte, e a AAMM da chave de acesso pode
# virar o mês na última noite. O horário fiscal precisa ser o local.
ENV TZ=America/Sao_Paulo

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    mkdir -p /app/data/fiscal-certs /app/data/fiscal-xmls /app/data/backups && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
