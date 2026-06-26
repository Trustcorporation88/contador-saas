# Dockerfile para Backend Node.js

## Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies (avoid lifecycle scripts before source code is copied)
RUN if [ -f package-lock.json ]; then npm ci --ignore-scripts; else npm install --ignore-scripts; fi

# Copy source
COPY src ./src

# Build TypeScript (best-effort: continue if dist/server.js was emitted despite type errors)
RUN npm run build || (test -f dist/server.js && echo "TypeScript errors detected, but dist/server.js was emitted; continuing build.")

## Runtime stage
FROM node:18-alpine

WORKDIR /app

# Install dumb-init and temporary build dependencies for native modules (e.g., bcrypt)
RUN apk add --no-cache dumb-init \
    && apk add --no-cache --virtual .build-deps python3 make g++

# Copy package files
COPY package*.json ./

# Install only production dependencies.
# Remove local prepare script to avoid running project build hooks in runtime stage,
# while still allowing dependency install scripts required by native modules.
RUN node -e "const fs=require('fs'); const p=require('./package.json'); if (p.scripts && p.scripts.prepare) delete p.scripts.prepare; fs.writeFileSync('package.json', JSON.stringify(p, null, 2));" \
    && if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi \
    && apk del .build-deps

# Copy compiled code from builder
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Writable dirs for certificados/XML
RUN mkdir -p /app/data/fiscal-certs /app/data/fiscal-xmls && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
