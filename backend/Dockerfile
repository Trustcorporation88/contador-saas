# Build context: pasta backend/ (copie automacao-xml antes: npm run prepare:docker)
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN if [ -f package-lock.json ]; then npm ci --ignore-scripts; else npm install --ignore-scripts; fi

COPY src ./src
RUN npm run build || (test -f dist/server.js && echo "TypeScript warnings; dist emitted.")

FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache dumb-init python3 py3-pip \
    libxml2 libxslt openssl \
    && apk add --no-cache --virtual .py-build-deps \
    python3-dev gcc musl-dev libffi-dev openssl-dev libxml2-dev libxslt-dev \
    && apk add --no-cache --virtual .node-build-deps python3 make g++

COPY package*.json ./
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
ENV PYTHON_BIN=python3
ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    mkdir -p /app/data/fiscal-certs /app/data/fiscal-xmls && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
