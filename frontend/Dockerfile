FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
# Em produção hospedada (Vercel/Railway+nginx) o axios usa same-origin
# (BASE_URL="") e o proxy /api → Railway. Deixe vazio no build PaaS.
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:1.27-alpine

# Railway injeta PORT; default local 8080
ENV PORT=8080
ENV BACKEND_URL=https://contador-api-production.up.railway.app

RUN apk add --no-cache curl

COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080

# Railway healthcheckPath=/ — garante que a porta do env responde
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/" >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
