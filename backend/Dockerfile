# Build context: raiz do repo (automacao-xml/ + backend/)
# Railway: Root Directory = / (vazio) — ver railway.toml na raiz do repo
# Deploy CLI local: cd backend && npm run deploy:railway
FROM node:18-alpine AS builder

WORKDIR /app

COPY backend/package*.json backend/tsconfig.json ./
RUN if [ -f package-lock.json ]; then npm ci --ignore-scripts; else npm install --ignore-scripts; fi

COPY backend/src ./src
RUN npm run build || (test -f dist/server.js && echo "TypeScript warnings; dist emitted.")

FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache dumb-init su-exec python3 py3-pip \
    libxml2 libxslt openssl \
    && apk add --no-cache --virtual .py-build-deps \
    python3-dev gcc musl-dev libffi-dev openssl-dev libxml2-dev libxslt-dev \
    && apk add --no-cache --virtual .node-build-deps python3 make g++

COPY backend/package*.json ./
RUN node -e "const fs=require('fs'); const p=require('./package.json'); if (p.scripts && p.scripts.prepare) delete p.scripts.prepare; fs.writeFileSync('package.json', JSON.stringify(p, null, 2));" \
    && if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi \
    && apk del .node-build-deps

COPY --from=builder /app/dist ./dist
COPY automacao-xml /app/automacao-xml
COPY backend/docker-entrypoint.sh /docker-entrypoint.sh

RUN pip3 install --no-cache-dir --break-system-packages \
    -r /app/automacao-xml/requirements.txt \
    && apk del .py-build-deps \
    && chmod +x /docker-entrypoint.sh

ENV FISCAL_AUTOMATION_DIR=/app/automacao-xml
ENV FISCAL_XML_ROOT=/app/data/fiscal-xmls
ENV FISCAL_CERTS_DIR=/app/data/fiscal-certs
ENV PYTHON_BIN=python3
ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    mkdir -p /app/data/fiscal-certs /app/data/fiscal-xmls && \
    chown -R nodejs:nodejs /app

# Entra como root para corrigir owner do volume Railway em /app/data;
# o entrypoint faz chown e desce para nodejs via su-exec.
USER root

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--", "/docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
